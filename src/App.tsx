import { useState, useEffect, useCallback, useRef } from 'react';
import CesiumMap from './components/CesiumMap';
import Map from './components/Map';
import LoadingSpinner from './components/LoadingSpinner';
import StatusBar from './components/StatusBar';
import AirportOverlay from './components/AirportOverlay';
import { fetchMETARs } from './services/metarService';
import { AirportMETAR } from './services/metarService';
import { AIRPORTS } from './data/airports';
import { RadarSource } from './types/radar';
import { MapRenderer } from './types/mapRenderer';

// Northeast region coordinates (centered on the region)
const NY_CENTER: [number, number] = [41.5, -73.0];
const NY_ZOOM = 7; // Zoomed out to show entire Northeast region

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

function App() {
  const [airportMETARs, setAirportMETARs] = useState<AirportMETAR[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [windToggleEnabled, setWindToggleEnabled] = useState(true);
  const [showAirportLabels, setShowAirportLabels] = useState(true);
  const [showRadar, setShowRadar] = useState(false);
  const [radarSource, setRadarSource] = useState<RadarSource>(RadarSource.IOWA_NEXRAD_N0Q);
  const [showVfrSectionals, setShowVfrSectionals] = useState(false);
  const [darkenSectionalCharts, setDarkenSectionalCharts] = useState(false);
  const [showSatellite, setShowSatellite] = useState(false);
  const [mapRenderer, setMapRenderer] = useState<MapRenderer>(MapRenderer.LEAFLET);
  const [autoMoveEnabled, setAutoMoveEnabled] = useState(false);
  const lastRefreshTimeRef = useRef<number>(0);

  const loadWeatherData = useCallback(async (isRefresh = false, forceRefresh = false) => {
    // Check if refresh is allowed (only if forced or enough time has passed)
    const now = Date.now();
    const timeSinceLastRefresh = now - lastRefreshTimeRef.current;

    if (isRefresh && !forceRefresh && timeSinceLastRefresh < REFRESH_INTERVAL_MS) {
      return;
    }



    if (isRefresh) {
      setIsRefreshing(true);

    } else {
      setIsLoading(true);

    }
    setError(null);

    try {

      const data = await fetchMETARs(AIRPORTS);


      setAirportMETARs(data);
      setLastUpdate(new Date());
      lastRefreshTimeRef.current = now;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load weather data';

      setError(errorMessage);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);

    }
  }, []);

  // Initial load
  useEffect(() => {

    loadWeatherData();
  }, [loadWeatherData]);

  // Auto-refresh every 5 minutes (force refresh to bypass rate limit)
  useEffect(() => {
    
    const interval = setInterval(() => {
      
      loadWeatherData(true, true); // Force refresh for auto-refresh
    }, REFRESH_INTERVAL_MS);

    return () => {
      
      clearInterval(interval);
    };
  }, [loadWeatherData]);

  useEffect(() => {
    if (mapRenderer !== MapRenderer.CESIUM && autoMoveEnabled) {
      setAutoMoveEnabled(false);
    }
  }, [mapRenderer, autoMoveEnabled]);



  const handleRefreshAirport = async (icao: string) => {
    // Check rate limit before allowing individual airport refresh
    const now = Date.now();
    const timeSinceLastRefresh = now - lastRefreshTimeRef.current;

    if (timeSinceLastRefresh < REFRESH_INTERVAL_MS) {
      return;
    }

    const airport = AIRPORTS.find(a => a.icao === icao);
    if (airport) {
      const { fetchSingleAirport } = await import('./services/metarService');
      const updatedData = await fetchSingleAirport(airport);
      setAirportMETARs(prev => prev.map(am =>
        am.airport.icao === icao ? updatedData : am
      ));
      lastRefreshTimeRef.current = now;
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0, overflow: 'hidden', backgroundColor: '#000000' }}>
      {isLoading && <LoadingSpinner />}
      {error && (
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          backgroundColor: 'rgba(255, 0, 0, 0.8)',
          color: '#ffffff',
          padding: '10px 20px',
          borderRadius: '5px',
          fontFamily: 'Arial, sans-serif'
        }}>
          Error: {error}
        </div>
      )}
      {mapRenderer === MapRenderer.CESIUM ? (
        <CesiumMap
          key={MapRenderer.CESIUM}
          airportMETARs={airportMETARs}
          center={NY_CENTER}
          zoom={NY_ZOOM}
          windToggleEnabled={windToggleEnabled}
          showAirportLabels={showAirportLabels}
          showRadar={showRadar}
          radarSource={radarSource}
          showVfrSectionals={showVfrSectionals}
          darkenSectionalCharts={darkenSectionalCharts}
          showSatellite={showSatellite}
          autoMoveEnabled={autoMoveEnabled}
          onRefreshAirport={handleRefreshAirport}
        />
      ) : (
        <Map
          key={MapRenderer.LEAFLET}
          airportMETARs={airportMETARs}
          center={NY_CENTER}
          zoom={NY_ZOOM}
          windToggleEnabled={windToggleEnabled}
          showAirportLabels={showAirportLabels}
          showRadar={showRadar}
          radarSource={radarSource}
          showVfrSectionals={showVfrSectionals}
          darkenSectionalCharts={darkenSectionalCharts}
          showSatellite={showSatellite}
          onRefreshAirport={handleRefreshAirport}
        />
      )}
      <StatusBar
        lastUpdate={lastUpdate}
        isRefreshing={isRefreshing}
        windToggleEnabled={windToggleEnabled}
        onWindToggleChange={setWindToggleEnabled}
        showAirportLabels={showAirportLabels}
        onShowAirportLabelsChange={setShowAirportLabels}
        showRadar={showRadar}
        onShowRadarChange={setShowRadar}
        radarSource={radarSource}
        onRadarSourceChange={setRadarSource}
        showVfrSectionals={showVfrSectionals}
        onShowVfrSectionalsChange={setShowVfrSectionals}
        darkenSectionalCharts={darkenSectionalCharts}
        onDarkenSectionalChartsChange={setDarkenSectionalCharts}
        mapRenderer={mapRenderer}
        onMapRendererChange={setMapRenderer}
        showSatellite={showSatellite}
        onShowSatelliteChange={setShowSatellite}
        autoMoveEnabled={autoMoveEnabled}
        onAutoMoveChange={setAutoMoveEnabled}
      />
      <AirportOverlay
        airportMETARs={airportMETARs}
        onRefresh={async () => {
          await loadWeatherData(true, false); // Respect rate limit
        }}
      />
    </div>
  );
}

export default App;
