import 'dotenv/config';
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

import { executeTrade, getBalance, getPositions, getPerformance } from '../trade.js';
import { scanWeatherMarkets } from '../markets.js';
import { findOpportunities } from '../analyze.js';
import { trackSpend, getRemainingDailyBudget, canAffordTrade } from '../budget.js';
import { CONFIG } from '../config.js';

const TIMEOUT = 60_000;

// ── Shared state across sequential phases ─────────────────────────────────────

const state = {
  startingBalance: null,       // cents
  cheapestMarket: null,        // { ticker, yesPrice }
  trade1Result: null,          // executeTrade return value
  trade1Cost: null,            // cents actually spent
  pipelineOpportunity: null,   // top opportunity from findOpportunities
  trade2Result: null,          // pipeline trade result
  trade2Cost: null,
  totalSpent: 0,               // running total of cents committed
};

// Safety cap: never spend more than 100¢ ($1.00) across all tests
const MAX_TEST_SPEND = 100;

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 1 — Input validation (no money spent)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Phase 1: Input validation', () => {
  it('rejects missing ticker', async () => {
    const r = await executeTrade({ ticker: '', side: 'yes', amount: 10, yesPrice: 5 });
    assert.strictEqual(r.success, false);
    assert.ok(r.error.includes('ticker'), `error should mention ticker: ${r.error}`);
  }, { timeout: TIMEOUT });

  it('rejects invalid side', async () => {
    const r = await executeTrade({ ticker: 'FAKE-TICKER', side: 'maybe', amount: 10, yesPrice: 5 });
    assert.strictEqual(r.success, false);
    assert.ok(r.error.includes('side'), `error should mention side: ${r.error}`);
  }, { timeout: TIMEOUT });

  it('rejects zero amount', async () => {
    const r = await executeTrade({ ticker: 'FAKE-TICKER', side: 'yes', amount: 0, yesPrice: 5 });
    assert.strictEqual(r.success, false);
    assert.ok(r.error.includes('amount'), `error should mention amount: ${r.error}`);
  }, { timeout: TIMEOUT });

  it('rejects yesPrice out of range (0)', async () => {
    const r = await executeTrade({ ticker: 'FAKE-TICKER', side: 'yes', amount: 10, yesPrice: 0 });
    assert.strictEqual(r.success, false);
    assert.ok(r.error.includes('yesPrice'), `error should mention yesPrice: ${r.error}`);
  }, { timeout: TIMEOUT });

  it('rejects yesPrice out of range (100)', async () => {
    const r = await executeTrade({ ticker: 'FAKE-TICKER', side: 'yes', amount: 10, yesPrice: 100 });
    assert.strictEqual(r.success, false);
    assert.ok(r.error.includes('yesPrice'), `error should mention yesPrice: ${r.error}`);
  }, { timeout: TIMEOUT });

  it('rejects amount exceeding maxTradeSize', async () => {
    const r = await executeTrade({ ticker: 'FAKE-TICKER', side: 'yes', amount: CONFIG.maxTradeSize + 1, yesPrice: 5 });
    assert.strictEqual(r.success, false);
    assert.ok(r.error.includes('max trade size'), `error should mention max trade size: ${r.error}`);
  }, { timeout: TIMEOUT });

  it('rejects amount too small for price', async () => {
    const r = await executeTrade({ ticker: 'FAKE-TICKER', side: 'yes', amount: 2, yesPrice: 5 });
    assert.strictEqual(r.success, false);
    assert.ok(r.error.includes('too small'), `error should mention too small: ${r.error}`);
  }, { timeout: TIMEOUT });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 2 — Starting balance snapshot
// ═══════════════════════════════════════════════════════════════════════════════

describe('Phase 2: Starting balance', () => {
  it('fetches Kalshi balance successfully', async () => {
    const r = await getBalance();
    assert.strictEqual(r.success, true, `getBalance failed: ${r.error}`);
    assert.strictEqual(typeof r.balance.available, 'number');
    assert.ok(r.balance.available >= 0, 'balance should be non-negative');

    state.startingBalance = r.balance.available;
    console.log(`  Starting balance: ${state.startingBalance}¢ ($${(state.startingBalance / 100).toFixed(2)})`);
  }, { timeout: TIMEOUT });

  it('has enough balance to run tests (need >= 100¢)', async () => {
    assert.ok(state.startingBalance !== null, 'balance must have been fetched');
    assert.ok(
      state.startingBalance >= MAX_TEST_SPEND,
      `Need at least ${MAX_TEST_SPEND}¢ to run integration tests, have ${state.startingBalance}¢`,
    );
  }, { timeout: TIMEOUT });

  it('getPerformance returns budget info', async () => {
    const r = await getPerformance();
    assert.strictEqual(r.success, true);
    assert.strictEqual(typeof r.performance.dailyBudgetRemaining, 'number');
    assert.strictEqual(typeof r.performance.maxTradeSize, 'number');
    assert.strictEqual(typeof r.performance.maxDailySpend, 'number');
  }, { timeout: TIMEOUT });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 3 — Find cheapest live market
// ═══════════════════════════════════════════════════════════════════════════════

describe('Phase 3: Find cheapest market for minimal-cost trade', () => {
  it('scans markets and finds at least one active market', async () => {
    const r = await scanWeatherMarkets();
    assert.strictEqual(r.success, true, `scanWeatherMarkets failed: ${r.error}`);
    assert.ok(r.events.length > 0, 'need at least one active event');

    // Flatten all markets, sort by yesPrice ascending to find cheapest
    const allMarkets = r.events.flatMap(e =>
      e.markets.map(m => ({ ...m, eventTitle: e.title, city: e.city }))
    );
    assert.ok(allMarkets.length > 0, 'need at least one market');

    // Find cheapest with yesPrice between 2-15¢ (cheap enough to minimize loss, liquid enough to fill)
    const candidates = allMarkets
      .filter(m => m.yesPrice >= 2 && m.yesPrice <= 15)
      .sort((a, b) => a.yesPrice - b.yesPrice);

    if (candidates.length > 0) {
      state.cheapestMarket = candidates[0];
    } else {
      // Fallback: just pick the cheapest market above 0
      const nonZero = allMarkets.filter(m => m.yesPrice > 0).sort((a, b) => a.yesPrice - b.yesPrice);
      assert.ok(nonZero.length > 0, 'need at least one market with yesPrice > 0');
      state.cheapestMarket = nonZero[0];
    }

    console.log(`  Cheapest market: ${state.cheapestMarket.ticker} @ ${state.cheapestMarket.yesPrice}¢ (${state.cheapestMarket.city})`);
    console.log(`  Question: ${state.cheapestMarket.question}`);
  }, { timeout: TIMEOUT });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 4 — Execute a single small trade
// ═══════════════════════════════════════════════════════════════════════════════

describe('Phase 4: Execute minimal trade (1 YES contract)', () => {
  it('places a limit buy for 1 YES contract', async () => {
    assert.ok(state.cheapestMarket, 'cheapest market must have been found');

    const price = state.cheapestMarket.yesPrice;
    // amount = price means exactly 1 contract
    const amount = price;

    // Safety check
    assert.ok(amount <= MAX_TEST_SPEND, `trade cost ${amount}¢ exceeds test budget ${MAX_TEST_SPEND}¢`);

    console.log(`  Placing: BUY 1 YES @ ${price}¢ on ${state.cheapestMarket.ticker}`);

    state.trade1Result = await executeTrade({
      ticker: state.cheapestMarket.ticker,
      side: 'yes',
      amount,
      yesPrice: price,
    });

    console.log(`  Result: success=${state.trade1Result.success}`);
    if (state.trade1Result.success) {
      console.log(`  Order ID: ${state.trade1Result.trade.orderId}`);
      console.log(`  Status: ${state.trade1Result.trade.status}`);
      console.log(`  Cost: ${state.trade1Result.trade.cost}¢`);
      state.trade1Cost = state.trade1Result.trade.cost;
      state.totalSpent += state.trade1Cost;
    } else {
      console.log(`  Error: ${state.trade1Result.error}`);
    }

    // The trade should succeed (valid inputs, real market, sufficient balance)
    // But it's possible the order gets rejected by the exchange if the market has no liquidity
    assert.strictEqual(typeof state.trade1Result.success, 'boolean');
    if (state.trade1Result.success) {
      assert.ok(state.trade1Result.trade.orderId, 'orderId should be present');
      assert.strictEqual(state.trade1Result.trade.side, 'yes');
      assert.strictEqual(state.trade1Result.trade.count, 1);
      assert.strictEqual(typeof state.trade1Result.trade.cost, 'number');
      assert.ok(state.trade1Result.trade.timestamp, 'timestamp should be present');
    }
  }, { timeout: TIMEOUT });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 5 — Verify position appears
// ═══════════════════════════════════════════════════════════════════════════════

describe('Phase 5: Verify position after trade', () => {
  it('getPositions returns successfully', async () => {
    const r = await getPositions();
    assert.strictEqual(r.success, true, `getPositions failed: ${r.error}`);
    assert.ok(Array.isArray(r.positions), 'positions should be an array');

    console.log(`  Total positions: ${r.positions.length}`);

    // If trade 1 succeeded, look for our position
    if (state.trade1Result?.success) {
      const ourPosition = r.positions.find(p => p.ticker === state.cheapestMarket.ticker);
      if (ourPosition) {
        console.log(`  Found position: ${ourPosition.ticker}, count=${ourPosition.yesCount}`);
        assert.ok(ourPosition.yesCount >= 1, 'should have at least 1 contract');
      } else {
        // Order may be pending/resting rather than filled
        console.log(`  Position for ${state.cheapestMarket.ticker} not found — order may be resting`);
      }
    }
  }, { timeout: TIMEOUT });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 6 — Full pipeline: findOpportunities → executeTrade
// ═══════════════════════════════════════════════════════════════════════════════

describe('Phase 6: Full analysis pipeline trade', () => {
  it('findOpportunities returns opportunities', async () => {
    // Use a low minEdge (5pp) to increase chances of finding something
    const r = await findOpportunities({ minEdge: 5 });
    assert.strictEqual(r.success, true, `findOpportunities failed: ${r.error}`);
    assert.ok(Array.isArray(r.opportunities));

    console.log(`  Opportunities found: ${r.opportunities.length} (minEdge=5)`);

    if (r.opportunities.length > 0) {
      state.pipelineOpportunity = r.opportunities[0]; // highest edge
      console.log(`  Top opportunity: ${state.pipelineOpportunity.ticker}`);
      console.log(`    Edge: ${state.pipelineOpportunity.edge}pp, Market: ${state.pipelineOpportunity.marketPrice}¢, Forecast: ${state.pipelineOpportunity.forecastConfidence}%`);
      console.log(`    Suggested: ${state.pipelineOpportunity.side} @ ${state.pipelineOpportunity.suggestedYesPrice}¢`);
    }
  }, { timeout: TIMEOUT });

  it('executes trade on top opportunity (1 contract)', async () => {
    if (!state.pipelineOpportunity) {
      console.log('  SKIP: no opportunities found — nothing to trade');
      return;
    }

    const opp = state.pipelineOpportunity;
    const price = opp.suggestedYesPrice;
    const amount = price; // 1 contract

    // Safety cap
    if (state.totalSpent + amount > MAX_TEST_SPEND) {
      console.log(`  SKIP: would exceed test budget (spent ${state.totalSpent}¢, this trade ${amount}¢, cap ${MAX_TEST_SPEND}¢)`);
      return;
    }

    console.log(`  Placing: BUY 1 ${opp.side.toUpperCase()} @ ${price}¢ on ${opp.ticker}`);

    state.trade2Result = await executeTrade({
      ticker: opp.ticker,
      side: opp.side,
      amount,
      yesPrice: price,
    });

    console.log(`  Result: success=${state.trade2Result.success}`);
    if (state.trade2Result.success) {
      console.log(`  Order ID: ${state.trade2Result.trade.orderId}`);
      console.log(`  Status: ${state.trade2Result.trade.status}`);
      console.log(`  Cost: ${state.trade2Result.trade.cost}¢`);
      state.trade2Cost = state.trade2Result.trade.cost;
      state.totalSpent += state.trade2Cost;
    } else {
      console.log(`  Error: ${state.trade2Result.error}`);
    }

    assert.strictEqual(typeof state.trade2Result.success, 'boolean');
    if (state.trade2Result.success) {
      assert.ok(state.trade2Result.trade.orderId);
      assert.strictEqual(state.trade2Result.trade.side, opp.side);
    }
  }, { timeout: TIMEOUT });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 7 — Balance reconciliation and budget enforcement
// ═══════════════════════════════════════════════════════════════════════════════

describe('Phase 7: Balance reconciliation', () => {
  it('final balance decreased by approximately the cost of trades', async () => {
    if (state.totalSpent === 0) {
      console.log('  SKIP: no trades were placed, nothing to reconcile');
      return;
    }

    const r = await getBalance();
    assert.strictEqual(r.success, true, `getBalance failed: ${r.error}`);

    const finalBalance = r.balance.available;
    const expectedBalance = state.startingBalance - state.totalSpent;

    console.log(`  Starting balance: ${state.startingBalance}¢`);
    console.log(`  Total spent:      ${state.totalSpent}¢`);
    console.log(`  Expected balance: ~${expectedBalance}¢`);
    console.log(`  Actual balance:   ${finalBalance}¢`);

    // Allow ±5¢ tolerance for resting orders vs filled orders
    const tolerance = 5;
    assert.ok(
      Math.abs(finalBalance - expectedBalance) <= tolerance,
      `Balance mismatch: expected ~${expectedBalance}¢ (±${tolerance}¢), got ${finalBalance}¢`,
    );
  }, { timeout: TIMEOUT });

  it('budget tracking reflects spend', async () => {
    const remaining = getRemainingDailyBudget();
    console.log(`  Daily budget remaining: ${remaining}¢ / ${CONFIG.maxDailySpend}¢`);

    assert.strictEqual(typeof remaining, 'number');
    assert.ok(remaining <= CONFIG.maxDailySpend, 'remaining should be <= maxDailySpend');
  }, { timeout: TIMEOUT });

  it('canAffordTrade rejects amounts exceeding remaining budget', async () => {
    // Try to "afford" the entire daily limit — should fail if any trades were placed
    if (state.totalSpent > 0) {
      const canAffordMax = canAffordTrade(CONFIG.maxDailySpend);
      console.log(`  canAffordTrade(${CONFIG.maxDailySpend}¢): ${canAffordMax}`);
      // After spending, we can't afford the full daily limit anymore
      assert.strictEqual(canAffordMax, false, 'should not afford full daily budget after trading');
    }
  }, { timeout: TIMEOUT });

  it('prints final test summary', async () => {
    console.log('\n  ═══ Integration Test Summary ═══');
    console.log(`  Starting balance:  ${state.startingBalance}¢ ($${((state.startingBalance || 0) / 100).toFixed(2)})`);
    console.log(`  Trades attempted:  ${[state.trade1Result, state.trade2Result].filter(Boolean).length}`);
    console.log(`  Trades succeeded:  ${[state.trade1Result, state.trade2Result].filter(r => r?.success).length}`);
    console.log(`  Total spent:       ${state.totalSpent}¢ ($${(state.totalSpent / 100).toFixed(2)})`);
    console.log(`  Budget remaining:  ${getRemainingDailyBudget()}¢`);

    const finalBal = await getBalance();
    if (finalBal.success) {
      console.log(`  Final balance:     ${finalBal.balance.available}¢ ($${(finalBal.balance.available / 100).toFixed(2)})`);
    }
    console.log('  ═════════════════════════════════\n');
  }, { timeout: TIMEOUT });
});
