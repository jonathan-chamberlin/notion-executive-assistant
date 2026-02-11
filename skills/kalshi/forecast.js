import { CONFIG, CITY_FORECAST_CONFIG } from './config.js';
import { noaaFetch, logAction } from './client.js';

/**
 * Fetch forecast for a specific city using NOAA NWS API.
 * All Kalshi weather cities are US-based, so NOAA covers everything.
 * Returns high temperature forecast for today and tomorrow in °F.
 */
export async function getForecast(city) {
  const config = CITY_FORECAST_CONFIG[city];
  if (!config) {
    return { success: false, error: `Unknown city: ${city}. Available: ${Object.keys(CITY_FORECAST_CONFIG).join(', ')}` };
  }

  try {
    const data = await noaaFetch(`/gridpoints/${config.gridpoint}/forecast`);
    const periods = data.properties.periods;

    if (!periods || periods.length === 0) {
      return { success: false, error: `No forecast data available for ${city}` };
    }

    // NOAA periods: [Today, Tonight, Tomorrow, Tomorrow Night, ...]
    // Daytime periods have isDaytime: true
    const todayDay = periods.find(p => p.isDaytime);
    const tomorrowDay = periods.find((p, i) => p.isDaytime && i > 1);

    const forecast = {
      city,
      source: 'noaa',
      generatedAt: data.properties.generatedAt,
      today: todayDay ? {
        highTemp: todayDay.temperature,
        unit: 'F',
        precipChance: todayDay.probabilityOfPrecipitation?.value ?? 0,
        shortForecast: todayDay.shortForecast,
      } : null,
      tomorrow: tomorrowDay ? {
        highTemp: tomorrowDay.temperature,
        unit: 'F',
        precipChance: tomorrowDay.probabilityOfPrecipitation?.value ?? 0,
        shortForecast: tomorrowDay.shortForecast,
      } : null,
    };

    logAction('forecast_fetched', { city, todayHigh: forecast.today?.highTemp, tomorrowHigh: forecast.tomorrow?.highTemp });
    return { success: true, forecast };

  } catch (error) {
    logAction('forecast_error', { city, error: error.message });
    return { success: false, error: `Failed to fetch forecast for ${city}: ${error.message}` };
  }
}

/**
 * Fetch forecasts for all configured cities.
 */
export async function getAllForecasts() {
  const cities = CONFIG.cities;
  const results = await Promise.allSettled(
    cities.map(city => getForecast(city))
  );

  const forecasts = [];
  const errors = [];

  results.forEach((result, i) => {
    if (result.status === 'fulfilled' && result.value.success) {
      forecasts.push(result.value.forecast);
    } else {
      const errorMsg = result.status === 'rejected' ? result.reason.message : result.value.error;
      errors.push({ city: cities[i], error: errorMsg });
    }
  });

  logAction('all_forecasts', { fetched: forecasts.length, errors: errors.length });

  return {
    success: true,
    forecasts,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Calculate probability that temperature falls in a specific bucket [low, high].
 * Uses normal distribution with NOAA-typical forecast error of ±3°F.
 */
export function temperatureBucketConfidence(forecastTemp, bucketLow, bucketHigh, sigma = 3.0) {
  if (bucketLow === null || bucketLow === -Infinity) {
    // "≤X" market: probability temp is at or below bucketHigh
    return normalCDF((bucketHigh - forecastTemp) / sigma);
  }

  if (bucketHigh === null || bucketHigh === Infinity) {
    // "≥X" market: probability temp is at or above bucketLow
    return 1 - normalCDF((bucketLow - forecastTemp) / sigma);
  }

  // "X-Y" bucket: probability temp falls in range
  const zLow = (bucketLow - forecastTemp) / sigma;
  const zHigh = (bucketHigh - forecastTemp) / sigma;
  return normalCDF(zHigh) - normalCDF(zLow);
}

// Normal CDF approximation (Abramowitz & Stegun, accurate to ~1.5e-7)
function normalCDF(x) {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.SQRT2;
  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

  return 0.5 * (1.0 + sign * y);
}
