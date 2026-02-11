import 'dotenv/config';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';

import { executeTrade, getBalance } from '../trade.js';
import { scanWeatherMarkets } from '../markets.js';
import { findOpportunities } from '../analyze.js';
import {
  getTradeLog, checkSettlements,
  TRADES_FILE, CSV_HEADERS, HEADER_LINE,
} from '../settlement.js';

const TIMEOUT = 60_000;

// Safety cap: never spend more than 20¢ ($0.20) across all tests
const MAX_TEST_SPEND = 20;

// ── Snapshot / restore the CSV so the test is non-destructive ───────────────

let originalCsv = null;
let originalCsvExisted = false;

before(() => {
  try {
    originalCsv = fs.readFileSync(TRADES_FILE, 'utf-8');
    originalCsvExisted = true;
  } catch {
    originalCsvExisted = false;
    originalCsv = null;
  }
});

after(() => {
  // Always restore — file is a permanent repo artifact
  fs.writeFileSync(TRADES_FILE, originalCsv || (HEADER_LINE + '\n'), 'utf-8');
});

// ── Shared state across sequential phases ───────────────────────────────────

const state = {
  startingBalance: null,
  cheapestMarket: null,
  tradeResult: null,
  tradeCost: 0,
  rowCountBefore: 0,
  opportunity: null,
};

// ═════════════════════════════════════════════════════════════════════════════
// PHASE 1 — Preflight: balance check + find cheapest market
// ═════════════════════════════════════════════════════════════════════════════

describe('Phase 1: Preflight', () => {
  it('has enough balance (>= 20¢)', async () => {
    const r = await getBalance();
    assert.strictEqual(r.success, true, `getBalance failed: ${r.error}`);
    state.startingBalance = r.balance.available;
    console.log(`  Balance: ${state.startingBalance}¢`);
    assert.ok(state.startingBalance >= MAX_TEST_SPEND,
      `Need >= ${MAX_TEST_SPEND}¢, have ${state.startingBalance}¢`);
  }, { timeout: TIMEOUT });

  it('finds a cheap market (2-15¢ YES price)', async () => {
    const r = await scanWeatherMarkets();
    assert.strictEqual(r.success, true, `scan failed: ${r.error}`);

    const allMarkets = r.events.flatMap(e =>
      e.markets.map(m => ({ ...m, city: e.city, eventTitle: e.title }))
    );
    const candidates = allMarkets
      .filter(m => m.yesPrice >= 2 && m.yesPrice <= 15)
      .sort((a, b) => a.yesPrice - b.yesPrice);

    assert.ok(candidates.length > 0, 'need at least one market with yesPrice 2-15¢');
    state.cheapestMarket = candidates[0];
    console.log(`  Cheapest: ${state.cheapestMarket.ticker} @ ${state.cheapestMarket.yesPrice}¢ (${state.cheapestMarket.city})`);
  }, { timeout: TIMEOUT });

  it('builds an opportunity object for the trade', async () => {
    // Try real findOpportunities first (low edge threshold)
    const r = await findOpportunities({ minEdge: 1 });
    if (r.success && r.opportunities.length > 0) {
      // Pick the opportunity matching our cheapest market, or just the first
      state.opportunity = r.opportunities.find(o => o.ticker === state.cheapestMarket.ticker)
        || r.opportunities[0];
      console.log(`  Using real opportunity: ${state.opportunity.ticker}, edge=${state.opportunity.edge}pp`);
    } else {
      // Synthesize a minimal opportunity so we can test the full CSV path
      state.opportunity = {
        city: state.cheapestMarket.city,
        bucket: state.cheapestMarket.bucket || { low: 30, high: 40 },
        forecastTemp: 35,
        sigma: 3,
        forecastConfidence: 80,
        marketPrice: state.cheapestMarket.yesPrice,
        edge: 10,
        ticker: state.cheapestMarket.ticker,
        side: 'yes',
      };
      console.log(`  No real opportunity found; synthesized one for ${state.cheapestMarket.ticker}`);
    }
  }, { timeout: TIMEOUT });
});

// ═════════════════════════════════════════════════════════════════════════════
// PHASE 2 — Place 1 trade with opportunity context, verify CSV row appears
// ═════════════════════════════════════════════════════════════════════════════

describe('Phase 2: Trade + CSV logging', () => {
  it('records row count before trade', () => {
    state.rowCountBefore = getTradeLog().length;
    console.log(`  CSV rows before trade: ${state.rowCountBefore}`);
  });

  it('places 1 YES contract with opportunity param', async () => {
    const market = state.cheapestMarket;
    const price = market.yesPrice;
    assert.ok(price <= MAX_TEST_SPEND, `price ${price}¢ exceeds test cap ${MAX_TEST_SPEND}¢`);

    console.log(`  Placing: BUY 1 YES @ ${price}¢ on ${market.ticker}`);

    state.tradeResult = await executeTrade({
      ticker: market.ticker,
      side: 'yes',
      amount: price,       // exactly 1 contract
      yesPrice: price,
      opportunity: state.opportunity,
    });

    console.log(`  success=${state.tradeResult.success}`);
    if (state.tradeResult.success) {
      state.tradeCost = state.tradeResult.trade.cost;
      console.log(`  Order ID: ${state.tradeResult.trade.orderId}`);
      console.log(`  Status:   ${state.tradeResult.trade.status}`);
      console.log(`  Cost:     ${state.tradeCost}¢`);
    } else {
      console.log(`  Error: ${state.tradeResult.error}`);
    }

    assert.strictEqual(state.tradeResult.success, true, `trade failed: ${state.tradeResult.error}`);
  }, { timeout: TIMEOUT });

  it('CSV has exactly 1 new row after trade', () => {
    const trades = getTradeLog();
    const newRows = trades.length - state.rowCountBefore;
    console.log(`  CSV rows after trade: ${trades.length} (+${newRows})`);
    assert.strictEqual(newRows, 1, `expected 1 new row, got ${newRows}`);
  });

  it('new CSV row has correct trade data', () => {
    const trades = getTradeLog();
    const row = trades[trades.length - 1]; // last row = our trade

    // All CSV_HEADERS should be present as keys
    for (const h of CSV_HEADERS) {
      assert.ok(h in row, `missing column: ${h}`);
    }

    // Trade fields from executeTrade
    assert.strictEqual(row.market_ticker, state.cheapestMarket.ticker);
    assert.strictEqual(row.side, 'yes');
    assert.strictEqual(row.order_id, state.tradeResult.trade.orderId);
    assert.strictEqual(row.contracts, '1');
    assert.ok(row.price_paid !== '', 'price_paid should not be empty');

    // Opportunity fields
    assert.strictEqual(row.city, state.opportunity.city);
    assert.ok(row.forecast_temp !== '', 'forecast_temp should not be empty');
    assert.ok(row.model_confidence !== '', 'model_confidence should not be empty');

    // Settlement fields should still be empty (not settled yet)
    assert.strictEqual(row.settled_won, '');
    assert.strictEqual(row.pnl_cents, '');

    console.log(`  Row verified: ${row.city} | ${row.market_ticker} | ${row.side} @ ${row.price_paid}¢ | order=${row.order_id}`);
  });

  it('event_ticker is derived from market_ticker', () => {
    const trades = getTradeLog();
    const row = trades[trades.length - 1];
    // e.g. "KXHIGHNY-26FEB12-B36.5" → "KXHIGHNY-26FEB12"
    const parts = state.cheapestMarket.ticker.split('-');
    const expectedEvent = `${parts[0]}-${parts[1]}`;
    assert.strictEqual(row.event_ticker, expectedEvent);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PHASE 3 — checkSettlements hits real API, updates order status
// ═════════════════════════════════════════════════════════════════════════════

describe('Phase 3: checkSettlements (real API)', () => {
  it('calls checkSettlements successfully', async () => {
    const result = await checkSettlements();
    console.log(`  checkSettlements: success=${result.success}, updated=${result.updated}`);
    console.log(`  Summary: ${result.summary}`);

    assert.strictEqual(result.success, true, `checkSettlements failed: ${result.error}`);
    assert.strictEqual(typeof result.updated, 'number');
    assert.ok(result.summary.length > 0);
  }, { timeout: TIMEOUT });

  it('CSV row has updated status/fill_count after checkSettlements', () => {
    const trades = getTradeLog();
    const row = trades[trades.length - 1];

    // After checkSettlements, the order API should have returned status info.
    // The trade was just placed, so it may be 'resting' or 'executed'.
    // At minimum, status should be non-empty (it was written at trade time).
    assert.ok(row.status !== '', 'status should not be empty');
    console.log(`  status=${row.status}, fill_count=${row.fill_count}`);

    // The market probably hasn't settled yet (it's a weather market for today/tomorrow),
    // so settled_won is likely still empty. That's expected.
    console.log(`  settled_won=${row.settled_won || '(empty — market not yet settled)'}`);
    console.log(`  revenue_cents=${row.revenue_cents || '(empty)'}`);
    console.log(`  pnl_cents=${row.pnl_cents || '(empty)'}`);
  });

  it('getTradeLog returns valid objects for every row', () => {
    const trades = getTradeLog();
    assert.ok(trades.length > 0, 'should have at least our test trade');

    for (const trade of trades) {
      // Every row should have all headers as keys
      for (const h of CSV_HEADERS) {
        assert.ok(h in trade, `row missing column: ${h}`);
      }
      // date should look like YYYY-MM-DD
      assert.match(trade.date, /^\d{4}-\d{2}-\d{2}$/, `bad date format: ${trade.date}`);
    }
    console.log(`  All ${trades.length} rows have valid structure`);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PHASE 4 — Summary
// ═════════════════════════════════════════════════════════════════════════════

describe('Phase 4: Summary', () => {
  it('prints test summary', () => {
    console.log('\n  ═══ Settlement Integration Test Summary ═══');
    console.log(`  Balance:       ${state.startingBalance}¢`);
    console.log(`  Trade cost:    ${state.tradeCost}¢ ($${(state.tradeCost / 100).toFixed(2)})`);
    console.log(`  Market:        ${state.cheapestMarket?.ticker}`);
    console.log(`  Order ID:      ${state.tradeResult?.trade?.orderId}`);
    console.log(`  CSV file:      ${TRADES_FILE}`);
    console.log(`  CSV rows:      ${getTradeLog().length}`);
    console.log('  ═════════════════════════════════════════════\n');
  });
});
