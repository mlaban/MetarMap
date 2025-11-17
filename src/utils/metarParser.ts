import { FlightCategory } from '../types/flightCategory';
import { METAR } from '../types/metar';

/**
 * Parses a METAR string to extract flight category
 * Flight categories are determined by:
 * - LIFR: Ceiling < 500 ft AGL and/or visibility < 1 mile
 * - IFR: Ceiling 500 to < 1000 ft AGL and/or visibility 1 to < 3 miles
 * - MVFR: Ceiling 1000 to < 3000 ft AGL and/or visibility 3 to < 5 miles
 * - VFR: Ceiling >= 3000 ft AGL and visibility >= 5 miles
 */
export function parseFlightCategory(metar: METAR): FlightCategory {
  const stationId = metar.icaoId || metar.stationId || 'UNKNOWN';
  console.log('[METAR Parser] Parsing flight category for station:', stationId);
  console.log('[METAR Parser] METAR data:', metar);
  
  // Check for fltCat field from API first (most reliable)
  if (metar.fltCat) {
    const apiCategory = metar.fltCat.toUpperCase();
    if (Object.values(FlightCategory).includes(apiCategory as FlightCategory)) {
      console.log('[METAR Parser] Using API fltCat field:', apiCategory);
      return apiCategory as FlightCategory;
    }
  }
  
  // If flight category is already provided in the METAR, use it
  if (metar.flightCategory) {
    console.log('[METAR Parser] Using provided flight category:', metar.flightCategory);
    return metar.flightCategory as FlightCategory;
  }

  // Parse from raw METAR text (handle both rawOb and rawText)
  // Note: rawText is defined above for visibility parsing, but we need it here too
  const rawTextForCategory = (metar.rawOb || metar.rawText || '').toUpperCase();
  console.log('[METAR Parser] Raw METAR text:', rawTextForCategory);
  
  // Check for explicit flight category in METAR
  const categoryMatch = rawTextForCategory.match(/\b(LIFR|IFR|MVFR|VFR)\b/);
  if (categoryMatch) {
    console.log('[METAR Parser] Found explicit category in text:', categoryMatch[1]);
    return categoryMatch[1] as FlightCategory;
  }

  // Parse visibility and ceiling from METAR
  // Handle both API formats: visib (may be miles or meters) and visibilityStatuteMi (miles)
  let visibilityMi = metar.visibilityStatuteMi;
  
  // Check raw text to determine if visib is in statute miles or meters
  const rawTextForVis = (metar.rawOb || metar.rawText || '').toUpperCase();
  const hasSM = rawTextForVis.includes('SM'); // If raw text has "SM", visib is likely in statute miles
  
  // Only use visib if it's a valid positive number (not 0 or undefined)
  if (!visibilityMi && metar.visib !== undefined && metar.visib > 0) {
    if (hasSM) {
      // If raw text shows "SM", visib is likely already in statute miles
      visibilityMi = metar.visib;
      console.log('[METAR Parser] Using visib from API (statute miles):', visibilityMi, 'miles');
    } else {
      // Otherwise assume meters and convert
      visibilityMi = metar.visib * 0.000621371;
      console.log('[METAR Parser] Using visib from API (meters):', metar.visib, 'meters =', visibilityMi, 'miles');
    }
  }
  let ceilingFt = undefined;

  // Parse visibility from raw text if not in structured data or if structured data is invalid
  // Handle both "10SM" and "10 SM" formats
  if (!visibilityMi || visibilityMi === 0) {
    // Try to parse statute miles first (most common format)
    const visMatch = rawTextForVis.match(/(\d+(?:\.\d+)?)\s*SM/); // Statute miles (space optional)
    if (visMatch) {
      visibilityMi = parseFloat(visMatch[1]);
      console.log('[METAR Parser] Parsed visibility from text:', visibilityMi, 'miles');
    } else {
      // Try to parse meters (4 digits, usually after wind)
      const visMetersMatch = rawTextForVis.match(/\s(\d{4})\s/); // Meters (4 digits with spaces)
      if (visMetersMatch) {
        visibilityMi = parseFloat(visMetersMatch[1]) * 0.000621371; // Convert meters to miles
        console.log('[METAR Parser] Parsed visibility from meters:', visibilityMi, 'miles');
      }
    }
  }

  // Parse ceiling from cloud layers
  // Only BKN (Broken) and OVC (Overcast) count as ceilings
  // SCT (Scattered) and FEW (Few) do NOT constitute a ceiling - treat as no ceiling restriction
  // VV (Vertical Visibility) also counts as a ceiling
  const cloudMatches = rawTextForVis.match(/\b(BKN|OVC|VV)(\d{3})\b/g);
  if (cloudMatches) {
    const ceilings = cloudMatches.map(match => {
      const ftMatch = match.match(/(\d{3})/);
      return ftMatch ? parseInt(ftMatch[1]) * 100 : Infinity; // Convert to feet (e.g., 049 -> 4900ft)
    });
    ceilingFt = Math.min(...ceilings);
    console.log('[METAR Parser] Parsed ceiling from clouds:', ceilingFt, 'feet');
  } else {
    // No BKN/OVC clouds found - check for clear skies or scattered/few clouds
    // CLR/SKC/CAVOK = clear skies = unlimited ceiling
    // Only SCT/FEW clouds = no ceiling restriction = unlimited ceiling for VFR purposes
    if (rawTextForVis.match(/\b(CLR|SKC|CAVOK)\b/)) {
      ceilingFt = Infinity; // Unlimited ceiling
      console.log('[METAR Parser] Clear skies detected, unlimited ceiling');
    } else if (rawTextForVis.match(/\b(SCT|FEW)(\d{3})\b/)) {
      // Only scattered or few clouds - no ceiling restriction
      ceilingFt = Infinity; // Unlimited ceiling (no restriction)
      console.log('[METAR Parser] Only SCT/FEW clouds detected, no ceiling restriction (unlimited)');
    }
    // If no clouds mentioned at all, ceilingFt remains undefined and will be handled in category logic
  }

  console.log('[METAR Parser] Parsed values - visibility:', visibilityMi, 'miles, ceiling:', ceilingFt, 'feet');
  
  // Determine flight category based on FAA/NWS standards:
  // LIFR: ceiling < 500 ft AND/OR visibility < 1 SM
  // IFR: ceiling 500-<1000 ft AND/OR visibility 1-<3 SM
  // MVFR: ceiling 1000-<3000 ft AND/OR visibility 3-<5 SM
  // VFR: ceiling >= 3000 ft (or no ceiling) AND visibility >= 5 SM
  // 
  // When both are available, use the WORSE (more restrictive) category
  let category: FlightCategory;
  
  if (visibilityMi !== undefined && ceilingFt !== undefined) {
    // Both visibility and ceiling available - determine each separately, then use the worse
    let visCategory: FlightCategory;
    let ceilCategory: FlightCategory;
    
    // Determine category based on visibility (statute miles)
    if (visibilityMi < 1) {
      visCategory = FlightCategory.LIFR;
    } else if (visibilityMi >= 1 && visibilityMi < 3) {
      visCategory = FlightCategory.IFR;
    } else if (visibilityMi >= 3 && visibilityMi < 5) {
      visCategory = FlightCategory.MVFR;
    } else {
      visCategory = FlightCategory.VFR; // >= 5 SM
    }
    
    // Determine category based on ceiling (feet AGL)
    if (ceilingFt < 500) {
      ceilCategory = FlightCategory.LIFR;
    } else if (ceilingFt >= 500 && ceilingFt < 1000) {
      ceilCategory = FlightCategory.IFR;
    } else if (ceilingFt >= 1000 && ceilingFt < 3000) {
      ceilCategory = FlightCategory.MVFR;
    } else {
      ceilCategory = FlightCategory.VFR; // >= 3000 ft
    }
    
    // Use the worse (more restrictive) category
    // Order: LIFR (worst) < IFR < MVFR < VFR (best)
    const categoryOrder = {
      [FlightCategory.LIFR]: 0,
      [FlightCategory.IFR]: 1,
      [FlightCategory.MVFR]: 2,
      [FlightCategory.VFR]: 3,
      [FlightCategory.UNKNOWN]: 4
    };
    
    category = categoryOrder[visCategory] < categoryOrder[ceilCategory] ? visCategory : ceilCategory;
    console.log('[METAR Parser] Visibility category:', visCategory, 'Ceiling category:', ceilCategory, 'Final (worse):', category);
    
  } else if (visibilityMi !== undefined) {
    // Only visibility available
    if (visibilityMi < 1) {
      category = FlightCategory.LIFR;
    } else if (visibilityMi >= 1 && visibilityMi < 3) {
      category = FlightCategory.IFR;
    } else if (visibilityMi >= 3 && visibilityMi < 5) {
      category = FlightCategory.MVFR;
    } else {
      category = FlightCategory.VFR; // >= 5 SM
    }
    console.log('[METAR Parser] Using visibility only:', category);
  } else if (ceilingFt !== undefined) {
    // Only ceiling available
    if (ceilingFt < 500) {
      category = FlightCategory.LIFR;
    } else if (ceilingFt >= 500 && ceilingFt < 1000) {
      category = FlightCategory.IFR;
    } else if (ceilingFt >= 1000 && ceilingFt < 3000) {
      category = FlightCategory.MVFR;
    } else {
      category = FlightCategory.VFR; // >= 3000 ft
    }
    console.log('[METAR Parser] Using ceiling only:', category);
  } else {
    // No ceiling and no visibility data available
    // If we have clear skies or only SCT/FEW clouds, treat as VFR (no ceiling restriction)
    // Otherwise unknown
    if (rawTextForVis.match(/\b(CLR|SKC|CAVOK)\b/) || rawTextForVis.match(/\b(SCT|FEW)(\d{3})\b/)) {
      category = FlightCategory.VFR;
      console.log('[METAR Parser] Clear skies or only SCT/FEW clouds, no visibility/ceiling data, assuming VFR');
    } else {
      category = FlightCategory.UNKNOWN;
      console.log('[METAR Parser] No visibility or ceiling data, returning UNKNOWN');
    }
  }

  console.log('[METAR Parser] Determined category:', category);
  return category;
}

