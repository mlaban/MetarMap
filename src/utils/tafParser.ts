import { TAF } from '../types/taf';
import { FlightCategory } from '../types/flightCategory';

export interface TAFForecast {
  validTimeFrom?: number;
  validTimeTo?: number;
  visibility?: number;
  visibilityStatuteMi?: number;
  ceiling?: number;
  windDir?: number;
  windSpeed?: number;
  flightCategory?: FlightCategory;
}

/**
 * Parses TAF forecast periods and determines the next weather condition
 */
export function getNextTAFCondition(taf: TAF | null): FlightCategory | null {
  if (!taf || !taf.fcsts || taf.fcsts.length === 0) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000); // Current time in seconds since epoch

  // Find the next forecast period that hasn't started yet, or the current one
  for (const fcst of taf.fcsts) {
    const validFrom = fcst.validTimeFrom || 0;
    const validTo = fcst.validTimeTo || Infinity;

    // If this forecast period is in the future or currently active
    if (validFrom >= now || (now >= validFrom && now <= validTo)) {
      // Determine flight category from forecast
      const category = determineFlightCategoryFromForecast(fcst);
      if (category) {

        return category;
      }
    }
  }

  // If no future forecast found, use the last one
  const lastFcst = taf.fcsts[taf.fcsts.length - 1];
  if (lastFcst) {
    const category = determineFlightCategoryFromForecast(lastFcst);
    if (category) {

      return category;
    }
  }

  return null;
}

/**
 * Decodes a TAF forecast period into readable information
 */
export interface DecodedTAFPeriod {
  validTimeFrom: Date;
  validTimeTo: Date;
  visibilityMi?: number;
  ceilingFt?: number;
  windDir?: number;
  windSpeed?: number;
  windGust?: number;
  flightCategory: FlightCategory | null;
  rawText?: string;
  clouds?: string[];
  weather?: string[];
}

/**
 * Decodes all TAF forecast periods
 */
export function decodeTAFPeriods(taf: TAF | null): DecodedTAFPeriod[] {
  if (!taf) return [];
  
  const rawTAF = taf.rawTAF || taf.rawOb || taf.rawText || '';
  if (!rawTAF) return [];

  // Parse issue time from TAF header (e.g., "110249Z")
  let issueDate = new Date();
  const issueMatch = rawTAF.match(/\b(\d{6})Z\b/);
  if (issueMatch) {
    const issueStr = issueMatch[1];
    const day = parseInt(issueStr.substring(0, 2));
    const hour = parseInt(issueStr.substring(2, 4));
    const minute = parseInt(issueStr.substring(4, 6));
    
    // Set to current year/month, then adjust day
    const now = new Date();
    issueDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day, hour, minute, 0));
    
    // Handle month boundary
    if (issueDate.getTime() > now.getTime() + 2 * 24 * 3600 * 1000) {
      issueDate.setUTCMonth(issueDate.getUTCMonth() - 1);
    } else if (issueDate.getTime() < now.getTime() - 28 * 24 * 3600 * 1000) {
      issueDate.setUTCMonth(issueDate.getUTCMonth() + 1);
    }
  }
  
  // Parse valid time range from header (e.g., "1103/1124")
  let validFrom = issueDate;
  let validTo = new Date(issueDate.getTime() + 24 * 3600 * 1000); // Default 24h
  
  const validMatch = rawTAF.match(/\b(\d{4})\/(\d{4})\b/);
  if (validMatch) {
    validFrom = parseTAFTimeGroup(validMatch[1], issueDate);
    validTo = parseTAFTimeGroup(validMatch[2], issueDate);
  }
  
  // Find all period indices
  // Matches: FM110600, TEMPO 1105/1106, BECMG 1105/1106, PROB30 1105/1106
  const periodRegex = /\b(FM\d{6}|TEMPO\s+\d{4}\/\d{4}|BECMG\s+\d{4}\/\d{4}|PROB\d{2}\s+\d{4}\/\d{4})\b/g;
  const matches = Array.from(rawTAF.matchAll(periodRegex));
  
  const periods: DecodedTAFPeriod[] = [];

  // 1. Initial period (from start of valid time to first match)
  const initialEndIdx = matches.length > 0 ? matches[0].index! : rawTAF.length;
  // Start from where the valid time group ends to skip header info if possible, 
  // but simpler to just take everything before first period keyword.
  const initialText = rawTAF.substring(0, initialEndIdx);
  
  // Determine end time of initial period
  let initialEndTime = validTo;
  if (matches.length > 0) {
    initialEndTime = parsePeriodStart(matches[0][0], issueDate, validFrom);
  }

  const initialData = parsePeriodData(initialText);
  const initialPeriod: DecodedTAFPeriod = {
    validTimeFrom: validFrom,
    validTimeTo: initialEndTime,
    flightCategory: null,
    rawText: initialText,
    ...initialData
  };
  initialPeriod.flightCategory = determineFlightCategoryFromForecast({ 
    rawOb: initialText, 
    visibilityStatuteMi: initialPeriod.visibilityMi, 
    ceiling: initialPeriod.ceilingFt 
  });
  periods.push(initialPeriod);
  
  // 2. Subsequent periods
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const typeStr = match[0]; // e.g., "FM110600" or "TEMPO 1105/1106"
    const startIdx = match.index!;
    const endIdx = (i < matches.length - 1) ? matches[i+1].index! : rawTAF.length;
    const text = rawTAF.substring(startIdx, endIdx);
    
    let periodFrom: Date;
    let periodTo: Date;
    
    // Determine start time
    periodFrom = parsePeriodStart(typeStr, issueDate, validFrom);

    // Determine end time
    if (typeStr.startsWith('FM')) {
      // FM persists until next FM or end of TAF
      // Check next period
      if (i < matches.length - 1) {
         // If next is FM, it ends there.
         // If next is TEMPO/BECMG, does FM continue "under" it? 
         // Standard TAF: FM change implies a complete reset of conditions.
         // TEMPO/PROB are fluctuations.
         // BUT for display purposes, we treat them as sequential blocks if possible, 
         // or we just show the time range derived from the tag.
         
         // Logic: FM sets new base conditions. 
         // TEMPO/PROB have explicit end times.
         
         // If next is FM, this FM ends at next FM start.
         // If next is TEMPO, this FM continues as base (conceptually), but for our linear list, 
         // we might want to show the FM validity until... ?
         // Let's use the start of the next period as the end of this one for simple sequential display,
         // UNLESS the next period is overlapping (TEMPO).
         
         const nextType = matches[i+1][0];
         if (nextType.startsWith('FM')) {
            periodTo = parsePeriodStart(nextType, issueDate, validFrom);
         } else {
             // Next is TEMPO/BECMG. The FM conditions are valid *during* the TEMPO/BECMG too (as base), 
             // but strictly speaking the FM group itself "ends" or is superseded by the temporary condition.
             // Actually, TEMPO implies a temporary change *to* the base.
             // For a linear timeline visualization, it's tricky.
             // Let's just say it goes until validTo, effectively.
             // But we want to avoid overlapping visual blocks if possible.
             // Let's try to infer a "main" block duration.
             
             // Simplification: FM lasts until next FM or TAF end. TEMPO are just inserted.
             // But our UI is a list.
             // Let's set periodTo to next FM start or ValidTo.
             let nextFM = matches.slice(i+1).find(m => m[0].startsWith('FM'));
             if (nextFM) {
                periodTo = parsePeriodStart(nextFM[0], issueDate, validFrom);
             } else {
                periodTo = validTo;
             }
         }
      } else {
         periodTo = validTo;
      }
    } else {
      // TEMPO/BECMG/PROB have explicit ranges
      const parts = typeStr.match(/\d{4}\/\d{4}/);
      if (parts) {
         const ranges = parts[0].split('/');
         periodTo = parseTAFTimeGroup(ranges[1], issueDate);
      } else {
         // Fallback
         periodTo = periodFrom; 
      }
    }
    
    const data = parsePeriodData(text);
    
    // If it's a TEMPO/PROB, it might inherit base conditions if not specified (e.g. wind might not change).
    // But usually they specify the changes. 
    // We will display what is in the text.
    
    const period: DecodedTAFPeriod = {
      validTimeFrom: periodFrom,
      validTimeTo: periodTo,
      flightCategory: null,
      rawText: text,
      ...data
    };
    
    period.flightCategory = determineFlightCategoryFromForecast({ 
      rawOb: text, 
      visibilityStatuteMi: period.visibilityMi, 
      ceiling: period.ceilingFt 
    });
    
    periods.push(period);
  }
  
  // Sort by start time just in case, though usually TAF is ordered
  return periods.sort((a, b) => a.validTimeFrom.getTime() - b.validTimeFrom.getTime());
}

function parsePeriodStart(typeStr: string, issueDate: Date, defaultStart: Date): Date {
  if (typeStr.startsWith('FM')) {
     const timeStr = typeStr.substring(2);
     const day = parseInt(timeStr.substring(0, 2));
     const hour = parseInt(timeStr.substring(2, 4));
     const minute = parseInt(timeStr.substring(4, 6));
     const d = new Date(issueDate);
     d.setUTCDate(day);
     d.setUTCHours(hour, minute, 0, 0);
     
     // Handle month rollover: if day is significantly less than issue day (e.g. 01 vs 30)
     if (day < issueDate.getUTCDate() && (issueDate.getUTCDate() - day) > 15) {
         d.setUTCMonth(d.getUTCMonth() + 1);
     } else if (day > issueDate.getUTCDate() && (day - issueDate.getUTCDate()) > 15) {
         // Previous month? Unlikely for forecast but possible for recent past issue
         d.setUTCMonth(d.getUTCMonth() - 1);
     }
     return d;
  }
  const match = typeStr.match(/(\d{4})\//);
  if (match) {
    return parseTAFTimeGroup(match[1], issueDate);
  }
  return defaultStart;
}

function parsePeriodData(text: string): Partial<DecodedTAFPeriod> {
  const result: Partial<DecodedTAFPeriod> = {};
  
  // Wind: DDDSSKT or DDDSSGSSKT or VRB...
  const windMatch = text.match(/\b(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?KT\b/);
  if (windMatch) {
    result.windDir = windMatch[1] === 'VRB' ? undefined : parseInt(windMatch[1]);
    result.windSpeed = parseInt(windMatch[2]);
    if (windMatch[3]) result.windGust = parseInt(windMatch[3]);
  }
  
  // Visibility: P6SM, 6SM, 1 1/2SM, 1/2SM
  // Regex needs to handle fractions
  const visMatch = text.match(/\b(?:P)?(\d+(?:\s\d+\/\d+)?|\d+\/\d+|\d+(?:\.\d+)?)\s*SM\b/);
  if (visMatch) {
    const visStr = visMatch[1];
    if (visStr.includes('/')) {
       if (visStr.includes(' ')) {
          const parts = visStr.split(' ');
          const frac = parts[1].split('/');
          result.visibilityMi = parseInt(parts[0]) + parseInt(frac[0])/parseInt(frac[1]);
       } else {
          const frac = visStr.split('/');
          result.visibilityMi = parseInt(frac[0])/parseInt(frac[1]);
       }
    } else {
       result.visibilityMi = parseFloat(visStr);
    }
  } else {
    // Try meters (4 digits) - typical for international TAFs
    // Must be surrounded by whitespace or start/end of string to avoid matching time groups (1118/1122)
    const meterMatch = text.match(/(?:^|\s)(\d{4})(?:\s|$)/);
    if (meterMatch) {
       // Avoid matching years like 2024. 
       // Look for "9999" or context. 
       // Often appears as "8000" or "4000".
       // Check if it is NOT followed by / (part of time group)
       // And NOT preceded by FM/TEMPO (time group)
       // This is heuristic.
       const val = parseInt(meterMatch[1]);
       if (val !== 9999 && (val < 1900 || val > 2100)) { 
          result.visibilityMi = val * 0.000621371;
       } else if (val === 9999) {
          result.visibilityMi = 7; // > 6SM
       }
    }
  }
  
  // Clouds
  const clouds: string[] = [];
  const cloudMatches = Array.from(text.matchAll(/\b(SKC|CLR|FEW|SCT|BKN|OVC|VV)(\d{3}|\/\/\/)?(?:CB|TCU)?\b/g));
  for(const m of cloudMatches) {
     if (m[2] && m[2] !== '///') {
        const height = parseInt(m[2]) * 100;
        const type = m[1];
        clouds.push(`${type}${m[2]}`);
        
        // Ceiling logic: BKN, OVC, VV define ceiling
        if ((type === 'BKN' || type === 'OVC' || type === 'VV') && result.ceilingFt === undefined) {
           result.ceilingFt = height;
        }
     } else {
        clouds.push(m[0]);
        if (m[0] === 'VV' && m[2] === '///') {
           // Indefinite ceiling, but height unknown. Treat as low?
           // No height, can't set ceilingFt numerically without guess.
        }
     }
  }
  if (clouds.length > 0) result.clouds = clouds;
  
  // Weather
  const weather: string[] = [];
  // Exclude keywords that might look like weather codes
  // e.g. "PROB30" contains "RA" (not really but regex might be loose)
  // Strict WX codes: 
  const wxRegex = /\b([+-]?(?:VC)?(?:MI|BC|DR|BL|SH|TS|FZ|PR|PL|RA|DZ|SN|SG|GR|GS|UP|BR|FG|FU|VA|DU|SA|HZ|PY|PO|SQ|FC|SS|DS)+)\b/g;
  const wxMatches = Array.from(text.matchAll(wxRegex));
  for (const m of wxMatches) {
     const code = m[0];
     // Filter out keywords
     if (!['TEMPO','BECMG','PROB','AUTO','NOSIG','CAVOK','RMK'].some(k => code.includes(k))) {
        // Additional check: Ensure it's not a runway visual range like R24/2000
        if (!code.startsWith('R') || !/\d/.test(code)) {
            weather.push(code);
        }
     }
  }
  if (weather.length > 0) result.weather = weather;
  
  return result;
}

/**
 * Parses timestamp - handles both Unix timestamp (seconds) and ISO string
 */
function parseTimestamp(ts: any): Date {
  if (!ts) return new Date();
  if (typeof ts === 'string') {
    // Try ISO string first
    const date = new Date(ts);
    if (!isNaN(date.getTime())) return date;
    // Try Unix timestamp as string
    const num = parseInt(ts);
    if (!isNaN(num)) return new Date(num * 1000);
  }
  if (typeof ts === 'number') {
    // If it's a very large number, assume milliseconds, otherwise seconds
    return new Date(ts > 1e12 ? ts : ts * 1000);
  }
  return new Date();
}

/**
 * Parses TAF date/time group (e.g., "1103/1124" or "FM110600")
 */
function parseTAFTimeGroup(timeGroup: string, issueDate: Date): Date {
  // Format: DDhh
  const match = timeGroup.match(/^(\d{2})(\d{2})$/);
  if (!match) return new Date();
  
  const day = parseInt(match[1]);
  const hour = parseInt(match[2]);
  
  const result = new Date(issueDate);
  result.setUTCDate(day);
  result.setUTCHours(hour, 0, 0, 0);
  
  // Handle month boundary
  if (day < issueDate.getUTCDate() && (issueDate.getUTCDate() - day) > 15) {
     result.setUTCMonth(result.getUTCMonth() + 1);
  } else if (day > issueDate.getUTCDate() && (day - issueDate.getUTCDate()) > 15) {
     result.setUTCMonth(result.getUTCMonth() - 1);
  }
  
  return result;
}

/**
 * Determines flight category from a TAF forecast period
 */
export function determineFlightCategoryFromForecast(fcst: any): FlightCategory | null {


  // Check if flight category is directly provided
  if (fcst.flightCategory) {
    const cat = fcst.flightCategory.toUpperCase();
    if (Object.values(FlightCategory).includes(cat as FlightCategory)) {
      return cat as FlightCategory;
    }
  }

  // Parse visibility (may be in statute miles or meters)
  // TAF visibility can be in different formats: "P6SM" (6+ SM), "6SM", or meters
  let visibilityMi: number | undefined;

  if (fcst.visibilityStatuteMi !== undefined) {
    visibilityMi = fcst.visibilityStatuteMi;
  } else if (fcst.visibility !== undefined) {
    // Check if it's already in statute miles (if it's a reasonable number < 10, likely SM)
    if (fcst.visibility < 10) {
      visibilityMi = fcst.visibility;
    } else {
      // Assume meters, convert to miles
      visibilityMi = fcst.visibility * 0.000621371;
    }
  } else if (fcst.rawOb || fcst.rawText) {
    // Try to parse from raw text (e.g., "P6SM", "6SM", "6000" meters)
    const rawText = (fcst.rawOb || fcst.rawText || '').toUpperCase();
    const smMatch = rawText.match(/(?:P)?(\d+(?:\.\d+)?)\s*SM/);
    if (smMatch) {
      visibilityMi = parseFloat(smMatch[1]);
    } else {
      // Try meters (4 digits)
      const metersMatch = rawText.match(/\s(\d{4})\s/);
      if (metersMatch) {
        visibilityMi = parseFloat(metersMatch[1]) * 0.000621371;
      }
    }
  }

  // Parse ceiling (in feet AGL)
  // Look for cloud layers: BKN050, OVC080, etc.
  let ceilingFt: number | undefined = fcst.ceiling;

  if (!ceilingFt && (fcst.rawOb || fcst.rawText)) {
    const rawText = (fcst.rawOb || fcst.rawText || '').toUpperCase();
    // Find BKN or OVC cloud layers (these constitute ceilings)
    const cloudMatch = rawText.match(/\b(BKN|OVC)(\d{3})\b/);
    if (cloudMatch) {
      ceilingFt = parseInt(cloudMatch[2]) * 100; // Convert to feet (e.g., 050 -> 5000ft)
    }
  }



  // Determine category based on FAA/NWS standards
  if (visibilityMi !== undefined && ceilingFt !== undefined) {
    // Both available - use the more restrictive
    let visCategory: FlightCategory;
    let ceilCategory: FlightCategory;

    if (visibilityMi < 1) {
      visCategory = FlightCategory.LIFR;
    } else if (visibilityMi >= 1 && visibilityMi < 3) {
      visCategory = FlightCategory.IFR;
    } else if (visibilityMi >= 3 && visibilityMi < 5) {
      visCategory = FlightCategory.MVFR;
    } else {
      visCategory = FlightCategory.VFR;
    }

    if (ceilingFt < 500) {
      ceilCategory = FlightCategory.LIFR;
    } else if (ceilingFt >= 500 && ceilingFt < 1000) {
      ceilCategory = FlightCategory.IFR;
    } else if (ceilingFt >= 1000 && ceilingFt < 3000) {
      ceilCategory = FlightCategory.MVFR;
    } else {
      ceilCategory = FlightCategory.VFR;
    }

    // Use the worse category
    const categoryOrder = {
      [FlightCategory.LIFR]: 0,
      [FlightCategory.IFR]: 1,
      [FlightCategory.MVFR]: 2,
      [FlightCategory.VFR]: 3,
    };

    return categoryOrder[visCategory] < categoryOrder[ceilCategory] ? visCategory : ceilCategory;
  } else if (visibilityMi !== undefined) {
    if (visibilityMi < 1) return FlightCategory.LIFR;
    if (visibilityMi >= 1 && visibilityMi < 3) return FlightCategory.IFR;
    if (visibilityMi >= 3 && visibilityMi < 5) return FlightCategory.MVFR;
    return FlightCategory.VFR;
  } else if (ceilingFt !== undefined) {
    if (ceilingFt < 500) return FlightCategory.LIFR;
    if (ceilingFt >= 500 && ceilingFt < 1000) return FlightCategory.IFR;
    if (ceilingFt >= 1000 && ceilingFt < 3000) return FlightCategory.MVFR;
    return FlightCategory.VFR;
  }

  // If no visibility or ceiling, check for clear conditions (VFR)
  if (fcst.rawOb || fcst.rawText) {
    const rawText = (fcst.rawOb || fcst.rawText || '').toUpperCase();
    if (rawText.match(/\b(CLR|SKC|CAVOK|P6SM)\b/)) {
      return FlightCategory.VFR;
    }
  }

  return null;
}
