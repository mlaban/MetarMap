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
        console.log(`[TAF Parser] Next condition for ${taf.icaoId}: ${category} (valid from ${new Date(validFrom * 1000).toISOString()})`);
        return category;
      }
    }
  }
  
  // If no future forecast found, use the last one
  const lastFcst = taf.fcsts[taf.fcsts.length - 1];
  if (lastFcst) {
    const category = determineFlightCategoryFromForecast(lastFcst);
    if (category) {
      console.log(`[TAF Parser] Using last forecast condition for ${taf.icaoId}: ${category}`);
      return category;
    }
  }
  
  return null;
}

/**
 * Determines flight category from a TAF forecast period
 */
function determineFlightCategoryFromForecast(fcst: any): FlightCategory | null {
  console.log('[TAF Parser] Parsing forecast:', fcst);
  
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
  
  console.log(`[TAF Parser] Parsed visibility: ${visibilityMi} mi, ceiling: ${ceilingFt} ft`);
  
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

