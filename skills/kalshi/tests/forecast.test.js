import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  temperatureBucketConfidence,
  getForecast,
  getAllForecasts,
} from '../forecast.js';

// ── 1. temperatureBucketConfidence (pure math) ──────────────────────────────

describe('temperatureBucketConfidence', () => {

  it('center bucket has highest probability (~0.495)', () => {
    // forecast=70, bucket [68,72] is centered on forecast
    const prob = temperatureBucketConfidence(70, 68, 72);
    // 4-degree window centered on mean with sigma=3 should capture ~49.5%
    assert.ok(prob > 0.45, `Expected >0.45 but got ${prob}`);
    assert.ok(prob < 0.55, `Expected <0.55 but got ${prob}`);
  });

  it('far bucket has very low probability (<0.01)', () => {
    // forecast=70, bucket [80,84] is 10-14 degrees away (>3 sigma)
    const prob = temperatureBucketConfidence(70, 80, 84);
    assert.ok(prob < 0.01, `Expected <0.01 but got ${prob}`);
  });

  it('open low end returns CDF for <=bucketHigh', () => {
    // forecast=70, bucket [null, 65] means P(temp <= 65)
    // z = (65 - 70) / 3 = -5/3 ~ -1.667 => CDF ~ 0.048
    const prob = temperatureBucketConfidence(70, null, 65);
    assert.ok(prob > 0.03, `Expected >0.03 but got ${prob}`);
    assert.ok(prob < 0.07, `Expected <0.07 but got ${prob}`);
  });

  it('open high end returns 1 - CDF for >=bucketLow', () => {
    // forecast=70, bucket [75, null] means P(temp >= 75)
    // z = (75 - 70) / 3 = 5/3 ~ 1.667 => 1 - CDF ~ 0.048
    const prob = temperatureBucketConfidence(70, 75, null);
    assert.ok(prob > 0.03, `Expected >0.03 but got ${prob}`);
    assert.ok(prob < 0.07, `Expected <0.07 but got ${prob}`);
  });

  it('symmetric buckets equidistant from forecast have equal probability', () => {
    // P(temp <= 65 | forecast=70) should equal P(temp >= 75 | forecast=70)
    const pLow = temperatureBucketConfidence(70, null, 65);
    const pHigh = temperatureBucketConfidence(70, 75, null);
    assert.ok(
      Math.abs(pLow - pHigh) < 1e-6,
      `Expected symmetry: P(<=65)=${pLow} vs P(>=75)=${pHigh}, diff=${Math.abs(pLow - pHigh)}`,
    );
  });

  it('sigma=1 gives tighter distribution than sigma=3 for center bucket', () => {
    const probSigma1 = temperatureBucketConfidence(70, 68, 72, 1);
    const probSigma3 = temperatureBucketConfidence(70, 68, 72, 3);
    assert.ok(
      probSigma1 > probSigma3,
      `sigma=1 prob (${probSigma1}) should exceed sigma=3 prob (${probSigma3})`,
    );
  });

  it('wide bucket captures almost all probability (>0.99)', () => {
    // forecast=70, bucket [60, 80] spans ~3.3 sigma on each side
    const prob = temperatureBucketConfidence(70, 60, 80);
    assert.ok(prob > 0.99, `Expected >0.99 but got ${prob}`);
  });
});

// ── 2. getForecast (real NOAA API call) ─────────────────────────────────────

describe('getForecast', () => {

  it('returns a valid forecast for a known city (NYC)', { timeout: 30000 }, async () => {
    const result = await getForecast('NYC');

    assert.strictEqual(result.success, true, `Expected success but got: ${JSON.stringify(result)}`);
    assert.ok(result.forecast, 'Result should contain a forecast object');

    const { forecast } = result;
    assert.strictEqual(forecast.city, 'NYC');
    assert.strictEqual(forecast.source, 'noaa');

    // Today's forecast
    assert.ok(forecast.today, 'forecast.today should exist');
    assert.strictEqual(typeof forecast.today.highTemp, 'number', 'today.highTemp should be a number');
    assert.strictEqual(forecast.today.unit, 'F', 'today.unit should be F');
    assert.strictEqual(typeof forecast.today.shortForecast, 'string', 'today.shortForecast should be a string');

    // Tomorrow's forecast
    assert.ok(forecast.tomorrow, 'forecast.tomorrow should exist');
    assert.strictEqual(typeof forecast.tomorrow.highTemp, 'number', 'tomorrow.highTemp should be a number');
  });

  it('returns an error for an unknown city', { timeout: 30000 }, async () => {
    const result = await getForecast('Tokyo');

    assert.strictEqual(result.success, false);
    assert.strictEqual(typeof result.error, 'string');
    assert.ok(
      result.error.includes('Available') || result.error.includes('Unknown'),
      `Error message should mention available cities, got: "${result.error}"`,
    );
  });
});

// ── 3. getAllForecasts (real NOAA API call) ──────────────────────────────────

describe('getAllForecasts', () => {

  it('returns a forecasts array with length > 0', { timeout: 30000 }, async () => {
    const result = await getAllForecasts();

    assert.strictEqual(result.success, true, `Expected success but got: ${JSON.stringify(result)}`);
    assert.ok(Array.isArray(result.forecasts), 'result.forecasts should be an array');
    assert.ok(result.forecasts.length > 0, 'forecasts array should not be empty');

    // Each forecast should have the expected shape
    for (const forecast of result.forecasts) {
      assert.strictEqual(typeof forecast.city, 'string', 'forecast.city should be a string');
      assert.strictEqual(forecast.source, 'noaa', 'forecast.source should be noaa');
      assert.ok(forecast.today !== undefined, 'forecast.today should be defined');
      assert.ok(forecast.tomorrow !== undefined, 'forecast.tomorrow should be defined');
    }
  });

  it('covers multiple cities', { timeout: 30000 }, async () => {
    const result = await getAllForecasts();

    assert.strictEqual(result.success, true);
    assert.ok(Array.isArray(result.forecasts));

    const cities = result.forecasts.map(f => f.city);
    const uniqueCities = new Set(cities);
    assert.ok(
      uniqueCities.size > 1,
      `Expected multiple unique cities but got: ${[...uniqueCities].join(', ')}`,
    );
  });
});
