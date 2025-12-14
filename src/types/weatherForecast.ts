export interface WeatherForecast {
  date: string;
  weatherCode: number;
  temperatureMax: number;
  temperatureMin: number;
  precipitationProbability: number;
  windSpeedMax: number; // in km/h (max for the day)
  windGustMax: number; // in km/h (max for the day)
  windSpeedAvg: number; // in km/h (average, more realistic)
  windGustAvg: number; // in km/h (average, more realistic)
  windDirection: number; // in degrees
  rawData?: {
    daily: {
      weathercode: number;
      temperature_2m_max: number;
      temperature_2m_min: number;
      precipitation_probability_max: number;
      windspeed_10m_max: number;
      windgusts_10m_max: number;
      winddirection_10m_dominant: number;
    };
  };
}

export interface WeatherForecastResponse {
  forecasts: WeatherForecast[];
}

