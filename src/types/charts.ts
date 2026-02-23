export enum ChartSource {
  VFR_SECTIONAL = 'VFR_SECTIONAL',
  VFR_TERMINAL = 'VFR_TERMINAL',
  IFR_ENROUTE_LOW = 'IFR_ENROUTE_LOW',
  IFR_ENROUTE_HIGH = 'IFR_ENROUTE_HIGH',
}

export const ChartSourceLabels: Record<ChartSource, string> = {
  [ChartSource.VFR_SECTIONAL]: 'VFR Sectional',
  [ChartSource.VFR_TERMINAL]: 'VFR Terminal Area (TAC)',
  [ChartSource.IFR_ENROUTE_LOW]: 'IFR Enroute Low',
  [ChartSource.IFR_ENROUTE_HIGH]: 'IFR Enroute High',
};

export const ChartSourceUrls: Record<ChartSource, string> = {
  [ChartSource.VFR_SECTIONAL]: 'https://tiles.arcgis.com/tiles/ssFJjBXIUyZDrSYZ/arcgis/rest/services/VFR_Sectional/MapServer',
  [ChartSource.VFR_TERMINAL]: 'https://tiles.arcgis.com/tiles/ssFJjBXIUyZDrSYZ/arcgis/rest/services/VFR_Terminal/MapServer',
  [ChartSource.IFR_ENROUTE_LOW]: 'https://tiles.arcgis.com/tiles/ssFJjBXIUyZDrSYZ/arcgis/rest/services/IFR_AreaLow/MapServer',
  [ChartSource.IFR_ENROUTE_HIGH]: 'https://tiles.arcgis.com/tiles/ssFJjBXIUyZDrSYZ/arcgis/rest/services/IFR_High/MapServer',
};
