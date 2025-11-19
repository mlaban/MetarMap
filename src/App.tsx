import { useState, useEffect, useCallback, useRef } from 'react';
import CesiumMap from './components/CesiumMap';
import LoadingSpinner from './components/LoadingSpinner';
import StatusBar from './components/StatusBar';
import AirportOverlay from './components/AirportOverlay';
import { fetchMETARs } from './services/metarService';
import { AirportMETAR } from './services/metarService';
import { FlightCategory } from './types/flightCategory';
import { AIRPORTS } from './data/airports';

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
  const [showSatellite, setShowSatellite] = useState(false);
  const [autoMoveEnabled, setAutoMoveEnabled] = useState(false);
  const lastRefreshTimeRef = useRef<number>(0);

  const loadWeatherData = useCallback(async (isRefresh = false, forceRefresh = false) => {
    // Check if refresh is allowed (only if forced or enough time has passed)
    const now = Date.now();
    const timeSinceLastRefresh = now - lastRefreshTimeRef.current;

    if (isRefresh && !forceRefresh && timeSinceLastRefresh < REFRESH_INTERVAL_MS) {
      const remainingSeconds = Math.ceil((REFRESH_INTERVAL_MS - timeSinceLastRefresh) / 1000);

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
      <CesiumMap
        airportMETARs={airportMETARs}
        center={NY_CENTER}
        zoom={NY_ZOOM}
        windToggleEnabled={windToggleEnabled}
        showAirportLabels={showAirportLabels}
        showRadar={showRadar}
        showSatellite={showSatellite}
        autoMoveEnabled={autoMoveEnabled}
        onRefreshAirport={async (icao: string) => {
          // Check rate limit before allowing individual airport refresh
          const now = Date.now();
          const timeSinceLastRefresh = now - lastRefreshTimeRef.current;

          if (timeSinceLastRefresh < REFRESH_INTERVAL_MS) {
            const remainingSeconds = Math.ceil((REFRESH_INTERVAL_MS - timeSinceLastRefresh) / 1000);

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
        }}
      />
      <StatusBar
        lastUpdate={lastUpdate}
        isRefreshing={isRefreshing}
        windToggleEnabled={windToggleEnabled}
        onWindToggleChange={setWindToggleEnabled}
        showAirportLabels={showAirportLabels}
        onShowAirportLabelsChange={setShowAirportLabels}
        showRadar={showRadar}
        onShowRadarChange={setShowRadar}
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
