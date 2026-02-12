#!/usr/bin/env node
/**
 * Standalone cron script for Kalshi weather scanning.
 * Runs the scanner and sends results directly to Telegram.
 *
 * Usage:
 *   node scripts/kalshi-cron.js scan        — run weather scan
 *   node scripts/kalshi-cron.js usage       — usage alert (suppressed if no activity)
 *   node scripts/kalshi-cron.js summary     — daily summary
 *   node scripts/kalshi-cron.js status      — current status
 *   node scripts/kalshi-cron.js calibration — calibration report
 *
 * Schedule via Windows Task Scheduler, cron, or clawdbot cron.
 */
import 'dotenv/config';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in .env');
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

const command = process.argv[2] || 'scan';

try {
  if (command === 'scan') {
    const { runScan } = await import('../skills/kalshi/scanner.js');
    const result = await runScan();
    await sendTelegram(result.message);
    console.log(result.message);
  } else if (command === 'usage') {
    const { getUsageAlert } = await import('../skills/kalshi/scanner.js');
    const result = await getUsageAlert();
    if (!result.suppress && result.message) {
      await sendTelegram(result.message);
      console.log(result.message);
    } else {
      console.log('Usage alert suppressed (no new activity)');
    }
  } else if (command === 'summary') {
    const { getDailySummary } = await import('../skills/kalshi/scanner.js');
    const result = await getDailySummary();
    await sendTelegram(result.message);
    console.log(result.message);
  } else if (command === 'status') {
    const { getStatus } = await import('../skills/kalshi/scanner.js');
    const result = await getStatus();
    await sendTelegram(result.message);
    console.log(result.message);
  } else if (command === 'calibration') {
    const { getCalibrationReport } = await import('../skills/kalshi/calibration.js');
    const report = getCalibrationReport();
    await sendTelegram(report);
    console.log(report);
  } else {
    console.error(`Unknown command: ${command}. Use: scan, usage, summary, status, calibration`);
    process.exit(1);
  }
} catch (err) {
  const errorMsg = `❌ Kalshi ${command} failed: ${err.message}`;
  console.error(errorMsg);
  await sendTelegram(errorMsg).catch(() => {});
  process.exit(1);
}
