#!/usr/bin/env node
/**
 * Long-running scheduler for Kalshi weather trading.
 * Replaces Windows Task Scheduler for Docker deployment.
 *
 * Runs scan, usage alerts, and daily summary on schedule.
 * Does NOT use dotenv — Docker provides env vars via env_file.
 * For local testing: node --env-file=.env scripts/kalshi-scheduler.js
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in environment');
  process.exit(1);
}

async function sendTelegram(text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: text.slice(0, 4096),
      parse_mode: 'Markdown',
    }),
  });
  if (!resp.ok) {
    // Retry without Markdown if parsing fails
    const retry = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: text.slice(0, 4096),
      }),
    });
    if (!retry.ok) console.error('Telegram send failed:', await retry.text());
  }
}

// Track last daily summary date to avoid duplicates
let lastSummaryDate = null;

async function runScheduledScan() {
  try {
    const { runScan } = await import('../skills/kalshi/scanner.js');
    const result = await runScan();
    await sendTelegram(result.message);
    console.log(`[SCAN] ${new Date().toISOString()}`);
  } catch (err) {
    const errorMsg = `❌ Kalshi scan failed: ${err.message}`;
    console.error(errorMsg);
    await sendTelegram(errorMsg).catch(() => {});
  }
}

async function runScheduledUsageAlert() {
  try {
    const { getUsageAlert } = await import('../skills/kalshi/scanner.js');
    const result = await getUsageAlert();
    if (!result.suppress && result.message) {
      await sendTelegram(result.message);
      console.log(`[USAGE] ${new Date().toISOString()}`);
    } else {
      console.log(`[USAGE] Suppressed (no new activity) — ${new Date().toISOString()}`);
    }
  } catch (err) {
    const errorMsg = `❌ Kalshi usage alert failed: ${err.message}`;
    console.error(errorMsg);
    await sendTelegram(errorMsg).catch(() => {});
  }
}

async function runScheduledSettlementCheck() {
  try {
    const { checkSettlements } = await import('../skills/kalshi/settlement.js');
    const result = await checkSettlements();
    if (!result.success) {
      const errorMsg = `❌ Settlement check failed: ${result.error}`;
      console.error(errorMsg);
      await sendTelegram(errorMsg).catch(() => {});
      return;
    }
    if (result.updated > 0) {
      await sendTelegram(`📊 *Settlement Update*\n${result.summary}`);
      console.log(`[SETTLEMENTS] Updated ${result.updated} — ${new Date().toISOString()}`);
    } else {
      console.log(`[SETTLEMENTS] No updates — ${new Date().toISOString()}`);
    }
  } catch (err) {
    const errorMsg = `❌ Settlement check failed: ${err.message}`;
    console.error(errorMsg);
    await sendTelegram(errorMsg).catch(() => {});
  }

  // Also settle any paper trades
  try {
    const { settlePaperTrades } = await import('../skills/kalshi/paper.js');
    const paperResult = await settlePaperTrades();
    if (paperResult.settled > 0) {
      await sendTelegram(`📝 Paper Settlement: ${paperResult.summary}`);
      console.log(`[PAPER] Settled ${paperResult.settled} — ${new Date().toISOString()}`);
    }
  } catch (err) {
    console.error(`[PAPER] Settlement error: ${err.message}`);
  }
}

async function runScheduledDailySummary() {
  try {
    const { getDailySummary } = await import('../skills/kalshi/scanner.js');
    const result = await getDailySummary();
    await sendTelegram(result.message);
    console.log(`[SUMMARY] ${new Date().toISOString()}`);
  } catch (err) {
    const errorMsg = `❌ Kalshi daily summary failed: ${err.message}`;
    console.error(errorMsg);
    await sendTelegram(errorMsg).catch(() => {});
  }
}

function getETTime() {
  // Convert to US/Eastern time
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
}

function checkDailySummaryTime() {
  const et = getETTime();
  const hour = et.getHours();
  const dateStr = et.toISOString().split('T')[0];

  // Run at 9:00 PM ET if we haven't sent today's summary yet
  if (hour === 21 && lastSummaryDate !== dateStr) {
    lastSummaryDate = dateStr;
    runScheduledDailySummary();
  }
}

async function startScheduler() {
  // Load config to get intervals
  const { loadTradingConfig } = await import('../skills/kalshi/config.js');
  const config = loadTradingConfig();

  const scanIntervalMs = config.scanIntervalMinutes * 60 * 1000;
  const usageAlertIntervalMs = config.usageAlertIntervalMinutes * 60 * 1000;

  const settlementIntervalMs = 6 * 60 * 60 * 1000; // every 6 hours

  console.log(`[STARTUP] Kalshi scheduler running — mode: ${config.mode}, scan every ${config.scanIntervalMinutes}m, settlements every 6h, first scan in 30s`);

  // Run first scan after 30 seconds, first settlement check after 60 seconds
  setTimeout(runScheduledScan, 30 * 1000);
  setTimeout(runScheduledSettlementCheck, 60 * 1000);

  // Schedule recurring scan
  setInterval(async () => {
    // Reload config each time to pick up changes
    const { loadTradingConfig } = await import('../skills/kalshi/config.js');
    loadTradingConfig();
    runScheduledScan();
  }, scanIntervalMs);

  // Schedule recurring usage alerts
  setInterval(runScheduledUsageAlert, usageAlertIntervalMs);

  // Schedule recurring settlement checks (every 6 hours)
  setInterval(runScheduledSettlementCheck, settlementIntervalMs);

  // Check for daily summary every 60 seconds
  setInterval(checkDailySummaryTime, 60 * 1000);

  // Heartbeat every hour
  setInterval(() => {
    const nextScanMinutes = Math.ceil(scanIntervalMs / 1000 / 60);
    console.log(`[HEARTBEAT] Kalshi scheduler alive — next scan in ${nextScanMinutes}m`);
  }, 60 * 60 * 1000);
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Shutting down...');
  process.exit(0);
});

startScheduler();
