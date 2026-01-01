export enum RadarSource {
  IOWA_NEXRAD_N0Q = 'IOWA_NEXRAD_N0Q', // Base Reflectivity (High Res)
  IOWA_NEXRAD_N0R = 'IOWA_NEXRAD_N0R', // Base Reflectivity (Classic)
}

export const RadarSourceLabels = {
  [RadarSource.IOWA_NEXRAD_N0Q]: 'US NEXRAD Base Reflectivity (High Res)',
  [RadarSource.IOWA_NEXRAD_N0R]: 'US NEXRAD Base Reflectivity (Classic)',
};
