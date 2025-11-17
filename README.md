# Weather Dashboard - METAR Map

A full-screen web application that displays airport weather conditions on a dark mode map, inspired by those physical METAR maps with Arduino that have popped up online.

## Inspiration

This project was inspired by those awesome physical METAR maps people have been building with Arduino and LED displays. I didn't want to have a physical version, but I always wanted to build a web version. So here it is!

**This version is tailored to the Northeast United States** (New York, New England, Pennsylvania, and surrounding areas). If you want to build it for your own region, you can download [Cursor](https://cursor.sh), open this project, and ask it to customize it for your region. The codebase is straightforward and easy to modify.

## How It Works

The application fetches real-time METAR (Meteorological Aerodrome Report) data from the NOAA Aviation Weather API and displays airports on an interactive map. Each airport is represented by a colored dot that indicates the current flight category:

- 🟢 **VFR** (Green): Visual Flight Rules - Good conditions (ceiling ≥ 3000 ft, visibility ≥ 5 miles)
- 🟡 **MVFR** (Yellow): Marginal VFR - Fair conditions (ceiling 1000-3000 ft, visibility 3-5 miles)
- 🟣 **IFR** (Magenta): Instrument Flight Rules - Poor conditions (ceiling 500-1000 ft, visibility 1-3 miles)
- 🔴 **LIFR** (Red): Low IFR - Very poor conditions (ceiling < 500 ft, visibility < 1 mile)

The map automatically refreshes every 5 minutes to keep the data current. You can click on any airport marker to see detailed METAR and TAF (Terminal Aerodrome Forecast) information.

## Features

- **Dark Mode Map**: CartoDB Dark Matter tiles optimized for OLED displays
- **Color-Coded Airport Markers**: Real-time flight category visualization
- **LED-Style Glow Effects**: Markers have a subtle glow effect reminiscent of physical LED displays
- **Wind Indicators**: High wind conditions (>30 knots) can be displayed with color-coded labels
- **TAF Forecast Arrows**: Visual indicators showing forecasted condition changes
- **Auto-Refresh**: Updates weather data every 5 minutes
- **Full-Screen Design**: Optimized for large displays and OLED TVs
- **Interactive Popups**: Click any airport to see detailed weather information

## Tech Stack

- **React 18** with TypeScript
- **Vite** for fast development and building
- **Leaflet** for map rendering
- **NOAA Aviation Weather API** for METAR and TAF data

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

The Vite dev server includes a proxy configuration that handles CORS automatically in development.

### Production Setup

Due to CORS restrictions on the NOAA Aviation Weather API, you'll need to run a backend proxy server in production:

1. **Set up the proxy server** (in a separate directory or alongside the frontend):
```bash
# Copy server-package.json to a new directory or rename it to package.json
npm install express cors node-fetch
```

2. **Start the proxy server**:
```bash
node server.js
```

The proxy server runs on `http://localhost:3001` by default.

3. **Build and run the frontend**:
```bash
npm run build
npm run preview
```

Or set the `VITE_PROXY_URL` environment variable to point to your proxy server:
```bash
VITE_PROXY_URL=http://your-proxy-server:3001/api/metar npm run build
```

### Alternative: Deploy Proxy Server

For production deployment, you can deploy the proxy server to services like:
- **Heroku**: Deploy `server.js` as a Node.js app
- **Railway**: Deploy the proxy server
- **Vercel/Netlify**: Use serverless functions as a proxy
- **Your own server**: Run the proxy server on your infrastructure

## Customizing for Your Region

Want to adapt this for your area? Here's what you need to change:

1. **Airport List**: Edit `src/data/airports.ts` to add airports in your region
2. **Map Center**: Modify `NY_CENTER` and `NY_ZOOM` in `src/App.tsx` to center on your area
3. **Refresh Interval**: Adjust `REFRESH_INTERVAL_MS` in `src/App.tsx` if needed

Or, if you're using Cursor, just ask it: *"Customize this METAR map for [your region]"* and it should handle the changes for you!

## Project Structure

```
src/
  components/     # React components (Map, StatusBar, AirportOverlay, etc.)
  data/          # Static data (airport list for Northeast)
  services/      # API services (METAR fetching)
  types/         # TypeScript type definitions
  utils/         # Utility functions (METAR/TAF parsing)
  App.tsx        # Main application component
  main.tsx       # Application entry point
```

## A Note on Development

This project has been entirely vibe coded. What does that mean? It means I built it iteratively, following intuition and making it work the way I wanted it to work, rather than following a strict plan. The code reflects that - it's functional, it works well, and it's been refined through use. If you find something that could be improved, feel free to make it better!

## API

Uses the NOAA Aviation Weather Center API:
- Endpoint: `https://aviationweather.gov/api/data/metar`
- Format: JSON
- Stations: ICAO codes (e.g., KJFK, KLGA, KBOS)

## License

MIT
