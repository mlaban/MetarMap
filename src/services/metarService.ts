import { METAR } from '../types/metar';
import { TAF } from '../types/taf';
import { Airport } from '../types/airport';
import { FlightCategory } from '../types/flightCategory';
import { parseFlightCategory } from '../utils/metarParser';

// Use proxy in development, or use environment variable for production proxy
// In production, set VITE_PROXY_URL to your backend proxy server URL
const METAR_API_URL = import.meta.env.DEV 
  ? '/api/metar'  // Vite proxy in development
  : (import.meta.env.VITE_PROXY_URL || 'http://localhost:3001/api/metar');  // Production proxy

const TAF_API_URL = import.meta.env.DEV 
  ? '/api/taf'  // Vite proxy in development
  : (import.meta.env.VITE_PROXY_URL?.replace('/api/metar', '/api/taf') || 'http://localhost:3001/api/taf');  // Production proxy

export interface AirportMETAR {
  airport: Airport;
  metar: METAR | null;
  taf: TAF | null;
  flightCategory: FlightCategory;
}

/**
 * Fetches METAR and TAF data for a single airport
 */
export async function fetchSingleAirport(airport: Airport): Promise<AirportMETAR> {
  const result = await fetchMETARs([airport]);
  return result[0];
}

/**
 * Fetches TAF data for a list of airports from NOAA Aviation Weather API
 */
async function fetchTAFs(airports: Airport[]): Promise<Map<string, TAF>> {
  const stationIds = airports.map(a => a.icao).join(',');
  const tafMap = new Map<string, TAF>();
  
  console.log('[TAF Service] Starting fetch for airports:', stationIds);
  console.log('[TAF Service] Using API URL:', TAF_API_URL);
  
  try {
    const url = `${TAF_API_URL}?ids=${stationIds}&format=json`;
    console.log('[TAF Service] Fetching from URL:', url);
    
    const response = await fetch(url);
    console.log('[TAF Service] Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[TAF Service] Response error text:', errorText);
      console.warn('[TAF Service] Failed to fetch TAFs, continuing without TAF data');
      return tafMap;
    }

    const responseData = await response.json();
    console.log('[TAF Service] Raw response data:', responseData);
    
    // Handle different response formats
    const data: TAF[] = Array.isArray(responseData) 
      ? responseData 
      : (responseData.data || []);
    
    console.log('[TAF Service] Parsed TAF array length:', data.length);
    
    data.forEach(taf => {
      const stationId = (taf.icaoId || taf.stationId || '').toUpperCase();
      if (taf && stationId) {
        tafMap.set(stationId, taf);
        console.log(`[TAF Service] Mapped TAF for station: ${stationId}`);
      } else {
        console.warn('[TAF Service] Skipping invalid TAF (no station ID):', taf);
      }
    });

    console.log('[TAF Service] TAF map size:', tafMap.size);
    return tafMap;
  } catch (error) {
    console.error('[TAF Service] Error fetching TAFs:', error);
    // Return empty map on error - TAFs are optional
    return tafMap;
  }
}

/**
 * Fetches METAR and TAF data for a list of airports from NOAA Aviation Weather API
 * Note: In production, you'll need a backend proxy or CORS proxy service
 * due to CORS restrictions on the Aviation Weather API
 */
export async function fetchMETARs(airports: Airport[]): Promise<AirportMETAR[]> {
  const stationIds = airports.map(a => a.icao).join(',');
  
  console.log('[METAR Service] Starting fetch for airports:', stationIds);
  console.log('[METAR Service] Using API URL:', METAR_API_URL);
  console.log('[METAR Service] Environment:', import.meta.env.DEV ? 'DEVELOPMENT' : 'PRODUCTION');
  
  // Fetch METARs and TAFs in parallel
  const [metarResponse, tafMap] = await Promise.all([
    fetch(`${METAR_API_URL}?ids=${stationIds}&format=json&taf=false`),
    fetchTAFs(airports)
  ]);
  
  try {
    console.log('[METAR Service] Response status:', metarResponse.status, metarResponse.statusText);
    
    if (!metarResponse.ok) {
      const errorText = await metarResponse.text();
      console.error('[METAR Service] Response error text:', errorText);
      throw new Error(`Failed to fetch METARs: ${metarResponse.statusText} (${metarResponse.status})`);
    }

    const responseData = await metarResponse.json();
    console.log('[METAR Service] Raw response data:', responseData);
    console.log('[METAR Service] Response data type:', Array.isArray(responseData) ? 'Array' : typeof responseData);
    
    // Handle different response formats - could be array or object with data property
    const data: METAR[] = Array.isArray(responseData) 
      ? responseData 
      : (responseData.data || []);
    
    console.log('[METAR Service] Parsed METAR array length:', data.length);
    console.log('[METAR Service] Sample METAR:', data[0]);
    
    // Create a map of station ID to METAR
    const metarMap = new Map<string, METAR>();
    data.forEach(metar => {
      // Handle both icaoId (NOAA API) and stationId (other APIs)
      const stationId = (metar.icaoId || metar.stationId || '').toUpperCase();
      if (metar && stationId) {
        metarMap.set(stationId, metar);
        console.log(`[METAR Service] Mapped METAR for station: ${stationId}`, metar);
      } else {
        console.warn('[METAR Service] Skipping invalid METAR (no station ID):', metar);
      }
    });

    console.log('[METAR Service] METAR map size:', metarMap.size);
    console.log('[METAR Service] METAR map keys:', Array.from(metarMap.keys()));

    // Match airports with their METARs and TAFs
    const result = airports.map(airport => {
      const metar = metarMap.get(airport.icao) || null;
      const taf = tafMap.get(airport.icao) || null;
      const flightCategory = metar ? parseFlightCategory(metar) : FlightCategory.UNKNOWN;
      
      if (!metar) {
        console.warn(`[METAR Service] No METAR found for airport: ${airport.icao}`);
      } else {
        console.log(`[METAR Service] Found METAR for ${airport.icao}, category: ${flightCategory}`);
      }
      
      if (taf) {
        console.log(`[METAR Service] Found TAF for ${airport.icao}`);
      }
      
      return {
        airport,
        metar,
        taf,
        flightCategory
      };
    });
    
    console.log('[METAR Service] Returning result:', result);
    console.log('[METAR Service] Result summary:', {
      total: result.length,
      withMETAR: result.filter(r => r.metar !== null).length,
      withTAF: result.filter(r => r.taf !== null).length,
      withoutMETAR: result.filter(r => r.metar === null).length
    });
    
    return result;
  } catch (error) {
    console.error('[METAR Service] Error fetching METARs:', error);
    if (error instanceof Error) {
      console.error('[METAR Service] Error message:', error.message);
      console.error('[METAR Service] Error stack:', error.stack);
    }
    // Return airports with null METARs and TAFs on error
    const fallbackResult = airports.map(airport => ({
      airport,
      metar: null,
      taf: null,
      flightCategory: FlightCategory.UNKNOWN
    }));
    console.log('[METAR Service] Returning fallback result (all UNKNOWN)');
    return fallbackResult;
  }
}

