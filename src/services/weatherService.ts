import { WeatherForecast, WeatherForecastResponse } from '../types/weatherForecast';

const OPEN_METEO_API_URL = 'https://api.open-meteo.com/v1/forecast';

/**
 * Maps WMO weather codes to emoji icons
 * Based on WMO Weather interpretation codes (WW)
 */
export function getWeatherIcon(weatherCode: number): string {
  // Clear sky
  if (weatherCode === 0) return '☀️';

  // Mainly clear, partly cloudy, and overcast
  if (weatherCode >= 1 && weatherCode <= 3) return '⛅';

  // Fog and depositing rime fog
  if (weatherCode >= 45 && weatherCode <= 48) return '🌫️';

  // Drizzle
  if (weatherCode >= 51 && weatherCode <= 55) return '🌦️';

  // Freezing Drizzle
  if (weatherCode >= 56 && weatherCode <= 57) return '🌨️';

  // Rain
  if (weatherCode >= 61 && weatherCode <= 65) return '🌧️';

  // Freezing Rain
  if (weatherCode >= 66 && weatherCode <= 67) return '🌨️';

  // Snow fall
  if (weatherCode >= 71 && weatherCode <= 77) return '❄️';

  // Rain showers
  if (weatherCode >= 80 && weatherCode <= 82) return '🌦️';

  // Snow showers
  if (weatherCode >= 85 && weatherCode <= 86) return '🌨️';

  // Thunderstorm
  if (weatherCode >= 95 && weatherCode <= 99) return '⛈️';

  // Default
  return '☁️';
}

/**
 * Gets weather description from WMO weather code
 */
export function getWeatherDescription(weatherCode: number): string {
  const descriptions: Record<number, string> = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    56: 'Light freezing drizzle',
    57: 'Dense freezing drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    66: 'Light freezing rain',
    67: 'Heavy freezing rain',
    71: 'Slight snow',
    73: 'Moderate snow',
    75: 'Heavy snow',
    77: 'Snow grains',
    80: 'Slight rain showers',
    81: 'Moderate rain showers',
    82: 'Violent rain showers',
    85: 'Slight snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with slight hail',
    99: 'Thunderstorm with heavy hail',
  };

  return descriptions[weatherCode] || 'Unknown';
}

/**
 * Fetches 7-day weather forecast from Open-Meteo API
 */
export async function fetchWeatherForecast(
  latitude: number,
  longitude: number,
  temperatureUnit: 'C' | 'F' = 'F'
): Promise<WeatherForecastResponse> {
  try {
    const url = new URL(OPEN_METEO_API_URL);
    url.searchParams.set('latitude', latitude.toString());
    url.searchParams.set('longitude', longitude.toString());
    // Fetch both daily and hourly data for better wind calculations
    url.searchParams.set('daily', 'weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max,windspeed_10m_max,windgusts_10m_max,winddirection_10m_dominant');
    url.searchParams.set('hourly', 'windspeed_10m,windgusts_10m,winddirection_10m');
    url.searchParams.set('forecast_days', '7');
    url.searchParams.set('temperature_unit', temperatureUnit === 'F' ? 'fahrenheit' : 'celsius');
    url.searchParams.set('timezone', 'auto');



    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Failed to fetch weather forecast: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.daily || !data.daily.time) {
      throw new Error('Invalid forecast data format');
    }

    const forecasts: WeatherForecast[] = data.daily.time.map((date: string, index: number) => {
      // Calculate average wind speeds from hourly data for more realistic values
      let windSpeedAvg = data.daily.windspeed_10m_max[index] || 0;
      let windGustAvg = data.daily.windgusts_10m_max[index] || 0;
      
      if (data.hourly && data.hourly.time && data.hourly.windspeed_10m) {
        // Find hourly data for this day
        const targetDate = new Date(date);
        const targetDateStr = targetDate.toISOString().split('T')[0]; // Get YYYY-MM-DD format
        
        const hourlyForDay: number[] = [];
        const gustForDay: number[] = [];
        
        data.hourly.time.forEach((hourTime: string, hourIndex: number) => {
          const hourDate = new Date(hourTime);
          const hourDateStr = hourDate.toISOString().split('T')[0];
          
          // Match dates (ignoring time)
          if (hourDateStr === targetDateStr) {
            const windSpeed = data.hourly.windspeed_10m[hourIndex];
            if (windSpeed !== null && windSpeed !== undefined && !isNaN(windSpeed)) {
              hourlyForDay.push(windSpeed);
            }
            
            if (data.hourly.windgusts_10m) {
              const windGust = data.hourly.windgusts_10m[hourIndex];
              if (windGust !== null && windGust !== undefined && !isNaN(windGust)) {
                gustForDay.push(windGust);
              }
            }
          }
        });
        
        // Calculate average (more representative than max)
        if (hourlyForDay.length > 0) {
          const sum = hourlyForDay.reduce((a, b) => a + b, 0);
          windSpeedAvg = sum / hourlyForDay.length;
        }
        if (gustForDay.length > 0) {
          const sum = gustForDay.reduce((a, b) => a + b, 0);
          windGustAvg = sum / gustForDay.length;
        }
      }

      return {
        date,
        weatherCode: data.daily.weathercode[index],
        temperatureMax: Math.round(data.daily.temperature_2m_max[index]),
        temperatureMin: Math.round(data.daily.temperature_2m_min[index]),
        precipitationProbability: data.daily.precipitation_probability_max[index] || 0,
        windSpeedMax: Math.round(data.daily.windspeed_10m_max[index] || 0), // Keep max for reference
        windGustMax: Math.round(data.daily.windgusts_10m_max[index] || 0), // Keep max for reference
        windSpeedAvg: Math.round(windSpeedAvg), // Average wind speed (more realistic)
        windGustAvg: Math.round(windGustAvg), // Average gust speed (more realistic)
        windDirection: Math.round(data.daily.winddirection_10m_dominant[index] || 0),
        rawData: {
          daily: {
            weathercode: data.daily.weathercode[index],
            temperature_2m_max: data.daily.temperature_2m_max[index],
            temperature_2m_min: data.daily.temperature_2m_min[index],
            precipitation_probability_max: data.daily.precipitation_probability_max[index] || 0,
            windspeed_10m_max: data.daily.windspeed_10m_max[index] || 0,
            windgusts_10m_max: data.daily.windgusts_10m_max[index] || 0,
            winddirection_10m_dominant: data.daily.winddirection_10m_dominant[index] || 0,
          }
        }
      };
    });



    return { forecasts };
  } catch (error) {

    throw error;
  }
}

