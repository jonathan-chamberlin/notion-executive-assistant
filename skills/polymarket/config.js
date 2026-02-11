// --- Configuration ---

export const CONFIG = {
  // Kalshi weather market cities (all US, all use NOAA)
  cities: ['NYC', 'Chicago', 'Miami', 'Austin', 'LA', 'Philadelphia', 'DC', 'Denver', 'SF'],
  scanIntervalMinutes: 10,
  maxTradeSize: 500,     // cents per trade
  maxDailySpend: 5000,   // cents per day
  minEdge: 20,           // percentage points (forecast confidence must exceed market price by this much)
};

// Kalshi series tickers for weather markets
export const CITY_SERIES = {
  'NYC':          'KXHIGHNY',
  'Chicago':      'KXHIGHCHI',
  'Miami':        'KXHIGHMIA',
  'Austin':       'KXHIGHAUS',
  'LA':           'KXHIGHLAX',
  'Philadelphia': 'KXHIGHPHIL',
  'DC':           'KXHIGHTDC',
  'Denver':       'KXHIGHDEN',
  'SF':           'KXHIGHTSFO',
};

// NOAA NWS API gridpoints for each city (free, no auth)
export const CITY_FORECAST_CONFIG = {
  'NYC':          { gridpoint: 'OKX/33,37' },
  'Chicago':      { gridpoint: 'LOT/76,73' },
  'Miami':        { gridpoint: 'MFL/110,50' },
  'Austin':       { gridpoint: 'EWX/156,91' },
  'LA':           { gridpoint: 'LOX/154,44' },
  'Philadelphia': { gridpoint: 'PHI/57,97' },
  'DC':           { gridpoint: 'LWX/97,71' },
  'Denver':       { gridpoint: 'BOU/62,60' },
  'SF':           { gridpoint: 'MTR/85,105' },
};

// API URLs
export const KALSHI_API_URL = 'https://api.elections.kalshi.com/trade-api/v2';
export const NOAA_BASE_URL = 'https://api.weather.gov';
export const NOAA_USER_AGENT = process.env.NOAA_USER_AGENT || 'weather-trading-bot';
