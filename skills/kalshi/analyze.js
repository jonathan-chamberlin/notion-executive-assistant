import { CONFIG, loadTradingConfig } from './config.js';
import { logAction } from './client.js';
import { getAllForecasts, temperatureBucketConfidence } from './forecast.js';
import { getAllEnsembleForecasts, ensembleBucketConfidence } from './ensemble.js';
import { scanWeatherMarkets } from './markets.js';
import { calculatePositionSize } from './sizing.js';
import { getBalance } from './trade.js';

/**
 * Score a single market against a forecast temperature.
 * Uses ensemble members for probability when available, falls back to normal distribution.
 * Returns an opportunity object if the market is mispriced, or null otherwise.
 */
function scoreMarket(market, forecastTemp, event, edge, tradingConfig, bankroll, ensembleMembers) {
  if (!market.bucket) return null;

  let confidence;
  let confidenceSource;

  if (ensembleMembers && ensembleMembers.length >= 10) {
    // Use ensemble empirical probability (no assumed sigma)
    confidence = ensembleBucketConfidence(ensembleMembers, market.bucket.low, market.bucket.high);
    confidenceSource = 'ensemble';
  } else {
    // Fallback: normal distribution with configurable sigma
    confidence = temperatureBucketConfidence(
      forecastTemp,
      market.bucket.low,
      market.bucket.high,
      tradingConfig.sigma ?? 3.0
    );
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

  // Fetch current balance for Kelly sizing
  let bankroll = 2000; // conservative fallback
  try {
    const balResult = await getBalance();
    if (balResult.success) bankroll = balResult.balance.available;
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

  const opportunities = marketsResult.events.flatMap(event => {
    const forecast = forecastByCity[event.city];
    if (!forecast) return [];
    const forecastData = event.label === 'tomorrow' ? forecast.tomorrow : forecast.today;
    if (!forecastData) return [];

    // Get ensemble members for this city/day (if available)
    const ensemble = ensembleByCity[event.city];
    const ensembleData = ensemble
      ? (event.label === 'tomorrow' ? ensemble.tomorrow : ensemble.today)
      : null;
    const ensembleMembers = ensembleData?.members || null;

    return event.markets
      .map(market => scoreMarket(market, forecastData.highTemp, event, edge, tradingConfig, bankroll, ensembleMembers))
      .filter(Boolean);
  }).sort((a, b) => b.edge - a.edge);

  const ensembleCities = Object.keys(ensembleByCity).length;

  logAction('opportunities_found', {
    count: opportunities.length,
    eventsScanned: marketsResult.events.length,
    citiesForecasted: forecastResult.forecasts.length,
    ensembleCities,
    minEdge: edge,
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
