import { useEffect, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import { AirportMETAR } from '../services/metarService';
import { FlightCategoryColors, FlightCategory } from '../types/flightCategory';

// Import Cesium CSS
import 'cesium/Build/Cesium/Widgets/widgets.css';

interface CesiumMapProps {
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

export default function CesiumMap({
    airportMETARs,
    center,
    zoom,
    windToggleEnabled,
    showAirportLabels,
    showRadar,
    showSatellite,
    autoMoveEnabled
}: CesiumMapProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewerRef = useRef<Cesium.Viewer | null>(null);
    const dataSourcesRef = useRef<Cesium.CustomDataSource | null>(null);
    const radarLayerRef = useRef<Cesium.ImageryLayer | null>(null);
    const satelliteLayerRef = useRef<Cesium.ImageryLayer | null>(null);
    const [showWinds, setShowWinds] = useState(false);

    // Helper to create glowing dot image
    const getGlowImage = (colorCss: string) => {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        if (!ctx) return canvas.toDataURL();

        const centerX = 32;
        const centerY = 32;
        const radius = 10;
        const glowRadius = 30;

        // Draw outer glow
        const gradient = ctx.createRadialGradient(centerX, centerY, radius, centerX, centerY, glowRadius);
        gradient.addColorStop(0, colorCss);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = gradient;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(centerX, centerY, glowRadius, 0, 2 * Math.PI);
        ctx.fill();

        // Draw core
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = colorCss;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fill();

        // Draw white center
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 0.4, 0, 2 * Math.PI);
        ctx.fill();

        return canvas.toDataURL();
    };

    // Cache for glow images
    const glowImageCache = useRef<Record<string, string>>({});

    // Initialize Cesium Viewer
    useEffect(() => {
        if (!containerRef.current) return;

        // Initialize viewer
        const viewer = new Cesium.Viewer(containerRef.current, {
            terrainProvider: undefined, // Use default ellipsoid for faster loading
            animation: false,
            baseLayerPicker: false,
            fullscreenButton: false,
            vrButton: false,
            geocoder: false,
            homeButton: false,
            infoBox: true,
            sceneModePicker: true,
            selectionIndicator: true,
            timeline: false,
            navigationHelpButton: false,
            navigationInstructionsInitiallyVisible: false,
            scene3DOnly: false,
            shouldAnimate: true,
        });

        // Enable clock for smooth interpolation
        viewer.clock.shouldAnimate = true;
        viewer.clock.multiplier = 1.0;

        // Remove default imagery and add Dark Matter
        viewer.imageryLayers.removeAll();
        viewer.imageryLayers.addImageryProvider(new Cesium.UrlTemplateImageryProvider({
            url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
            credit: 'Map tiles by CartoDB, under CC BY 3.0. Data by OpenStreetMap, under ODbL.',
            subdomains: ['a', 'b', 'c', 'd']
        }));

        // Remove default credit container to clean up UI (credits still required, can be moved)
        // (viewer.cesiumWidget.creditContainer as HTMLElement).style.display = 'none';

        viewerRef.current = viewer;

        // Create a custom data source for airports
        const dataSource = new Cesium.CustomDataSource('airports');
        viewer.dataSources.add(dataSource);
        dataSourcesRef.current = dataSource;

        // Initial camera position
        // Convert Leaflet zoom to height. Zoom 7 is ~2,000,000m
        const height = 20000000 / Math.pow(2, zoom - 2);
        viewer.camera.setView({
            destination: Cesium.Cartesian3.fromDegrees(center[1], center[0], height)
        });

        return () => {
            if (viewerRef.current) {
                viewerRef.current.destroy();
                viewerRef.current = null;
            }
        };
    }, []); // Run once on mount

    // Update Radar Layer
    useEffect(() => {
        const viewer = viewerRef.current;
        if (!viewer) return;

        if (showRadar) {
            if (!radarLayerRef.current) {
                const provider = new Cesium.UrlTemplateImageryProvider({
                    url: 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0r-900913/{z}/{x}/{y}.png',
                    credit: 'NOAA NEXRAD via Iowa State Mesonet',
                    maximumLevel: 10,
                });
                radarLayerRef.current = viewer.imageryLayers.addImageryProvider(provider);
                radarLayerRef.current.alpha = 0.6;
            }
        } else {
            if (radarLayerRef.current) {
                viewer.imageryLayers.remove(radarLayerRef.current);
                radarLayerRef.current = null;
            }
        }
    }, [showRadar]);

    // Update Satellite Layer
    useEffect(() => {
        const viewer = viewerRef.current;
        if (!viewer) return;

        if (showSatellite) {
            if (!satelliteLayerRef.current) {
                const provider = new Cesium.UrlTemplateImageryProvider({
                    url: 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/goes-16-geocolor-900913/{z}/{x}/{y}.png',
                    credit: 'NOAA GOES-16 via Iowa State Mesonet',
                    maximumLevel: 10,
                });
                satelliteLayerRef.current = viewer.imageryLayers.addImageryProvider(provider);
                satelliteLayerRef.current.alpha = 0.7;
            }
        } else {
            if (satelliteLayerRef.current) {
                viewer.imageryLayers.remove(satelliteLayerRef.current);
                satelliteLayerRef.current = null;
            }
        }
    }, [showSatellite]);

    // Toggle winds
    useEffect(() => {
        if (!windToggleEnabled) {
            setShowWinds(false);
            return;
        }
        const interval = setInterval(() => {
            setShowWinds(prev => !prev);
        }, 3000);
        return () => clearInterval(interval);
    }, [windToggleEnabled]);

    // Update Airport Markers
    useEffect(() => {
        const dataSource = dataSourcesRef.current;
        if (!dataSource) return;

        // Clear existing entities
        dataSource.entities.removeAll();

        airportMETARs.forEach(am => {
            const { airport, flightCategory, metar, taf } = am;

            // Determine color
            const colorHex = FlightCategoryColors[flightCategory];

            // Get or create glow image
            if (!glowImageCache.current[colorHex]) {
                glowImageCache.current[colorHex] = getGlowImage(colorHex);
            }
            const image = glowImageCache.current[colorHex];

            // Prepare description HTML
            const metarText = metar?.rawOb || metar?.rawText || 'No METAR available';
            const tafText = taf?.rawTAF || taf?.rawOb || taf?.rawText || 'No TAF available';

            let visibilityMi = metar?.visibilityStatuteMi;
            if (!visibilityMi && metar?.visib !== undefined) {
                visibilityMi = metar.visib * 0.000621371;
            }
            const visibility = visibilityMi ? `${visibilityMi.toFixed(1)} mi` : 'N/A';

            const windDir = metar?.wdir || metar?.windDirDegrees;
            const windSpeed = metar?.wspd || metar?.windSpeedKt;
            const wind = windSpeed ? `${windDir || 'VRB'}° @ ${windSpeed} kt` : 'N/A';

            const description = `
        <div style="font-family: Arial, sans-serif; color: #fff; background-color: #000; padding: 10px;">
          <h3>${airport.icao} - ${airport.name}</h3>
          <p><strong>Category:</strong> <span style="color: ${colorHex}">${flightCategory}</span></p>
          <p><strong>Visibility:</strong> ${visibility}</p>
          <p><strong>Wind:</strong> ${wind}</p>
          <hr/>
          <p><strong>METAR:</strong> ${metarText}</p>
          ${taf ? `<p><strong>TAF:</strong> ${tafText}</p>` : ''}
        </div>
      `;

            // Label text
            let labelText = airport.icao;
            if (windToggleEnabled && showWinds && metar) {
                const windGust = metar.wgst || (metar as any).windGustKt;
                const maxWind = Math.max(windSpeed || 0, windGust || 0);
                if (maxWind > 30) {
                    labelText = `${Math.round(windSpeed || 0)}G${Math.round(windGust || 0)}KT`;
                } else if ((windSpeed || 0) > 0) {
                    labelText = `${Math.round(windSpeed || 0)}KT`;
                }
            }

            // Add entity
            dataSource.entities.add({
                position: Cesium.Cartesian3.fromDegrees(airport.longitude, airport.latitude),
                name: airport.icao,
                description: description,
                billboard: {
                    image: image,
                    scale: flightCategory === FlightCategory.VFR ? 0.3 : 0.4, // Reduced scale
                    color: Cesium.Color.WHITE, // Image already has color
                    verticalOrigin: Cesium.VerticalOrigin.CENTER,

                },
                label: showAirportLabels ? {
                    text: labelText,
                    font: '12px sans-serif',
                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                    fillColor: Cesium.Color.WHITE,
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 2,
                    verticalOrigin: Cesium.VerticalOrigin.TOP,
                    pixelOffset: new Cesium.Cartesian2(0, 15),
                    scaleByDistance: new Cesium.NearFarScalar(1.5e2, 1.5, 8.0e6, 0.0),

                } : undefined
            });
        });

    }, [airportMETARs, showAirportLabels, showWinds, windToggleEnabled]);

    // Auto-move logic
    useEffect(() => {
        const viewer = viewerRef.current;
        if (autoMoveEnabled && viewer) {
            const height = 20000000 / Math.pow(2, zoom - 2);
            viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(center[1], center[0], height),
                duration: 2
            });
        }
    }, [autoMoveEnabled, center, zoom]);


    return (
        <div ref={containerRef} style={{ width: '100%', height: '100vh' }} />
    );
}
