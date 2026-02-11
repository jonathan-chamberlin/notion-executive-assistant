import crypto from 'crypto';
import fs from 'fs';
import { CONFIG, KALSHI_API_URL, NOAA_BASE_URL, NOAA_USER_AGENT, CITY_SERIES } from './config.js';

// Kalshi credentials
export const KALSHI_API_KEY_ID = process.env.KALSHI_API_KEY_ID;
const KALSHI_PRIVATE_KEY_PATH = process.env.KALSHI_PRIVATE_KEY_PATH;
let _privateKey = null;

function getPrivateKey() {
  if (_privateKey) return _privateKey;
  if (process.env.KALSHI_PRIVATE_KEY_PEM) {
    _privateKey = process.env.KALSHI_PRIVATE_KEY_PEM;
    return _privateKey;
  }
  if (KALSHI_PRIVATE_KEY_PATH) {
    _privateKey = fs.readFileSync(KALSHI_PRIVATE_KEY_PATH, 'utf8');
    return _privateKey;
  }
  return null;
}

// --- Environment Validation ---

export function validateEnv() {
  const errors = [];
  if (!KALSHI_API_KEY_ID) errors.push('KALSHI_API_KEY_ID is not set');
  if (!getPrivateKey()) errors.push('KALSHI_PRIVATE_KEY_PATH or KALSHI_PRIVATE_KEY_PEM is not set');
  return errors;
}

// --- Logging ---

export function logAction(action, details, level = 'info') {
  const entry = {
    skill: 'WeatherTradingSkill',
    level,
    action,
    timestamp: new Date().toISOString(),
    ...details,
  };
  const msg = JSON.stringify(entry);
  if (level === 'error') console.error(msg);
  else if (level === 'warn') console.warn(msg);
  else console.log(msg);
}

// --- Kalshi API Auth (RSA-PSS signing) ---

function signRequest(timestamp, method, path) {
  const privateKey = getPrivateKey();
  if (!privateKey) throw new Error('Kalshi private key not configured');

  const pathWithoutQuery = path.split('?')[0];
  const message = `${timestamp}${method}${pathWithoutQuery}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(message);
  signer.end();

  return signer.sign({
    key: privateKey,
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
  }, 'base64');
}

function getAuthHeaders(method, path) {
  const timestamp = Date.now().toString();
  const signature = signRequest(timestamp, method, path);
  return {
    'KALSHI-ACCESS-KEY': KALSHI_API_KEY_ID,
    'KALSHI-ACCESS-TIMESTAMP': timestamp,
    'KALSHI-ACCESS-SIGNATURE': signature,
    'Content-Type': 'application/json',
  };
}

// --- Kalshi API Client ---

/** Public (unauthenticated) Kalshi API fetch */
export async function kalshiFetch(path) {
  const response = await fetch(`${KALSHI_API_URL}${path}`, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Kalshi API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/** Authenticated Kalshi API fetch */
export async function kalshiAuthFetch(method, path, body = null) {
  const envErrors = validateEnv();
  if (envErrors.length > 0) {
    throw new Error(envErrors.join(', '));
  }

  const fullPath = `/trade-api/v2${path}`;
  const headers = getAuthHeaders(method, fullPath);

  const options = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${KALSHI_API_URL}${path}`, options);

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Kalshi API error: ${response.status} ${response.statusText} ${text}`);
  }

  return response.json();
}

// --- NOAA API Client (public, no auth) ---

export async function noaaFetch(path) {
  const response = await fetch(`${NOAA_BASE_URL}${path}`, {
    headers: {
      'User-Agent': NOAA_USER_AGENT,
      'Accept': 'application/geo+json',
    },
  });

  if (!response.ok) {
    throw new Error(`NOAA API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// --- Error Formatting ---

export function formatApiError(error) {
  if (error.message?.includes('401') || error.message?.includes('403')) {
    return 'Authentication failed. Check your KALSHI_API_KEY_ID and private key.';
  }
  if (error.message?.includes('429')) {
    return 'Rate limited. Wait a moment and try again.';
  }
  return error.message || 'Unknown API error';
}

// --- Event Ticker Builder ---

/**
 * Build a Kalshi event ticker for a city and date.
 * Format: KXHIGHNY-26FEB12 (series + YY + MMM + DD)
 */
export function buildEventTicker(city, dateObj) {
  const series = CITY_SERIES[city];
  if (!series) return null;

  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
    'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  const yy = String(dateObj.getFullYear()).slice(-2);
  const mmm = months[dateObj.getMonth()];
  const dd = String(dateObj.getDate()).padStart(2, '0');

  return `${series}-${yy}${mmm}${dd}`;
}
