import { CONFIG, loadTradingConfig, saveTradingConfig, TRADING_CONFIG_PATH } from './config.js';
import { findOpportunities } from './analyze.js';
import { executeTrade, getBalance, getPositions } from './trade.js';
import { getRemainingDailyBudget } from './budget.js';
import { checkSettlements, getTradeLog } from './settlement.js';
import { getUsageReport, markUsageAlerted, getUsageStats } from './usage.js';
import { logAction } from './client.js';

const VALID_MODES = ['paused', 'alert-only', 'alert-then-trade', 'autonomous'];

/**
 * Format an opportunity as a compact Telegram-friendly string.
 */
function formatOpportunity(opp, index) {
  const bucket = opp.bucket
    ? (opp.bucket.low == null ? `≤${opp.bucket.high}` : opp.bucket.high == null ? `≥${opp.bucket.low}` : `${opp.bucket.low}-${opp.bucket.high}`)
    : '?';
  return [
    `${index + 1}. ${opp.city} ${bucket}°F`,
    `   Forecast: ${opp.forecastTemp}°F (${opp.forecastConfidence}% conf)`,
    `   Market: ${opp.marketPrice}¢ → Edge: +${opp.edge}pp`,
    `   ${opp.ticker}`,
  ].join('\n');
}

/**
 * Main 30-min cron entry point.
 * Read mode → findOpportunities → format alert → optionally trade (if autonomous).
 */
export async function runScan() {
  const tradingConfig = loadTradingConfig();
  const { mode } = tradingConfig;

  logAction('scan_started', { mode });

  if (mode === 'paused') {
    return { success: true, message: '⏸️ Scanner is paused. Send /kalshi mode alert-only to resume.' };
  }

  let result;
  try {
    result = await findOpportunities({ minEdge: tradingConfig.minEdge });
  } catch (error) {
    logAction('scan_error', { error: error.message }, 'error');
    return { success: false, message: `❌ Scan failed: ${error.message}` };
  }

  if (!result.success) {
    return { success: false, message: `❌ Scan failed: ${result.error || 'Unknown error'}` };
  }

  const { opportunities, summary } = result;
  const topN = opportunities.slice(0, tradingConfig.topOpportunitiesToShow);

  const lines = [
    `🌡️ Weather Scan — ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' })} ET`,
    `Mode: ${mode} | Budget left: ${getRemainingDailyBudget()}¢`,
    `Scanned ${summary.eventsScanned} events across ${summary.citiesForecasted} cities`,
    ``,
  ];

  if (opportunities.length === 0) {
    lines.push('No opportunities found above minimum edge.');
  } else {
    lines.push(`Found ${opportunities.length} opportunities (showing top ${topN.length}):`);
    lines.push('');
    for (let i = 0; i < topN.length; i++) {
      lines.push(formatOpportunity(topN[i], i));
    }
  }

  // In autonomous mode, execute top trades within budget
  if (mode === 'autonomous' && opportunities.length > 0) {
    const maxTrades = tradingConfig.autoTradeMaxPerScan;
    const tradeable = opportunities.slice(0, maxTrades);
    const tradeResults = [];

    for (const opp of tradeable) {
      const tradeResult = await executeTrade({
        ticker: opp.ticker,
        side: opp.side,
        amount: Math.min(opp.suggestedAmount, tradingConfig.maxTradeSize),
        yesPrice: opp.suggestedYesPrice,
        opportunity: opp,
      });
      tradeResults.push({ ticker: opp.ticker, ...tradeResult });
    }

    lines.push('');
    lines.push(`🤖 Auto-traded ${tradeResults.length} positions:`);
    for (const tr of tradeResults) {
      const icon = tr.success ? '✅' : '❌';
      const detail = tr.success
        ? `${tr.trade.count}x @ ${tr.trade.yesPrice}¢`
        : tr.error;
      lines.push(`  ${icon} ${tr.ticker}: ${detail}`);
    }
  }

  if (mode === 'alert-then-trade' && opportunities.length > 0) {
    lines.push('');
    lines.push('💬 Reply "trade" to execute top opportunities.');
  }

  if (summary.forecastErrors?.length > 0) {
    lines.push('');
    lines.push(`⚠️ Forecast errors: ${summary.forecastErrors.length} cities failed`);
  }

  logAction('scan_completed', {
    mode,
    opportunitiesFound: opportunities.length,
    eventsScanned: summary.eventsScanned,
  });

  return { success: true, message: lines.join('\n') };
}

/**
 * Set trading mode. Validates input and writes to trading-config.json.
 */
export function setMode(mode) {
  if (!VALID_MODES.includes(mode)) {
    return {
      success: false,
      message: `❌ Invalid mode "${mode}". Valid: ${VALID_MODES.join(', ')}`,
    };
  }

  const config = loadTradingConfig();
  config.mode = mode;
  saveTradingConfig(config);

  logAction('mode_changed', { mode });

  const descriptions = {
    paused: 'No scanning, no trades.',
    'alert-only': 'Scans and alerts, no trades.',
    'alert-then-trade': 'Scans, alerts, waits for confirmation to trade.',
    autonomous: 'Scans and auto-trades within budget.',
  };

  return {
    success: true,
    message: `✅ Mode set to: ${mode}\n${descriptions[mode]}`,
  };
}

/**
 * Get current status: mode, budget remaining, trade count, balance.
 */
export async function getStatus() {
  const tradingConfig = loadTradingConfig();
  const remaining = getRemainingDailyBudget();
  const trades = getTradeLog();
  const todayStr = new Date().toISOString().split('T')[0];
  const todayTrades = trades.filter(t => t.date === todayStr);

  let balanceStr = 'unknown';
  try {
    const balResult = await getBalance();
    if (balResult.success) {
      balanceStr = `${balResult.balance.available}¢`;
    }
  } catch {
    // non-fatal
  }

  const lines = [
    `📈 Kalshi Trading Status`,
    ``,
    `Mode: ${tradingConfig.mode}`,
    `Daily budget remaining: ${remaining}¢ / ${tradingConfig.maxDailySpend}¢`,
    `Trades today: ${todayTrades.length}`,
    `Total trades: ${trades.length}`,
    `Kalshi balance: ${balanceStr}`,
    `Min edge: ${tradingConfig.minEdge}pp`,
    `Max trade size: ${tradingConfig.maxTradeSize}¢`,
  ];

  return { success: true, message: lines.join('\n') };
}

/**
 * API usage report — only returns content if there's new activity since last alert.
 */
export function getUsageAlert() {
  const report = getUsageReport();

  if (!report.hasNewActivity) {
    return { success: true, message: '', suppress: true };
  }

  markUsageAlerted();
  return { success: true, message: report.message };
}

/**
 * End-of-day summary: trade count, settlements, balance, usage.
 */
export async function getDailySummary() {
  const tradingConfig = loadTradingConfig();
  const trades = getTradeLog();
  const todayStr = new Date().toISOString().split('T')[0];
  const todayTrades = trades.filter(t => t.date === todayStr);
  const remaining = getRemainingDailyBudget();

  // Check settlements
  let settlementSummary = 'Unable to check';
  try {
    const settleResult = await checkSettlements();
    if (settleResult.success) {
      settlementSummary = settleResult.summary;
    }
  } catch {
    // non-fatal
  }

  // Get balance
  let balanceStr = 'unknown';
  try {
    const balResult = await getBalance();
    if (balResult.success) {
      balanceStr = `${balResult.balance.available}¢ available, ${balResult.balance.payout}¢ in payouts`;
    }
  } catch {
    // non-fatal
  }

  // Usage stats
  const usage = getUsageStats();

  const lines = [
    `📋 Daily Summary — ${todayStr}`,
    ``,
    `Mode: ${tradingConfig.mode}`,
    `Trades today: ${todayTrades.length}`,
    `Budget spent: ${tradingConfig.maxDailySpend - remaining}¢ / ${tradingConfig.maxDailySpend}¢`,
    ``,
    `Settlements: ${settlementSummary}`,
    `Kalshi balance: ${balanceStr}`,
    ``,
    `OpenClaw usage today:`,
    `  Cost: $${usage.totalCost.toFixed(4)}`,
    `  Invocations: ${usage.invocations}`,
    `  Tokens: ${usage.tokensIn.toLocaleString()} in / ${usage.tokensOut.toLocaleString()} out`,
  ];

  logAction('daily_summary', { trades: todayTrades.length, mode: tradingConfig.mode });

  return { success: true, message: lines.join('\n') };
}
