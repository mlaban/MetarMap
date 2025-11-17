export enum FlightCategory {
  VFR = 'VFR',
  MVFR = 'MVFR',
  IFR = 'IFR',
  LIFR = 'LIFR',
  UNKNOWN = 'UNKNOWN'
}

export const FlightCategoryColors: Record<FlightCategory, string> = {
  [FlightCategory.VFR]: '#00FF00',    // Green
  [FlightCategory.MVFR]: '#0080FF',   // Blue
  [FlightCategory.IFR]: '#FF0000',    // Red
  [FlightCategory.LIFR]: '#FF00FF',   // Magenta
  [FlightCategory.UNKNOWN]: '#808080' // Gray
};

export const FlightCategoryLabels: Record<FlightCategory, string> = {
  [FlightCategory.VFR]: 'VFR',
  [FlightCategory.MVFR]: 'MVFR',
  [FlightCategory.IFR]: 'IFR',
  [FlightCategory.LIFR]: 'LIFR',
  [FlightCategory.UNKNOWN]: 'Unknown'
};

