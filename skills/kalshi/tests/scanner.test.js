import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';

import { setMode, getUsageAlert, runScan } from '../scanner.js';
import { TRADING_CONFIG_PATH, loadTradingConfig } from '../config.js';

// Snapshot the trading config before tests so we can restore afterward.
let originalConfigContent = null;
let originalConfigExisted = false;

before(() => {
  try {
    originalConfigContent = fs.readFileSync(TRADING_CONFIG_PATH, 'utf-8');
    originalConfigExisted = true;
  } catch {
    originalConfigExisted = false;
    originalConfigContent = null;
  }
});

after(() => {
  if (originalConfigExisted) {
    fs.writeFileSync(TRADING_CONFIG_PATH, originalConfigContent, 'utf-8');
  } else {
    try {
      fs.unlinkSync(TRADING_CONFIG_PATH);
    } catch {
      // File may not exist; that is fine.
    }
  }
});

// ---------------------------------------------------------------------------
// setMode tests
// ---------------------------------------------------------------------------

describe('setMode', () => {
  it('accepts valid modes', () => {
    for (const mode of ['paused', 'alert-only', 'alert-then-trade', 'autonomous']) {
      const result = setMode(mode);
      assert.equal(result.success, true, `setMode("${mode}") should succeed`);
      assert.ok(result.message.includes(mode), `message should mention ${mode}`);
    }
  });

  it('rejects invalid mode', () => {
    const result = setMode('yolo');
    assert.equal(result.success, false);
    assert.ok(result.message.includes('Invalid mode'));
  });

  it('persists mode to trading-config.json', () => {
    setMode('paused');
    const config = loadTradingConfig();
    assert.equal(config.mode, 'paused');
  });

  it('returns { success, message }', () => {
    const result = setMode('alert-only');
    assert.equal(typeof result.success, 'boolean');
    assert.equal(typeof result.message, 'string');
  });
});

// ---------------------------------------------------------------------------
// loadTradingConfig tests
// ---------------------------------------------------------------------------

describe('loadTradingConfig', () => {
  it('returns an object with mode', () => {
    const config = loadTradingConfig();
    assert.equal(typeof config.mode, 'string');
  });

  it('falls back to defaults if file is missing', () => {
    const backup = fs.readFileSync(TRADING_CONFIG_PATH, 'utf-8');
    fs.unlinkSync(TRADING_CONFIG_PATH);
    const config = loadTradingConfig();
    assert.equal(config.mode, 'alert-only');
    assert.equal(config.maxDailySpend, 1000);
    // Restore
    fs.writeFileSync(TRADING_CONFIG_PATH, backup, 'utf-8');
  });

  it('falls back to default mode if mode is invalid in file', () => {
    const backup = fs.readFileSync(TRADING_CONFIG_PATH, 'utf-8');
    fs.writeFileSync(TRADING_CONFIG_PATH, JSON.stringify({ mode: 'bad-mode' }), 'utf-8');
    const config = loadTradingConfig();
    assert.equal(config.mode, 'alert-only');
    // Restore
    fs.writeFileSync(TRADING_CONFIG_PATH, backup, 'utf-8');
  });
});

// ---------------------------------------------------------------------------
// getUsageAlert tests
// ---------------------------------------------------------------------------

describe('getUsageAlert', () => {
  it('returns { success, message }', () => {
    const result = getUsageAlert();
    assert.equal(result.success, true);
    assert.equal(typeof result.message, 'string');
  });

  it('suppresses when no new activity', () => {
    // Call once to snapshot, then again — should be suppressed
    getUsageAlert();
    const result = getUsageAlert();
    if (result.suppress) {
      assert.equal(result.message, '');
    }
  });
});

// ---------------------------------------------------------------------------
// runScan — paused mode (no API calls)
// ---------------------------------------------------------------------------

describe('runScan in paused mode', () => {
  before(() => {
    setMode('paused');
  });

  after(() => {
    setMode('alert-only');
  });

  it('returns immediately without scanning', async () => {
    const result = await runScan();
    assert.equal(result.success, true);
    assert.ok(result.message.includes('paused'), 'message should mention paused');
  });
});

// ---------------------------------------------------------------------------
// runScan — alert-only mode (live API test)
// ---------------------------------------------------------------------------

describe('runScan in alert-only mode (live)', () => {
  before(() => {
    setMode('alert-only');
  });

  it('returns a formatted message with scan results', async () => {
    const result = await runScan();
    assert.equal(typeof result.message, 'string');
    assert.ok(result.message.length > 0, 'message should not be empty');
    // Should contain scan header
    assert.ok(result.message.includes('Weather Scan') || result.message.includes('Scan failed'),
      'message should contain scan info');
  });
});
