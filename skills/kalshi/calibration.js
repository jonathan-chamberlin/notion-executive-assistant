import { getTradeLog } from './settlement.js';
import { logAction } from './client.js';

/**
 * Compute forecast error statistics from trades that have both forecast_temp and actual_high.
 * This is the key validation: if realizedSigma ≈ 3, the model is well-calibrated.
 */
export function computeForecastErrors(trades) {
  // Filter to trades with both forecast_temp and actual_high populated
  const valid = trades.filter(t =>
    t.forecast_temp !== '' && t.actual_high !== '' &&
    !isNaN(Number(t.forecast_temp)) && !isNaN(Number(t.actual_high))
  );

  if (valid.length === 0) {
    return { errors: [], meanError: 0, meanAbsoluteError: 0, realizedSigma: 0, sampleSize: 0 };
  }

  const errors = valid.map(t => {
    const forecastTemp = Number(t.forecast_temp);
    const actualHigh = Number(t.actual_high);
    return {
      city: t.city,
      date: t.date,
      forecastTemp,
      actualHigh,
      error: forecastTemp - actualHigh, // positive = forecast too high
    };
  });

  // Deduplicate by city+date (multiple trades for same city/date should count once)
  const seen = new Set();
  const unique = errors.filter(e => {
    const key = `${e.city}-${e.date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const n = unique.length;
  const sumError = unique.reduce((s, e) => s + e.error, 0);
  const meanError = sumError / n;
  const meanAbsoluteError = unique.reduce((s, e) => s + Math.abs(e.error), 0) / n;

  // Standard deviation of errors = realizedSigma
  const variance = unique.reduce((s, e) => s + (e.error - meanError) ** 2, 0) / n;
  const realizedSigma = Math.sqrt(variance);

  return {
    errors: unique,
    meanError: Math.round(meanError * 10) / 10,      // round to 1 decimal
    meanAbsoluteError: Math.round(meanAbsoluteError * 10) / 10,
    realizedSigma: Math.round(realizedSigma * 10) / 10,
    sampleSize: n,
  };
}

/**
 * Compute calibration table: for each confidence bucket, what fraction actually won?
 * A well-calibrated model should show ~diagonal results.
 */
export function computeCalibration(trades) {
  // Filter to settled trades with model_confidence
  const valid = trades.filter(t =>
    t.model_confidence !== '' && t.settled_won !== '' &&
    !isNaN(Number(t.model_confidence))
  );

  if (valid.length === 0) {
    return { buckets: [], sampleSize: 0 };
  }

  // Define confidence buckets
  const bucketDefs = [
    { label: '0-20%', min: 0, max: 20 },
    { label: '20-40%', min: 20, max: 40 },
    { label: '40-60%', min: 40, max: 60 },
    { label: '60-80%', min: 60, max: 80 },
    { label: '80-100%', min: 80, max: 100 },
  ];

  const buckets = bucketDefs.map(def => {
    const inBucket = valid.filter(t => {
      const conf = Number(t.model_confidence);
      return conf >= def.min && conf < def.max;
    });

    const wins = inBucket.filter(t => t.settled_won === 'yes').length;
    const total = inBucket.length;

    return {
      label: def.label,
      total,
      wins,
      winRate: total > 0 ? Math.round((wins / total) * 100) : null,
    };
  });

  return { buckets, sampleSize: valid.length };
}

/**
 * Generate a full calibration report from the trade log.
 * Returns a formatted string suitable for Telegram.
 */
export function getCalibrationReport() {
  const trades = getTradeLog();

  if (trades.length === 0) {
    return '📊 Calibration Report\n\nNo trades logged yet. Start trading to collect calibration data.';
  }

  const forecastStats = computeForecastErrors(trades);
  const calibration = computeCalibration(trades);

  const lines = ['📊 Calibration Report', ''];

  // Forecast accuracy section
  if (forecastStats.sampleSize > 0) {
    lines.push('Forecast Accuracy:');
    lines.push(`  Sample size: ${forecastStats.sampleSize} city-days`);
    lines.push(`  Mean error: ${forecastStats.meanError > 0 ? '+' : ''}${forecastStats.meanError}°F (+ = forecast too high)`);
    lines.push(`  Mean absolute error: ${forecastStats.meanAbsoluteError}°F`);
    lines.push(`  Realized sigma: ${forecastStats.realizedSigma}°F (model assumes 3.0°F)`);

    // Assessment
    if (forecastStats.realizedSigma <= 4.0) {
      lines.push(`  Status: GOOD — model is reasonably calibrated`);
    } else if (forecastStats.realizedSigma <= 5.0) {
      lines.push(`  Status: CAUTION — consider increasing sigma to ${forecastStats.realizedSigma}`);
    } else {
      lines.push(`  Status: WARNING — model is overconfident, sigma should be ${forecastStats.realizedSigma}`);
    }
  } else {
    lines.push('Forecast Accuracy: No actual temperature data yet.');
    lines.push('  (Waiting for checkSettlements to populate actual_high)');
  }

  lines.push('');

  // Calibration table
  if (calibration.sampleSize > 0) {
    lines.push('Calibration (confidence → actual win rate):');
    for (const b of calibration.buckets) {
      if (b.total > 0) {
        const expected = b.label.replace('%', '').split('-').reduce((a, b) => (Number(a) + Number(b)) / 2);
        lines.push(`  ${b.label}: ${b.winRate}% actual (${b.wins}/${b.total})`);
      }
    }
  } else {
    lines.push('Calibration: No settled trades yet.');
  }

  lines.push('');
  lines.push(`Total trades: ${trades.length}`);

  logAction('calibration_report', {
    sampleSize: forecastStats.sampleSize,
    realizedSigma: forecastStats.realizedSigma,
  });

  return lines.join('\n');
}
