import fs from 'fs';
import path from 'path';
import { logAction } from './client.js';
import { getObservedHigh } from './observations.js';

const PAPER_FILE = path.join(
  process.env.HOME || process.env.USERPROFILE || '.',
  '.kalshi-paper.json',
);

const DEFAULT_BALANCE = 100_000; // 100000¢ = $1000

/**
 * Determine if a bucket condition was met given the actual observed high.
 *
 * @param {{ low: number|null, high: number|null }} bucket
 * @param {number} actualHigh - Observed high temperature in °F
 * @returns {boolean}
 */
export function didBucketWin(bucket, actualHigh) {
  if (bucket.low == null) return actualHigh <= bucket.high;   // "≤X"
  if (bucket.high == null) return actualHigh >= bucket.low;   // "≥X"
  return actualHigh >= bucket.low && actualHigh <= bucket.high; // range
}

/**
 * Load paper trading state from disk.
 * Returns default state if file doesn't exist or is corrupt.
 */
export function getPaperState() {
  try {
    const raw = fs.readFileSync(PAPER_FILE, 'utf-8');
    const state = JSON.parse(raw);
    // Validate shape
    if (typeof state.balance !== 'number' || !Array.isArray(state.positions) || !Array.isArray(state.settled)) {
      throw new Error('invalid shape');
    }
    return state;
  } catch {
    return {
      initialBalance: DEFAULT_BALANCE,
      balance: DEFAULT_BALANCE,
      positions: [],
      settled: [],
    };
  }
}

/**
 * Save paper trading state to disk.
 */
export function savePaperState(state) {
  try {
    fs.writeFileSync(PAPER_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    logAction('paper_save_error', { error: err.message }, 'error');
  }
}

/**
 * Reset paper trading to a fresh start.
 * @param {number} [balanceCents=100000] - Starting balance in cents
 */
export function resetPaper(balanceCents = DEFAULT_BALANCE) {
  const state = {
    initialBalance: balanceCents,
    balance: balanceCents,
    positions: [],
    settled: [],
  };
  savePaperState(state);
  logAction('paper_reset', { balance: balanceCents });
  return { success: true, message: `Paper trading reset. Balance: ${balanceCents}¢ ($${(balanceCents / 100).toFixed(2)})` };
}

/**
 * Get paper balance in the same shape as getBalance() from trade.js.
 */
export function getPaperBalance() {
  const state = getPaperState();
  return {
    success: true,
    balance: {
      available: state.balance,
      payout: 0,
    },
  };
}

/**
 * Get paper positions in the same shape as getPositions() from trade.js.
 */
export function getPaperPositions() {
  const state = getPaperState();
  const positions = state.positions.map(p => ({
    ticker: p.ticker,
    marketTitle: `${p.city} ${formatBucketStr(p.bucket)}°F`,
    yesCount: p.count,
    avgYesPrice: p.yesPrice,
    realizedPnl: 0,
    restingOrderCount: 0,
  }));
  return { success: true, positions };
}

function formatBucketStr(bucket) {
  if (!bucket) return '?';
  if (bucket.low == null) return `≤${bucket.high}`;
  if (bucket.high == null) return `≥${bucket.low}`;
  return `${bucket.low}-${bucket.high}`;
}

/**
 * Execute a paper trade. Validates inputs, deducts from paper balance,
 * adds position to state. Returns same shape as executeTrade().
 *
 * @param {Object} params
 * @param {string} params.ticker - Market ticker
 * @param {string} params.side - "yes" or "no"
 * @param {number} params.amount - Amount to spend in cents
 * @param {number} params.yesPrice - Price per contract in cents (1-99)
 * @param {Object} [params.opportunity] - Opportunity context from findOpportunities()
 */
export function executePaperTrade({ ticker, side, amount, yesPrice, opportunity }) {
  if (!ticker) return { success: false, error: 'ticker is required' };
  if (!side || !['yes', 'no'].includes(side.toLowerCase())) return { success: false, error: 'side must be "yes" or "no"' };
  if (!amount || amount <= 0) return { success: false, error: 'amount must be positive' };
  if (!yesPrice || yesPrice < 1 || yesPrice > 99) return { success: false, error: 'yesPrice must be between 1 and 99 cents' };

  const count = Math.floor(amount / yesPrice);
  if (count < 1) return { success: false, error: `Amount ${amount}¢ too small for price ${yesPrice}¢` };

  const cost = count * yesPrice;
  const state = getPaperState();

  if (cost > state.balance) {
    return { success: false, error: `Paper balance insufficient: need ${cost}¢, have ${state.balance}¢` };
  }

  // Derive event date from ticker (e.g., KXHIGHNY-26FEB14-T40 → 2026-02-14)
  const date = dateFromTicker(ticker);
  const city = opportunity?.city || '';

  const position = {
    id: `paper-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ticker,
    side: side.toLowerCase(),
    count,
    yesPrice,
    cost,
    city,
    date,
    bucket: opportunity?.bucket || null,
    forecastTemp: opportunity?.forecastTemp || null,
    forecastConfidence: opportunity?.forecastConfidence || null,
    confidenceSource: opportunity?.confidenceSource || null,
    edge: opportunity?.edge || null,
    timestamp: new Date().toISOString(),
  };

  state.balance -= cost;
  state.positions.push(position);
  savePaperState(state);

  logAction('paper_trade_executed', { ticker, side: side.toLowerCase(), count, yesPrice, cost, paperBalance: state.balance });

  return {
    success: true,
    trade: {
      orderId: position.id,
      ticker,
      side: side.toLowerCase(),
      count,
      yesPrice,
      cost,
      status: 'paper-filled',
      timestamp: position.timestamp,
    },
  };
}

/**
 * Settle paper trades whose event date has passed.
 * Fetches observed temperatures from NOAA and determines win/loss.
 */
export async function settlePaperTrades() {
  const state = getPaperState();
  if (state.positions.length === 0) {
    return { success: true, settled: 0, summary: 'No paper positions to settle.' };
  }

  const today = new Date().toISOString().split('T')[0];
  const settleable = state.positions.filter(p => p.date && p.date < today);

  if (settleable.length === 0) {
    return { success: true, settled: 0, summary: 'No paper positions ready to settle (all are today or future).' };
  }

  let settledCount = 0;
  const remaining = [];

  for (const pos of state.positions) {
    if (!pos.date || pos.date >= today || !pos.bucket || !pos.city) {
      remaining.push(pos);
      continue;
    }

    // Fetch observed high temperature
    let actualHigh;
    try {
      const obsResult = await getObservedHigh(pos.city, pos.date);
      if (!obsResult.success) {
        logAction('paper_settle_skip', { ticker: pos.ticker, error: obsResult.error }, 'warn');
        remaining.push(pos); // Keep position, try next time
        continue;
      }
      actualHigh = obsResult.actualHigh;
    } catch (err) {
      logAction('paper_settle_error', { ticker: pos.ticker, error: err.message }, 'warn');
      remaining.push(pos);
      continue;
    }

    // Determine win/loss
    const bucketWon = didBucketWin(pos.bucket, actualHigh);
    const betWon = (pos.side === 'yes' && bucketWon) || (pos.side === 'no' && !bucketWon);
    const revenue = betWon ? pos.count * 100 : 0; // YES pays 100¢ per contract
    const pnl = revenue - pos.cost;

    // Credit winnings to paper balance
    if (betWon) {
      state.balance += revenue;
    }

    state.settled.push({
      ...pos,
      actualHigh,
      won: betWon,
      revenue,
      pnl,
      settledAt: new Date().toISOString(),
    });

    settledCount++;
    logAction('paper_settled', { ticker: pos.ticker, actualHigh, won: betWon, pnl, paperBalance: state.balance });
  }

  state.positions = remaining;
  savePaperState(state);

  const summary = settledCount > 0
    ? `Settled ${settledCount} paper trades. Balance: ${state.balance}¢ ($${(state.balance / 100).toFixed(2)})`
    : 'No paper positions could be settled (observations unavailable).';

  return { success: true, settled: settledCount, summary };
}

/**
 * Get a formatted paper trading summary.
 */
export function getPaperSummary() {
  const state = getPaperState();
  const totalTrades = state.settled.length + state.positions.length;

  if (totalTrades === 0) {
    return {
      success: true,
      message: `Paper trading: $${(state.balance / 100).toFixed(2)} balance, 0 trades.`,
      stats: { totalTrades: 0, wins: 0, losses: 0, openPositions: 0, balance: state.balance, initialBalance: state.initialBalance, netPnl: 0 },
    };
  }

  const wins = state.settled.filter(s => s.won).length;
  const losses = state.settled.filter(s => !s.won).length;
  const netPnl = state.balance - state.initialBalance;
  const winRate = state.settled.length > 0 ? Math.round((wins / state.settled.length) * 100) : 0;

  const lines = [
    `Paper Trading ($${(state.initialBalance / 100).toFixed(2)} virtual):`,
    `  Balance: $${(state.balance / 100).toFixed(2)}`,
    `  Settled: ${state.settled.length} | Won: ${wins} | Lost: ${losses} | Win rate: ${winRate}%`,
    `  Open: ${state.positions.length} positions`,
    `  Net P&L: ${netPnl >= 0 ? '+' : ''}$${(netPnl / 100).toFixed(2)}`,
  ];

  return {
    success: true,
    message: lines.join('\n'),
    stats: { totalTrades, wins, losses, openPositions: state.positions.length, balance: state.balance, initialBalance: state.initialBalance, netPnl },
  };
}

/**
 * Derive event date from a market ticker.
 * e.g., "KXHIGHNY-26FEB14-T40" → "2026-02-14"
 */
function dateFromTicker(ticker) {
  const parts = ticker.split('-');
  if (parts.length < 2) return '';
  const raw = parts[1]; // e.g. "26FEB14"
  const months = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06', JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12' };
  const year = '20' + raw.slice(0, 2);
  const month = months[raw.slice(2, 5)];
  const day = raw.slice(5).padStart(2, '0');
  if (!month) return '';
  return `${year}-${month}-${day}`;
}

// Export for testing
export { PAPER_FILE, DEFAULT_BALANCE, dateFromTicker };
