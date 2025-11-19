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



  try {
    const url = `${TAF_API_URL}?ids=${stationIds}&format=json`;


    const response = await fetch(url);


    if (!response.ok) {
      const errorText = await response.text();

      return tafMap;
    }

    const responseData = await response.json();


    // Handle different response formats
    const data: TAF[] = Array.isArray(responseData)
      ? responseData
      : (responseData.data || []);



    data.forEach(taf => {
      const stationId = (taf.icaoId || taf.stationId || '').toUpperCase();
      if (taf && stationId) {
        tafMap.set(stationId, taf);

      }
    });


    return tafMap;
  } catch (error) {

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



  // Fetch METARs and TAFs in parallel
  const [metarResponse, tafMap] = await Promise.all([
    fetch(`${METAR_API_URL}?ids=${stationIds}&format=json&taf=false`),
    fetchTAFs(airports)
  ]);

  try {


    if (!metarResponse.ok) {
      const errorText = await metarResponse.text();

      throw new Error(`Failed to fetch METARs: ${metarResponse.statusText} (${metarResponse.status})`);
    }

    const responseData = await metarResponse.json();


    // Handle different response formats - could be array or object with data property
    const data: METAR[] = Array.isArray(responseData)
      ? responseData
      : (responseData.data || []);



    // Create a map of station ID to METAR
    const metarMap = new Map<string, METAR>();
    data.forEach(metar => {
      // Handle both icaoId (NOAA API) and stationId (other APIs)
      const stationId = (metar.icaoId || metar.stationId || '').toUpperCase();
      if (metar && stationId) {
        metarMap.set(stationId, metar);

      }
    });



    // Match airports with their METARs and TAFs
    const result = airports.map(airport => {
      const metar = metarMap.get(airport.icao) || null;
      const taf = tafMap.get(airport.icao) || null;
      const flightCategory = metar ? parseFlightCategory(metar) : FlightCategory.UNKNOWN;

      if (!metar) {

      }

      if (taf) {

      }

      return {
        airport,
        metar,
        taf,
        flightCategory
      };
    });



    return result;
  } catch (error) {

    // Return airports with null METARs and TAFs on error
    const fallbackResult = airports.map(airport => ({
      airport,
      metar: null,
      taf: null,
      flightCategory: FlightCategory.UNKNOWN
    }));

    return fallbackResult;
  }
}

