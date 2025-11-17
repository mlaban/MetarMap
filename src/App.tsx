import { useState, useEffect, useCallback, useRef } from 'react';
import Map from './components/Map';
import LoadingSpinner from './components/LoadingSpinner';
import StatusBar from './components/StatusBar';
import AirportOverlay from './components/AirportOverlay';
import { fetchMETARs } from './services/metarService';
import { AirportMETAR } from './services/metarService';
import { FlightCategory } from './types/flightCategory';
import { NY_AREA_AIRPORTS } from './data/airports';

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
  const lastRefreshTimeRef = useRef<number>(0);

  const loadWeatherData = useCallback(async (isRefresh = false, forceRefresh = false) => {
    // Check if refresh is allowed (only if forced or enough time has passed)
    const now = Date.now();
    const timeSinceLastRefresh = now - lastRefreshTimeRef.current;
    
    if (isRefresh && !forceRefresh && timeSinceLastRefresh < REFRESH_INTERVAL_MS) {
      const remainingSeconds = Math.ceil((REFRESH_INTERVAL_MS - timeSinceLastRefresh) / 1000);
      console.log(`[App] Refresh rate limited. Please wait ${remainingSeconds} more seconds.`);
      return;
    }

    console.log('[App] loadWeatherData called, isRefresh:', isRefresh, 'forceRefresh:', forceRefresh);
    console.log('[App] Number of airports to fetch:', NY_AREA_AIRPORTS.length);
    console.log('[App] Airport list:', NY_AREA_AIRPORTS.map(a => a.icao));
    
    if (isRefresh) {
      setIsRefreshing(true);
      console.log('[App] Setting isRefreshing to true');
    } else {
      setIsLoading(true);
      console.log('[App] Setting isLoading to true');
    }
    setError(null);

    try {
      console.log('[App] Calling fetchMETARs...');
      const data = await fetchMETARs(NY_AREA_AIRPORTS);
      console.log('[App] Received data from fetchMETARs:', data);
      console.log('[App] Data length:', data.length);
      console.log('[App] Data with METARs:', data.filter(d => d.metar !== null).length);
      console.log('[App] Data with TAFs:', data.filter(d => d.taf !== null).length);
      
      setAirportMETARs(data);
      setLastUpdate(new Date());
      lastRefreshTimeRef.current = now;
      console.log('[App] State updated successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load weather data';
      console.error('[App] Error loading weather data:', err);
      console.error('[App] Error details:', {
        message: errorMessage,
        error: err,
        stack: err instanceof Error ? err.stack : undefined
      });
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      console.log('[App] Loading states reset');
    }
  }, []);

  // Initial load
  useEffect(() => {
    console.log('[App] Component mounted, starting initial load');
    loadWeatherData();
  }, [loadWeatherData]);

  // Auto-refresh every 5 minutes (force refresh to bypass rate limit)
  useEffect(() => {
    console.log('[App] Setting up auto-refresh interval:', REFRESH_INTERVAL_MS, 'ms');
    const interval = setInterval(() => {
      console.log('[App] Auto-refresh triggered');
      loadWeatherData(true, true); // Force refresh for auto-refresh
    }, REFRESH_INTERVAL_MS);

    return () => {
      console.log('[App] Cleaning up auto-refresh interval');
      clearInterval(interval);
    };
  }, [loadWeatherData]);

  // Debug: Log state changes
  useEffect(() => {
    console.log('[App] State update:', {
      airportMETARsCount: airportMETARs.length,
      isLoading,
      isRefreshing,
      lastUpdate,
      error,
      airportMETARs: airportMETARs.map(am => ({
        icao: am.airport.icao,
        hasMETAR: am.metar !== null,
        category: am.flightCategory
      }))
    });
  }, [airportMETARs, isLoading, isRefreshing, lastUpdate, error]);

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
      <Map 
        airportMETARs={airportMETARs} 
        center={NY_CENTER} 
        zoom={NY_ZOOM}
        windToggleEnabled={windToggleEnabled}
        showAirportLabels={showAirportLabels}
        showRadar={showRadar}
        showSatellite={showSatellite}
        onRefreshAirport={async (icao: string) => {
          // Check rate limit before allowing individual airport refresh
          const now = Date.now();
          const timeSinceLastRefresh = now - lastRefreshTimeRef.current;
          
          if (timeSinceLastRefresh < REFRESH_INTERVAL_MS) {
            const remainingSeconds = Math.ceil((REFRESH_INTERVAL_MS - timeSinceLastRefresh) / 1000);
            console.log(`[App] Individual airport refresh rate limited. Please wait ${remainingSeconds} more seconds.`);
            return;
          }

          const airport = NY_AREA_AIRPORTS.find(a => a.icao === icao);
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

