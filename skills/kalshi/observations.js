import { CONFIG, CITY_OBSERVATION_STATIONS } from './config.js';
import { noaaFetch, logAction } from './client.js';

/**
 * Fetch the actual observed high temperature for a city on a given date.
 * Uses NOAA observations API with the station that matches Kalshi's settlement source.
 *
 * @param {string} city - City name (e.g., 'NYC')
 * @param {string} dateStr - Date in 'YYYY-MM-DD' format
 * @returns {{ success: boolean, actualHigh?: number, error?: string }}
 */
export async function getObservedHigh(city, dateStr) {
  const stationId = CITY_OBSERVATION_STATIONS[city];
  if (!stationId) {
    return { success: false, error: `Unknown city: ${city}` };
  }

  // Don't fetch for today or future dates (observations incomplete)
  const today = new Date().toISOString().split('T')[0];
  if (dateStr >= today) {
    return { success: false, error: `Cannot fetch observations for today or future: ${dateStr}` };
  }

  try {
    // NOAA observations API: fetch all observations for the date range
    const nextDay = nextDate(dateStr);
    const data = await noaaFetch(
      `/stations/${stationId}/observations?start=${dateStr}T00:00:00Z&end=${nextDay}T00:00:00Z`
    );

    const features = data.features || [];
    if (features.length === 0) {
      return { success: false, error: `No observations found for ${city} on ${dateStr}` };
    }

    // Extract max temperature from all observations
    // NOAA returns temperature in Celsius (unitCode: wmoUnit:degC)
    let maxTempC = -Infinity;
    for (const f of features) {
      const temp = f.properties?.temperature?.value;
      if (temp != null && typeof temp === 'number') {
        maxTempC = Math.max(maxTempC, temp);
      }
    }

    if (maxTempC === -Infinity) {
      return { success: false, error: `No valid temperature readings for ${city} on ${dateStr}` };
    }

    // Convert Celsius to Fahrenheit, round to nearest integer (NWS convention)
    const actualHigh = Math.round(maxTempC * 9 / 5 + 32);

    logAction('observed_high_fetched', { city, date: dateStr, actualHigh, stationId });
    return { success: true, actualHigh };
  } catch (error) {
    logAction('observed_high_error', { city, date: dateStr, error: error.message }, 'error');
    return { success: false, error: `Failed to fetch observations for ${city}: ${error.message}` };
  }
}

/**
 * Fetch observed highs for multiple cities on a given date.
 * Same parallel pattern as getAllForecasts() in forecast.js.
 */
export async function getObservedHighs(cities, dateStr) {
  const results = await Promise.allSettled(
    cities.map(city => getObservedHigh(city, dateStr))
  );

  const highs = {};
  const errors = [];

  results.forEach((result, i) => {
    const city = cities[i];
    if (result.status === 'fulfilled' && result.value.success) {
      highs[city] = result.value.actualHigh;
    } else {
      const errorMsg = result.status === 'rejected' ? result.reason.message : result.value.error;
      errors.push({ city, error: errorMsg });
    }
  });

  logAction('observed_highs_batch', { fetched: Object.keys(highs).length, errors: errors.length });
  return { success: true, highs, errors: errors.length > 0 ? errors : undefined };
}

/** Get the next date in YYYY-MM-DD format */
export function nextDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z'); // noon UTC to avoid timezone issues
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().split('T')[0];
}
