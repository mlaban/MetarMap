import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AirportMETAR, fetchSingleAirport } from '../services/metarService';
import { FlightCategoryColors, FlightCategory } from '../types/flightCategory';
import { getNextTAFCondition } from '../utils/tafParser';

interface MapProps {
  airportMETARs: AirportMETAR[];
  center: [number, number];
  zoom: number;
  windToggleEnabled: boolean;
  showAirportLabels: boolean;
  showRadar: boolean;
  showSatellite: boolean;
  autoMoveEnabled: boolean;
  onRefreshAirport?: (icao: string) => Promise<void>;
}

export default function Map({ airportMETARs, center, zoom, windToggleEnabled, showAirportLabels, showRadar, showSatellite, autoMoveEnabled, onRefreshAirport }: MapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);
  const coreMarkersRef = useRef<L.CircleMarker[]>([]);
  const hitBoxMarkersRef = useRef<L.CircleMarker[]>([]);
  const labelsRef = useRef<L.Marker[]>([]);
  const tafArrowsRef = useRef<L.Marker[]>([]);
  const refreshingAirportsRef = useRef<Set<string>>(new Set());
  const previousCategoriesRef = useRef<globalThis.Map<string, FlightCategory>>(new globalThis.Map());
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showWinds, setShowWinds] = useState(false);
  const radarLayerRef = useRef<L.TileLayer | null>(null);
  const satelliteLayerRef = useRef<L.TileLayer | null>(null);

  // Auto-move state
  const autoMoveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentAngleRef = useRef<number>(0);
  const isMovingRef = useRef<boolean>(false);
  const initialCenterRef = useRef<[number, number] | null>(null);

  // Helper function to generate a consistent delay based on ICAO code
  const getStaggerDelay = (icao: string): number => {
    // Create a hash from the ICAO code to get a consistent delay (0-1500ms)
    let hash = 0;
    for (let i = 0; i < icao.length; i++) {
      hash = ((hash << 5) - hash) + icao.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % 1500; // Delay between 0-1500ms
  };

  // Small circular movement pattern to prevent burn-in (just a few pixels)
  // Calculate positions in a circle around current center
  const getCircularPosition = (center: [number, number], angle: number, radiusDegrees: number): [number, number] => {
    // Convert angle from degrees to radians
    const angleRad = (angle * Math.PI) / 180;
    // Small radius: approximately 0.01 degrees (roughly 1km or a few pixels at typical zoom)
    const lat = center[0] + radiusDegrees * Math.cos(angleRad);
    const lon = center[1] + radiusDegrees * Math.sin(angleRad) / Math.cos(center[0] * Math.PI / 180);
    return [lat, lon];
  };

  useEffect(() => {
    // Perform small circular movement to prevent burn-in (just a few pixels)
    const performAutoMove = () => {
      if (!mapRef.current || isMovingRef.current) {

        return;
      }

      // Store initial center on first move
      if (!initialCenterRef.current) {
        const currentCenter = mapRef.current.getCenter();
        initialCenterRef.current = [currentCenter.lat, currentCenter.lng];
      }

      isMovingRef.current = true;
      const currentZoom = mapRef.current.getZoom();

      // Small radius: 0.005 degrees (roughly 500m or a few pixels at zoom 7-10)
      // Adjust radius based on zoom - smaller at higher zoom
      const baseRadius = 0.005;
      const zoomFactor = Math.max(0.5, Math.min(1.5, 10 / currentZoom));
      const radiusDegrees = baseRadius * zoomFactor;

      // Calculate next position in circle (move 30 degrees each time)
      const newPosition = getCircularPosition(initialCenterRef.current, currentAngleRef.current, radiusDegrees);



      // Pan to new position with smooth animation (keep current zoom level)
      mapRef.current.flyTo(newPosition, currentZoom, {
        duration: 1.5,
        easeLinearity: 0.25
      });

      // After movement completes, mark as ready for next move
      setTimeout(() => {
        isMovingRef.current = false;

      }, 1500); // Wait for animation to complete

      // Move to next angle in circle (30 degrees per step = 12 steps for full circle)
      currentAngleRef.current = (currentAngleRef.current + 30) % 360;
    };

    // Initialize map
    if (!mapRef.current) {
      mapRef.current = L.map('map', {
        center,
        zoom,
        zoomControl: true,
        attributionControl: true,
        wheelPxPerZoomLevel: 120, // More pixels needed per zoom level (default is 60) - makes zoom more gradual
        zoomDelta: 0.5, // Smaller zoom increments (default is 1) - makes zoom smoother
      });

      // Add dark mode tile layer (CartoDB Dark Matter)
      // Using 'dark_nolabels' or 'dark_all' - 'dark_nolabels' may show less water detail
      // Alternative: Use Positron style for lighter rendering with less detail
      // Options: 'dark_all', 'dark_nolabels', 'positron', 'positron_nolabels', 'voyager'
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
      }).addTo(mapRef.current);

      // Set map container background to black for unloaded tiles
      const mapContainer = document.getElementById('map');
      if (mapContainer) {
        mapContainer.style.backgroundColor = '#000000';
      }

      // Note: Raster tiles are pre-rendered and cannot filter specific features like small water bodies.
      // To hide small water bodies, you would need to use vector tiles with custom styling.
    }

    // Auto-move effect
    // Clear existing interval
    if (autoMoveIntervalRef.current) {
      clearInterval(autoMoveIntervalRef.current);
      autoMoveIntervalRef.current = null;
    }

    if (autoMoveEnabled && mapRef.current) {
      // Start auto-move immediately, then every 10 seconds
      performAutoMove();
      autoMoveIntervalRef.current = setInterval(() => {
        performAutoMove();
      }, 10000); // 10 seconds
    }

    // Cleanup function
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      if (autoMoveIntervalRef.current) {
        clearInterval(autoMoveIntervalRef.current);
        autoMoveIntervalRef.current = null;
      }
    };
  }, [autoMoveEnabled]);

  // Initialize and update radar layer when visibility changes
  useEffect(() => {
    if (!mapRef.current) return;

    // Remove old layer if it exists
    if (radarLayerRef.current) {
      radarLayerRef.current.remove();
    }

    // Create composite radar layer (n0r - combines all tilts)
    radarLayerRef.current = L.tileLayer('https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0r-900913/{z}/{x}/{y}.png', {
      attribution: 'NOAA NEXRAD via Iowa State Mesonet',
      opacity: 0.6,
      maxZoom: 10,
      zIndex: 100
    });

    // Add to map if radar should be shown
    if (showRadar) {
      radarLayerRef.current.addTo(mapRef.current);
    }
  }, [showRadar]);

  // Satellite layer disabled - tiles not working properly (showing all green)
  // TODO: Re-enable when a working satellite tile service is found
  // useEffect(() => {
  //   if (!mapRef.current) return;
  //   
  //   // Remove old layer if it exists
  //   if (satelliteLayerRef.current) {
  //     satelliteLayerRef.current.remove();
  //   }

  //   // Create GOES-16 satellite geocolor layer (shows clouds and weather)
  //   // Using Iowa State Mesonet GOES satellite tiles
  //   satelliteLayerRef.current = L.tileLayer('https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/goes-16-geocolor-900913/{z}/{x}/{y}.png', {
  //     attribution: 'NOAA GOES-16 via Iowa State Mesonet',
  //     opacity: 0.7,
  //     maxZoom: 10,
  //     zIndex: 90,
  //     errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  //   });

  //   // Add to map if satellite should be shown
  //   if (showSatellite) {
  //     satelliteLayerRef.current.addTo(mapRef.current);
  //   }
  // }, [showSatellite]);

  useEffect(() => {


    // Update markers when airportMETARs change
    if (!mapRef.current) {

      return;
    }


    // Remove existing markers
    markersRef.current.forEach(marker => {
      mapRef.current?.removeLayer(marker);
    });
    coreMarkersRef.current.forEach(marker => {
      mapRef.current?.removeLayer(marker);
    });
    hitBoxMarkersRef.current.forEach(marker => {
      mapRef.current?.removeLayer(marker);
    });
    labelsRef.current.forEach(label => {
      mapRef.current?.removeLayer(label);
    });
    tafArrowsRef.current.forEach(arrow => {
      mapRef.current?.removeLayer(arrow);
    });
    markersRef.current = [];
    coreMarkersRef.current = [];
    hitBoxMarkersRef.current = [];
    labelsRef.current = [];
    tafArrowsRef.current = [];


    // Add new markers
    airportMETARs.forEach(({ airport, flightCategory }) => {

      const color = FlightCategoryColors[flightCategory] || FlightCategoryColors.UNKNOWN;

      // VFR markers are slightly larger, MVFR markers are 25% larger, UNKNOWN markers are half size
      const isVFR = flightCategory === FlightCategory.VFR;
      const isMVFR = flightCategory === FlightCategory.MVFR;
      const isUnknown = flightCategory === FlightCategory.UNKNOWN;
      let outerRadius = 2;
      let coreRadius = 1;

      if (isVFR) {
        outerRadius = 1.7; // Slightly larger for VFR (green dots)
        coreRadius = 1.0;
      } else if (isMVFR) {
        outerRadius = 2.5; // 25% larger
        coreRadius = 1.25;
      } else if (isUnknown) {
        outerRadius = 1; // Half size
        coreRadius = 0.5;
      }

      // Create outer colored circle with glow
      const marker = L.circleMarker(
        [airport.latitude, airport.longitude],
        {
          radius: outerRadius,
          fillColor: color,
          color: color,
          weight: 0.5,
          opacity: 1,
          fillOpacity: 1
        }
      );

      // Create bright white center core
      const coreMarker = L.circleMarker(
        [airport.latitude, airport.longitude],
        {
          radius: coreRadius,
          fillColor: '#ffffff',
          color: '#ffffff',
          weight: 0,
          opacity: 1,
          fillOpacity: 1
        }
      );

      // Create larger invisible hit box for easier clicking
      const hitBoxMarker = L.circleMarker(
        [airport.latitude, airport.longitude],
        {
          radius: 8, // Larger hit box (8px radius = 16px diameter)
          fillColor: 'transparent',
          color: 'transparent',
          weight: 0,
          opacity: 0,
          fillOpacity: 0,
          interactive: true,
          bubblingMouseEvents: false
        }
      );

      // Check for high wind gusts (17+ knots)
      const airportData = airportMETARs.find(am => am.airport.icao === airport.icao);
      const windGust = airportData?.metar?.wgst || (airportData?.metar as any)?.windGustKt;
      const hasHighGusts = windGust !== undefined && windGust >= 17;

      // Add LED glow effect to outer marker
      marker.on('add', function () {
        const element = this.getElement();
        if (element) {
          // Apply outer glow effect (scaled down for smaller markers)
          element.style.filter = `drop-shadow(0 0 1.5px ${color}) drop-shadow(0 0 3px ${color}) drop-shadow(0 0 4px ${color})`;
          element.style.transition = 'filter 0.2s ease, opacity 0.5s ease';

          // Add blinking animation for high gusts with random delay
          if (hasHighGusts) {
            element.classList.add('airport-marker-gust');
            // Random delay between 0 and 1 second to desynchronize blinking
            const randomDelay = Math.random();
            element.style.animationDelay = `${randomDelay}s`;

          }

          // Add hover effect for brighter glow
          element.addEventListener('mouseenter', function () {
            this.style.filter = `drop-shadow(0 0 2px ${color}) drop-shadow(0 0 4px ${color}) drop-shadow(0 0 6px ${color}) drop-shadow(0 0 8px ${color})`;
            if (hasHighGusts) {
              this.style.animationPlayState = 'paused';
            }
          });

          element.addEventListener('mouseleave', function () {
            this.style.filter = `drop-shadow(0 0 1.5px ${color}) drop-shadow(0 0 3px ${color}) drop-shadow(0 0 4px ${color})`;
            if (hasHighGusts) {
              this.style.animationPlayState = 'running';
            }
          });
        }
      });

      // Add bright glow to center core
      coreMarker.on('add', function () {
        const element = this.getElement();
        if (element) {
          element.style.filter = `drop-shadow(0 0 1px rgba(255, 255, 255, 0.9)) drop-shadow(0 0 2px rgba(255, 255, 255, 0.6))`;
          element.style.transition = 'opacity 0.5s ease';

          // Add blinking animation for high gusts with random delay
          if (hasHighGusts) {
            element.classList.add('airport-marker-gust');
            // Random delay between 0 and 1 second to desynchronize blinking
            const randomDelay = Math.random();
            element.style.animationDelay = `${randomDelay}s`;
          }
        }
      });

      // Add popup with airport info
      const metarText = airportData?.metar?.rawOb || airportData?.metar?.rawText || 'No METAR available';

      // Handle visibility (convert meters to miles if needed)
      let visibilityMi = airportData?.metar?.visibilityStatuteMi;
      if (!visibilityMi && airportData?.metar?.visib !== undefined) {
        visibilityMi = airportData.metar.visib * 0.000621371;
      }
      const visibility = visibilityMi
        ? `${visibilityMi.toFixed(1)} mi`
        : 'N/A';

      // Handle wind (use wspd/wdir or windSpeedKt/windDirDegrees)
      const windDir = airportData?.metar?.wdir || airportData?.metar?.windDirDegrees;
      const windSpeed = airportData?.metar?.wspd || airportData?.metar?.windSpeedKt;
      const wind = windSpeed
        ? `${windDir || 'VRB'}° @ ${windSpeed} kt`
        : 'N/A';

      // Get TAF data
      const taf = airportMETARs.find(am => am.airport.icao === airport.icao)?.taf;
      const tafText = taf?.rawTAF || taf?.rawOb || taf?.rawText || 'No TAF available';

      // Determine trend (improving, worsening, or stable)
      const previousCategory = previousCategoriesRef.current.get(airport.icao);
      let trend: 'improving' | 'worsening' | 'stable' | null = null;

      if (previousCategory && previousCategory !== flightCategory) {
        const categoryOrder = {
          [FlightCategory.LIFR]: 0,
          [FlightCategory.IFR]: 1,
          [FlightCategory.MVFR]: 2,
          [FlightCategory.VFR]: 3,
        };
        const prevOrder = categoryOrder[previousCategory] ?? 2;
        const currOrder = categoryOrder[flightCategory] ?? 2;

        if (currOrder > prevOrder) {
          trend = 'improving'; // Better category (higher number = better)
        } else if (currOrder < prevOrder) {
          trend = 'worsening'; // Worse category
        }
      } else if (previousCategory) {
        trend = 'stable';
      }

      // Update previous category
      previousCategoriesRef.current.set(airport.icao, flightCategory);

      // Function to create popup content
      const createPopupContent = (airportData: AirportMETAR, trend: 'improving' | 'worsening' | 'stable' | null, previousCategory?: FlightCategory) => {
        const metar = airportData.metar;
        const taf = airportData.taf;
        const category = airportData.flightCategory;
        const categoryColor = FlightCategoryColors[category];
        const metarText = metar?.rawOb || metar?.rawText || 'No METAR available';
        const tafText = taf?.rawTAF || taf?.rawOb || taf?.rawText || 'No TAF available';

        let visibilityMi = metar?.visibilityStatuteMi;
        if (!visibilityMi && metar?.visib !== undefined) {
          visibilityMi = metar.visib * 0.000621371;
        }
        const visibility = visibilityMi
          ? `${visibilityMi.toFixed(1)} mi`
          : 'N/A';

        const windDir = metar?.wdir || metar?.windDirDegrees;
        const windSpeed = metar?.wspd || metar?.windSpeedKt;
        const wind = windSpeed
          ? `${windDir || 'VRB'}° @ ${windSpeed} kt`
          : 'N/A';

        // Trend display at bottom
        let trendDisplay = '';
        if (trend && previousCategory) {
          const trendColor = trend === 'improving' ? '#00ff00' : trend === 'worsening' ? '#ff0000' : '#888888';
          const trendIcon = trend === 'improving' ? '↑' : trend === 'worsening' ? '↓' : '→';
          const trendText = trend === 'improving' ? 'Improving' : trend === 'worsening' ? 'Worsening' : 'Stable';
          trendDisplay = `
            <div style="margin-top: 12px; padding-top: 8px; border-top: 1px solid #444;">
              <div style="display: flex; align-items: center; gap: 6px; font-size: 12px;">
                <span style="color: ${trendColor}; font-weight: bold; font-size: 14px;">${trendIcon}</span>
                <span style="color: ${trendColor};">${trendText}</span>
                ${trend !== 'stable' ? `<span style="color: #888; font-size: 11px;">(${previousCategory} → ${category})</span>` : ''}
              </div>
            </div>
          `;
        }

        return `
          <div style="color: white; font-family: Arial, sans-serif; min-width: 200px;">
            <div style="margin-bottom: 4px;">
              <strong style="font-size: 16px;">${airport.icao}</strong>
            </div>
            <span style="font-size: 12px; color: #cccccc;">${airport.name}</span><br/>
            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #444;">
              <strong>Category:</strong> <span style="color: ${categoryColor};">${category}</span><br/>
              <strong>Visibility:</strong> ${visibility}<br/>
              <strong>Wind:</strong> ${wind}<br/>
              <div style="margin-top: 8px; font-size: 11px; color: #aaaaaa; font-family: monospace;">
                <strong>METAR:</strong><br/>${metarText}
              </div>
              ${taf ? `
              <div style="margin-top: 8px; font-size: 11px; color: #aaaaaa; font-family: monospace;">
                <strong>TAF:</strong><br/>${tafText}
              </div>
              ` : ''}
            </div>
            ${trendDisplay}
          </div>
        `;
      };

      const popupContent = createPopupContent(
        airportMETARs.find(am => am.airport.icao === airport.icao)!,
        trend,
        previousCategory || undefined
      );

      // Bind popup to hit box marker (larger clickable area)
      const popup = hitBoxMarker.bindPopup(popupContent);

      // Make visible markers non-interactive so clicks go to hit box
      marker.options.interactive = false;
      coreMarker.options.interactive = false;

      // Add hit box first (behind visible markers) so it captures clicks
      hitBoxMarker.addTo(mapRef.current!);
      marker.addTo(mapRef.current!);
      coreMarker.addTo(mapRef.current!);
      hitBoxMarkersRef.current.push(hitBoxMarker);
      markersRef.current.push(marker);
      coreMarkersRef.current.push(coreMarker);

      // Format wind conditions for display and determine color
      // Only show winds if max wind speed (including gusts) is > 30 knots
      let windConditionsText = '';
      let windColor = '#888888'; // Default gray
      if (airportData?.metar) {
        const windSpeed = airportData.metar.wspd || airportData.metar.windSpeedKt || 0;
        const windDir = airportData.metar.wdir || airportData.metar.windDirDegrees;
        const windGustValue = windGust || 0;
        const maxWind = Math.max(windSpeed, windGustValue);

        // Only show winds if max wind speed is greater than 30 knots
        if (maxWind > 30) {
          if (hasHighGusts && windGustValue > 0) {
            // High gusts: show "12G16KT" format
            windConditionsText = `${Math.round(windSpeed)}G${Math.round(windGustValue)}KT`;
          } else {
            // Regular wind: show "270@12KT" or "12KT" format
            if (windDir !== undefined && windDir !== null) {
              windConditionsText = `${Math.round(windDir)}@${Math.round(windSpeed)}KT`;
            } else {
              windConditionsText = `${Math.round(windSpeed)}KT`;
            }
          }

          // Color code based on max wind speed (including gusts)
          if (maxWind > 40) {
            windColor = '#FF00FF'; // Magenta
          } else if (maxWind > 30) {
            windColor = '#FF0000'; // Red
          } else if (maxWind > 20) {
            windColor = '#FF8000'; // Orange
          } else if (maxWind > 15) {
            windColor = '#0080FF'; // Blue
          } else {
            windColor = '#00FF00'; // Green
          }
        }
      }

      // Add airport name label - alternate between ICAO and winds with smooth transitions
      // Only create label if showAirportLabels is true
      // Make VFR labels smaller and more subtle to declutter
      if (showAirportLabels) {
        const labelId = `airport-label-${airport.icao}`;
        const staggerDelay = getStaggerDelay(airport.icao);

        // Determine what to show: winds if showWinds is true, windToggleEnabled is true, and we have wind data, otherwise ICAO
        const shouldShowWinds = windToggleEnabled && showWinds && windConditionsText;

        // Make VFR labels smaller and more transparent to reduce clutter
        const isVFR = flightCategory === FlightCategory.VFR;
        const icaoFontSize = isVFR ? '7px' : '8px';
        const icaoOpacity = isVFR ? '0.5' : '1';
        const windFontSize = '7px';
        const labelHeight = isVFR ? 10 : 12;
        const labelHeightStr = `${labelHeight}px`;

        // Create both elements with smooth crossfade transitions
        // Always create wind element if windConditionsText exists, even if not showing initially
        const labelHtml = `<div id="${labelId}" style="
            position: relative;
            pointer-events: none;
            text-align: center;
            width: 100%;
            height: ${labelHeightStr};
            overflow: visible;
          ">
            <div class="airport-label-content" id="${labelId}-icao" style="
              font-family: Arial, sans-serif;
              font-size: ${icaoFontSize};
              font-weight: ${isVFR ? 'normal' : 'bold'};
              color: #888888;
              text-shadow: 
                -1px -1px 0 #000,
                1px -1px 0 #000,
                -1px 1px 0 #000,
                1px 1px 0 #000;
              white-space: nowrap;
              line-height: 1;
              -webkit-font-smoothing: antialiased;
              -moz-osx-font-smoothing: grayscale;
              opacity: ${shouldShowWinds ? 0 : icaoOpacity};
              transition: opacity 0.8s ease-in-out;
              transition-delay: ${staggerDelay}ms;
              position: absolute;
              left: 50%;
              top: 50%;
              transform: translate(-50%, -50%);
              pointer-events: none;
              z-index: 1;
            ">${airport.icao}</div>
            ${windConditionsText ? `<div class="airport-label-content" id="${labelId}-wind" style="
              font-family: Arial, sans-serif;
              font-size: ${windFontSize};
              font-weight: normal;
              color: ${windColor};
              text-shadow: 
                -1px -1px 0 #000,
                1px -1px 0 #000,
                -1px 1px 0 #000,
                1px 1px 0 #000,
                0 0 2px ${windColor},
                0 0 4px ${windColor};
              white-space: nowrap;
              line-height: 1;
              -webkit-font-smoothing: antialiased;
              -moz-osx-font-smoothing: grayscale;
              opacity: ${shouldShowWinds ? 1 : 0};
              transition: opacity 0.8s ease-in-out;
              transition-delay: ${staggerDelay}ms;
              position: absolute;
              left: 50%;
              top: 50%;
              transform: translate(-50%, -50%);
              pointer-events: none;
              z-index: 1;
            ">${windConditionsText}</div>` : ''}
          </div>`;

        const labelIcon = L.divIcon({
          className: 'airport-label',
          html: labelHtml,
          iconSize: [40, labelHeight],
          iconAnchor: [20, labelHeight], // Anchor at bottom center, so label appears above
        });

        // Offset label closer to marker to reduce clutter
        const labelLat = airport.latitude + 0.004; // Reduced offset (was 0.008)
        const labelMarker = L.marker([labelLat, airport.longitude], {
          icon: labelIcon,
          zIndexOffset: 500,
          interactive: false,
        });

        labelMarker.addTo(mapRef.current!);
        labelsRef.current.push(labelMarker);
      }

      // Add TAF forecast arrow indicator
      const nextCondition = airportData?.taf ? getNextTAFCondition(airportData.taf) : null;

      if (nextCondition) {
        const arrowColor = FlightCategoryColors[nextCondition];

        // Create arrow icon pointing right (indicating future forecast)
        const arrowIcon = L.divIcon({
          className: 'taf-arrow-indicator',
          html: `<div style="
            width: 0;
            height: 0;
            border-top: 6px solid transparent;
            border-bottom: 6px solid transparent;
            border-left: 10px solid ${arrowColor};
            filter: drop-shadow(0 0 2px ${arrowColor});
          "></div>`,
          iconSize: [10, 12],
          iconAnchor: [0, 6],
        });

        // Position arrow to the right of the marker
        const arrowLat = airport.latitude;
        const arrowLon = airport.longitude + 0.012; // Offset to the right

        const arrowMarker = L.marker([arrowLat, arrowLon], {
          icon: arrowIcon,
          zIndexOffset: 400,
          interactive: false,
        });

        arrowMarker.addTo(mapRef.current!);
        tafArrowsRef.current.push(arrowMarker);
      }


    });


  }, [airportMETARs, showWinds, windToggleEnabled, showAirportLabels]);

  // Alternate between showing ICAO and winds every 3 seconds
  // Only run if windToggleEnabled is true
  useEffect(() => {
    if (!windToggleEnabled) {
      // If disabled, always show ICAO
      setShowWinds(false);
      return;
    }

    const interval = setInterval(() => {
      setShowWinds(prev => !prev);
    }, 3000);

    return () => clearInterval(interval);
  }, [windToggleEnabled]);

  // Update label opacity with staggered transitions when showWinds changes
  // Also handle showAirportLabels visibility
  useEffect(() => {
    if (!showAirportLabels) {
      // Hide all labels
      labelsRef.current.forEach(labelMarker => {
        const element = labelMarker.getElement();
        if (element) {
          element.style.display = 'none';
        }
      });
      return;
    }

    // Show all labels
    labelsRef.current.forEach(labelMarker => {
      const element = labelMarker.getElement();
      if (element) {
        element.style.display = '';
      }
    });

    labelsRef.current.forEach((labelMarker, index) => {
      const airport = airportMETARs[index];
      if (!airport) return;

      const labelId = `airport-label-${airport.airport.icao}`;
      const icaoElement = document.getElementById(`${labelId}-icao`);
      const windElement = document.getElementById(`${labelId}-wind`);

      if (!icaoElement) return;

      const staggerDelay = getStaggerDelay(airport.airport.icao);
      const airportData = airportMETARs.find(am => am.airport.icao === airport.airport.icao);
      const windGust = airportData?.metar?.wgst || (airportData?.metar as any)?.windGustKt;
      const hasHighGusts = windGust !== undefined && windGust >= 17;

      let windConditionsText = '';
      if (airportData?.metar) {
        const windSpeed = airportData.metar.wspd || airportData.metar.windSpeedKt || 0;
        const windGustValue = windGust || 0;
        const maxWind = Math.max(windSpeed, windGustValue);

        // Only show winds if max wind speed is greater than 30 knots
        if (maxWind > 30) {
          if (hasHighGusts && windGustValue > 0) {
            windConditionsText = `${Math.round(windSpeed)}G${Math.round(windGustValue)}KT`;
          } else {
            const windDir = airportData.metar.wdir || airportData.metar.windDirDegrees;
            if (windDir !== undefined && windDir !== null) {
              windConditionsText = `${Math.round(windDir)}@${Math.round(windSpeed)}KT`;
            } else {
              windConditionsText = `${Math.round(windSpeed)}KT`;
            }
          }
        }
      }

      const shouldShowWinds = windToggleEnabled && showWinds && windConditionsText;

      // Update both elements simultaneously for true crossfade
      // Both elements use the same transition timing so they crossfade smoothly
      // Force a reflow to ensure transitions are applied before opacity changes
      icaoElement.style.transition = 'opacity 0.8s ease-in-out';
      icaoElement.style.transitionDelay = `${staggerDelay}ms`;
      icaoElement.offsetHeight; // Force reflow
      icaoElement.style.opacity = shouldShowWinds ? '0' : '1';

      if (windElement) {
        windElement.style.transition = 'opacity 0.8s ease-in-out';
        windElement.style.transitionDelay = `${staggerDelay}ms`;
        windElement.offsetHeight; // Force reflow
        windElement.style.opacity = shouldShowWinds ? '1' : '0';
      }
    });
  }, [showWinds, airportMETARs, windToggleEnabled, showAirportLabels]);

  return <div id="map" style={{ width: '100%', height: '100vh' }} />;
}

