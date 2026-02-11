import fs from 'fs';
import path from 'path';
import { CONFIG } from './config.js';

// --- Daily Spend Persistence ---

const SPEND_FILE = path.join(process.env.HOME || process.env.USERPROFILE || '.', '.kalshi-spend.json');

function loadSpend() {
  const today = new Date().toISOString().split('T')[0];
  try {
    const raw = fs.readFileSync(SPEND_FILE, 'utf-8');
    const data = JSON.parse(raw);
    if (data.date === today) {
      return { dailySpend: data.dailySpend, date: data.date };
    }
    return { dailySpend: 0, date: today };
  } catch {
    return { dailySpend: 0, date: today };
  }
}

function saveSpend(dailySpend, date) {
  try {
    fs.writeFileSync(SPEND_FILE, JSON.stringify({ dailySpend, date }), 'utf-8');
  } catch {
    // Silently swallow write errors
  }
}

// --- Daily Spend Tracking ---

export function trackSpend(amount) {
  const state = loadSpend();
  state.dailySpend += amount;
  saveSpend(state.dailySpend, state.date);
}

export function getRemainingDailyBudget() {
  const state = loadSpend();
  return CONFIG.maxDailySpend - state.dailySpend;
}

export function canAffordTrade(amount) {
  if (amount > CONFIG.maxTradeSize) return false;
  if (amount > getRemainingDailyBudget()) return false;
  return true;
}
