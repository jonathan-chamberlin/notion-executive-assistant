import { CONFIG } from './config.js';
import { logAction } from './client.js';
import { getAllForecasts, temperatureBucketConfidence } from './forecast.js';
import { scanWeatherMarkets } from './markets.js';

/**
 * Score a single market against a forecast temperature.
 * Returns an opportunity object if the market is mispriced, or null otherwise.
 */
function scoreMarket(market, forecastTemp, event, edge) {
  if (!market.bucket) return null;

  const confidence = temperatureBucketConfidence(
    forecastTemp,
    market.bucket.low,
    market.bucket.high
  );

  const confidencePct = Math.round(confidence * 100); // 0-1 → 0-100
  const yesEdge = confidencePct - market.yesPrice; // both in same scale (cents = percentage points)
  if (yesEdge < edge) return null; // edge is 20 (percentage points)

  return {
    eventTitle: event.title,
    market: market.question,
    ticker: market.ticker,
    city: event.city,
    bucket: market.bucket,
    forecastTemp,
    forecastConfidence: confidencePct,
    marketPrice: market.yesPrice, // already cents
    edge: yesEdge,
    side: 'yes',
    suggestedAmount: CONFIG.maxTradeSize, // already cents (500)
    suggestedYesPrice: market.yesPrice + 1, // already cents, add 1 cent
  };
}

/**
 * Find mispriced weather contracts by comparing forecasts to Kalshi odds.
 * Returns opportunities where forecast confidence significantly exceeds market price.
 */
export async function findOpportunities({ minEdge } = {}) {
  const edge = minEdge ?? CONFIG.minEdge;

  const forecastResult = await getAllForecasts();
  if (!forecastResult.success) return forecastResult;

  const forecastByCity = Object.fromEntries(
    forecastResult.forecasts.map(f => [f.city, f])
  );

  const marketsResult = await scanWeatherMarkets();
  if (!marketsResult.success) return marketsResult;

  const opportunities = marketsResult.events.flatMap(event => {
    const forecast = forecastByCity[event.city];
    if (!forecast) return [];
    const forecastData = event.label === 'tomorrow' ? forecast.tomorrow : forecast.today;
    if (!forecastData) return [];
    return event.markets
      .map(market => scoreMarket(market, forecastData.highTemp, event, edge))
      .filter(Boolean);
  }).sort((a, b) => b.edge - a.edge);

  logAction('opportunities_found', {
    count: opportunities.length,
    eventsScanned: marketsResult.events.length,
    citiesForecasted: forecastResult.forecasts.length,
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
