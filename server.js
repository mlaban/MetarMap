import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for the React app
app.use(cors());

// Proxy endpoint for METAR data
app.get('/api/metar', async (req, res) => {
  try {
    const { ids, format = 'json', taf = 'false' } = req.query;
    
    if (!ids) {
      return res.status(400).json({ error: 'Station IDs (ids) parameter is required' });
    }

    const url = `https://aviationweather.gov/api/data/metar?ids=${ids}&format=${format}&taf=${taf}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Aviation Weather API error: ${response.statusText}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Failed to fetch METAR data', message: error.message });
  }
});

// Proxy endpoint for TAF data
app.get('/api/taf', async (req, res) => {
  try {
    const { ids, format = 'json' } = req.query;
    
    if (!ids) {
      return res.status(400).json({ error: 'Station IDs (ids) parameter is required' });
    }

    const url = `https://aviationweather.gov/api/data/taf?ids=${ids}&format=${format}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Aviation Weather API error: ${response.statusText}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Failed to fetch TAF data', message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`METAR proxy server running on http://localhost:${PORT}`);
  console.log(`Proxy endpoint: http://localhost:${PORT}/api/metar`);
});

