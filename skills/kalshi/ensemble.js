import { CONFIG, CITY_COORDS } from './config.js';
import { logAction } from './client.js';

const ENSEMBLE_API_URL = 'https://ensemble-api.open-meteo.com/v1/ensemble';

/**
 * Fetch GFS ensemble forecast for a single city from Open-Meteo.
 * Returns 31 ensemble member high-temp forecasts for today and tomorrow.
 */
export async function getEnsembleForecast(city) {
  const coords = CITY_COORDS[city];
  if (!coords) {
    return { success: false, error: `Unknown city: ${city}. Available: ${Object.keys(CITY_COORDS).join(', ')}` };
  }

  try {
    const url = `${ENSEMBLE_API_URL}?latitude=${coords.lat}&longitude=${coords.lon}&daily=temperature_2m_max&models=gfs_seamless&forecast_days=2&temperature_unit=fahrenheit`;
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Open-Meteo API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const daily = data.daily;

    if (!daily || !daily.time || daily.time.length === 0) {
      return { success: false, error: `No ensemble data for ${city}` };
    }

    // Collect all member values for each day
    // Open-Meteo returns: temperature_2m_max (mean) + temperature_2m_max_member01..member30
    const todayMembers = [];
    const tomorrowMembers = [];

    // The mean value
    if (daily.temperature_2m_max) {
      if (daily.temperature_2m_max[0] != null) todayMembers.push(daily.temperature_2m_max[0]);
      if (daily.temperature_2m_max[1] != null) tomorrowMembers.push(daily.temperature_2m_max[1]);
    }

    // Member values (member01 through member30)
    for (let i = 1; i <= 30; i++) {
      const key = `temperature_2m_max_member${String(i).padStart(2, '0')}`;
      if (daily[key]) {
        if (daily[key][0] != null) todayMembers.push(daily[key][0]);
        if (daily[key][1] != null) tomorrowMembers.push(daily[key][1]);
      }
    }

    const result = {
      city,
      source: 'gfs_ensemble',
      dates: daily.time,
      today: todayMembers.length > 0 ? {
        members: todayMembers,
        mean: todayMembers.reduce((s, v) => s + v, 0) / todayMembers.length,
        min: Math.min(...todayMembers),
        max: Math.max(...todayMembers),
        spread: Math.max(...todayMembers) - Math.min(...todayMembers),
      } : null,
      tomorrow: tomorrowMembers.length > 0 ? {
        members: tomorrowMembers,
        mean: tomorrowMembers.reduce((s, v) => s + v, 0) / tomorrowMembers.length,
        min: Math.min(...tomorrowMembers),
        max: Math.max(...tomorrowMembers),
        spread: Math.max(...tomorrowMembers) - Math.min(...tomorrowMembers),
      } : null,
    };

    logAction('ensemble_fetched', {
      city,
      todayMembers: todayMembers.length,
      tomorrowMembers: tomorrowMembers.length,
      todayMean: result.today?.mean,
      tomorrowMean: result.tomorrow?.mean,
      todaySpread: result.today?.spread,
      tomorrowSpread: result.tomorrow?.spread,
    });

    return { success: true, forecast: result };
  } catch (error) {
    logAction('ensemble_error', { city, error: error.message }, 'error');
    return { success: false, error: `Ensemble fetch failed for ${city}: ${error.message}` };
  }
}

/**
 * Fetch GFS ensemble forecasts for all configured cities.
 */
export async function getAllEnsembleForecasts() {
  const cities = CONFIG.cities;
  const results = await Promise.allSettled(
    cities.map(city => getEnsembleForecast(city))
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

  logAction('all_ensembles', { fetched: forecasts.length, errors: errors.length });

  return {
    success: true,
    forecasts,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Calculate probability that temperature falls in a bucket using ensemble members.
 * This is a direct empirical probability — no assumed sigma needed.
 *
 * For edge buckets (≤X or ≥X), uses 0.5 continuity correction at the boundary.
 * For range buckets (X-Y), counts members in [low, high] inclusive (Kalshi convention).
 *
 * @param {number[]} members - Ensemble member temperature values in °F
 * @param {number|null} bucketLow - Lower bound (null for "≤X" buckets)
 * @param {number|null} bucketHigh - Upper bound (null for "≥X" buckets)
 * @returns {number} Probability 0-1
 */
export function ensembleBucketConfidence(members, bucketLow, bucketHigh) {
  if (!members || members.length === 0) return 0;

  const n = members.length;
  let count = 0;

  for (const temp of members) {
    const roundedTemp = Math.round(temp); // Kalshi settles on whole degrees

    if ((bucketLow === null || bucketLow === -Infinity) && bucketHigh !== null && bucketHigh !== Infinity) {
      // "≤X" bucket
      if (roundedTemp <= bucketHigh) count++;
    } else if ((bucketHigh === null || bucketHigh === Infinity) && bucketLow !== null && bucketLow !== -Infinity) {
      // "≥X" bucket
      if (roundedTemp >= bucketLow) count++;
    } else if (bucketLow !== null && bucketHigh !== null) {
      // "X-Y" range bucket
      if (roundedTemp >= bucketLow && roundedTemp <= bucketHigh) count++;
    }
  }

  return count / n;
}
