import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

import { getSessionCosts, getUsageReport, markUsageAlerted, getUsageStats, USAGE_FILE, SESSIONS_DIR } from '../usage.js';

// Snapshot the usage file before tests so we can restore afterward.
let originalUsageContent = null;
let originalFileExisted = false;

before(() => {
  try {
    originalUsageContent = fs.readFileSync(USAGE_FILE, 'utf-8');
    originalFileExisted = true;
  } catch {
    originalFileExisted = false;
    originalUsageContent = null;
  }
});

after(() => {
  if (originalFileExisted) {
    fs.writeFileSync(USAGE_FILE, originalUsageContent, 'utf-8');
  } else {
    try {
      fs.unlinkSync(USAGE_FILE);
    } catch {
      // File may not exist; that is fine.
    }
  }
});

function resetUsageFile() {
  try {
    fs.unlinkSync(USAGE_FILE);
  } catch {
    // Ignore if it does not exist.
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getSessionCosts', () => {
  it('returns an object with today, totalCost, tokensIn, tokensOut, invocations', () => {
    const result = getSessionCosts();
    assert.equal(typeof result.today, 'string');
    assert.equal(typeof result.totalCost, 'number');
    assert.equal(typeof result.tokensIn, 'number');
    assert.equal(typeof result.tokensOut, 'number');
    assert.equal(typeof result.invocations, 'number');
  });

  it('today matches YYYY-MM-DD format', () => {
    const result = getSessionCosts();
    assert.match(result.today, /^\d{4}-\d{2}-\d{2}$/);
  });

  it('totalCost is non-negative', () => {
    const result = getSessionCosts();
    assert.ok(result.totalCost >= 0, `totalCost should be >= 0, got ${result.totalCost}`);
  });
});

describe('getUsageStats', () => {
  it('returns same shape as getSessionCosts', () => {
    const stats = getUsageStats();
    assert.equal(typeof stats.today, 'string');
    assert.equal(typeof stats.totalCost, 'number');
    assert.equal(typeof stats.tokensIn, 'number');
    assert.equal(typeof stats.tokensOut, 'number');
    assert.equal(typeof stats.invocations, 'number');
  });
});

describe('getUsageReport', () => {
  before(() => resetUsageFile());

  it('returns { hasNewActivity, message }', () => {
    const report = getUsageReport();
    assert.equal(typeof report.hasNewActivity, 'boolean');
    assert.equal(typeof report.message, 'string');
  });

  it('message is empty when hasNewActivity is false', () => {
    // Mark current state as alerted, then immediately report — nothing new
    markUsageAlerted();
    const report = getUsageReport();
    if (!report.hasNewActivity) {
      assert.equal(report.message, '');
    }
  });
});

describe('markUsageAlerted', () => {
  before(() => resetUsageFile());

  it('writes the usage file', () => {
    markUsageAlerted();
    assert.ok(fs.existsSync(USAGE_FILE), 'Usage file should exist after markUsageAlerted');
  });

  it('usage file contains valid JSON with today field', () => {
    markUsageAlerted();
    const raw = fs.readFileSync(USAGE_FILE, 'utf-8');
    const data = JSON.parse(raw);
    const today = new Date().toISOString().split('T')[0];
    assert.equal(data.today, today);
  });
});

describe('hasNewActivity logic', () => {
  before(() => resetUsageFile());

  it('after markUsageAlerted, report shows no new activity', () => {
    markUsageAlerted();
    const report = getUsageReport();
    // Should be false since we just snapshotted
    assert.equal(report.hasNewActivity, false);
  });
});

describe('watermark persistence', () => {
  before(() => resetUsageFile());

  it('watermark survives read/write cycle', () => {
    markUsageAlerted();
    const raw = JSON.parse(fs.readFileSync(USAGE_FILE, 'utf-8'));
    assert.equal(typeof raw.totalCost, 'number');
    assert.equal(typeof raw.invocations, 'number');
  });
});
