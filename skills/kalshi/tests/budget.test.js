import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

import { trackSpend, getRemainingDailyBudget, canAffordTrade } from '../budget.js';
import { CONFIG } from '../config.js';

const SPEND_FILE = path.join(
  process.env.HOME || process.env.USERPROFILE || '.',
  '.kalshi-spend.json'
);

// Snapshot the spend file before any tests so we can restore it afterward.
let originalSpendContent = null;
let originalFileExisted = false;

before(() => {
  try {
    originalSpendContent = fs.readFileSync(SPEND_FILE, 'utf-8');
    originalFileExisted = true;
  } catch {
    originalFileExisted = false;
    originalSpendContent = null;
  }
});

after(() => {
  // Restore the original spend file (or remove it if it did not exist).
  if (originalFileExisted) {
    fs.writeFileSync(SPEND_FILE, originalSpendContent, 'utf-8');
  } else {
    try {
      fs.unlinkSync(SPEND_FILE);
    } catch {
      // File may not exist; that is fine.
    }
  }
});

// ---------------------------------------------------------------------------
// Helper: reset the spend file so each describe block starts from zero spend.
// ---------------------------------------------------------------------------
function resetSpendFile() {
  try {
    fs.unlinkSync(SPEND_FILE);
  } catch {
    // Ignore if it does not exist.
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getRemainingDailyBudget', () => {
  before(() => resetSpendFile());

  it('returns maxDailySpend (5000¢) when no spend has occurred today', () => {
    const remaining = getRemainingDailyBudget();
    assert.equal(remaining, CONFIG.maxDailySpend);
  });
});

describe('trackSpend + getRemainingDailyBudget', () => {
  before(() => resetSpendFile());

  it('after tracking 500¢, remaining drops by 500¢', () => {
    const before = getRemainingDailyBudget();
    trackSpend(500);
    const afterSpend = getRemainingDailyBudget();
    assert.equal(afterSpend, before - 500);
  });
});

describe('canAffordTrade', () => {
  before(() => resetSpendFile());

  it('returns true for an amount within both maxTradeSize and remaining budget', () => {
    assert.equal(canAffordTrade(300), true);
  });

  it('returns false for an amount exceeding maxTradeSize', () => {
    assert.equal(canAffordTrade(CONFIG.maxTradeSize + 1), false);
  });

  it('returns false for an amount exceeding remaining budget', () => {
    // Spend almost the entire budget so the remaining is very small.
    resetSpendFile();
    trackSpend(CONFIG.maxDailySpend - 100);
    // Now remaining is 100¢, requesting 300¢ should exceed it.
    assert.equal(canAffordTrade(300), false);
  });
});

describe('Persistence', () => {
  before(() => resetSpendFile());

  it('after trackSpend the spend file contains { dailySpend, date } with today\'s date', () => {
    trackSpend(700);
    const raw = fs.readFileSync(SPEND_FILE, 'utf-8');
    const data = JSON.parse(raw);
    const today = new Date().toISOString().split('T')[0];

    assert.equal(typeof data.dailySpend, 'number');
    assert.equal(data.dailySpend, 700);
    assert.equal(data.date, today);
  });
});

describe('Multiple spends accumulate', () => {
  before(() => resetSpendFile());

  it('tracking 200¢ then 300¢ reduces remaining by 500¢ total', () => {
    const startRemaining = getRemainingDailyBudget();
    trackSpend(200);
    trackSpend(300);
    const endRemaining = getRemainingDailyBudget();
    assert.equal(endRemaining, startRemaining - 500);
  });
});

describe('canAffordTrade edge cases', () => {
  before(() => resetSpendFile());

  it('amount exactly equal to maxTradeSize (500¢) returns true when budget allows', () => {
    assert.equal(canAffordTrade(CONFIG.maxTradeSize), true);
  });

  it('amount of 0 returns true (canAffordTrade does not reject zero)', () => {
    // canAffordTrade only checks amount > maxTradeSize and amount > remaining.
    // 0 > 500 is false, and 0 > remaining is false, so it returns true.
    assert.equal(canAffordTrade(0), true);
  });

  it('negative amount returns true (canAffordTrade does not reject negatives)', () => {
    // -1 > maxTradeSize is false, -1 > remaining is false, so it returns true.
    assert.equal(canAffordTrade(-1), true);
  });
});
