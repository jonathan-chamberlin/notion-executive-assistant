import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { kalshiAuthFetch, logAction } from './client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TRADES_FILE = path.join(__dirname, 'trades.csv');

const CSV_HEADERS = [
  'date', 'city', 'event_ticker', 'market_ticker', 'bucket', 'forecast_temp',
  'sigma', 'model_confidence', 'market_price', 'edge', 'side', 'price_paid',
  'contracts', 'order_id', 'status', 'fill_count', 'actual_high',
  'settled_won', 'revenue_cents', 'pnl_cents',
];

const HEADER_LINE = CSV_HEADERS.join(',');

/** Escape a value for CSV (wrap in quotes if it contains comma, quote, or newline). */
function csvEscape(value) {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Parse a CSV line respecting quoted fields. */
function parseCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

/**
 * Format a bucket object as a human-readable string.
 * e.g. { low: 36, high: 40 } → "36-40", { high: 36 } → "≤36", { low: 40 } → "≥40"
 */
function formatBucket(bucket) {
  if (!bucket) return '';
  if (bucket.low == null) return `≤${bucket.high}`;
  if (bucket.high == null) return `≥${bucket.low}`;
  return `${bucket.low}-${bucket.high}`;
}

/**
 * Derive event ticker from market ticker.
 * Market ticker: "KXHIGHNY-26FEB12-B36.5" → event ticker: "KXHIGHNY-26FEB12"
 */
function deriveEventTicker(marketTicker) {
  if (!marketTicker) return '';
  const parts = marketTicker.split('-');
  if (parts.length >= 2) return `${parts[0]}-${parts[1]}`;
  return marketTicker;
}

/**
 * Log a trade to the CSV file after a successful executeTrade() call.
 *
 * @param {Object|null} opportunity - The opportunity from findOpportunities() (optional)
 * @param {Object} tradeResult - The trade result from executeTrade() (.trade property)
 */
export function logTrade(opportunity, tradeResult) {
  const trade = tradeResult.trade || tradeResult;

  const row = [
    csvEscape(new Date().toISOString().split('T')[0]),
    csvEscape(opportunity?.city || ''),
    csvEscape(opportunity ? deriveEventTicker(trade.ticker) : deriveEventTicker(trade.ticker)),
    csvEscape(trade.ticker || ''),
    csvEscape(opportunity ? formatBucket(opportunity.bucket) : ''),
    csvEscape(opportunity?.forecastTemp ?? ''),
    csvEscape(opportunity?.sigma ?? 3),
    csvEscape(opportunity?.forecastConfidence ?? ''),
    csvEscape(opportunity?.marketPrice ?? ''),
    csvEscape(opportunity?.edge ?? ''),
    csvEscape(trade.side || ''),
    csvEscape(trade.yesPrice || ''),
    csvEscape(trade.count || ''),
    csvEscape(trade.orderId || ''),
    csvEscape(trade.status || ''),
    csvEscape(''),  // fill_count — filled by checkSettlements
    csvEscape(''),  // actual_high — filled by checkSettlements
    csvEscape(''),  // settled_won — filled by checkSettlements
    csvEscape(''),  // revenue_cents — filled by checkSettlements
    csvEscape(''),  // pnl_cents — filled by checkSettlements
  ];

  const needsHeader = !fs.existsSync(TRADES_FILE);
  const line = row.join(',');

  try {
    if (needsHeader) {
      fs.writeFileSync(TRADES_FILE, HEADER_LINE + '\n' + line + '\n', 'utf-8');
    } else {
      fs.appendFileSync(TRADES_FILE, line + '\n', 'utf-8');
    }
    logAction('trade_logged', { ticker: trade.ticker, file: TRADES_FILE });
  } catch (err) {
    logAction('trade_log_error', { error: err.message }, 'error');
  }
}

/**
 * Read the trade log CSV and return an array of objects.
 * Returns [] if the file doesn't exist.
 */
export function getTradeLog() {
  try {
    const raw = fs.readFileSync(TRADES_FILE, 'utf-8');
    const lines = raw.trim().split('\n');
    if (lines.length <= 1) return []; // only header or empty

    const headers = parseCsvLine(lines[0]);
    return lines.slice(1).filter(l => l.trim()).map(line => {
      const values = parseCsvLine(line);
      const obj = {};
      headers.forEach((h, i) => { obj[h] = values[i] ?? ''; });
      return obj;
    });
  } catch {
    return [];
  }
}

/**
 * Check settlements for trades that haven't been reconciled yet.
 * Queries /portfolio/settlements and /portfolio/orders to fill in
 * settled_won, revenue_cents, pnl_cents, status, and fill_count.
 *
 * Returns { success, updated, summary }.
 */
export async function checkSettlements() {
  const trades = getTradeLog();
  if (trades.length === 0) {
    return { success: true, updated: 0, summary: 'No trades to check.' };
  }

  // Find unsettled rows (settled_won is empty)
  const unsettled = trades.filter(t => !t.settled_won);
  if (unsettled.length === 0) {
    return { success: true, updated: 0, summary: 'All trades already settled.' };
  }

  let settlements = [];
  let orders = [];

  try {
    const settlementsData = await kalshiAuthFetch('GET', '/portfolio/settlements');
    settlements = settlementsData.settlements || [];
  } catch (err) {
    logAction('settlement_fetch_error', { error: err.message }, 'error');
    return { success: false, error: `Failed to fetch settlements: ${err.message}` };
  }

  try {
    const ordersData = await kalshiAuthFetch('GET', '/portfolio/orders');
    orders = ordersData.orders || [];
  } catch (err) {
    logAction('orders_fetch_error', { error: err.message }, 'warn');
    // Non-fatal: we can still update settlements without order data
  }

  // Index settlements by market_ticker
  const settlementsByTicker = {};
  for (const s of settlements) {
    settlementsByTicker[s.market_ticker] = s;
  }

  // Index orders by order_id
  const ordersById = {};
  for (const o of orders) {
    ordersById[o.order_id] = o;
  }

  let updatedCount = 0;

  for (const trade of trades) {
    if (trade.settled_won) continue; // already settled

    let changed = false;

    // Check order status
    if (trade.order_id && ordersById[trade.order_id]) {
      const order = ordersById[trade.order_id];
      trade.status = order.status || trade.status;
      trade.fill_count = String(order.fill_count ?? '');
      changed = true;
    }

    // Check settlement
    const settlement = settlementsByTicker[trade.market_ticker];
    if (settlement) {
      trade.settled_won = settlement.market_result || '';
      trade.revenue_cents = String(settlement.revenue ?? '');
      const pricePaid = Number(trade.price_paid) || 0;
      const contracts = Number(trade.contracts) || 0;
      const revenue = Number(settlement.revenue) || 0;
      trade.pnl_cents = String(revenue - (pricePaid * contracts));
      changed = true;
    }

    if (changed) updatedCount++;
  }

  // Rewrite the CSV with updated data
  if (updatedCount > 0) {
    try {
      const lines = [HEADER_LINE];
      for (const trade of trades) {
        const row = CSV_HEADERS.map(h => csvEscape(trade[h]));
        lines.push(row.join(','));
      }
      fs.writeFileSync(TRADES_FILE, lines.join('\n') + '\n', 'utf-8');
      logAction('settlements_updated', { updated: updatedCount });
    } catch (err) {
      logAction('settlement_write_error', { error: err.message }, 'error');
      return { success: false, error: `Failed to write updated trades: ${err.message}` };
    }
  }

  return {
    success: true,
    updated: updatedCount,
    summary: `Checked ${unsettled.length} unsettled trades, updated ${updatedCount}.`,
  };
}

// Export for testing
export { TRADES_FILE, CSV_HEADERS, HEADER_LINE, csvEscape, parseCsvLine, formatBucket };
