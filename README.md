# Weather Dashboard - Airport Conditions Map

A full-screen web application that displays airport weather conditions on a dark mode map, designed for OLED TV displays.

## Features

- **Dark Mode Map**: CartoDB Dark Matter tiles for optimal OLED display
- **Color-Coded Airport Markers**: Dots change color based on flight category:
  - 🟢 **VFR** (Green): Visual Flight Rules - Good conditions
  - 🟡 **MVFR** (Yellow): Marginal VFR - Fair conditions
  - 🟣 **IFR** (Magenta): Instrument Flight Rules - Poor conditions
  - 🔴 **LIFR** (Red): Low IFR - Very poor conditions
- **Auto-Refresh**: Updates weather data every 5 minutes
- **New York Area Focus**: Centered on New York metropolitan area
- **Full-Screen Design**: Optimized for OLED TV displays

## Tech Stack

- **React 18** with TypeScript
- **Vite** for fast development and building
- **Leaflet** for map rendering
- **NOAA Aviation Weather API** for METAR data

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

## Project Structure

```
src/
  components/     # React components (Map, StatusBar, etc.)
  data/          # Static data (airport list)
  services/      # API services (METAR fetching)
  types/         # TypeScript type definitions
  utils/         # Utility functions (METAR parsing)
  App.tsx        # Main application component
  main.tsx       # Application entry point
```

## Extensibility

The application is designed to be easily extensible:

- **Add More Airports**: Edit `src/data/airports.ts` to add airports
- **Change Map Center**: Modify `NY_CENTER` and `NY_ZOOM` in `App.tsx`
- **Adjust Refresh Interval**: Change `REFRESH_INTERVAL_MS` in `App.tsx`
- **Customize Colors**: Update `FlightCategoryColors` in `src/types/flightCategory.ts`
- **Add Features**: Services are modular and can be extended

## API

Uses the NOAA Aviation Weather Center API:
- Endpoint: `https://aviationweather.gov/api/data/metar`
- Format: JSON
- Stations: ICAO codes (e.g., KJFK, KLGA)

## License

MIT

