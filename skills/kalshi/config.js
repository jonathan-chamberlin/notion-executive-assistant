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

// API URLs
export const KALSHI_API_URL = 'https://api.elections.kalshi.com/trade-api/v2';
export const NOAA_BASE_URL = 'https://api.weather.gov';
export const NOAA_USER_AGENT = process.env.NOAA_USER_AGENT || 'weather-trading-bot';
