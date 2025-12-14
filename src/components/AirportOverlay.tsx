import { useEffect, useState, useRef, useCallback } from 'react';
import { AirportMETAR, fetchSingleAirport } from '../services/metarService';
import { FlightCategoryColors, FlightCategory } from '../types/flightCategory';
import { getNextTAFCondition, decodeTAFPeriods } from '../utils/tafParser';
import { Airport } from '../types/airport';
import { fetchWeatherForecast, getWeatherIcon, getWeatherDescription } from '../services/weatherService';
import { WeatherForecast } from '../types/weatherForecast';

interface AirportOverlayProps {
  airportMETARs: AirportMETAR[];
  onRefresh?: () => Promise<void>;
}

const STORAGE_KEY = 'favoriteAirportIcao';
const POSITION_STORAGE_KEY = 'airportOverlayPosition';
const TEMP_UNIT_STORAGE_KEY = 'temperatureUnit';

export default function AirportOverlay({ airportMETARs, onRefresh }: AirportOverlayProps) {
  const [favoriteIcao, setFavoriteIcao] = useState<string>(() => {
    // Load from localStorage on mount
    return localStorage.getItem(STORAGE_KEY) || '';
  });
  const [editingIcao, setEditingIcao] = useState(false);
  const [inputIcao, setInputIcao] = useState('');
  const [airportData, setAirportData] = useState<AirportMETAR | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weatherForecast, setWeatherForecast] = useState<WeatherForecast[] | null>(null);
  const [isLoadingForecast, setIsLoadingForecast] = useState(false);
  const [temperatureUnit, setTemperatureUnit] = useState<'C' | 'F'>(() => {
    // Load from localStorage on mount, default to F
    return (localStorage.getItem(TEMP_UNIT_STORAGE_KEY) as 'C' | 'F') || 'F';
  });
  const [selectedForecast, setSelectedForecast] = useState<WeatherForecast | null>(null);

  // Position state for dragging
  const [position, setPosition] = useState<{ top: number; left: number }>(() => {
    // Load position from localStorage or use default
    const saved = localStorage.getItem(POSITION_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { top: parsed.top || 80, left: parsed.left || window.innerWidth - 500 };
      } catch {
        // Fallback to default if parse fails
      }
    }
    // Default position: bottom right (converted to top/left)
    return { top: window.innerHeight - 400, left: window.innerWidth - 500 };
  });

  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const overlayRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef(position);

  // Keep positionRef in sync with position state
  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  // Load weather forecast
  const loadForecast = useCallback(async (latitude: number, longitude: number) => {
    if (!latitude || !longitude) return;

    setIsLoadingForecast(true);
    try {
      const forecast = await fetchWeatherForecast(latitude, longitude, temperatureUnit);
      setWeatherForecast(forecast.forecasts);
    } catch (err) {

      setWeatherForecast(null);
    } finally {
      setIsLoadingForecast(false);
    }
  }, [temperatureUnit]);

  // Load airport data when favoriteIcao changes
  useEffect(() => {
    if (!favoriteIcao) {
      setAirportData(null);
      setWeatherForecast(null);
      return;
    }

    // First try to find in existing airportMETARs
    const existingData = airportMETARs.find(am => am.airport.icao.toUpperCase() === favoriteIcao.toUpperCase());
    if (existingData) {
      setAirportData(existingData);
      setError(null);
      // Load forecast for this airport
      loadForecast(existingData.airport.latitude, existingData.airport.longitude);
      return;
    }

    // If not found, fetch it
    setIsLoading(true);
    setError(null);
    const airport: Airport = {
      icao: favoriteIcao.toUpperCase(),
      name: favoriteIcao.toUpperCase(), // Will be updated if fetch succeeds
      latitude: 0,
      longitude: 0
    };

    fetchSingleAirport(airport)
      .then(data => {
        setAirportData(data);
        setError(null);
        // Load forecast for this airport
        if (data.airport.latitude && data.airport.longitude) {
          loadForecast(data.airport.latitude, data.airport.longitude);
        }
      })
      .catch(err => {

        setError('Failed to load airport data');
        setAirportData(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [favoriteIcao, airportMETARs, loadForecast]);

  // Update airport data when airportMETARs changes (in case the favorite airport is in the list)
  useEffect(() => {
    if (favoriteIcao) {
      const existingData = airportMETARs.find(am => am.airport.icao.toUpperCase() === favoriteIcao.toUpperCase());
      if (existingData) {
        setAirportData(existingData);
        setError(null);
        // Load forecast if not already loaded
        if (!weatherForecast && existingData.airport.latitude && existingData.airport.longitude) {
          loadForecast(existingData.airport.latitude, existingData.airport.longitude);
        }
      }
    }
  }, [airportMETARs, favoriteIcao, weatherForecast, loadForecast]);

  const handleSetIcao = () => {
    const icao = inputIcao.trim().toUpperCase();
    if (icao.length >= 3 && icao.length <= 4) {
      setFavoriteIcao(icao);
      localStorage.setItem(STORAGE_KEY, icao);
      setEditingIcao(false);
      setInputIcao('');
    }
  };

  const handleChangeIcao = () => {
    setInputIcao(favoriteIcao);
    setEditingIcao(true);
  };

  const handleCancelEdit = () => {
    setEditingIcao(false);
    setInputIcao('');
  };

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Don't start dragging if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'BUTTON' || target.closest('button') || target.closest('input')) {
      return;
    }

    if (overlayRef.current) {
      const rect = overlayRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      setIsDragging(true);
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && overlayRef.current) {
        const newLeft = e.clientX - dragOffset.x;
        const newTop = e.clientY - dragOffset.y;

        // Constrain to viewport bounds
        const maxLeft = window.innerWidth - overlayRef.current.offsetWidth;
        const maxTop = window.innerHeight - overlayRef.current.offsetHeight;

        const constrainedPosition = {
          left: Math.max(0, Math.min(newLeft, maxLeft)),
          top: Math.max(0, Math.min(newTop, maxTop))
        };

        setPosition(constrainedPosition);
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        // Save position to localStorage
        localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(positionRef.current));
      }
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  // Validate and constrain position on mount and when window resizes
  useEffect(() => {
    const validatePosition = () => {
      if (overlayRef.current) {
        const maxLeft = window.innerWidth - overlayRef.current.offsetWidth;
        const maxTop = window.innerHeight - overlayRef.current.offsetHeight;
        setPosition(prev => {
          const constrained = {
            left: Math.max(0, Math.min(prev.left, maxLeft)),
            top: Math.max(0, Math.min(prev.top, maxTop))
          };
          // Save constrained position if it changed
          if (constrained.left !== prev.left || constrained.top !== prev.top) {
            localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(constrained));
          }
          return constrained;
        });
      }
    };

    // Validate on mount (after first render)
    const timeoutId = setTimeout(validatePosition, 0);

    // Validate on resize
    window.addEventListener('resize', validatePosition);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', validatePosition);
    };
  }, []);

  // Helper function to determine if it's windy and get wind conditions text
  const getWindConditions = () => {
    if (!airportData?.metar) return null;

    const windSpeed = airportData.metar.wspd || airportData.metar.windSpeedKt || 0;
    const windDir = airportData.metar.wdir || airportData.metar.windDirDegrees;
    const windGust = airportData.metar.wgst || (airportData.metar as any)?.windGustKt || 0;
    const maxWind = Math.max(windSpeed, windGust);

    // Consider it windy if wind speed (including gusts) is >= 15 knots
    if (maxWind >= 15) {
      let windText = '';
      if (windGust > 0 && windGust >= 15) {
        windText = `${Math.round(windSpeed)}G${Math.round(windGust)}KT`;
      } else if (windDir !== undefined && windDir !== null) {
        windText = `${Math.round(windDir)}°@${Math.round(windSpeed)}KT`;
      } else {
        windText = `${Math.round(windSpeed)}KT`;
      }
      return windText;
    }
    return null;
  };

  // Format date for display
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }
  };

  // Format date for square items (shorter format)
  const formatDateShort = (dateString: string): string => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tmrw';
    } else {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    }
  };

  // Convert km/h to knots
  const kmhToKnots = (kmh: number): number => {
    return Math.round(kmh * 0.539957);
  };

  // Format wind for display - use average wind speeds for more realistic values
  const formatWind = (forecast: WeatherForecast): string => {
    // Use average wind speeds instead of max for more realistic display
    const windSpeedKmh = forecast.windSpeedAvg || forecast.windSpeedMax || 0;
    const windGustKmh = forecast.windGustAvg || forecast.windGustMax || 0;
    
    if (windSpeedKmh === 0) return 'CALM';
    const knots = kmhToKnots(windSpeedKmh);
    const gustKnots = windGustKmh > 0 ? kmhToKnots(windGustKmh) : 0;

    // Only show gusts if they're >= 10 knots and exceed base wind speed
    if (gustKnots >= 10 && gustKnots > knots) {
      return `${knots}G${gustKnots}KT`;
    }
    return `${knots}KT`;
  };


  // Show input form if no airport is set or if editing
  if (!favoriteIcao || editingIcao) {
    return (
      <div
        ref={overlayRef}
        onMouseDown={handleMouseDown}
        style={{
          position: 'fixed',
          top: `${position.top}px`,
          left: `${position.left}px`,
          backgroundColor: 'rgba(26, 26, 26, 0.9)',
          border: '1px solid #444',
          borderRadius: '8px',
          padding: '16px',
          width: 'fit-content',
          minWidth: '300px',
          color: '#ffffff',
          fontFamily: 'Arial, sans-serif',
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none'
        }}
      >
        <div style={{ marginBottom: '12px' }}>
          <strong style={{ fontSize: '20px' }}>Favorite Airport</strong>
          <div style={{ fontSize: '14px', color: '#cccccc', marginTop: '4px' }}>
            {editingIcao ? 'Change ICAO code' : 'Enter an ICAO code to monitor'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="text"
            value={inputIcao}
            onChange={(e) => setInputIcao(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSetIcao();
              } else if (e.key === 'Escape') {
                handleCancelEdit();
              }
            }}
            placeholder="e.g., KBDR"
            maxLength={4}
            style={{
              flex: 1,
              backgroundColor: '#333',
              color: '#ffffff',
              border: '1px solid #555',
              borderRadius: '4px',
              padding: '8px',
              fontSize: '16px',
              fontFamily: 'monospace',
              textTransform: 'uppercase'
            }}
            autoFocus
          />
          <button
            onClick={handleSetIcao}
            disabled={inputIcao.trim().length < 3}
            style={{
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '8px 16px',
              cursor: inputIcao.trim().length < 3 ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              opacity: inputIcao.trim().length < 3 ? 0.5 : 1
            }}
          >
            Set
          </button>
          {editingIcao && (
            <button
              onClick={handleCancelEdit}
              style={{
                backgroundColor: '#666',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '8px 16px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    );
  }

  // Show loading state
  if (isLoading) {
    return (
      <div
        ref={overlayRef}
        onMouseDown={handleMouseDown}
        style={{
          position: 'fixed',
          top: `${position.top}px`,
          left: `${position.left}px`,
          backgroundColor: 'rgba(26, 26, 26, 0.9)',
          border: '1px solid #444',
          borderRadius: '8px',
          padding: '16px',
          width: 'fit-content',
          minWidth: '300px',
          color: '#ffffff',
          fontFamily: 'Arial, sans-serif',
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none'
        }}
      >
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <div>Loading {favoriteIcao}...</div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error && !airportData) {
    return (
      <div
        ref={overlayRef}
        onMouseDown={handleMouseDown}
        style={{
          position: 'fixed',
          top: `${position.top}px`,
          left: `${position.left}px`,
          backgroundColor: 'rgba(26, 26, 26, 0.9)',
          border: '1px solid #444',
          borderRadius: '8px',
          padding: '16px',
          width: 'fit-content',
          minWidth: '300px',
          color: '#ffffff',
          fontFamily: 'Arial, sans-serif',
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none'
        }}
      >
        <div style={{ marginBottom: '12px' }}>
          <strong style={{ fontSize: '20px' }}>{favoriteIcao}</strong>
          <div style={{ fontSize: '14px', color: '#ff4444', marginTop: '4px' }}>{error}</div>
        </div>
        <button
          onClick={handleChangeIcao}
          style={{
            backgroundColor: '#333',
            color: 'white',
            border: '1px solid #555',
            borderRadius: '4px',
            padding: '6px 12px',
            cursor: 'pointer',
            fontSize: '14px',
            width: '100%'
          }}
        >
          Change Airport
        </button>
      </div>
    );
  }

  // Show airport data
  if (!airportData) {
    return null;
  }

  const metarCategory = airportData.flightCategory;
  const metarColor = FlightCategoryColors[metarCategory] || FlightCategoryColors.UNKNOWN;
  const tafCategory = airportData.taf ? getNextTAFCondition(airportData.taf) : null;
  const tafColor = tafCategory ? FlightCategoryColors[tafCategory] : '#808080';

  // Calculate dot sizes (same as map)
  const getDotSizes = (category: FlightCategory) => {
    const isVFR = category === FlightCategory.VFR;
    const isMVFR = category === FlightCategory.MVFR;
    const isUnknown = category === FlightCategory.UNKNOWN;
    let outerRadius = 2;
    let coreRadius = 1;

    if (isVFR) {
      outerRadius = 1.485; // 10% bigger (1.35 * 1.1)
      coreRadius = 0.7425; // 10% bigger (0.675 * 1.1)
    } else if (isMVFR) {
      outerRadius = 2.5; // 25% larger
      coreRadius = 1.25;
    } else if (isUnknown) {
      outerRadius = 1; // Half size
      coreRadius = 0.5;
    }

    return { outerRadius, coreRadius };
  };

  const metarSizes = getDotSizes(metarCategory);
  const tafSizes = tafCategory ? getDotSizes(tafCategory) : { outerRadius: 1, coreRadius: 0.5 };

  // Check for high wind gusts
  const windGust = airportData.metar?.wgst || (airportData.metar as any)?.windGustKt;
  const hasHighGusts = windGust !== undefined && windGust >= 17;

  const metarText = airportData.metar?.rawOb || airportData.metar?.rawText || 'No METAR available';
  const tafText = airportData.taf?.rawTAF || airportData.taf?.rawOb || airportData.taf?.rawText || 'No TAF available';
  const windConditions = getWindConditions();
  const decodedTAFPeriods = airportData.taf ? decodeTAFPeriods(airportData.taf) : [];

  // Get wind color based on wind speed
  const getWindColor = () => {
    if (!airportData?.metar) return '#888888';
    const windSpeed = airportData.metar.wspd || airportData.metar.windSpeedKt || 0;
    const windGust = airportData.metar.wgst || (airportData.metar as any)?.windGustKt || 0;
    const maxWind = Math.max(windSpeed, windGust);

    if (maxWind > 40) return '#FF00FF'; // Magenta
    if (maxWind > 30) return '#FF0000'; // Red
    if (maxWind > 20) return '#FF8000'; // Orange
    if (maxWind > 15) return '#0080FF'; // Blue
    return '#00FF00'; // Green
  };

  return (
    <div
      ref={overlayRef}
      onMouseDown={handleMouseDown}
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        backgroundColor: 'rgba(26, 26, 26, 0.9)',
        border: '1px solid #444',
        borderRadius: '8px',
        padding: '16px',
        width: weatherForecast && weatherForecast.length > 0 ? '593px' : 'fit-content',
        minWidth: '300px',
        color: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        zIndex: 1000,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none'
      }}
    >
      <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <strong style={{ fontSize: '20px' }}>{favoriteIcao}</strong>
            <button
              onClick={handleChangeIcao}
              style={{
                backgroundColor: 'transparent',
                color: '#888',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                padding: '2px 6px',
                borderRadius: '3px'
              }}
              title="Change airport"
            >
              ✏️
            </button>
          </div>
          <button
            onClick={() => {
              const newUnit = temperatureUnit === 'F' ? 'C' : 'F';
              setTemperatureUnit(newUnit);
              localStorage.setItem(TEMP_UNIT_STORAGE_KEY, newUnit);
              // Reload forecast with new unit if we have airport data
              if (airportData && airportData.airport.latitude && airportData.airport.longitude) {
                loadForecast(airportData.airport.latitude, airportData.airport.longitude);
              }
            }}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              color: '#ffffff',
              border: '1px solid #555',
              cursor: 'pointer',
              fontSize: '12px',
              padding: '4px 8px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontWeight: 'bold'
            }}
            title={`Switch to ${temperatureUnit === 'F' ? 'Celsius' : 'Fahrenheit'}`}
          >
            <span style={{ opacity: temperatureUnit === 'F' ? 1 : 0.5 }}>°F</span>
            <span style={{ margin: '0 2px' }}>/</span>
            <span style={{ opacity: temperatureUnit === 'C' ? 1 : 0.5 }}>°C</span>
          </button>
        </div>
        <div style={{ fontSize: '14px', color: '#cccccc' }}>
          {airportData.airport.name !== favoriteIcao ? airportData.airport.name : 'Airport'}
        </div>
      </div>

      {error && (
        <div style={{ fontSize: '13px', color: '#ff4444', marginBottom: '8px' }}>{error}</div>
      )}

      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold' }}>METAR:</div>
          <div
            style={{
              position: 'relative',
              width: `${metarSizes.outerRadius * 2 * 6}px`,
              height: `${metarSizes.outerRadius * 2 * 6}px`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {/* Outer colored circle with glow */}
            <div
              className={hasHighGusts ? 'airport-marker-gust' : ''}
              style={{
                position: 'absolute',
                width: `${metarSizes.outerRadius * 6}px`,
                height: `${metarSizes.outerRadius * 6}px`,
                borderRadius: '50%',
                backgroundColor: metarColor,
                border: `0.5px solid ${metarColor}`,
                filter: `drop-shadow(0 0 1.5px ${metarColor}) drop-shadow(0 0 3px ${metarColor}) drop-shadow(0 0 4px ${metarColor})`,
                transition: 'filter 0.2s ease, opacity 0.5s ease'
              }}
            />
            {/* Bright white center core */}
            <div
              className={hasHighGusts ? 'airport-marker-gust' : ''}
              style={{
                position: 'absolute',
                width: `${metarSizes.coreRadius * 6}px`,
                height: `${metarSizes.coreRadius * 6}px`,
                borderRadius: '50%',
                backgroundColor: '#ffffff',
                filter: 'drop-shadow(0 0 1px rgba(255, 255, 255, 0.9)) drop-shadow(0 0 2px rgba(255, 255, 255, 0.6))'
              }}
            />
          </div>
          <div style={{ fontSize: '14px', color: metarColor, fontWeight: 'bold' }}>{metarCategory}</div>
          {windConditions && (
            <div style={{
              fontSize: '12px',
              color: getWindColor(),
              fontWeight: 'normal',
              marginLeft: '8px',
              textShadow: `0 0 2px ${getWindColor()}, 0 0 4px ${getWindColor()}`
            }}>
              {windConditions}
            </div>
          )}
        </div>

        {tafCategory && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold' }}>TAF:</div>
            <div
              style={{
                position: 'relative',
                width: `${tafSizes.outerRadius * 2 * 6}px`,
                height: `${tafSizes.outerRadius * 2 * 6}px`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {/* Outer colored circle with glow */}
              <div
                style={{
                  position: 'absolute',
                  width: `${tafSizes.outerRadius * 6}px`,
                  height: `${tafSizes.outerRadius * 6}px`,
                  borderRadius: '50%',
                  backgroundColor: tafColor,
                  border: `0.5px solid ${tafColor}`,
                  filter: `drop-shadow(0 0 1.5px ${tafColor}) drop-shadow(0 0 3px ${tafColor}) drop-shadow(0 0 4px ${tafColor})`,
                  transition: 'filter 0.2s ease, opacity 0.5s ease'
                }}
              />
              {/* Bright white center core */}
              <div
                style={{
                  position: 'absolute',
                  width: `${tafSizes.coreRadius * 6}px`,
                  height: `${tafSizes.coreRadius * 6}px`,
                  borderRadius: '50%',
                  backgroundColor: '#ffffff',
                  filter: 'drop-shadow(0 0 1px rgba(255, 255, 255, 0.9)) drop-shadow(0 0 2px rgba(255, 255, 255, 0.6))'
                }}
              />
            </div>
            <div style={{ fontSize: '14px', color: tafColor, fontWeight: 'bold' }}>{tafCategory}</div>
          </div>
        )}
      </div>

      <div style={{ fontSize: '13px', color: '#aaaaaa', fontFamily: 'monospace', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #444', maxWidth: '567px', wordBreak: 'break-word' }}>
        <div style={{ marginBottom: '8px' }}>
          <strong style={{ color: '#ffffff', fontSize: '14px' }}>METAR:</strong><br />
          {metarText}
        </div>
        {airportData.taf && (
          <div>
            <strong style={{ color: '#ffffff', fontSize: '14px' }}>TAF:</strong><br />
            {tafText}
          </div>
        )}
      </div>

      {/* Decoded TAF Forecast */}
      {decodedTAFPeriods.length > 0 && (
        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #444' }}>
          <div style={{ fontSize: '11px', color: '#888', fontFamily: 'monospace', marginBottom: '6px' }}>
            TAF FORECAST
          </div>
          {decodedTAFPeriods.map((period, index) => {
            const periodColor = period.flightCategory 
              ? FlightCategoryColors[period.flightCategory] 
              : '#888888';
            
            // Compact time format: "Dec 11 03:00-06:00"
            const formatCompactTime = (date: Date) => {
              const month = date.toLocaleString('en-US', { month: 'short' });
              const day = date.getDate();
              const hours = date.getHours().toString().padStart(2, '0');
              const minutes = date.getMinutes().toString().padStart(2, '0');
              return { month, day, time: `${hours}:${minutes}` };
            };
            
            const from = formatCompactTime(period.validTimeFrom);
            const to = formatCompactTime(period.validTimeTo);
            const timeRange = from.day === to.day 
              ? `${from.month} ${from.day} ${from.time}-${to.time}`
              : `${from.month} ${from.day} ${from.time} - ${to.month} ${to.day} ${to.time}`;

            // Determine status (current, future, past)
            const now = new Date();
            const isCurrent = now >= period.validTimeFrom && now <= period.validTimeTo;
            const isFuture = now < period.validTimeFrom;
            
            let statusText = '';
            let statusColor = '#888';
            
            if (isCurrent) {
              statusText = 'CURRENT';
              statusColor = '#00FF00'; // Green for current
            } else if (isFuture) {
              const diffMs = period.validTimeFrom.getTime() - now.getTime();
              const diffHrs = Math.floor(diffMs / 3600000);
              const diffMins = Math.floor((diffMs % 3600000) / 60000);
              
              if (diffHrs > 0) {
                statusText = `in ${diffHrs}h ${diffMins}m`;
              } else {
                statusText = `in ${diffMins}m`;
              }
              statusColor = '#4A9EFF'; // Blue for future
            }

            return (
              <div
                key={index}
                style={{
                  marginTop: index > 0 ? '2px' : '0',
                  padding: '4px 6px',
                  backgroundColor: index % 2 === 0 ? '#1a1a1a' : '#222',
                  borderLeft: `3px solid ${periodColor}`,
                  fontFamily: 'monospace',
                  fontSize: '10px',
                  lineHeight: '1.4'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{ 
                      color: periodColor, 
                      fontWeight: 'bold', 
                      fontSize: '11px',
                      minWidth: '40px'
                    }}>
                      {period.flightCategory || 'UNK'}
                    </span>
                    <span style={{ color: '#888', fontSize: '10px' }}>{timeRange}</span>
                  </div>
                  {statusText && (
                    <span style={{ 
                      color: statusColor, 
                      fontWeight: 'bold', 
                      fontSize: '10px',
                      border: `1px solid ${statusColor}`,
                      padding: '0 3px',
                      borderRadius: '3px',
                      marginLeft: '8px'
                    }}>
                      {statusText}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {period.visibilityMi !== undefined && (
                    <span style={{ backgroundColor: '#2a2a2a', padding: '1px 4px', borderRadius: '3px', color: '#ccc' }}>
                      {period.visibilityMi.toFixed(1)}SM
                    </span>
                  )}
                  {period.ceilingFt !== undefined && (
                    <span style={{ backgroundColor: '#2a2a2a', padding: '1px 4px', borderRadius: '3px', color: '#ccc' }}>
                      {period.ceilingFt}FT
                    </span>
                  )}
                  {period.windSpeed !== undefined && (
                    <span style={{ backgroundColor: '#2a2a2a', padding: '1px 4px', borderRadius: '3px', color: '#ccc' }}>
                      {period.windDir !== undefined ? `${period.windDir.toString().padStart(3, '0')}°` : 'VRB'}@{period.windSpeed}KT
                      {period.windGust ? `G${period.windGust}` : ''}
                    </span>
                  )}
                  {period.clouds && period.clouds.length > 0 && period.clouds.map((cloud, i) => (
                    <span key={`cloud-${i}`} style={{ backgroundColor: '#2a2a2a', padding: '1px 4px', borderRadius: '3px', color: '#ccc' }}>
                      {cloud}
                    </span>
                  ))}
                  {period.weather && period.weather.length > 0 && period.weather.map((wx, i) => (
                    <span key={`wx-${i}`} style={{ backgroundColor: '#2a2a2a', padding: '1px 4px', borderRadius: '3px', color: '#ccc' }}>
                      {wx}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 7-Day Weather Forecast */}
      {weatherForecast && weatherForecast.length > 0 && (
        <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #444', width: 'fit-content' }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#ffffff' }}>
            7-Day Forecast
          </div>
          <div style={{ display: 'flex', flexDirection: 'row', gap: '6px', paddingBottom: '4px' }}>
            {weatherForecast.map((forecast, index) => {
              const forecastDate = new Date(forecast.date);
              const today = new Date();
              const isToday = forecastDate.toDateString() === today.toDateString();

              return (
                <div
                  key={index}
                  onClick={() => setSelectedForecast(forecast)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    padding: '8px 10px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '6px',
                    fontSize: '12px',
                    minWidth: '75px',
                    width: '75px',
                    minHeight: '90px',
                    height: 'auto',
                    flexShrink: 0,
                    border: isToday ? '2px solid #4A9EFF' : 'none',
                    boxShadow: isToday ? '0 0 8px rgba(74, 158, 255, 0.5)' : 'none',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease, transform 0.1s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.transform = 'scale(1.02)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  <div style={{ fontSize: '28px', marginBottom: '3px' }}>
                    {getWeatherIcon(forecast.weatherCode)}
                  </div>
                  <div style={{ fontSize: '10px', color: '#ffffff', fontWeight: 'bold', marginBottom: '3px', textAlign: 'center', lineHeight: '1.2' }}>
                    {formatDateShort(forecast.date)}
                  </div>
                  <div style={{ fontSize: '13px', color: '#ffffff', fontWeight: 'bold', marginBottom: '2px' }}>
                    {forecast.temperatureMax}°{temperatureUnit}
                  </div>
                  <div style={{ fontSize: '10px', color: '#aaaaaa', marginBottom: '2px' }}>
                    {forecast.temperatureMin}°{temperatureUnit}
                  </div>
                  <div style={{ fontSize: '9px', color: '#888888', marginBottom: forecast.precipitationProbability > 0 ? '2px' : '0' }}>
                    {formatWind(forecast)}
                  </div>
                  {forecast.precipitationProbability > 0 && (
                    <div style={{ color: '#4A9EFF', fontSize: '9px', marginTop: 'auto' }}>
                      {forecast.precipitationProbability}%
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isLoadingForecast && (
        <div style={{ fontSize: '12px', color: '#aaaaaa', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #444' }}>
          Loading forecast...
        </div>
      )}

      {/* Weather Forecast Popup */}
      {selectedForecast && (
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(26, 26, 26, 0.95)',
            border: '1px solid #444',
            borderRadius: '8px',
            padding: '20px',
            minWidth: '400px',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflowY: 'auto',
            color: '#ffffff',
            fontFamily: 'Arial, sans-serif',
            zIndex: 2000,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.7)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
              {formatDate(selectedForecast.date)} - Raw Weather Data
            </h2>
            <button
              onClick={() => setSelectedForecast(null)}
              style={{
                backgroundColor: 'transparent',
                color: '#ffffff',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                padding: '0',
                width: '30px',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4px',
                transition: 'background-color 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              ×
            </button>
          </div>

          <div style={{ fontSize: '14px', lineHeight: '1.8' }}>
            <div style={{ marginBottom: '12px' }}>
              <strong style={{ color: '#4A9EFF' }}>Weather:</strong>
              <div style={{ marginLeft: '12px', marginTop: '4px' }}>
                <span style={{ fontSize: '32px', marginRight: '8px' }}>{getWeatherIcon(selectedForecast.weatherCode)}</span>
                <span>{getWeatherDescription(selectedForecast.weatherCode)}</span>
                <span style={{ color: '#888', marginLeft: '8px' }}>(Code: {selectedForecast.weatherCode})</span>
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <strong style={{ color: '#4A9EFF' }}>Temperature:</strong>
              <div style={{ marginLeft: '12px', marginTop: '4px' }}>
                High: {selectedForecast.temperatureMax}°{temperatureUnit}<br />
                Low: {selectedForecast.temperatureMin}°{temperatureUnit}
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <strong style={{ color: '#4A9EFF' }}>Wind:</strong>
              <div style={{ marginLeft: '12px', marginTop: '4px', fontFamily: 'monospace' }}>
                <div>Direction: {selectedForecast.windDirection}°</div>
                <div>Speed (Avg): {kmhToKnots(selectedForecast.windSpeedAvg || selectedForecast.windSpeedMax).toFixed(1)} kt ({selectedForecast.windSpeedAvg || selectedForecast.windSpeedMax} km/h)</div>
                <div>Speed (Max): {kmhToKnots(selectedForecast.windSpeedMax).toFixed(1)} kt ({selectedForecast.windSpeedMax} km/h)</div>
                {selectedForecast.windGustAvg > 0 && (
                  <>
                    <div>Gusts (Avg): {kmhToKnots(selectedForecast.windGustAvg).toFixed(1)} kt ({selectedForecast.windGustAvg} km/h)</div>
                    <div>Gusts (Max): {kmhToKnots(selectedForecast.windGustMax).toFixed(1)} kt ({selectedForecast.windGustMax} km/h)</div>
                  </>
                )}
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <strong style={{ color: '#4A9EFF' }}>Precipitation:</strong>
              <div style={{ marginLeft: '12px', marginTop: '4px' }}>
                Probability: {selectedForecast.precipitationProbability}%
              </div>
            </div>

            {selectedForecast.rawData && (
              <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #444' }}>
                <strong style={{ color: '#4A9EFF' }}>Raw API Data:</strong>
                <pre style={{
                  marginTop: '8px',
                  padding: '12px',
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  overflowX: 'auto',
                  color: '#cccccc',
                  lineHeight: '1.6',
                }}>
                  {JSON.stringify(selectedForecast.rawData, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Backdrop for popup */}
      {selectedForecast && (
        <div
          onClick={() => setSelectedForecast(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1999,
          }}
        />
      )}
    </div>
  );
}

