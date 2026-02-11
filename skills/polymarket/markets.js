import { CONFIG, CITY_SERIES } from './config.js';
import { kalshiFetch, buildEventTicker, logAction } from './client.js';

/**
 * Resolve a date descriptor ('today', 'tomorrow', Date, or date string) to a Date object.
 */
function resolveDate(date) {
  if (date === 'today') return new Date();
  if (date === 'tomorrow') {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  }
  if (date instanceof Date) return date;
  return new Date(date);
}

/**
 * Map a raw Kalshi market object to a normalized shape.
 */
function mapMarket(m) {
  return {
    ticker: m.ticker,
    question: m.title || m.subtitle,
    yesPrice: (m.yes_bid != null ? (m.yes_bid + (m.yes_ask || m.yes_bid)) / 2 : m.last_price || 0) / 100,
    yesBid: (m.yes_bid || 0) / 100,
    yesAsk: (m.yes_ask || 0) / 100,
    lastPrice: (m.last_price || 0) / 100,
    volume: m.volume || 0,
    openInterest: m.open_interest || 0,
    bucket: parseBucket(m),
  };
}

/**
 * Fetch weather events for all configured cities for today and tomorrow.
 * Uses Kalshi's public /markets endpoint (no auth needed).
 */
export async function scanWeatherMarkets() {
  try {
    const cities = CONFIG.cities;
    const today = resolveDate('today');
    const tomorrow = resolveDate('tomorrow');

    // Fetch today + tomorrow for all cities in parallel
    const fetches = [];
    for (const city of cities) {
      fetches.push(fetchEventMarkets(city, today, 'today'));
      fetches.push(fetchEventMarkets(city, tomorrow, 'tomorrow'));
    }

    const results = await Promise.allSettled(fetches);
    const events = [];
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        events.push(r.value);
      }
    }

    // Filter out events with no open markets
    const active = events.filter(e => e.markets.length > 0);

    logAction('markets_scanned', {
      events: active.length,
      totalMarkets: active.reduce((n, e) => n + e.markets.length, 0),
      citiesFetched: cities.length,
    });
    return { success: true, events: active };

  } catch (error) {
    logAction('markets_scan_error', { error: error.message });
    return { success: false, error: `Failed to scan markets: ${error.message}` };
  }
}

async function fetchEventMarkets(city, dateObj, label) {
  const eventTicker = buildEventTicker(city, dateObj);
  if (!eventTicker) return null;

  try {
    const data = await kalshiFetch(`/events/${eventTicker}?with_nested_markets=true`);
    if (!data?.event?.markets) return null;

    const openMarkets = data.event.markets.filter(m =>
      m.status === 'active' || m.status === 'open'
    );

    const markets = openMarkets.map(mapMarket);

    return {
      title: data.event.title,
      eventTicker,
      city,
      label,
      markets,
    };
  } catch {
    // Event doesn't exist yet — normal for future dates
    return null;
  }
}

/**
 * Fetch a specific city's weather event for a given date.
 */
export async function getCityWeatherEvent(city, date) {
  const series = CITY_SERIES[city];
  if (!series) {
    return { success: false, error: `Unknown city: ${city}` };
  }

  const dateObj = resolveDate(date);

  const eventTicker = buildEventTicker(city, dateObj);

  try {
    const data = await kalshiFetch(`/events/${eventTicker}?with_nested_markets=true`);

    if (!data?.event?.markets) {
      return { success: false, error: `No weather event found for ${city} on ${date}` };
    }

    const markets = data.event.markets.map(mapMarket);

    logAction('city_event_fetched', { city, eventTicker, markets: markets.length });
    return { success: true, event: { title: data.event.title, eventTicker, city, markets } };

  } catch (error) {
    logAction('city_event_error', { city, eventTicker, error: error.message });
    return { success: false, error: `No weather event found for ${city}: ${error.message}` };
  }
}

/**
 * Parse a Kalshi market into a temperature bucket.
 * Kalshi markets have strike_type, floor_strike, cap_strike fields.
 */
function parseBucket(market) {
  const strikeType = market.strike_type;
  const floor = market.floor_strike;
  const cap = market.cap_strike;

  if (strikeType === 'less' && cap != null) {
    return { low: null, high: cap, unit: 'F' };
  }

  if (strikeType === 'greater' && floor != null) {
    return { low: floor, high: null, unit: 'F' };
  }

  if (strikeType === 'between' && floor != null && cap != null) {
    return { low: floor, high: cap, unit: 'F' };
  }

  // Fallback: try to parse from subtitle
  if (market.yes_sub_title || market.subtitle) {
    return parseBucketFromTitle(market.yes_sub_title || market.subtitle);
  }

  return null;
}

/**
 * Fallback parser for market subtitle text.
 */
function parseBucketFromTitle(title) {
  if (!title) return null;

  // "31° or below"
  const belowMatch = title.match(/(-?\d+)°?\s+or\s+below/i);
  if (belowMatch) {
    return { low: null, high: parseInt(belowMatch[1], 10), unit: 'F' };
  }

  // "32-33°" or "32° to 33°"
  const rangeMatch = title.match(/(-?\d+)°?\s*[-–to]+\s*(-?\d+)/i);
  if (rangeMatch) {
    return { low: parseInt(rangeMatch[1], 10), high: parseInt(rangeMatch[2], 10), unit: 'F' };
  }

  // "40° or above"
  const aboveMatch = title.match(/(-?\d+)°?\s+or\s+above/i);
  if (aboveMatch) {
    return { low: parseInt(aboveMatch[1], 10), high: null, unit: 'F' };
  }

  return null;
}
