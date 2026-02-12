import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { CONFIG, CITY_COORDS } from '../config.js';
import { getEnsembleForecast, getAllEnsembleForecasts, ensembleBucketConfidence } from '../ensemble.js';

// ── 1. CITY_COORDS ─────────────────────────────────────────────────────────

describe('CITY_COORDS', () => {
  it('should have coordinates for all 9 cities', () => {
    for (const city of CONFIG.cities) {
      assert.ok(CITY_COORDS[city], `Missing coordinates for ${city}`);
      assert.strictEqual(typeof CITY_COORDS[city].lat, 'number', `${city} lat should be a number`);
      assert.strictEqual(typeof CITY_COORDS[city].lon, 'number', `${city} lon should be a number`);
      // Verify reasonable US lat/lon ranges
      assert.ok(
        CITY_COORDS[city].lat >= 25 && CITY_COORDS[city].lat <= 48,
        `${city} lat ${CITY_COORDS[city].lat} out of US range (25-48)`,
      );
      assert.ok(
        CITY_COORDS[city].lon >= -125 && CITY_COORDS[city].lon <= -70,
        `${city} lon ${CITY_COORDS[city].lon} out of US range (-125 to -70)`,
      );
    }
  });
});

// ── 2. ensembleBucketConfidence unit tests ─────────────────────────────────

describe('ensembleBucketConfidence - basic cases', () => {
  it('should return 0 for empty members array', () => {
    assert.strictEqual(ensembleBucketConfidence([], 30, 35), 0);
  });

  it('should return 1.0 when all members fall in bucket', () => {
    const members = [32, 33, 34, 33, 32, 34, 33, 33, 32, 34];
    assert.strictEqual(ensembleBucketConfidence(members, 30, 35), 1.0);
  });

  it('should return 0.0 when no members fall in bucket', () => {
    const members = [40, 41, 42, 43, 44, 45, 46, 47, 48, 49];
    assert.strictEqual(ensembleBucketConfidence(members, 30, 35), 0);
  });

  it('should compute correct fraction for mixed members', () => {
    // 3 out of 10 members in [34, 36]
    const members = [30, 31, 32, 34, 35, 36, 38, 39, 40, 41];
    assert.strictEqual(ensembleBucketConfidence(members, 34, 36), 0.3);
  });
});

describe('ensembleBucketConfidence - edge buckets', () => {
  it('should handle "≤X" bucket (bucketLow is null)', () => {
    const members = [28, 30, 32, 34, 36, 38, 40, 42, 44, 46];
    // ≤33: members 28, 30, 32 → 3/10
    assert.strictEqual(ensembleBucketConfidence(members, null, 33), 0.3);
  });

  it('should handle "≥X" bucket (bucketHigh is null)', () => {
    const members = [28, 30, 32, 34, 36, 38, 40, 42, 44, 46];
    // ≥40: members 40, 42, 44, 46 → 4/10
    assert.strictEqual(ensembleBucketConfidence(members, 40, null), 0.4);
  });

  it('should handle -Infinity for bucketLow (same as null)', () => {
    const members = [28, 30, 32, 34, 36];
    assert.strictEqual(
      ensembleBucketConfidence(members, -Infinity, 33),
      ensembleBucketConfidence(members, null, 33),
    );
  });

  it('should handle Infinity for bucketHigh (same as null)', () => {
    const members = [28, 30, 32, 34, 36];
    assert.strictEqual(
      ensembleBucketConfidence(members, 34, Infinity),
      ensembleBucketConfidence(members, 34, null),
    );
  });
});

describe('ensembleBucketConfidence - rounding and boundary behavior', () => {
  it('should round members to nearest integer before comparison', () => {
    // 34.4 rounds to 34 (in bucket), 34.6 rounds to 35 (in bucket), 35.6 rounds to 36 (NOT in bucket for [34,35])
    const members = [34.4, 34.6, 35.6, 36.4, 37.0];
    // 34.4→34 (in), 34.6→35 (in), 35.6→36 (out), 36.4→36 (out), 37→37 (out)
    assert.strictEqual(ensembleBucketConfidence(members, 34, 35), 0.4);
  });

  it('should include both boundaries in range buckets', () => {
    const members = [30, 32, 34, 36, 38];
    // [32, 36] should include 32, 34, 36 → 3/5
    assert.strictEqual(ensembleBucketConfidence(members, 32, 36), 0.6);
  });
});

describe('ensembleBucketConfidence - invalid inputs', () => {
  it('should return 0 for null members', () => {
    assert.strictEqual(ensembleBucketConfidence(null, 30, 35), 0);
  });

  it('should return 0 for undefined members', () => {
    assert.strictEqual(ensembleBucketConfidence(undefined, 30, 35), 0);
  });
});

// ── 3. getEnsembleForecast (live API) ──────────────────────────────────────

describe('getEnsembleForecast (live API)', () => {
  it('should return unknown city error', async () => {
    const result = await getEnsembleForecast('Atlantis');
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('Unknown city'), `Expected unknown city error, got: ${result.error}`);
  });

  it('should fetch ensemble for NYC', async () => {
    const result = await getEnsembleForecast('NYC');
    assert.strictEqual(result.success, true, `Expected success, got error: ${result.error}`);
    assert.strictEqual(result.forecast.city, 'NYC');
    assert.strictEqual(result.forecast.source, 'gfs_ensemble');

    // Should have members (at least some)
    assert.ok(
      result.forecast.today || result.forecast.tomorrow,
      'Should have today or tomorrow data',
    );

    if (result.forecast.today) {
      assert.ok(
        result.forecast.today.members.length >= 2,
        `Should have multiple ensemble members, got ${result.forecast.today.members.length}`,
      );
      // Temperature should be in a reasonable range
      assert.ok(
        result.forecast.today.mean >= -30 && result.forecast.today.mean <= 120,
        `Mean ${result.forecast.today.mean}°F should be in reasonable range (-30 to 120)`,
      );
      assert.ok(
        result.forecast.today.spread >= 0,
        `Spread ${result.forecast.today.spread} should be non-negative`,
      );
      assert.ok(
        result.forecast.today.min <= result.forecast.today.max,
        `Min ${result.forecast.today.min} should be ≤ max ${result.forecast.today.max}`,
      );
    }
  });
});

// ── 4. getAllEnsembleForecasts (live API) ──────────────────────────────────

describe('getAllEnsembleForecasts (live API)', () => {
  it('should fetch ensembles for multiple cities', async () => {
    const result = await getAllEnsembleForecasts();
    assert.strictEqual(result.success, true);
    assert.ok(
      result.forecasts.length >= 5,
      `Should get most cities, got ${result.forecasts.length}`,
    );
    // Each forecast should have city and source
    for (const f of result.forecasts) {
      assert.ok(f.city, 'Forecast should have city property');
      assert.strictEqual(f.source, 'gfs_ensemble', 'Forecast source should be gfs_ensemble');
    }
  });
});
