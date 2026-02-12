import { CONFIG, loadTradingConfig, CITY_TIMEZONES } from './config.js';
import { logAction } from './client.js';
import { getAllForecasts, temperatureBucketConfidence } from './forecast.js';
import { getAllEnsembleForecasts, ensembleBucketConfidence } from './ensemble.js';
import { scanWeatherMarkets } from './markets.js';
import { calculatePositionSize } from './sizing.js';
import { getBalance, getPositions } from './trade.js';

/**
 * Check if it's past 2 PM local time in a city's timezone.
 * After 2 PM, today's high has likely already been recorded — forecasts are stale.
 */
function isPastCutoff(city, cutoffHour = 14) {
  const tz = CITY_TIMEZONES[city];
  if (!tz) return false;
  const localHour = new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: tz });
  return parseInt(localHour, 10) >= cutoffHour;
}

/**
 * Score a single market against a forecast temperature.
 * Uses ensemble members for probability when available, falls back to normal distribution.
 * Returns an opportunity object if the market is mispriced, or null otherwise.
 */
function scoreMarket(market, forecastTemp, event, edge, tradingConfig, bankroll, ensembleMembers, isToday) {
  if (!market.bucket) return null;

  let confidence;
  let confidenceSource;

  if (ensembleMembers && ensembleMembers.length >= 10) {
    // Use ensemble empirical probability (no assumed sigma)
    confidence = ensembleBucketConfidence(ensembleMembers, market.bucket.low, market.bucket.high);
    confidenceSource = 'ensemble';
  } else {
    // Fallback: normal distribution — use tighter sigma for today (forecast is fresher)
    const sigma = isToday
      ? (tradingConfig.sigmaToday ?? 2.0)
      : (tradingConfig.sigmaTomorrow ?? 3.5);
    confidence = temperatureBucketConfidence(
      forecastTemp,
      market.bucket.low,
      market.bucket.high,
      sigma
    );
    // Cap normal-model confidence at 90% — the normal distribution underestimates
    // tail risk (fat tails), producing false 99% confidence on ≤X/≥X buckets.
    // Only ensemble data can justify >90% confidence.
    if (confidence > 0.90) confidence = 0.90;
    confidenceSource = 'normal';
  }

  const confidencePct = Math.round(confidence * 100); // 0-1 → 0-100
  const yesEdge = confidencePct - market.yesPrice; // both in same scale (cents = percentage points)
  if (yesEdge < edge) return null; // edge is 20 (percentage points)

  const sizing = calculatePositionSize({
    bankroll,
    edge: yesEdge,
    yesPrice: market.yesPrice,
    kellyMultiplier: tradingConfig.kellyMultiplier ?? 0.25,
    maxTradeSize: CONFIG.maxTradeSize,
    minTradeSize: tradingConfig.minTradeSize ?? 5,
  });

  // Skip if Kelly says don't trade
  if (sizing.amount === 0) return null;

  return {
    eventTitle: event.title,
    market: market.question,
    ticker: market.ticker,
    city: event.city,
    bucket: market.bucket,
    forecastTemp,
    forecastConfidence: confidencePct,
    confidenceSource,
    ensembleSpread: ensembleMembers ? Math.max(...ensembleMembers) - Math.min(...ensembleMembers) : null,
    marketPrice: market.yesPrice, // already cents
    edge: yesEdge,
    side: 'yes',
    suggestedAmount: sizing.amount,
    suggestedYesPrice: market.yesPrice + 1, // already cents, add 1 cent
    sizingReason: sizing.reason,
    contracts: sizing.contracts,
  };
}

/**
 * Find mispriced weather contracts by comparing forecasts to Kalshi odds.
 * Returns opportunities where forecast confidence significantly exceeds market price.
 */
export async function findOpportunities({ minEdge } = {}) {
  const tradingConfig = loadTradingConfig();
  const edge = minEdge ?? CONFIG.minEdge;

  // Fetch current balance for Kelly sizing, subtract open position cost basis
  let bankroll = 2000; // conservative fallback
  try {
    const balResult = await getBalance();
    if (balResult.success) {
      bankroll = balResult.balance.available;
      // Subtract cost of open positions — money tied up isn't available for new bets
      try {
        const posResult = await getPositions();
        if (posResult.success && posResult.positions.length > 0) {
          const positionCost = posResult.positions.reduce((sum, p) => {
            return sum + Math.abs(p.avgYesPrice || 0) * Math.abs(p.yesCount || 0);
          }, 0);
          bankroll = Math.max(0, bankroll - positionCost);
          logAction('bankroll_adjusted', { raw: balResult.balance.available, positionCost, adjusted: bankroll });
        }
      } catch {
        // Non-fatal: use unadjusted balance
      }
    }
  } catch {
    // Use fallback
  }

  // Fetch NOAA forecasts, ensemble forecasts, and market data in parallel
  const [forecastResult, ensembleResult, marketsResult] = await Promise.all([
    getAllForecasts(),
    getAllEnsembleForecasts().catch(err => {
      logAction('ensemble_fallback', { error: err.message }, 'warn');
      return { success: true, forecasts: [] };
    }),
    scanWeatherMarkets(),
  ]);

  if (!forecastResult.success) return forecastResult;
  if (!marketsResult.success) return marketsResult;

  const forecastByCity = Object.fromEntries(
    forecastResult.forecasts.map(f => [f.city, f])
  );

  const ensembleByCity = Object.fromEntries(
    (ensembleResult.forecasts || []).map(f => [f.city, f])
  );

  let skippedTodayCutoff = 0;
  const opportunities = marketsResult.events.flatMap(event => {
    const forecast = forecastByCity[event.city];
    if (!forecast) return [];

    // Skip today's markets after 2 PM local — the high is likely already in,
    // so the forecast is stale and the market price reflects near-certainty.
    if (event.label === 'today' && isPastCutoff(event.city)) {
      skippedTodayCutoff++;
      return [];
    }

    const forecastData = event.label === 'tomorrow' ? forecast.tomorrow : forecast.today;
    if (!forecastData) return [];

    // Get ensemble members for this city/day (if available)
    const ensemble = ensembleByCity[event.city];
    const ensembleData = ensemble
      ? (event.label === 'tomorrow' ? ensemble.tomorrow : ensemble.today)
      : null;
    const ensembleMembers = ensembleData?.members || null;

    const isToday = event.label !== 'tomorrow';

    return event.markets
      .map(market => scoreMarket(market, forecastData.highTemp, event, edge, tradingConfig, bankroll, ensembleMembers, isToday))
      .filter(Boolean);
  }).sort((a, b) => b.edge - a.edge);

  const ensembleCities = Object.keys(ensembleByCity).length;

  if (skippedTodayCutoff > 0) {
    logAction('today_cutoff_skipped', { count: skippedTodayCutoff });
  }

  logAction('opportunities_found', {
    count: opportunities.length,
    eventsScanned: marketsResult.events.length,
    citiesForecasted: forecastResult.forecasts.length,
    ensembleCities,
    minEdge: edge,
    skippedTodayCutoff,
  });

  return {
    success: true,
    opportunities,
    summary: {
      eventsScanned: marketsResult.events.length,
      citiesForecasted: forecastResult.forecasts.length,
      opportunitiesFound: opportunities.length,
      forecastErrors: forecastResult.errors,
    },
  };
}
