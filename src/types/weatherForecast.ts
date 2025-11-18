export interface WeatherForecast {
  date: string;
  weatherCode: number;
  temperatureMax: number;
  temperatureMin: number;
  precipitationProbability: number;
  windSpeedMax: number; // in km/h
  windGustMax: number; // in km/h
  windDirection: number; // in degrees
}

export interface WeatherForecastResponse {
  forecasts: WeatherForecast[];
}

