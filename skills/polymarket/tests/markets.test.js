import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { getCityWeatherEvent, scanWeatherMarkets } from '../markets.js';
import { CONFIG } from '../config.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Validate the shape of a single normalized market object.
 */
function assertMarketShape(market, label) {
  assert.strictEqual(typeof market.ticker, 'string', `${label}: ticker should be a string`);
  assert.ok(market.ticker.length > 0, `${label}: ticker must not be empty`);

  assert.strictEqual(typeof market.question, 'string', `${label}: question should be a string`);

  assert.strictEqual(typeof market.yesPrice, 'number', `${label}: yesPrice should be a number`);
  assert.ok(market.yesPrice >= 0 && market.yesPrice <= 1,
    `${label}: yesPrice must be between 0 and 1, got ${market.yesPrice}`);

  // bucket is object or null
  if (market.bucket !== null) {
    assert.strictEqual(typeof market.bucket, 'object', `${label}: bucket should be an object when non-null`);
  }
}

// ── 1. getCityWeatherEvent — valid city + today ─────────────────────────────

describe('getCityWeatherEvent', () => {

  it('returns expected shape for valid city + today', { timeout: 30000 }, async () => {
    const result = await getCityWeatherEvent('NYC', 'today');

    assert.strictEqual(typeof result, 'object', 'result should be an object');
    assert.ok('success' in result, 'result must have a success property');

    if (!result.success) {
      // Market may not exist yet (e.g. early morning) — that is acceptable
      assert.strictEqual(typeof result.error, 'string', 'on failure, error should be a string');
      return;
    }

    const { event } = result;
    assert.ok(event, 'event should be defined when success is true');

    assert.strictEqual(typeof event.title, 'string', 'event.title should be a string');
    assert.ok(event.title.length > 0, 'event.title must not be empty');

    assert.strictEqual(typeof event.eventTicker, 'string', 'event.eventTicker should be a string');
    assert.match(event.eventTicker, /^KXHIGHNY/, 'NYC eventTicker should match KXHIGHNY pattern');

    assert.strictEqual(event.city, 'NYC', 'event.city should be NYC');

    assert.ok(Array.isArray(event.markets), 'event.markets should be an array');
    for (let i = 0; i < event.markets.length; i++) {
      assertMarketShape(event.markets[i], `markets[${i}]`);
    }
  });

  // ── 2. getCityWeatherEvent — valid city + tomorrow ──────────────────────

  it('returns expected shape for valid city + tomorrow', { timeout: 30000 }, async () => {
    const result = await getCityWeatherEvent('NYC', 'tomorrow');

    assert.strictEqual(typeof result, 'object', 'result should be an object');
    assert.ok('success' in result, 'result must have a success property');

    if (!result.success) {
      assert.strictEqual(typeof result.error, 'string', 'on failure, error should be a string');
      return;
    }

    const { event } = result;
    assert.ok(event, 'event should be defined when success is true');

    assert.strictEqual(typeof event.title, 'string', 'event.title should be a string');
    assert.strictEqual(typeof event.eventTicker, 'string', 'event.eventTicker should be a string');
    assert.match(event.eventTicker, /^KXHIGHNY/, 'NYC tomorrow eventTicker should match KXHIGHNY pattern');
    assert.strictEqual(event.city, 'NYC', 'event.city should be NYC');

    assert.ok(Array.isArray(event.markets), 'event.markets should be an array');
    for (let i = 0; i < event.markets.length; i++) {
      assertMarketShape(event.markets[i], `tomorrow markets[${i}]`);
    }
  });

  // ── 3. getCityWeatherEvent — invalid city ───────────────────────────────

  it('returns error for unknown city', { timeout: 30000 }, async () => {
    const result = await getCityWeatherEvent('Tokyo', 'today');

    assert.strictEqual(result.success, false, 'success should be false for unknown city');
    assert.strictEqual(typeof result.error, 'string', 'error should be a string');
    assert.ok(result.error.includes('Unknown city'),
      `error message should mention "Unknown city", got: "${result.error}"`);
  });

  // ── 4. Market price sanity ──────────────────────────────────────────────

  it('all market prices are valid decimal probabilities', { timeout: 30000 }, async () => {
    const result = await getCityWeatherEvent('NYC', 'today');

    if (!result.success || !result.event?.markets?.length) {
      // No markets available — nothing to validate
      return;
    }

    for (const market of result.event.markets) {
      assert.ok(market.yesPrice >= 0 && market.yesPrice <= 1,
        `yesPrice must be between 0 and 1, got ${market.yesPrice} for ${market.ticker}`);

      // yesBid <= yesAsk when both are non-zero
      if (market.yesBid > 0 && market.yesAsk > 0) {
        assert.ok(market.yesBid <= market.yesAsk,
          `yesBid (${market.yesBid}) should be <= yesAsk (${market.yesAsk}) for ${market.ticker}`);
      }
    }
  });

  // ── 5. Bucket structure ─────────────────────────────────────────────────

  it('markets with non-null buckets have valid bucket structure', { timeout: 30000 }, async () => {
    const result = await getCityWeatherEvent('NYC', 'today');

    if (!result.success || !result.event?.markets?.length) {
      return;
    }

    const marketsWithBuckets = result.event.markets.filter(m => m.bucket !== null);

    for (const market of marketsWithBuckets) {
      const { bucket } = market;

      assert.strictEqual(typeof bucket, 'object', `bucket should be an object for ${market.ticker}`);

      // low is number or null
      if (bucket.low !== null) {
        assert.strictEqual(typeof bucket.low, 'number',
          `bucket.low should be a number when non-null for ${market.ticker}`);
      }

      // high is number or null
      if (bucket.high !== null) {
        assert.strictEqual(typeof bucket.high, 'number',
          `bucket.high should be a number when non-null for ${market.ticker}`);
      }

      // unit should be 'F'
      assert.strictEqual(bucket.unit, 'F',
        `bucket.unit should be 'F' for ${market.ticker}, got '${bucket.unit}'`);

      // At least one of low/high should be non-null
      assert.ok(bucket.low !== null || bucket.high !== null,
        `At least one of bucket.low or bucket.high must be non-null for ${market.ticker}`);
    }
  });
});

// ── 6. scanWeatherMarkets — returns events ────────────────────────────────

describe('scanWeatherMarkets', () => {

  it('returns success with events array', { timeout: 30000 }, async () => {
    const result = await scanWeatherMarkets();

    assert.strictEqual(typeof result, 'object', 'result should be an object');
    assert.ok('success' in result, 'result must have a success property');

    if (!result.success) {
      // API failure is possible but should still have an error string
      assert.strictEqual(typeof result.error, 'string', 'on failure, error should be a string');
      return;
    }

    assert.strictEqual(result.success, true, 'success should be true');
    assert.ok(Array.isArray(result.events), 'events should be an array');

    // Events array may be empty if no markets are active — that is OK
    for (let i = 0; i < result.events.length; i++) {
      const event = result.events[i];
      const label = `events[${i}]`;

      assert.strictEqual(typeof event.title, 'string', `${label}.title should be a string`);
      assert.strictEqual(typeof event.eventTicker, 'string', `${label}.eventTicker should be a string`);
      assert.strictEqual(typeof event.city, 'string', `${label}.city should be a string`);

      assert.ok(event.label === 'today' || event.label === 'tomorrow',
        `${label}.label should be 'today' or 'tomorrow', got '${event.label}'`);

      assert.ok(Array.isArray(event.markets), `${label}.markets should be an array`);

      for (let j = 0; j < event.markets.length; j++) {
        assertMarketShape(event.markets[j], `${label}.markets[${j}]`);
      }
    }
  });

  // ── 7. City coverage ──────────────────────────────────────────────────────

  it('returned cities are from CONFIG.cities', { timeout: 30000 }, async () => {
    const result = await scanWeatherMarkets();

    if (!result.success || !result.events?.length) {
      return;
    }

    const allowedCities = new Set(CONFIG.cities);

    for (const event of result.events) {
      assert.ok(allowedCities.has(event.city),
        `event city "${event.city}" should be in CONFIG.cities: [${CONFIG.cities.join(', ')}]`);
    }
  });

  // ── 8. No duplicate events ────────────────────────────────────────────────

  it('each eventTicker is unique', { timeout: 30000 }, async () => {
    const result = await scanWeatherMarkets();

    if (!result.success || !result.events?.length) {
      return;
    }

    const tickers = result.events.map(e => e.eventTicker);
    const unique = new Set(tickers);

    assert.strictEqual(unique.size, tickers.length,
      `Duplicate eventTickers found: ${tickers.filter((t, i) => tickers.indexOf(t) !== i).join(', ')}`);
  });
});
