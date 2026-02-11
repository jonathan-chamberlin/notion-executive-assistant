import { getAllForecasts, temperatureBucketConfidence } from '../skills/polymarket/forecast.js';
import { scanWeatherMarkets, getCityWeatherEvent } from '../skills/polymarket/markets.js';

function bucketStr(bucket) {
  if (!bucket) return '???';
  const lo = bucket.low !== null ? Math.round(bucket.low) : null;
  const hi = bucket.high !== null ? Math.round(bucket.high) : null;
  if (lo === null) return '<=' + hi + 'F';
  if (hi === null) return '>=' + lo + 'F';
  return lo + '-' + hi + 'F';
}

async function main() {
  // Step 1: Fetch all forecasts
  console.log('=== FETCHING FORECASTS ===');
  const forecasts = await getAllForecasts();
  console.log('Fetched:', forecasts.forecasts.length, 'cities');
  if (forecasts.errors) console.log('Errors:', JSON.stringify(forecasts.errors));

  for (const f of forecasts.forecasts) {
    console.log(
      '  ' + f.city + ':',
      'Today=' + f.today?.highTemp + 'F',
      'Tomorrow=' + f.tomorrow?.highTemp + 'F',
      '(' + f.source + ')'
    );
  }

  // Step 2: Scan Polymarket weather markets (bulk)
  console.log('\n=== SCANNING POLYMARKET WEATHER MARKETS ===');
  const markets = await scanWeatherMarkets();
  console.log('Active events:', markets.events?.length || 0);

  for (const event of (markets.events || [])) {
    console.log('\n' + event.title + ' (' + event.markets.length + ' open buckets, overround: ' + (event.overround * 100).toFixed(0) + '%)');
    for (const m of event.markets) {
      console.log(
        '  ' + bucketStr(m.bucket).padEnd(14) +
        ' | Raw: ' + (m.rawYesPrice * 100).toFixed(1).padStart(5) + 'c' +
        ' | Norm: ' + (m.yesPrice * 100).toFixed(1).padStart(5) + '%' +
        ' | Vol: $' + m.volume.toFixed(0)
      );
    }
  }

  // Step 2b: Test slug-based fetch for tomorrow
  console.log('\n=== TESTING SLUG-BASED FETCH (NYC tomorrow) ===');
  const nycTomorrow = await getCityWeatherEvent('NYC', 'tomorrow');
  if (nycTomorrow.success) {
    console.log('Found:', nycTomorrow.event.title, '(' + nycTomorrow.event.markets.length + ' markets)');
    for (const m of nycTomorrow.event.markets) {
      console.log('  ' + bucketStr(m.bucket).padEnd(14) + ' | ' + (m.yesPrice * 100).toFixed(1) + '%');
    }
  } else {
    console.log('Slug fetch result:', nycTomorrow.error);
  }

  // Step 3: Find opportunities
  console.log('\n=== FINDING OPPORTUNITIES (edge >= 15%) ===');
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

    // Use the label set by scanWeatherMarkets ('today' or 'tomorrow')
    const forecastData = event.label === 'tomorrow' ? forecast.tomorrow : forecast.today;
    if (!forecastData) continue;

    const forecastTemp = forecastData.highTemp;
    console.log('\n  ' + event.city + ' (forecast: ' + forecastTemp + 'F ' + event.label + ')');

    for (const m of event.markets) {
      if (!m.bucket) continue;
      const confidence = temperatureBucketConfidence(forecastTemp, m.bucket.low, m.bucket.high);
      const edge = confidence - m.yesPrice;
      const marker = edge >= 0.15 ? '>>>' : '   ';
      if (edge >= 0.05 || Math.abs(edge) < 0.05) {
        console.log(
          '  ' + marker + ' ' + bucketStr(m.bucket).padEnd(14),
          '| Model: ' + (confidence * 100).toFixed(0).padStart(3) + '%',
          '| Market: ' + (m.yesPrice * 100).toFixed(0).padStart(3) + '%',
          '| Edge: ' + (edge >= 0 ? '+' : '') + (edge * 100).toFixed(0) + '%'
        );
      }
      if (edge >= 0.15) oppCount++;
    }
  }
  console.log('\nTotal opportunities found:', oppCount);
}

main().catch(e => console.error('ERROR:', e.message, e.stack));
