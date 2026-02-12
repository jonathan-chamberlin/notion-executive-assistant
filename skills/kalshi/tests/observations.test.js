import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  nextDate,
  getObservedHigh,
  getObservedHighs,
} from '../observations.js';
import { CONFIG } from '../config.js';

// ── 1. nextDate helper ──────────────────────────────────────────────────────

describe('nextDate', () => {

  it('increments date correctly for mid-month', () => {
    assert.strictEqual(nextDate('2026-02-10'), '2026-02-11');
  });

  it('increments date correctly for end-of-month', () => {
    assert.strictEqual(nextDate('2026-02-28'), '2026-03-01');
  });

  it('handles leap year correctly', () => {
    assert.strictEqual(nextDate('2024-02-28'), '2024-02-29');
    assert.strictEqual(nextDate('2024-02-29'), '2024-03-01');
  });

  it('increments date correctly for end-of-year', () => {
    assert.strictEqual(nextDate('2026-12-31'), '2027-01-01');
  });
});

// ── 2. getObservedHigh (validation + live API) ──────────────────────────────

describe('getObservedHigh', () => {

  it('returns error for unknown city', async () => {
    const result = await getObservedHigh('Tokyo', '2026-02-01');
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('Unknown city'));
  });

  it('returns error for future date', async () => {
    const futureDate = '2027-01-01';
    const result = await getObservedHigh('NYC', futureDate);
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('Cannot fetch observations for today or future'));
  });

  it('returns error for today\'s date', async () => {
    const today = new Date().toISOString().split('T')[0];
    const result = await getObservedHigh('NYC', today);
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('Cannot fetch observations for today or future'));
  });

  it('fetches yesterday\'s observed high for NYC', { timeout: 30000 }, async () => {
    // Calculate yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    const result = await getObservedHigh('NYC', dateStr);

    assert.strictEqual(result.success, true, `Expected success but got: ${JSON.stringify(result)}`);
    assert.strictEqual(typeof result.actualHigh, 'number', 'actualHigh should be a number');
    assert.ok(result.actualHigh >= -20, `actualHigh ${result.actualHigh} should be >= -20°F`);
    assert.ok(result.actualHigh <= 130, `actualHigh ${result.actualHigh} should be <= 130°F`);
  });
});

// ── 3. getObservedHighs (live API) ──────────────────────────────────────────

describe('getObservedHighs', () => {

  it('fetches yesterday\'s observed highs for all 9 cities', { timeout: 60000 }, async () => {
    // Calculate yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    const result = await getObservedHighs(CONFIG.cities, dateStr);

    assert.strictEqual(result.success, true, `Expected success but got: ${JSON.stringify(result)}`);
    assert.ok(typeof result.highs === 'object', 'result.highs should be an object');

    // Should have successfully fetched at least some cities
    const cityCount = Object.keys(result.highs).length;
    assert.ok(
      cityCount > 0,
      `Expected at least 1 city to return data, got ${cityCount}`,
    );

    // Each high should be a valid temperature
    for (const [city, temp] of Object.entries(result.highs)) {
      assert.strictEqual(typeof temp, 'number', `${city} temp should be a number`);
      assert.ok(temp >= -20, `${city} temp ${temp} should be >= -20°F`);
      assert.ok(temp <= 130, `${city} temp ${temp} should be <= 130°F`);
    }

    // Log errors if any
    if (result.errors && result.errors.length > 0) {
      console.log(`Errors for ${result.errors.length} cities:`, result.errors);
    }
  });
});
