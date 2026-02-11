import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { findOpportunities } from '../analyze.js';

// These tests hit real NOAA + Kalshi APIs — allow generous timeout.
const TIMEOUT = 60_000;

// ── 1. Default call ──────────────────────────────────────────────────────────

describe('findOpportunities — default call', () => {
  let result;

  it('returns { success, opportunities, summary }', async () => {
    result = await findOpportunities();

    assert.strictEqual(result.success, true, 'result.success should be true');
    assert.ok(Array.isArray(result.opportunities), 'opportunities should be an array');
    assert.ok(result.summary !== null && typeof result.summary === 'object', 'summary should be an object');
  }, { timeout: TIMEOUT });

  it('summary has eventsScanned (number), citiesForecasted (number), opportunitiesFound (number)', async () => {
    // result was populated by the previous test; guard against undefined
    assert.ok(result, 'result must exist — did the previous test run?');

    const { summary } = result;
    assert.strictEqual(typeof summary.eventsScanned, 'number', 'eventsScanned should be a number');
    assert.strictEqual(typeof summary.citiesForecasted, 'number', 'citiesForecasted should be a number');
    assert.strictEqual(typeof summary.opportunitiesFound, 'number', 'opportunitiesFound should be a number');
  }, { timeout: TIMEOUT });
});

// ── 2. Opportunities shape ───────────────────────────────────────────────────

describe('findOpportunities — opportunity shape', () => {
  it('each opportunity has the expected fields with correct types', async () => {
    const { opportunities } = await findOpportunities();

    if (opportunities.length === 0) {
      // No opportunities today — nothing to validate; that is acceptable.
      return;
    }

    for (const opp of opportunities) {
      assert.strictEqual(typeof opp.eventTitle, 'string', 'eventTitle should be a string');
      assert.strictEqual(typeof opp.market, 'string', 'market should be a string');
      assert.strictEqual(typeof opp.ticker, 'string', 'ticker should be a string');
      assert.strictEqual(typeof opp.city, 'string', 'city should be a string');
      assert.ok(opp.bucket !== null && typeof opp.bucket === 'object', 'bucket should be an object');
      assert.strictEqual(typeof opp.forecastTemp, 'number', 'forecastTemp should be a number');

      assert.strictEqual(typeof opp.forecastConfidence, 'number', 'forecastConfidence should be a number');
      assert.ok(opp.forecastConfidence >= 0 && opp.forecastConfidence <= 100, `forecastConfidence should be 0-100, got ${opp.forecastConfidence}`);

      assert.strictEqual(typeof opp.marketPrice, 'number', 'marketPrice should be a number');
      assert.ok(opp.marketPrice >= 0 && opp.marketPrice <= 100, `marketPrice should be 0-100, got ${opp.marketPrice}`);

      assert.strictEqual(typeof opp.edge, 'number', 'edge should be a number');
      assert.ok(opp.edge > 0, `edge should be > 0, got ${opp.edge}`);

      assert.strictEqual(opp.side, 'yes', `side should be 'yes', got '${opp.side}'`);

      assert.strictEqual(typeof opp.suggestedAmount, 'number', 'suggestedAmount should be a number');
      assert.ok(opp.suggestedAmount > 0, `suggestedAmount should be > 0, got ${opp.suggestedAmount}`);

      assert.strictEqual(typeof opp.suggestedYesPrice, 'number', 'suggestedYesPrice should be a number');
      assert.ok(opp.suggestedYesPrice >= 1 && opp.suggestedYesPrice <= 100, `suggestedYesPrice should be 1-100, got ${opp.suggestedYesPrice}`);
    }
  }, { timeout: TIMEOUT });
});

// ── 3. Sorted by edge ────────────────────────────────────────────────────────

describe('findOpportunities — sorted by edge descending', () => {
  it('opportunities[i].edge >= opportunities[i+1].edge for all consecutive pairs', async () => {
    const { opportunities } = await findOpportunities();

    for (let i = 0; i < opportunities.length - 1; i++) {
      assert.ok(
        opportunities[i].edge >= opportunities[i + 1].edge,
        `opportunities[${i}].edge (${opportunities[i].edge}) should be >= opportunities[${i + 1}].edge (${opportunities[i + 1].edge})`,
      );
    }
  }, { timeout: TIMEOUT });
});

// ── 4. Edge threshold ────────────────────────────────────────────────────────

describe('findOpportunities — edge threshold (default minEdge = 20)', () => {
  it('all opportunities have edge >= 20', async () => {
    const { opportunities } = await findOpportunities();

    for (const opp of opportunities) {
      assert.ok(
        opp.edge >= 20,
        `opportunity edge should be >= 20 (default minEdge 20 pp), got ${opp.edge} for "${opp.market}"`,
      );
    }
  }, { timeout: TIMEOUT });
});

// ── 5. Custom minEdge ────────────────────────────────────────────────────────

describe('findOpportunities — custom minEdge', () => {
  it('minEdge: 50 returns fewer or equal opportunities, all with edge >= 50', async () => {
    const [defaultResult, strictResult] = await Promise.all([
      findOpportunities(),
      findOpportunities({ minEdge: 50 }),
    ]);

    assert.ok(
      strictResult.opportunities.length <= defaultResult.opportunities.length,
      `minEdge 50 should return <= opportunities than default (got ${strictResult.opportunities.length} vs ${defaultResult.opportunities.length})`,
    );

    for (const opp of strictResult.opportunities) {
      assert.ok(
        opp.edge >= 50,
        `with minEdge 50, edge should be >= 50, got ${opp.edge} for "${opp.market}"`,
      );
    }
  }, { timeout: TIMEOUT });
});

// ── 6. Very high minEdge ─────────────────────────────────────────────────────

describe('findOpportunities — very high minEdge', () => {
  it('minEdge: 99 should likely return 0 opportunities', async () => {
    const result = await findOpportunities({ minEdge: 99 });

    assert.strictEqual(result.success, true, 'result.success should be true');
    assert.ok(Array.isArray(result.opportunities), 'opportunities should be an array');
    // A 99 pp edge is nearly impossible, so we expect 0 — but don't hard-fail
    // if some truly extreme mispricing exists.
    assert.ok(
      result.opportunities.length <= 1,
      `minEdge 99 should return 0 (or at most 1 extreme outlier) opportunities, got ${result.opportunities.length}`,
    );
  }, { timeout: TIMEOUT });
});

// ── 7. Forecasts were fetched ────────────────────────────────────────────────

describe('findOpportunities — forecasts were fetched', () => {
  it('summary.citiesForecasted should be > 0', async () => {
    const result = await findOpportunities();

    assert.ok(
      result.summary.citiesForecasted > 0,
      `citiesForecasted should be > 0, got ${result.summary.citiesForecasted}`,
    );
  }, { timeout: TIMEOUT });
});
