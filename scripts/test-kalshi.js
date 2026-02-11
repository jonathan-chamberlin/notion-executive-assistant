import 'dotenv/config';
import { getAllForecasts, temperatureBucketConfidence } from '../skills/kalshi/forecast.js';
import { scanWeatherMarkets, getCityWeatherEvent } from '../skills/kalshi/markets.js';

function bucketStr(bucket) {
  if (!bucket) return '???';
  const lo = bucket.low !== null ? Math.round(bucket.low) : null;
  const hi = bucket.high !== null ? Math.round(bucket.high) : null;
  if (lo === null) return '<=' + hi + 'F';
  if (hi === null) return '>=' + lo + 'F';
  return lo + '-' + hi + 'F';
}

async function main() {
  console.log('=== KALSHI WEATHER TRADING BOT TEST ===\n');

  // Step 1: Fetch all forecasts
  console.log('--- FETCHING NOAA FORECASTS ---');
  const forecasts = await getAllForecasts();
  console.log('Fetched:', forecasts.forecasts.length, 'cities');
  if (forecasts.errors) console.log('Errors:', JSON.stringify(forecasts.errors));

  for (const f of forecasts.forecasts) {
    console.log(
      '  ' + f.city.padEnd(14) +
      'Today=' + String(f.today?.highTemp ?? '?').padStart(3) + 'F' +
      '  Tomorrow=' + String(f.tomorrow?.highTemp ?? '?').padStart(3) + 'F'
    );
  }

  // Step 2: Scan Kalshi weather markets
  console.log('\n--- SCANNING KALSHI WEATHER MARKETS ---');
  const markets = await scanWeatherMarkets();
  console.log('Active events:', markets.events?.length || 0);
  console.log('Total markets:', markets.events?.reduce((n, e) => n + e.markets.length, 0) || 0);

  for (const event of (markets.events || [])) {
    console.log('\n  ' + event.title + ' [' + event.eventTicker + '] (' + event.markets.length + ' markets)');
    for (const m of event.markets) {
      const price = m.yesPrice;
      const bid = m.yesBid;
      const ask = m.yesAsk;
      console.log(
        '    ' + bucketStr(m.bucket).padEnd(14) +
        ' | Mid: ' + (price * 100).toFixed(0).padStart(3) + '¢' +
        ' | Bid/Ask: ' + (bid * 100).toFixed(0) + '/' + (ask * 100).toFixed(0) +
        ' | Last: ' + (m.lastPrice * 100).toFixed(0) + '¢' +
        ' | Vol: ' + m.volume
      );
    }
  }

  // Step 3: Test single city fetch
  console.log('\n--- TESTING SINGLE CITY FETCH (NYC tomorrow) ---');
  const nycTomorrow = await getCityWeatherEvent('NYC', 'tomorrow');
  if (nycTomorrow.success) {
    console.log('Found:', nycTomorrow.event.title, '(' + nycTomorrow.event.markets.length + ' markets)');
    for (const m of nycTomorrow.event.markets) {
      console.log('  ' + bucketStr(m.bucket).padEnd(14) + ' | ' + (m.yesPrice * 100).toFixed(0) + '¢');
    }
  } else {
    console.log('Result:', nycTomorrow.error);
  }

  // Step 4: Find opportunities
  console.log('\n--- FINDING OPPORTUNITIES (edge >= 15%) ---');
  const forecastByCity = {};
  for (const f of forecasts.forecasts) {
    forecastByCity[f.city] = f;
  }

  let oppCount = 0;
  for (const event of (markets.events || [])) {
    const forecast = forecastByCity[event.city];
    if (!forecast) {
      console.log('  [skip] No forecast for', event.city);
      continue;
    }

    const forecastData = event.label === 'tomorrow' ? forecast.tomorrow : forecast.today;
    if (!forecastData) continue;

    const forecastTemp = forecastData.highTemp;
    console.log('\n  ' + event.city + ' ' + event.label + ' (forecast: ' + forecastTemp + 'F)');

    for (const m of event.markets) {
      if (!m.bucket) continue;
      const confidence = temperatureBucketConfidence(forecastTemp, m.bucket.low, m.bucket.high);
      const edge = confidence - m.yesPrice;
      const marker = edge >= 0.15 ? ' >>>' : '    ';
      if (edge >= 0.05 || Math.abs(edge) < 0.05) {
        console.log(
          marker + ' ' + bucketStr(m.bucket).padEnd(14),
          '| Model: ' + (confidence * 100).toFixed(0).padStart(3) + '%',
          '| Market: ' + (m.yesPrice * 100).toFixed(0).padStart(3) + '¢',
          '| Edge: ' + (edge >= 0 ? '+' : '') + (edge * 100).toFixed(0) + '%',
          '| Ticker: ' + m.ticker
        );
      }
      if (edge >= 0.15) oppCount++;
    }
  }
  console.log('\n=== Total opportunities (>=15% edge):', oppCount, '===');
}

main().catch(e => console.error('ERROR:', e.message, e.stack));
