import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';

import {
  logTrade, getTradeLog, checkSettlements,
  TRADES_FILE, CSV_HEADERS, HEADER_LINE, csvEscape, parseCsvLine, formatBucket,
} from '../settlement.js';

// ---------------------------------------------------------------------------
// Snapshot / restore the trades CSV so tests don't pollute real data
// ---------------------------------------------------------------------------

let originalContent = null;
let originalFileExisted = false;

before(() => {
  try {
    originalContent = fs.readFileSync(TRADES_FILE, 'utf-8');
    originalFileExisted = true;
  } catch {
    originalFileExisted = false;
    originalContent = null;
  }
});

after(() => {
  // Always restore — file is a permanent repo artifact
  fs.writeFileSync(TRADES_FILE, originalContent || (HEADER_LINE + '\n'), 'utf-8');
});

function resetTradesFile() {
  try { fs.unlinkSync(TRADES_FILE); } catch { /* ok */ }
}

// ---------------------------------------------------------------------------
// Mock opportunity and trade result
// ---------------------------------------------------------------------------

function mockOpportunity(overrides = {}) {
  return {
    city: 'NYC',
    bucket: { low: 36, high: 40 },
    forecastTemp: 38,
    sigma: 3,
    forecastConfidence: 72,
    marketPrice: 45,
    edge: 27,
    ticker: 'KXHIGHNY-26FEB12-B36.5',
    side: 'yes',
    ...overrides,
  };
}

function mockTradeResult(overrides = {}) {
  return {
    trade: {
      orderId: 'order-abc-123',
      ticker: 'KXHIGHNY-26FEB12-B36.5',
      side: 'yes',
      count: 5,
      yesPrice: 45,
      cost: 225,
      status: 'resting',
      timestamp: '2026-02-11T12:00:00.000Z',
      ...overrides,
    },
  };
}

// ---------------------------------------------------------------------------
// CSV helper tests
// ---------------------------------------------------------------------------

describe('csvEscape', () => {
  it('returns plain string as-is', () => {
    assert.equal(csvEscape('hello'), 'hello');
  });

  it('wraps string containing comma in quotes', () => {
    assert.equal(csvEscape('a,b'), '"a,b"');
  });

  it('escapes double quotes by doubling them', () => {
    assert.equal(csvEscape('say "hi"'), '"say ""hi"""');
  });

  it('handles null/undefined as empty string', () => {
    assert.equal(csvEscape(null), '');
    assert.equal(csvEscape(undefined), '');
  });

  it('handles numbers', () => {
    assert.equal(csvEscape(42), '42');
  });
});

describe('parseCsvLine', () => {
  it('parses simple comma-separated values', () => {
    assert.deepEqual(parseCsvLine('a,b,c'), ['a', 'b', 'c']);
  });

  it('parses quoted fields with commas', () => {
    assert.deepEqual(parseCsvLine('a,"b,c",d'), ['a', 'b,c', 'd']);
  });

  it('parses escaped double quotes inside quoted fields', () => {
    assert.deepEqual(parseCsvLine('"say ""hi""",done'), ['say "hi"', 'done']);
  });

  it('handles empty fields', () => {
    assert.deepEqual(parseCsvLine('a,,c'), ['a', '', 'c']);
  });
});

describe('formatBucket', () => {
  it('formats low-high range', () => {
    assert.equal(formatBucket({ low: 36, high: 40 }), '36-40');
  });

  it('formats upper-bound only', () => {
    assert.equal(formatBucket({ high: 36 }), '≤36');
  });

  it('formats lower-bound only', () => {
    assert.equal(formatBucket({ low: 40 }), '≥40');
  });

  it('returns empty for null', () => {
    assert.equal(formatBucket(null), '');
  });
});

// ---------------------------------------------------------------------------
// logTrade tests
// ---------------------------------------------------------------------------

describe('logTrade', () => {
  before(() => resetTradesFile());

  it('creates CSV with header if file does not exist', () => {
    resetTradesFile();
    logTrade(mockOpportunity(), mockTradeResult());
    const raw = fs.readFileSync(TRADES_FILE, 'utf-8');
    const lines = raw.trim().split('\n');
    assert.equal(lines[0], HEADER_LINE);
    assert.equal(lines.length, 2); // header + 1 data row
  });

  it('appends rows without duplicating header', () => {
    logTrade(mockOpportunity({ city: 'Chicago' }), mockTradeResult({ orderId: 'order-def-456' }));
    const raw = fs.readFileSync(TRADES_FILE, 'utf-8');
    const lines = raw.trim().split('\n');
    assert.equal(lines[0], HEADER_LINE);
    assert.equal(lines.length, 3); // header + 2 data rows

    // Verify no duplicate headers
    const headerCount = lines.filter(l => l === HEADER_LINE).length;
    assert.equal(headerCount, 1);
  });

  it('writes correct column values', () => {
    resetTradesFile();
    const opp = mockOpportunity();
    const result = mockTradeResult();
    logTrade(opp, result);

    const trades = getTradeLog();
    assert.equal(trades.length, 1);
    const row = trades[0];
    assert.equal(row.city, 'NYC');
    assert.equal(row.market_ticker, 'KXHIGHNY-26FEB12-B36.5');
    assert.equal(row.event_ticker, 'KXHIGHNY-26FEB12');
    assert.equal(row.bucket, '36-40');
    assert.equal(row.forecast_temp, '38');
    assert.equal(row.model_confidence, '72');
    assert.equal(row.market_price, '45');
    assert.equal(row.edge, '27');
    assert.equal(row.side, 'yes');
    assert.equal(row.price_paid, '45');
    assert.equal(row.contracts, '5');
    assert.equal(row.order_id, 'order-abc-123');
    assert.equal(row.status, 'resting');
    // Settlement fields should be empty
    assert.equal(row.settled_won, '');
    assert.equal(row.revenue_cents, '');
    assert.equal(row.pnl_cents, '');
  });

  it('works without opportunity (null)', () => {
    resetTradesFile();
    logTrade(null, mockTradeResult());
    const trades = getTradeLog();
    assert.equal(trades.length, 1);
    assert.equal(trades[0].city, '');
    assert.equal(trades[0].market_ticker, 'KXHIGHNY-26FEB12-B36.5');
    assert.equal(trades[0].order_id, 'order-abc-123');
  });
});

// ---------------------------------------------------------------------------
// getTradeLog tests
// ---------------------------------------------------------------------------

describe('getTradeLog', () => {
  it('returns empty array for missing file', () => {
    resetTradesFile();
    const trades = getTradeLog();
    assert.deepEqual(trades, []);
  });

  it('returns empty array for header-only file', () => {
    resetTradesFile();
    fs.writeFileSync(TRADES_FILE, HEADER_LINE + '\n', 'utf-8');
    const trades = getTradeLog();
    assert.deepEqual(trades, []);
  });

  it('returns parsed array of objects with correct keys', () => {
    resetTradesFile();
    logTrade(mockOpportunity(), mockTradeResult());
    logTrade(mockOpportunity({ city: 'Miami' }), mockTradeResult({ orderId: 'order-xyz' }));

    const trades = getTradeLog();
    assert.equal(trades.length, 2);
    for (const trade of trades) {
      for (const header of CSV_HEADERS) {
        assert.ok(header in trade, `missing key: ${header}`);
      }
    }
    assert.equal(trades[0].city, 'NYC');
    assert.equal(trades[1].city, 'Miami');
  });
});

// ---------------------------------------------------------------------------
// CSV escaping round-trip
// ---------------------------------------------------------------------------

describe('CSV round-trip with special characters', () => {
  before(() => resetTradesFile());

  it('handles commas and quotes in bucket field', () => {
    resetTradesFile();
    // Use a bucket with unusual values to test escaping
    const opp = mockOpportunity({ city: 'Austin, TX' });
    logTrade(opp, mockTradeResult());

    const trades = getTradeLog();
    assert.equal(trades.length, 1);
    assert.equal(trades[0].city, 'Austin, TX');
  });
});

// ---------------------------------------------------------------------------
// checkSettlements (offline — tests CSV rewrite logic)
// ---------------------------------------------------------------------------

describe('checkSettlements', () => {
  it('returns success with 0 updated when no trades exist', async () => {
    resetTradesFile();
    const result = await checkSettlements();
    assert.equal(result.success, true);
    assert.equal(result.updated, 0);
  });

  it('returns success when all trades already settled', async () => {
    resetTradesFile();
    // Write a trade that already has settled_won filled
    const header = HEADER_LINE;
    const row = CSV_HEADERS.map(h => {
      if (h === 'settled_won') return 'yes';
      if (h === 'market_ticker') return 'FAKE-TICKER';
      if (h === 'order_id') return 'order-settled';
      return '';
    }).join(',');
    fs.writeFileSync(TRADES_FILE, header + '\n' + row + '\n', 'utf-8');

    const result = await checkSettlements();
    assert.equal(result.success, true);
    assert.equal(result.updated, 0);
    assert.ok(result.summary.includes('already settled'));
  });
});
