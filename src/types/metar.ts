import { FlightCategory } from './flightCategory';

export interface METAR {
  // API response fields (NOAA uses different field names)
  icaoId?: string;  // API uses icaoId
  stationId?: string;  // Some APIs use stationId
  rawOb?: string;  // API uses rawOb for raw text
  rawText?: string;  // Some APIs use rawText
  receiptTime?: string;
  obsTime?: number;
  reportTime?: string;
  temp?: number;  // API uses temp (in Celsius)
  tempC?: number;  // Some APIs use tempC
  dewp?: number;  // API uses dewp (dewpoint in Celsius)
  dewpointC?: number;  // Some APIs use dewpointC
  wdir?: number;  // API uses wdir (wind direction)
  windDirDegrees?: number;  // Some APIs use windDirDegrees
  wspd?: number;  // API uses wspd (wind speed in knots)
  windSpeedKt?: number;  // Some APIs use windSpeedKt
  visib?: number;  // API uses visib (may be in statute miles or meters - check rawOb for units)
  visibilityStatuteMi?: number;  // Some APIs use visibilityStatuteMi
  altim?: number;  // API uses altim (altimeter in inches)
  altimInHg?: number;  // Some APIs use altimInHg
  seaLevelPressureMb?: number;
  fltCat?: string;  // API provides flight category directly (VFR, MVFR, IFR, LIFR)
  flightCategory?: FlightCategory;
  metarType?: string;
  elevationM?: number;
  elev?: number;  // API uses elev for elevation
  // Legacy fields for compatibility
  observationTime?: string;
  latitude?: number;
  longitude?: number;
  lat?: number;  // API uses lat
  lon?: number;  // API uses lon
}

export interface METARResponse {
  data: METAR[];
}

