import { logAction } from './client.js';

/**
 * Check circuit breakers to determine if trading should be halted.
 * Based on the kalshi-risk-manager agent specification.
 *
 * @param {Object[]} trades - Array of trade objects from getTradeLog()
 * @param {Object} config - Trading config with maxDailySpend
 * @returns {{ canTrade: boolean, reasons: string[] }}
 */
export function checkCircuitBreakers(trades, config) {
  const reasons = [];
  const todayStr = new Date().toISOString().split('T')[0];
  const todayTrades = trades.filter(t => t.date === todayStr);

  // 1. Daily loss > 20% of daily budget → stop
  const settledToday = todayTrades.filter(t => t.pnl_cents !== '');
  const dailyPnl = settledToday.reduce((sum, t) => sum + (Number(t.pnl_cents) || 0), 0);
  const lossThreshold = -Math.floor((config.maxDailySpend || 1000) * 0.2);
  if (dailyPnl < lossThreshold) {
    reasons.push(`Daily loss ${dailyPnl}¢ exceeds 20% of budget (${lossThreshold}¢)`);
  }

  // 2. 5+ consecutive losses → stop
  // Look at most recent settled trades (all time, not just today)
  const settled = trades.filter(t => t.settled_won !== '').reverse(); // most recent first
  let consecutiveLosses = 0;
  for (const t of settled) {
    if (t.settled_won === 'no') {
      consecutiveLosses++;
    } else {
      break;
    }
  }
  if (consecutiveLosses >= 5) {
    reasons.push(`${consecutiveLosses} consecutive losses`);
  }

  // 3. Any recent forecast miss > 8°F → flag for review
  const recentWithActual = trades.filter(t =>
    t.actual_high !== '' && t.forecast_temp !== '' &&
    !isNaN(Number(t.actual_high)) && !isNaN(Number(t.forecast_temp))
  ).slice(-10); // last 10 with data

  for (const t of recentWithActual) {
    const miss = Math.abs(Number(t.forecast_temp) - Number(t.actual_high));
    if (miss > 8) {
      reasons.push(`Forecast miss of ${miss}°F for ${t.city} on ${t.date} (forecast: ${t.forecast_temp}°F, actual: ${t.actual_high}°F)`);
      break; // one is enough to flag
    }
  }

  const canTrade = reasons.length === 0;

  if (!canTrade) {
    logAction('circuit_breaker_tripped', { reasons }, 'warn');
  }

  return { canTrade, reasons };
}
