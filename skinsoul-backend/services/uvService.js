// ============================================================
//  services/uvService.js — UV Index data via OpenWeatherMap
// ============================================================

const https = require('https');

// Simple cache: { city → { uv, label, advice, fetchedAt } }
const cache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function uvLabel(uv) {
  if (uv <= 2) return 'Low';
  if (uv <= 5) return 'Moderate';
  if (uv <= 7) return 'High';
  if (uv <= 10) return 'Very High';
  return 'Extreme';
}

function uvAdvice(uv) {
  if (uv <= 2) return 'Minimal protection needed. SPF 15 is fine outdoors.';
  if (uv <= 5) return 'Wear SPF 30+. Seek shade during midday hours.';
  if (uv <= 7) return 'SPF 50+ recommended. Wear protective clothing and a hat.';
  if (uv <= 10) return 'Apply SPF 50+ and reapply every 2 hours. Avoid 11am–3pm sun.';
  return 'Extreme UV today. Minimize outdoor exposure. SPF 50+ mandatory. Cover up fully.';
}

function uvColor(uv) {
  if (uv <= 2) return '#4CAF50';  // Green
  if (uv <= 5) return '#FFEB3B';  // Yellow
  if (uv <= 7) return '#FF9800';  // Orange
  if (uv <= 10) return '#F44336'; // Red
  return '#9C27B0';               // Purple
}

/**
 * Fetch real UV index for a city.
 * Falls back to a seasonal estimate if the API key is missing.
 */
async function getUVIndex(city = 'Delhi') {
  // Return cached data if fresh
  const cached = cache.get(city.toLowerCase());
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached;
  }

  // No API key → return seasonal estimate
  if (!process.env.OPENWEATHER_API_KEY || process.env.OPENWEATHER_API_KEY === 'your_openweather_key_here') {
    return fallbackUV(city);
  }

  try {
    // Step 1: Geocode the city
    const geo = await httpGet(
      `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${process.env.OPENWEATHER_API_KEY}`
    );
    if (!geo.length) return fallbackUV(city);

    const { lat, lon } = geo[0];

    // Step 2: Fetch current UV
    const weather = await httpGet(
      `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&exclude=minutely,hourly,daily,alerts&appid=${process.env.OPENWEATHER_API_KEY}`
    );

    const uv = Math.round(weather.current?.uvi ?? 6);
    const result = buildUVResult(uv, city);
    cache.set(city.toLowerCase(), { ...result, fetchedAt: Date.now() });
    return result;

  } catch (err) {
    console.warn(`[UV] API fetch failed for "${city}": ${err.message}. Using fallback.`);
    return fallbackUV(city);
  }
}

function buildUVResult(uv, city) {
  return {
    city,
    uv,
    label: uvLabel(uv),
    advice: uvAdvice(uv),
    color: uvColor(uv),
    source: 'live',
  };
}

function fallbackUV(city) {
  // Reasonable seasonal estimate for Indian cities in summer
  const month = new Date().getMonth(); // 0-11
  const isSummer = month >= 2 && month <= 8;
  const uv = isSummer ? 8 : 5;
  return {
    city,
    uv,
    label: uvLabel(uv),
    advice: uvAdvice(uv),
    color: uvColor(uv),
    source: 'estimate',
  };
}

// Simple promise-based HTTPS GET that parses JSON
function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Failed to parse API response')); }
      });
    }).on('error', reject);
  });
}

module.exports = { getUVIndex };
