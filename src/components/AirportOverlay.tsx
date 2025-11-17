import { useEffect, useState } from 'react';
import { AirportMETAR, fetchSingleAirport } from '../services/metarService';
import { FlightCategoryColors, FlightCategory } from '../types/flightCategory';
import { getNextTAFCondition } from '../utils/tafParser';
import { Airport } from '../types/airport';

interface AirportOverlayProps {
  airportMETARs: AirportMETAR[];
  onRefresh?: () => Promise<void>;
}

const STORAGE_KEY = 'favoriteAirportIcao';

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

  // Load airport data when favoriteIcao changes
  useEffect(() => {
    if (!favoriteIcao) {
      setAirportData(null);
      return;
    }

    // First try to find in existing airportMETARs
    const existingData = airportMETARs.find(am => am.airport.icao.toUpperCase() === favoriteIcao.toUpperCase());
    if (existingData) {
      setAirportData(existingData);
      setError(null);
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
      })
      .catch(err => {
        console.error('[Airport Overlay] Error fetching airport:', err);
        setError('Failed to load airport data');
        setAirportData(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [favoriteIcao, airportMETARs]);

  // Update airport data when airportMETARs changes (in case the favorite airport is in the list)
  useEffect(() => {
    if (favoriteIcao) {
      const existingData = airportMETARs.find(am => am.airport.icao.toUpperCase() === favoriteIcao.toUpperCase());
      if (existingData) {
        setAirportData(existingData);
        setError(null);
      }
    }
  }, [airportMETARs, favoriteIcao]);

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


  // Show input form if no airport is set or if editing
  if (!favoriteIcao || editingIcao) {
    return (
      <div
        style={{
          position: 'absolute',
          bottom: '80px',
          right: '20px',
          backgroundColor: 'rgba(26, 26, 26, 0.9)',
          border: '1px solid #444',
          borderRadius: '8px',
          padding: '16px',
          minWidth: '300px',
          maxWidth: '400px',
          color: '#ffffff',
          fontFamily: 'Arial, sans-serif',
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)'
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
        style={{
          position: 'absolute',
          bottom: '80px',
          right: '20px',
          backgroundColor: 'rgba(26, 26, 26, 0.9)',
          border: '1px solid #444',
          borderRadius: '8px',
          padding: '16px',
          minWidth: '300px',
          maxWidth: '400px',
          color: '#ffffff',
          fontFamily: 'Arial, sans-serif',
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)'
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
        style={{
          position: 'absolute',
          bottom: '80px',
          right: '20px',
          backgroundColor: 'rgba(26, 26, 26, 0.9)',
          border: '1px solid #444',
          borderRadius: '8px',
          padding: '16px',
          minWidth: '300px',
          maxWidth: '400px',
          color: '#ffffff',
          fontFamily: 'Arial, sans-serif',
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)'
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

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '80px',
        right: '20px',
        backgroundColor: 'rgba(26, 26, 26, 0.9)',
        border: '1px solid #444',
        borderRadius: '8px',
        padding: '16px',
        minWidth: '300px',
        maxWidth: '400px',
        color: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        zIndex: 1000,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)'
      }}
    >
      <div style={{ marginBottom: '12px' }}>
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

      <div style={{ fontSize: '13px', color: '#aaaaaa', fontFamily: 'monospace', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #444' }}>
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
    </div>
  );
}

