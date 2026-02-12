import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  CONFIG,
  CITY_SERIES,
  CITY_FORECAST_CONFIG,
  CITY_OBSERVATION_STATIONS,
  CITY_TIMEZONES,
  CITY_COORDS,
  KALSHI_API_URL,
  NOAA_BASE_URL,
  NOAA_USER_AGENT,
  loadTradingConfig,
} from '../config.js';

// ── 1. CONFIG structure ────────────────────────────────────────────────────────

describe('CONFIG structure', () => {
  const expectedKeys = ['cities', 'scanIntervalMinutes', 'maxTradeSize', 'maxDailySpend', 'minEdge'];

  it('has all expected keys', () => {
    for (const key of expectedKeys) {
      assert.ok(key in CONFIG, `CONFIG is missing key "${key}"`);
    }
  });

  it('cities is an array', () => {
    assert.ok(Array.isArray(CONFIG.cities));
  });

  it('scanIntervalMinutes is a number', () => {
    assert.strictEqual(typeof CONFIG.scanIntervalMinutes, 'number');
  });

  it('maxTradeSize is a number', () => {
    assert.strictEqual(typeof CONFIG.maxTradeSize, 'number');
  });

  it('maxDailySpend is a number', () => {
    assert.strictEqual(typeof CONFIG.maxDailySpend, 'number');
  });

  it('minEdge is a number', () => {
    assert.strictEqual(typeof CONFIG.minEdge, 'number');
  });
});

// ── 2. CONFIG.cities ───────────────────────────────────────────────────────────

describe('CONFIG.cities', () => {
  it('is a non-empty array', () => {
    assert.ok(Array.isArray(CONFIG.cities));
    assert.ok(CONFIG.cities.length > 0, 'cities array must not be empty');
  });

  it('every element is a string', () => {
    for (const city of CONFIG.cities) {
      assert.strictEqual(typeof city, 'string', `Expected string but got ${typeof city}: ${city}`);
    }
  });

  it('contains no duplicates', () => {
    const unique = new Set(CONFIG.cities);
    assert.strictEqual(unique.size, CONFIG.cities.length, 'cities array contains duplicates');
  });
});

// ── 3. CONFIG limits ───────────────────────────────────────────────────────────

describe('CONFIG limits', () => {
  it('maxTradeSize is greater than 0', () => {
    assert.ok(CONFIG.maxTradeSize > 0, `maxTradeSize must be > 0, got ${CONFIG.maxTradeSize}`);
  });

  it('maxDailySpend is greater than maxTradeSize', () => {
    assert.ok(
      CONFIG.maxDailySpend > CONFIG.maxTradeSize,
      `maxDailySpend (${CONFIG.maxDailySpend}) must be > maxTradeSize (${CONFIG.maxTradeSize})`,
    );
  });

  it('minEdge is between 0 and 100 (exclusive)', () => {
    assert.ok(CONFIG.minEdge > 0, `minEdge must be > 0, got ${CONFIG.minEdge}`);
    assert.ok(CONFIG.minEdge < 100, `minEdge must be < 100, got ${CONFIG.minEdge}`);
  });
});

// ── 4. CITY_SERIES ─────────────────────────────────────────────────────────────

describe('CITY_SERIES', () => {
  it('has an entry for every city in CONFIG.cities', () => {
    for (const city of CONFIG.cities) {
      assert.ok(city in CITY_SERIES, `CITY_SERIES is missing entry for "${city}"`);
    }
  });

  it('all values are non-empty strings starting with "KX"', () => {
    for (const city of CONFIG.cities) {
      const ticker = CITY_SERIES[city];
      assert.strictEqual(typeof ticker, 'string', `CITY_SERIES["${city}"] should be a string`);
      assert.ok(ticker.length > 0, `CITY_SERIES["${city}"] must not be empty`);
      assert.ok(ticker.startsWith('KX'), `CITY_SERIES["${city}"] = "${ticker}" must start with "KX"`);
    }
  });
});

// ── 5. CITY_FORECAST_CONFIG ────────────────────────────────────────────────────

describe('CITY_FORECAST_CONFIG', () => {
  const gridpointPattern = /^[A-Z]{3}\/\d+,\d+$/;

  it('has an entry for every city in CONFIG.cities', () => {
    for (const city of CONFIG.cities) {
      assert.ok(city in CITY_FORECAST_CONFIG, `CITY_FORECAST_CONFIG is missing entry for "${city}"`);
    }
  });

  it('every entry has a gridpoint string matching pattern XXX/NN,NN', () => {
    for (const city of CONFIG.cities) {
      const entry = CITY_FORECAST_CONFIG[city];
      assert.strictEqual(
        typeof entry.gridpoint,
        'string',
        `CITY_FORECAST_CONFIG["${city}"].gridpoint should be a string`,
      );
      assert.ok(
        gridpointPattern.test(entry.gridpoint),
        `CITY_FORECAST_CONFIG["${city}"].gridpoint = "${entry.gridpoint}" does not match pattern XXX/NN,NN`,
      );
    }
  });
});

// ── 6. API URLs ────────────────────────────────────────────────────────────────

describe('API URLs', () => {
  it('KALSHI_API_URL starts with https://', () => {
    assert.ok(
      KALSHI_API_URL.startsWith('https://'),
      `KALSHI_API_URL must start with "https://", got "${KALSHI_API_URL}"`,
    );
  });

  it('NOAA_BASE_URL starts with https://', () => {
    assert.ok(
      NOAA_BASE_URL.startsWith('https://'),
      `NOAA_BASE_URL must start with "https://", got "${NOAA_BASE_URL}"`,
    );
  });

  it('NOAA_USER_AGENT is a non-empty string', () => {
    assert.strictEqual(typeof NOAA_USER_AGENT, 'string');
    assert.ok(NOAA_USER_AGENT.length > 0, 'NOAA_USER_AGENT must not be empty');
  });
});

// ── 7. CITY_OBSERVATION_STATIONS ───────────────────────────────────────────────

describe('CITY_OBSERVATION_STATIONS', () => {
  const stationPattern = /^K[A-Z]{3}$/;

  it('has an entry for every city in CONFIG.cities', () => {
    for (const city of CONFIG.cities) {
      assert.ok(city in CITY_OBSERVATION_STATIONS, `CITY_OBSERVATION_STATIONS is missing entry for "${city}"`);
    }
  });

  it('all values are 4-character ICAO station codes starting with K', () => {
    for (const city of CONFIG.cities) {
      const stationId = CITY_OBSERVATION_STATIONS[city];
      assert.strictEqual(typeof stationId, 'string', `CITY_OBSERVATION_STATIONS["${city}"] should be a string`);
      assert.ok(
        stationPattern.test(stationId),
        `CITY_OBSERVATION_STATIONS["${city}"] = "${stationId}" must match pattern K[A-Z]{3}`,
      );
    }
  });
});

// ── 8. CITY_TIMEZONES ──────────────────────────────────────────────────────────

describe('CITY_TIMEZONES', () => {
  const timezonePattern = /^[A-Za-z_]+\/[A-Za-z_]+$/;

  it('has an entry for every city in CONFIG.cities', () => {
    for (const city of CONFIG.cities) {
      assert.ok(city in CITY_TIMEZONES, `CITY_TIMEZONES is missing entry for "${city}"`);
    }
  });

  it('keys match CONFIG.cities exactly (no extras)', () => {
    const citySet = new Set(CONFIG.cities);
    const timezoneKeys = Object.keys(CITY_TIMEZONES);
    assert.strictEqual(
      timezoneKeys.length,
      citySet.size,
      `CITY_TIMEZONES has ${timezoneKeys.length} keys but CONFIG.cities has ${citySet.size} entries`,
    );
    for (const key of timezoneKeys) {
      assert.ok(citySet.has(key), `CITY_TIMEZONES has extra key "${key}" not in CONFIG.cities`);
    }
  });

  it('all values are non-empty strings', () => {
    for (const city of CONFIG.cities) {
      const tz = CITY_TIMEZONES[city];
      assert.strictEqual(typeof tz, 'string', `CITY_TIMEZONES["${city}"] should be a string`);
      assert.ok(tz.length > 0, `CITY_TIMEZONES["${city}"] must not be empty`);
    }
  });

  it('all values match IANA timezone pattern (contain /)', () => {
    for (const city of CONFIG.cities) {
      const tz = CITY_TIMEZONES[city];
      assert.ok(
        timezonePattern.test(tz),
        `CITY_TIMEZONES["${city}"] = "${tz}" does not match IANA pattern (e.g., "America/New_York")`,
      );
    }
  });
});

// ── 9. CITY_COORDS ─────────────────────────────────────────────────────────────

describe('CITY_COORDS', () => {
  it('has an entry for every city in CONFIG.cities', () => {
    for (const city of CONFIG.cities) {
      assert.ok(city in CITY_COORDS, `CITY_COORDS is missing entry for "${city}"`);
    }
  });

  it('keys match CONFIG.cities exactly (no extras)', () => {
    const citySet = new Set(CONFIG.cities);
    const coordKeys = Object.keys(CITY_COORDS);
    assert.strictEqual(
      coordKeys.length,
      citySet.size,
      `CITY_COORDS has ${coordKeys.length} keys but CONFIG.cities has ${citySet.size} entries`,
    );
    for (const key of coordKeys) {
      assert.ok(citySet.has(key), `CITY_COORDS has extra key "${key}" not in CONFIG.cities`);
    }
  });

  it('each entry has lat (number between -90 and 90) and lon (number between -180 and 180)', () => {
    for (const city of CONFIG.cities) {
      const coords = CITY_COORDS[city];
      assert.ok(coords.lat !== undefined, `CITY_COORDS["${city}"] is missing lat`);
      assert.ok(coords.lon !== undefined, `CITY_COORDS["${city}"] is missing lon`);
      assert.strictEqual(typeof coords.lat, 'number', `CITY_COORDS["${city}"].lat should be a number`);
      assert.strictEqual(typeof coords.lon, 'number', `CITY_COORDS["${city}"].lon should be a number`);
      assert.ok(
        coords.lat >= -90 && coords.lat <= 90,
        `CITY_COORDS["${city}"].lat = ${coords.lat} must be between -90 and 90`,
      );
      assert.ok(
        coords.lon >= -180 && coords.lon <= 180,
        `CITY_COORDS["${city}"].lon = ${coords.lon} must be between -180 and 180`,
      );
    }
  });

  it('all cities have US coordinates (lat 24-50, lon -125 to -65)', () => {
    for (const city of CONFIG.cities) {
      const coords = CITY_COORDS[city];
      assert.ok(
        coords.lat >= 24 && coords.lat <= 50,
        `CITY_COORDS["${city}"].lat = ${coords.lat} should be within US mainland range (24-50)`,
      );
      assert.ok(
        coords.lon >= -125 && coords.lon <= -65,
        `CITY_COORDS["${city}"].lon = ${coords.lon} should be within US mainland range (-125 to -65)`,
      );
    }
  });
});

// ── 10. loadTradingConfig sigma defaults ───────────────────────────────────────

describe('loadTradingConfig sigma defaults', () => {
  it('default config includes sigmaToday (number > 0)', () => {
    const config = loadTradingConfig();
    assert.ok(config.sigmaToday !== undefined, 'config.sigmaToday is missing');
    assert.strictEqual(typeof config.sigmaToday, 'number', 'config.sigmaToday should be a number');
    assert.ok(config.sigmaToday > 0, `config.sigmaToday = ${config.sigmaToday} must be > 0`);
  });

  it('default config includes sigmaTomorrow (number > 0)', () => {
    const config = loadTradingConfig();
    assert.ok(config.sigmaTomorrow !== undefined, 'config.sigmaTomorrow is missing');
    assert.strictEqual(typeof config.sigmaTomorrow, 'number', 'config.sigmaTomorrow should be a number');
    assert.ok(config.sigmaTomorrow > 0, `config.sigmaTomorrow = ${config.sigmaTomorrow} must be > 0`);
  });

  it('sigmaTomorrow > sigmaToday (tomorrow has more uncertainty)', () => {
    const config = loadTradingConfig();
    assert.ok(
      config.sigmaTomorrow > config.sigmaToday,
      `config.sigmaTomorrow (${config.sigmaTomorrow}) should be > sigmaToday (${config.sigmaToday})`,
    );
  });
});

// ── 11. Consistency ────────────────────────────────────────────────────────────

describe('Consistency across CONFIG.cities, CITY_SERIES, CITY_FORECAST_CONFIG, CITY_OBSERVATION_STATIONS, CITY_TIMEZONES, and CITY_COORDS', () => {
  const citySet = new Set(CONFIG.cities);
  const seriesKeys = Object.keys(CITY_SERIES);
  const forecastKeys = Object.keys(CITY_FORECAST_CONFIG);
  const stationKeys = Object.keys(CITY_OBSERVATION_STATIONS);
  const timezoneKeys = Object.keys(CITY_TIMEZONES);
  const coordKeys = Object.keys(CITY_COORDS);

  it('CITY_SERIES keys match CONFIG.cities exactly', () => {
    assert.strictEqual(
      seriesKeys.length,
      citySet.size,
      `CITY_SERIES has ${seriesKeys.length} keys but CONFIG.cities has ${citySet.size} entries`,
    );
    for (const key of seriesKeys) {
      assert.ok(citySet.has(key), `CITY_SERIES has extra key "${key}" not in CONFIG.cities`);
    }
  });

  it('CITY_FORECAST_CONFIG keys match CONFIG.cities exactly', () => {
    assert.strictEqual(
      forecastKeys.length,
      citySet.size,
      `CITY_FORECAST_CONFIG has ${forecastKeys.length} keys but CONFIG.cities has ${citySet.size} entries`,
    );
    for (const key of forecastKeys) {
      assert.ok(citySet.has(key), `CITY_FORECAST_CONFIG has extra key "${key}" not in CONFIG.cities`);
    }
  });

  it('CITY_OBSERVATION_STATIONS keys match CONFIG.cities exactly', () => {
    assert.strictEqual(
      stationKeys.length,
      citySet.size,
      `CITY_OBSERVATION_STATIONS has ${stationKeys.length} keys but CONFIG.cities has ${citySet.size} entries`,
    );
    for (const key of stationKeys) {
      assert.ok(citySet.has(key), `CITY_OBSERVATION_STATIONS has extra key "${key}" not in CONFIG.cities`);
    }
  });

  it('CITY_TIMEZONES keys match CONFIG.cities exactly', () => {
    assert.strictEqual(
      timezoneKeys.length,
      citySet.size,
      `CITY_TIMEZONES has ${timezoneKeys.length} keys but CONFIG.cities has ${citySet.size} entries`,
    );
    for (const key of timezoneKeys) {
      assert.ok(citySet.has(key), `CITY_TIMEZONES has extra key "${key}" not in CONFIG.cities`);
    }
  });

  it('CITY_COORDS keys match CONFIG.cities exactly', () => {
    assert.strictEqual(
      coordKeys.length,
      citySet.size,
      `CITY_COORDS has ${coordKeys.length} keys but CONFIG.cities has ${citySet.size} entries`,
    );
    for (const key of coordKeys) {
      assert.ok(citySet.has(key), `CITY_COORDS has extra key "${key}" not in CONFIG.cities`);
    }
  });
});
