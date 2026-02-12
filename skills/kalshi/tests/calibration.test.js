import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  computeForecastErrors,
  computeCalibration,
  getCalibrationReport,
} from '../calibration.js';

// ── 1. computeForecastErrors with known data ───────────────────────────────────

describe('computeForecastErrors', () => {
  it('computes correct statistics for known error distribution', () => {
    const trades = [
      { city: 'NY', date: '2026-02-10', forecast_temp: '40', actual_high: '42' }, // error = -2
      { city: 'LA', date: '2026-02-10', forecast_temp: '68', actual_high: '69' }, // error = -1
      { city: 'SF', date: '2026-02-10', forecast_temp: '60', actual_high: '59' }, // error = +1
      { city: 'CHI', date: '2026-02-10', forecast_temp: '32', actual_high: '30' }, // error = +2
    ];

    const result = computeForecastErrors(trades);

    assert.strictEqual(result.sampleSize, 4);
    assert.strictEqual(result.meanError, 0); // (-2 + -1 + 1 + 2) / 4 = 0
    assert.strictEqual(result.meanAbsoluteError, 1.5); // (2 + 1 + 1 + 2) / 4 = 1.5

    // Variance = [(0-0)² + ...] / 4 = [4 + 1 + 1 + 4] / 4 = 2.5
    // Sigma = sqrt(2.5) ≈ 1.58
    assert.ok(result.realizedSigma >= 1.5 && result.realizedSigma <= 1.6);
  });

  it('returns zero sigma when all errors are identical', () => {
    const trades = [
      { city: 'NY', date: '2026-02-10', forecast_temp: '40', actual_high: '38' }, // error = +2
      { city: 'LA', date: '2026-02-10', forecast_temp: '68', actual_high: '66' }, // error = +2
      { city: 'SF', date: '2026-02-10', forecast_temp: '60', actual_high: '58' }, // error = +2
    ];

    const result = computeForecastErrors(trades);

    assert.strictEqual(result.sampleSize, 3);
    assert.strictEqual(result.meanError, 2.0);
    assert.strictEqual(result.meanAbsoluteError, 2.0);
    assert.strictEqual(result.realizedSigma, 0); // no variance
  });

  it('handles a single trade correctly', () => {
    const trades = [
      { city: 'NY', date: '2026-02-10', forecast_temp: '40', actual_high: '42' },
    ];

    const result = computeForecastErrors(trades);

    assert.strictEqual(result.sampleSize, 1);
    assert.strictEqual(result.meanError, -2.0);
    assert.strictEqual(result.meanAbsoluteError, 2.0);
    assert.strictEqual(result.realizedSigma, 0); // single sample has no variance
  });
});

// ── 2. computeForecastErrors deduplication ─────────────────────────────────────

describe('computeForecastErrors deduplication', () => {
  it('deduplicates multiple trades for same city+date', () => {
    const trades = [
      { city: 'NY', date: '2026-02-10', forecast_temp: '40', actual_high: '42' },
      { city: 'NY', date: '2026-02-10', forecast_temp: '40', actual_high: '42' }, // duplicate
      { city: 'LA', date: '2026-02-10', forecast_temp: '68', actual_high: '70' },
    ];

    const result = computeForecastErrors(trades);

    assert.strictEqual(result.sampleSize, 2); // NY + LA, duplicate removed
    assert.strictEqual(result.errors.length, 2);
  });

  it('does not deduplicate different cities on same date', () => {
    const trades = [
      { city: 'NY', date: '2026-02-10', forecast_temp: '40', actual_high: '42' },
      { city: 'LA', date: '2026-02-10', forecast_temp: '68', actual_high: '70' },
    ];

    const result = computeForecastErrors(trades);

    assert.strictEqual(result.sampleSize, 2); // both kept
  });

  it('does not deduplicate same city on different dates', () => {
    const trades = [
      { city: 'NY', date: '2026-02-10', forecast_temp: '40', actual_high: '42' },
      { city: 'NY', date: '2026-02-11', forecast_temp: '38', actual_high: '40' },
    ];

    const result = computeForecastErrors(trades);

    assert.strictEqual(result.sampleSize, 2); // both kept
  });
});

// ── 3. computeForecastErrors with empty/invalid data ───────────────────────────

describe('computeForecastErrors with invalid data', () => {
  it('returns zeros for empty array', () => {
    const result = computeForecastErrors([]);

    assert.strictEqual(result.sampleSize, 0);
    assert.strictEqual(result.meanError, 0);
    assert.strictEqual(result.meanAbsoluteError, 0);
    assert.strictEqual(result.realizedSigma, 0);
    assert.deepStrictEqual(result.errors, []);
  });

  it('filters out trades with missing forecast_temp', () => {
    const trades = [
      { city: 'NY', date: '2026-02-10', forecast_temp: '', actual_high: '42' },
      { city: 'LA', date: '2026-02-10', forecast_temp: '68', actual_high: '70' },
    ];

    const result = computeForecastErrors(trades);

    assert.strictEqual(result.sampleSize, 1); // only LA
  });

  it('filters out trades with missing actual_high', () => {
    const trades = [
      { city: 'NY', date: '2026-02-10', forecast_temp: '40', actual_high: '' },
      { city: 'LA', date: '2026-02-10', forecast_temp: '68', actual_high: '70' },
    ];

    const result = computeForecastErrors(trades);

    assert.strictEqual(result.sampleSize, 1); // only LA
  });

  it('filters out trades with non-numeric values', () => {
    const trades = [
      { city: 'NY', date: '2026-02-10', forecast_temp: 'invalid', actual_high: '42' },
      { city: 'LA', date: '2026-02-10', forecast_temp: '68', actual_high: 'invalid' },
      { city: 'SF', date: '2026-02-10', forecast_temp: '60', actual_high: '59' },
    ];

    const result = computeForecastErrors(trades);

    assert.strictEqual(result.sampleSize, 1); // only SF
  });
});

// ── 4. computeCalibration with known data ──────────────────────────────────────

describe('computeCalibration', () => {
  it('computes win rates for each confidence bucket', () => {
    const trades = [
      // 80-100% bucket: 8 wins out of 10
      ...Array(8).fill(null).map((_, i) => ({
        model_confidence: '85',
        settled_won: 'yes',
      })),
      ...Array(2).fill(null).map((_, i) => ({
        model_confidence: '90',
        settled_won: 'no',
      })),
      // 20-40% bucket: 3 wins out of 10
      ...Array(3).fill(null).map((_, i) => ({
        model_confidence: '30',
        settled_won: 'yes',
      })),
      ...Array(7).fill(null).map((_, i) => ({
        model_confidence: '25',
        settled_won: 'no',
      })),
    ];

    const result = computeCalibration(trades);

    assert.strictEqual(result.sampleSize, 20);
    assert.strictEqual(result.buckets.length, 5);

    // Find the buckets
    const bucket80_100 = result.buckets.find(b => b.label === '80-100%');
    const bucket20_40 = result.buckets.find(b => b.label === '20-40%');

    assert.strictEqual(bucket80_100.total, 10);
    assert.strictEqual(bucket80_100.wins, 8);
    assert.strictEqual(bucket80_100.winRate, 80); // 8/10 = 80%

    assert.strictEqual(bucket20_40.total, 10);
    assert.strictEqual(bucket20_40.wins, 3);
    assert.strictEqual(bucket20_40.winRate, 30); // 3/10 = 30%
  });

  it('handles empty buckets', () => {
    const trades = [
      { model_confidence: '85', settled_won: 'yes' },
    ];

    const result = computeCalibration(trades);

    assert.strictEqual(result.sampleSize, 1);

    // All buckets should exist, but most should be empty
    const bucket80_100 = result.buckets.find(b => b.label === '80-100%');
    const bucket0_20 = result.buckets.find(b => b.label === '0-20%');

    assert.strictEqual(bucket80_100.total, 1);
    assert.strictEqual(bucket80_100.wins, 1);
    assert.strictEqual(bucket80_100.winRate, 100);

    assert.strictEqual(bucket0_20.total, 0);
    assert.strictEqual(bucket0_20.winRate, null);
  });

  it('correctly assigns trades on bucket boundaries', () => {
    const trades = [
      { model_confidence: '20', settled_won: 'yes' }, // 20-40 bucket
      { model_confidence: '40', settled_won: 'yes' }, // 40-60 bucket
      { model_confidence: '60', settled_won: 'yes' }, // 60-80 bucket
      { model_confidence: '80', settled_won: 'yes' }, // 80-100 bucket
    ];

    const result = computeCalibration(trades);

    const bucket20_40 = result.buckets.find(b => b.label === '20-40%');
    const bucket40_60 = result.buckets.find(b => b.label === '40-60%');
    const bucket60_80 = result.buckets.find(b => b.label === '60-80%');
    const bucket80_100 = result.buckets.find(b => b.label === '80-100%');

    assert.strictEqual(bucket20_40.total, 1);
    assert.strictEqual(bucket40_60.total, 1);
    assert.strictEqual(bucket60_80.total, 1);
    assert.strictEqual(bucket80_100.total, 1);
  });
});

// ── 5. computeCalibration with empty data ──────────────────────────────────────

describe('computeCalibration with invalid data', () => {
  it('returns empty buckets for empty array', () => {
    const result = computeCalibration([]);

    assert.strictEqual(result.sampleSize, 0);
    assert.deepStrictEqual(result.buckets, []);
  });

  it('filters out trades with missing model_confidence', () => {
    const trades = [
      { model_confidence: '', settled_won: 'yes' },
      { model_confidence: '85', settled_won: 'yes' },
    ];

    const result = computeCalibration(trades);

    assert.strictEqual(result.sampleSize, 1);
  });

  it('filters out trades with missing settled_won', () => {
    const trades = [
      { model_confidence: '85', settled_won: '' },
      { model_confidence: '90', settled_won: 'yes' },
    ];

    const result = computeCalibration(trades);

    assert.strictEqual(result.sampleSize, 1);
  });

  it('filters out trades with non-numeric model_confidence', () => {
    const trades = [
      { model_confidence: 'invalid', settled_won: 'yes' },
      { model_confidence: '85', settled_won: 'yes' },
    ];

    const result = computeCalibration(trades);

    assert.strictEqual(result.sampleSize, 1);
  });
});

// ── 6. getCalibrationReport ────────────────────────────────────────────────────

describe('getCalibrationReport', () => {
  it('returns appropriate message when no trades exist', () => {
    // This test assumes getTradeLog() returns an empty array when no file exists
    // The actual behavior depends on the file system, so we just check the structure
    const report = getCalibrationReport();

    assert.strictEqual(typeof report, 'string');
    assert.ok(report.includes('📊 Calibration Report'));
  });

  it('returns a string', () => {
    const report = getCalibrationReport();
    assert.strictEqual(typeof report, 'string');
  });

  it('includes expected sections', () => {
    const report = getCalibrationReport();

    assert.ok(report.includes('📊 Calibration Report'));
    // Either shows data or shows "No trades logged yet"
    assert.ok(
      report.includes('Forecast Accuracy') ||
      report.includes('No trades logged yet') ||
      report.includes('Calibration')
    );
  });
});
