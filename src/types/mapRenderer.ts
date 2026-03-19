export enum MapRenderer {
  CESIUM = 'CESIUM',
  LEAFLET = 'LEAFLET',
}

export const MapRendererLabels: Record<MapRenderer, string> = {
  [MapRenderer.CESIUM]: '3D Globe (Cesium)',
  [MapRenderer.LEAFLET]: '2D Map (Leaflet)',
};