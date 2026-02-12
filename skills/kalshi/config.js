import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- Configuration ---

export const CONFIG = {
  // Kalshi weather market cities (all US, all use NOAA)
  cities: ['NYC', 'Chicago', 'Miami', 'Austin', 'LA', 'Philadelphia', 'DC', 'Denver', 'SF'],
  scanIntervalMinutes: 10,
  maxTradeSize: 500,     // cents per trade
  maxDailySpend: 5000,   // cents per day
  minEdge: 20,           // percentage points (forecast confidence must exceed market price by this much)
};

// --- Runtime Trading Config ---

export const TRADING_CONFIG_PATH = path.join(__dirname, 'trading-config.json');

const VALID_MODES = ['paused', 'alert-only', 'alert-then-trade', 'autonomous'];

const TRADING_DEFAULTS = {
  mode: 'alert-only',
  maxDailySpend: 1000,
  minEdge: 20,
  maxTradeSize: 500,
  scanIntervalMinutes: 30,
  usageAlertIntervalMinutes: 10,
  topOpportunitiesToShow: 5,
  autoTradeMaxPerScan: 2,
  sigma: 3.0,           // legacy fallback (used if sigmaToday/sigmaTomorrow missing)
  sigmaToday: 2.0,      // NOAA same-day forecast error ~2°F
  sigmaTomorrow: 3.5,   // NOAA next-day forecast error ~3-4°F
  kellyMultiplier: 0.25,
  minTradeSize: 5,
};

/**
 * Load runtime trading config from trading-config.json.
 * Falls back to TRADING_DEFAULTS if file is missing or malformed.
 * Merges overrides into CONFIG (maxDailySpend, minEdge, maxTradeSize, scanIntervalMinutes).
 */
export function loadTradingConfig() {
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(TRADING_CONFIG_PATH, 'utf-8'));
  } catch {
    raw = {};
  }

  const config = { ...TRADING_DEFAULTS, ...raw };

  // Validate mode
  if (!VALID_MODES.includes(config.mode)) {
    config.mode = TRADING_DEFAULTS.mode;
  }

  // Apply runtime overrides to CONFIG
  if (typeof config.maxDailySpend === 'number' && config.maxDailySpend > 0) {
    CONFIG.maxDailySpend = config.maxDailySpend;
  }
  if (typeof config.minEdge === 'number' && config.minEdge > 0) {
    CONFIG.minEdge = config.minEdge;
  }
  if (typeof config.maxTradeSize === 'number' && config.maxTradeSize > 0) {
    CONFIG.maxTradeSize = config.maxTradeSize;
  }
  if (typeof config.scanIntervalMinutes === 'number' && config.scanIntervalMinutes > 0) {
    CONFIG.scanIntervalMinutes = config.scanIntervalMinutes;
  }

  return config;
}

/**
 * Save updated trading config to trading-config.json.
 */
export function saveTradingConfig(config) {
  fs.writeFileSync(TRADING_CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

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

// NOAA observation stations for settlement verification (matches Kalshi's NWS CLI sources)
export const CITY_OBSERVATION_STATIONS = {
  'NYC':          'KNYC',   // Central Park
  'Chicago':      'KMDW',   // Midway (NOT O'Hare)
  'Miami':        'KMIA',   // Miami International
  'Austin':       'KAUS',   // Austin-Bergstrom
  'LA':           'KLAX',   // LAX
  'Philadelphia': 'KPHL',   // Philadelphia International
  'DC':           'KDCA',   // Reagan National
  'Denver':       'KDEN',   // Denver International
  'SF':           'KSFO',   // SFO
};

// City coordinates for Open-Meteo ensemble API
export const CITY_COORDS = {
  'NYC':          { lat: 40.7829, lon: -73.9654 },   // Central Park
  'Chicago':      { lat: 41.7868, lon: -87.7522 },   // Midway
  'Miami':        { lat: 25.7959, lon: -80.2870 },   // KMIA
  'Austin':       { lat: 30.1945, lon: -97.6699 },   // KAUS
  'LA':           { lat: 33.9425, lon: -118.4081 },   // KLAX
  'Philadelphia': { lat: 39.8721, lon: -75.2411 },   // KPHL
  'DC':           { lat: 38.8512, lon: -77.0402 },    // KDCA
  'Denver':       { lat: 39.8561, lon: -104.6737 },   // KDEN
  'SF':           { lat: 37.6213, lon: -122.3790 },   // KSFO
};

// City timezones (IANA) for time-of-day filtering
export const CITY_TIMEZONES = {
  'NYC':          'America/New_York',
  'Chicago':      'America/Chicago',
  'Miami':        'America/New_York',
  'Austin':       'America/Chicago',
  'LA':           'America/Los_Angeles',
  'Philadelphia': 'America/New_York',
  'DC':           'America/New_York',
  'Denver':       'America/Denver',
  'SF':           'America/Los_Angeles',
};

// API URLs
export const KALSHI_API_URL = 'https://api.elections.kalshi.com/trade-api/v2';
export const NOAA_BASE_URL = 'https://api.weather.gov';
export const NOAA_USER_AGENT = process.env.NOAA_USER_AGENT || 'weather-trading-bot';
