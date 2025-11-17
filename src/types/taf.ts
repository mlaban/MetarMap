export interface TAF {
  icaoId?: string;
  stationId?: string;
  rawTAF?: string;  // Raw TAF text (NOAA API uses rawTAF)
  rawOb?: string;   // Alternative field name
  rawText?: string; // Alternative field name
  issueTime?: string;
  bulletinTime?: string;
  validTimeFrom?: string;
  validTimeTo?: string;
  remarks?: string;
  lat?: number;
  lon?: number;
  elevationM?: number;
  elev?: number;
  fcsts?: any[];    // Forecast periods
}

