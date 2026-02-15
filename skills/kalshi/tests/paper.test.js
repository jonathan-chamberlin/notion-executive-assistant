import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';

import {
  getPaperState, savePaperState, resetPaper,
  executePaperTrade, getPaperBalance, getPaperPositions,
  settlePaperTrades, getPaperSummary,
  didBucketWin, PAPER_FILE, DEFAULT_BALANCE, dateFromTicker,
} from '../paper.js';

// ── Test helpers ────────────────────────────────────────────────────────────────

let originalState = null;

function backupPaperState() {
  try {
    originalState = fs.readFileSync(PAPER_FILE, 'utf-8');
  } catch {
    originalState = null;
  }
}

function restorePaperState() {
  if (originalState != null) {
    fs.writeFileSync(PAPER_FILE, originalState, 'utf-8');
  } else {
    try { fs.unlinkSync(PAPER_FILE); } catch { /* noop */ }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section 1: didBucketWin — pure function
// ═══════════════════════════════════════════════════════════════════════════════

describe('Section 1: didBucketWin', () => {
  it('≤X bucket: wins when actual <= high', () => {
    assert.strictEqual(didBucketWin({ low: null, high: 40 }, 38), true);
    assert.strictEqual(didBucketWin({ low: null, high: 40 }, 40), true);
  });

  it('≤X bucket: loses when actual > high', () => {
    assert.strictEqual(didBucketWin({ low: null, high: 40 }, 41), false);
    assert.strictEqual(didBucketWin({ low: null, high: 40 }, 50), false);
  });

  it('≥X bucket: wins when actual >= low', () => {
    assert.strictEqual(didBucketWin({ low: 50, high: null }, 50), true);
    assert.strictEqual(didBucketWin({ low: 50, high: null }, 55), true);
  });

  it('≥X bucket: loses when actual < low', () => {
    assert.strictEqual(didBucketWin({ low: 50, high: null }, 49), false);
  });

  it('range bucket: wins when actual in range', () => {
    assert.strictEqual(didBucketWin({ low: 36, high: 40 }, 38), true);
    assert.strictEqual(didBucketWin({ low: 36, high: 40 }, 36), true);
    assert.strictEqual(didBucketWin({ low: 36, high: 40 }, 40), true);
  });

  it('range bucket: loses when actual outside range', () => {
    assert.strictEqual(didBucketWin({ low: 36, high: 40 }, 35), false);
    assert.strictEqual(didBucketWin({ low: 36, high: 40 }, 41), false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Section 2: dateFromTicker
// ═══════════════════════════════════════════════════════════════════════════════

describe('Section 2: dateFromTicker', () => {
  it('parses standard ticker format', () => {
    assert.strictEqual(dateFromTicker('KXHIGHNY-26FEB14-T40'), '2026-02-14');
    assert.strictEqual(dateFromTicker('KXHIGHCHI-26MAR05-B32.5'), '2026-03-05');
  });

  it('handles single-digit day', () => {
    assert.strictEqual(dateFromTicker('KXHIGHMIA-26JAN3-T79'), '2026-01-03');
  });

  it('returns empty for invalid ticker', () => {
    assert.strictEqual(dateFromTicker('INVALID'), '');
    assert.strictEqual(dateFromTicker(''), '');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Section 3: State management
// ═══════════════════════════════════════════════════════════════════════════════

describe('Section 3: State management', () => {
  before(() => backupPaperState());
  after(() => restorePaperState());

  it('getPaperState returns default when no file exists', () => {
    try { fs.unlinkSync(PAPER_FILE); } catch { /* noop */ }
    const state = getPaperState();
    assert.strictEqual(state.initialBalance, DEFAULT_BALANCE);
    assert.strictEqual(state.balance, DEFAULT_BALANCE);
    assert.deepStrictEqual(state.positions, []);
    assert.deepStrictEqual(state.settled, []);
  });

  it('savePaperState + getPaperState round-trips', () => {
    const state = { initialBalance: 50000, balance: 45000, positions: [], settled: [] };
    savePaperState(state);
    const loaded = getPaperState();
    assert.strictEqual(loaded.balance, 45000);
    assert.strictEqual(loaded.initialBalance, 50000);
  });

  it('resetPaper sets fresh state', () => {
    const result = resetPaper(200_000);
    assert.strictEqual(result.success, true);
    const state = getPaperState();
    assert.strictEqual(state.initialBalance, 200_000);
    assert.strictEqual(state.balance, 200_000);
    assert.deepStrictEqual(state.positions, []);
    assert.deepStrictEqual(state.settled, []);
  });

  it('resetPaper defaults to $1000', () => {
    resetPaper();
    const state = getPaperState();
    assert.strictEqual(state.balance, DEFAULT_BALANCE);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Section 4: getPaperBalance and getPaperPositions
// ═══════════════════════════════════════════════════════════════════════════════

describe('Section 4: Balance and positions API shape', () => {
  before(() => {
    backupPaperState();
    resetPaper(100_000);
  });
  after(() => restorePaperState());

  it('getPaperBalance matches getBalance() shape', () => {
    const result = getPaperBalance();
    assert.strictEqual(result.success, true);
    assert.strictEqual(typeof result.balance.available, 'number');
    assert.strictEqual(typeof result.balance.payout, 'number');
    assert.strictEqual(result.balance.available, 100_000);
  });

  it('getPaperPositions matches getPositions() shape', () => {
    const result = getPaperPositions();
    assert.strictEqual(result.success, true);
    assert.ok(Array.isArray(result.positions));
    assert.strictEqual(result.positions.length, 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Section 5: executePaperTrade
// ═══════════════════════════════════════════════════════════════════════════════

describe('Section 5: executePaperTrade', () => {
  before(() => {
    backupPaperState();
    resetPaper(1000); // $10 budget for easy math
  });
  after(() => restorePaperState());

  it('rejects missing ticker', () => {
    const r = executePaperTrade({ ticker: '', side: 'yes', amount: 10, yesPrice: 5 });
    assert.strictEqual(r.success, false);
    assert.ok(r.error.includes('ticker'));
  });

  it('rejects invalid side', () => {
    const r = executePaperTrade({ ticker: 'KXHIGHNY-26FEB14-T40', side: 'maybe', amount: 10, yesPrice: 5 });
    assert.strictEqual(r.success, false);
    assert.ok(r.error.includes('side'));
  });

  it('rejects zero amount', () => {
    const r = executePaperTrade({ ticker: 'KXHIGHNY-26FEB14-T40', side: 'yes', amount: 0, yesPrice: 5 });
    assert.strictEqual(r.success, false);
  });

  it('rejects yesPrice out of range', () => {
    const r1 = executePaperTrade({ ticker: 'KXHIGHNY-26FEB14-T40', side: 'yes', amount: 10, yesPrice: 0 });
    assert.strictEqual(r1.success, false);
    const r2 = executePaperTrade({ ticker: 'KXHIGHNY-26FEB14-T40', side: 'yes', amount: 10, yesPrice: 100 });
    assert.strictEqual(r2.success, false);
  });

  it('places a paper trade and deducts balance', () => {
    const r = executePaperTrade({
      ticker: 'KXHIGHNY-26FEB14-T40',
      side: 'yes',
      amount: 100,
      yesPrice: 5,
      opportunity: { city: 'NYC', bucket: { low: null, high: 40 }, forecastTemp: 38, forecastConfidence: 72, edge: 67 },
    });
    assert.strictEqual(r.success, true);
    assert.strictEqual(r.trade.count, 20); // 100 / 5 = 20 contracts
    assert.strictEqual(r.trade.cost, 100);
    assert.strictEqual(r.trade.status, 'paper-filled');
    assert.ok(r.trade.orderId.startsWith('paper-'));

    const bal = getPaperBalance();
    assert.strictEqual(bal.balance.available, 900); // 1000 - 100

    const pos = getPaperPositions();
    assert.strictEqual(pos.positions.length, 1);
    assert.strictEqual(pos.positions[0].ticker, 'KXHIGHNY-26FEB14-T40');
    assert.strictEqual(pos.positions[0].yesCount, 20);
  });

  it('rejects trade exceeding paper balance', () => {
    const r = executePaperTrade({
      ticker: 'KXHIGHCHI-26FEB14-T50',
      side: 'yes',
      amount: 999,
      yesPrice: 10,
    });
    // 999 / 10 = 99 contracts * 10 = 990¢, balance is 900¢
    assert.strictEqual(r.success, false);
    assert.ok(r.error.includes('insufficient'));
  });

  it('calculates contract count correctly (floors)', () => {
    const r = executePaperTrade({
      ticker: 'KXHIGHCHI-26FEB14-T50',
      side: 'yes',
      amount: 15,
      yesPrice: 7,
    });
    assert.strictEqual(r.success, true);
    assert.strictEqual(r.trade.count, 2); // floor(15/7) = 2
    assert.strictEqual(r.trade.cost, 14); // 2 * 7
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Section 6: Paper settlement
// ═══════════════════════════════════════════════════════════════════════════════

describe('Section 6: settlePaperTrades', () => {
  before(() => {
    backupPaperState();
  });
  after(() => restorePaperState());

  it('returns early with no positions', async () => {
    resetPaper();
    const r = await settlePaperTrades();
    assert.strictEqual(r.success, true);
    assert.strictEqual(r.settled, 0);
  });

  it('skips future-dated positions', async () => {
    // Create a position dated far in the future
    const state = getPaperState();
    state.positions = [{
      id: 'paper-future',
      ticker: 'KXHIGHNY-30DEC25-T40',
      side: 'yes',
      count: 10,
      yesPrice: 5,
      cost: 50,
      city: 'NYC',
      date: '2030-12-25',
      bucket: { low: null, high: 40 },
      timestamp: new Date().toISOString(),
    }];
    savePaperState(state);

    const r = await settlePaperTrades();
    assert.strictEqual(r.settled, 0);
    // Position should still be there
    assert.strictEqual(getPaperState().positions.length, 1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Section 7: getPaperSummary
// ═══════════════════════════════════════════════════════════════════════════════

describe('Section 7: getPaperSummary', () => {
  before(() => {
    backupPaperState();
  });
  after(() => restorePaperState());

  it('returns zero stats for fresh state', () => {
    resetPaper();
    const r = getPaperSummary();
    assert.strictEqual(r.success, true);
    assert.strictEqual(r.stats.totalTrades, 0);
    assert.strictEqual(r.stats.wins, 0);
    assert.strictEqual(r.stats.losses, 0);
  });

  it('calculates win/loss stats from settled trades', () => {
    const state = getPaperState();
    state.initialBalance = 10000;
    state.balance = 10500; // net +500¢
    state.settled = [
      { won: true, pnl: 800 },
      { won: false, pnl: -200 },
      { won: false, pnl: -100 },
    ];
    state.positions = [{ ticker: 'OPEN' }];
    savePaperState(state);

    const r = getPaperSummary();
    assert.strictEqual(r.stats.wins, 1);
    assert.strictEqual(r.stats.losses, 2);
    assert.strictEqual(r.stats.openPositions, 1);
    assert.strictEqual(r.stats.totalTrades, 4);
    assert.strictEqual(r.stats.netPnl, 500);
    assert.ok(r.message.includes('Won: 1'));
    assert.ok(r.message.includes('Lost: 2'));
  });
});
