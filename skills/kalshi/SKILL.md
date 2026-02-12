---
name: kalshi
description: Automated weather prediction market trading on Kalshi using GFS ensemble forecasts and NOAA data
user-invocable: true
requires:
  env:
    - KALSHI_API_KEY_ID
    - KALSHI_PRIVATE_KEY_PATH
---

# WeatherTradingSkill (Kalshi)

Trade weather prediction markets on Kalshi by comparing GFS ensemble forecast data against market odds. When ensemble models show high confidence but market prices are low, the bot identifies mispriced contracts and executes trades autonomously.

## Status

- **Forecasting**: Working — GFS 31-member ensemble via Open-Meteo (primary) + NOAA NWS point forecast (fallback)
- **Market scanning**: Working (Kalshi public events API, event ticker lookup)
- **Opportunity detection**: Working (ensemble empirical probability, fallback normal distribution σ)
- **Trade execution**: Live and autonomous (Kalshi REST API with RSA-PSS authentication)
- **Position sizing**: Working (fractional Kelly criterion, quarter-Kelly default)
- **Automated scanning**: Working (cron-driven, 30-min interval, Telegram alerts)
- **Mode control**: Working (paused / alert-only / alert-then-trade / autonomous) — **currently autonomous**
- **Settlement tracking**: Working (Kalshi API + NOAA actual temps for forecast validation)
- **Calibration**: Working (forecast accuracy analysis, realized sigma tracking)
- **Circuit breakers**: Working (daily loss, consecutive loss, forecast miss protection)

## How Kalshi Weather Markets Work

Kalshi (CFTC-regulated, US-legal) creates daily high temperature events for 9 US cities. Each event has ~7 markets representing temperature buckets in °F.

```
Event: KXHIGHNY-26FEB12 — "What will be the high temp in NYC on Feb 12?"
  ├── ≤33°F          (YES: 16¢)   strike_type: less,    cap: 33
  ├── 34-35°F        (YES: 24¢)   strike_type: between, floor: 34, cap: 35
  ├── 36-37°F        (YES: 54¢)   strike_type: between, floor: 36, cap: 37
  ├── 38-39°F        (YES: 9¢)    strike_type: between, floor: 38, cap: 39
  ├── 40-41°F        (YES: 2¢)    strike_type: between, floor: 40, cap: 41
  ├── 42-43°F        (YES: 1¢)    strike_type: between, floor: 42, cap: 43
  └── ≥44°F          (YES: 1¢)    strike_type: greater, floor: 44
```

**Event ticker format:** `{SERIES}-{YY}{MMM}{DD}` (e.g., `KXHIGHNY-26FEB12`)

Markets settle based on the NWS Climatological Report (Daily) from each city's designated station:
NYC (KNYC/Central Park), Chicago (KMDW/Midway), Miami (KMIA), Austin (KAUS), LA (KLAX), Philadelphia (KPHL), DC (KDCA), Denver (KDEN), SF (KSFO).

## Strategy

1. Fetch GFS ensemble forecasts (31 members) for all 9 cities via Open-Meteo (free API, no key)
2. Fetch NOAA point forecasts in parallel as fallback
3. Calculate bucket probabilities empirically: count ensemble members that round to each bucket
4. Compare ensemble confidence to market YES prices
5. Buy YES when ensemble confidence significantly exceeds market price (edge > minEdge)
6. Position sizes via fractional Kelly criterion (quarter-Kelly default) based on edge and bankroll
7. Circuit breakers halt autonomous trading on excessive losses or forecast misses

### Why Ensemble > Normal Distribution

The previous approach assumed forecast errors follow N(0, σ²) with σ=3°F. This required guessing sigma and produced suspiciously large edges (69pp+). The GFS ensemble provides 31 independent model runs — each with slightly different initial conditions — giving an empirical probability distribution with no assumed parameters. When 31/31 members agree a temperature will be ≤36°F, that's genuine high confidence. When members disagree (spread of 8°F), the bot naturally assigns lower confidence.

## Functions

### Data

- `getAllForecasts()` — fetch NOAA point forecasts for all 9 cities
- `getForecast(city)` — fetch NOAA point forecast for one city
- `getEnsembleForecast(city)` — fetch GFS 31-member ensemble from Open-Meteo
- `getAllEnsembleForecasts()` — fetch ensembles for all 9 cities in parallel
- `scanWeatherMarkets()` — fetch today + tomorrow events for all cities with live prices
- `getCityWeatherEvent(city, date)` — fetch specific city/date event

### Analysis

- `findOpportunities({ minEdge })` — full pipeline: ensemble + NOAA + markets + Kelly sizing = ranked edges
- `ensembleBucketConfidence(members, bucketLow, bucketHigh)` — empirical probability from ensemble members
- `temperatureBucketConfidence(forecastTemp, bucketLow, bucketHigh, sigma)` — normal distribution fallback
- `calculatePositionSize({ bankroll, edge, yesPrice, ... })` — Kelly criterion position sizing

### Trading

- `executeTrade({ ticker, side, amount, yesPrice })` — place limit order on Kalshi
- `getPositions()` — list open positions
- `getBalance()` — get account balance
- `getPerformance()` — daily budget + balance summary

### Observations & Calibration

- `getObservedHigh(city, dateStr)` — fetch actual observed high temp from NOAA station
- `getObservedHighs(cities, dateStr)` — batch fetch for multiple cities
- `getCalibrationReport()` — forecast accuracy analysis with realized sigma
- `computeForecastErrors(trades)` — mean error, MAE, realized sigma from trade history
- `computeCalibration(trades)` — confidence bucket → actual win rate table
- `checkCircuitBreakers(trades, config)` — risk checks before autonomous trading

### Scanner (Cron Entry Points)

- `runScan()` — main 30-min cron: reads mode → finds opportunities → circuit breakers → optionally auto-trades
- `setMode(mode)` — change trading mode (paused / alert-only / alert-then-trade / autonomous)
- `getStatus()` — current mode, budget remaining, trade count, Kalshi balance
- `getUsageAlert()` — OpenClaw LLM usage report (suppressed if no new activity)
- `getDailySummary()` — end-of-day: trades, settlements, P&L, forecast accuracy, usage stats
- `getUsageStats()` — raw usage stats: today's cost, tokens in/out, invocation count

## Trading Modes

| Mode | Scans? | Alerts? | Trades? |
|------|--------|---------|---------|
| `paused` | No | No | No |
| `alert-only` | Yes | Yes | No |
| `alert-then-trade` | Yes | Yes | On confirmation |
| `autonomous` | Yes | Yes | Auto (up to N per scan) |

## Current Live Configuration

Editable at `skills/kalshi/trading-config.json`:

```json
{
  "mode": "autonomous",
  "maxDailySpend": 500,
  "minEdge": 25,
  "maxTradeSize": 200,
  "scanIntervalMinutes": 30,
  "usageAlertIntervalMinutes": 10,
  "topOpportunitiesToShow": 5,
  "autoTradeMaxPerScan": 2,
  "sigma": 3.0,
  "kellyMultiplier": 0.25,
  "minTradeSize": 5
}
```

| Setting | Current | Description |
|---------|---------|-------------|
| `mode` | autonomous | Auto-trades top opportunities per scan |
| `maxDailySpend` | 500¢ ($5) | Daily budget in cents |
| `minEdge` | 25pp | Minimum edge to trigger trade |
| `maxTradeSize` | 200¢ ($2) | Max per-trade amount in cents |
| `scanIntervalMinutes` | 30 | Cron scan interval |
| `usageAlertIntervalMinutes` | 10 | Usage report interval |
| `topOpportunitiesToShow` | 5 | Top N opportunities in alerts |
| `autoTradeMaxPerScan` | 2 | Max auto-trades per scan |
| `sigma` | 3.0 | Normal distribution fallback σ (used only when ensemble unavailable) |
| `kellyMultiplier` | 0.25 | Fraction of Kelly criterion (0.25 = quarter-Kelly) |
| `minTradeSize` | 5 | Minimum position size in cents |

## Cron Jobs

| Job | Interval | Command | Telegram |
|-----|----------|---------|----------|
| Weather scan | 30 min | `node scripts/kalshi-cron.js scan` | Always |
| Usage alert | 10 min | `node scripts/kalshi-cron.js usage` | Only if new activity |
| Daily summary | 9 PM ET | `node scripts/kalshi-cron.js summary` | Always |
| Calibration | On demand | `node scripts/kalshi-cron.js calibration` | On demand |
| Status | On demand | `node scripts/kalshi-cron.js status` | On demand |

## Module Architecture

```
skills/kalshi/
├── config.js          — Cities, tickers, gridpoints, coordinates, trading defaults
├── client.js          — Kalshi API (public + authenticated), NOAA API, RSA-PSS signing
├── ensemble.js        — GFS 31-member ensemble from Open-Meteo (primary forecast source)
├── forecast.js        — NOAA NWS point forecasts + normal distribution model (fallback)
├── markets.js         — Kalshi event/market scanning, bucket parsing
├── analyze.js         — Opportunity detection pipeline (ensemble → scoring → Kelly sizing)
├── sizing.js          — Fractional Kelly criterion position sizing
├── trade.js           — Order execution, positions, balance
├── budget.js          — Daily spend tracking, budget enforcement
├── settlement.js      — Trade settlement checking, actual_high population, CSV trade log
├── observations.js    — NOAA observed actual high temps for calibration
├── calibration.js     — Forecast error analysis, realized sigma, confidence calibration
├── risk.js            — Circuit breakers (daily loss, consecutive loss, forecast miss)
├── scanner.js         — Cron entry points (scan, status, summary, usage)
├── usage.js           — OpenClaw API usage tracking
├── trading-config.json — Runtime configuration (editable)
├── trades.csv         — Trade log (auto-managed)
├── index.js           — Public exports
├── SKILL.md           — This file
└── tests/
    ├── config.test.js      — 23 tests (cities, tickers, stations, coordinates)
    ├── client.test.js      — 15 tests (API clients, signing, ticker builder)
    ├── forecast.test.js    — 10 tests (NOAA forecasts, bucket confidence)
    ├── markets.test.js     — 8 tests (event scanning, bucket parsing)
    ├── analyze.test.js     — 8 tests (opportunity pipeline, edge thresholds, ensemble fields)
    ├── budget.test.js      — 10 tests (daily spend, budget enforcement)
    ├── settlement.test.js  — 19 tests (trade logging, settlement checking)
    ├── observations.test.js — 9 tests (NOAA observations, C→F conversion)
    ├── sizing.test.js      — 17 tests (Kelly criterion, edge cases)
    ├── calibration.test.js — 20 tests (forecast errors, calibration table)
    ├── risk.test.js        — 10 tests (circuit breakers)
    ├── ensemble.test.js    — 16 tests (ensemble fetch, bucket confidence, coordinates)
    └── integration.test.js — 19 tests (real trades, balance reconciliation)
```

**Total: 180+ unit tests + 19 integration tests**

## Data Flow

```
Open-Meteo API ──→ ensemble.js (31 GFS members per city)
                        │
NOAA NWS API ───→ forecast.js (point forecast, fallback)
                        │
Kalshi Public API → markets.js (events + bucket prices)
                        │
                   analyze.js ──→ scoreMarket() uses ensemble when available
                        │         falls back to normal distribution
                        │
                   sizing.js ──→ Kelly criterion position sizing
                        │
                   scanner.js ──→ circuit breakers → executeTrade()
                        │
                   Telegram ←── formatted alert + trade results
```

## Cities

| City | Series Ticker | NOAA Gridpoint | Settlement Station | Lat/Lon |
|------|--------------|----------------|-------------------|---------|
| NYC | KXHIGHNY | OKX/33,37 | KNYC (Central Park) | 40.78, -73.97 |
| Chicago | KXHIGHCHI | LOT/76,73 | KMDW (Midway) | 41.79, -87.75 |
| Miami | KXHIGHMIA | MFL/110,50 | KMIA | 25.80, -80.29 |
| Austin | KXHIGHAUS | EWX/156,91 | KAUS | 30.19, -97.67 |
| LA | KXHIGHLAX | LOX/154,44 | KLAX | 33.94, -118.41 |
| Philadelphia | KXHIGHPHIL | PHI/57,97 | KPHL | 39.87, -75.24 |
| DC | KXHIGHTDC | LWX/97,71 | KDCA | 38.85, -77.04 |
| Denver | KXHIGHDEN | BOU/62,60 | KDEN | 39.86, -104.67 |
| SF | KXHIGHTSFO | MTR/85,105 | KSFO | 37.62, -122.38 |

## Safety Rules

1. **Hard position limits** — never exceed `maxTradeSize` per trade or `maxDailySpend` per day
2. **No market-making** — directional YES buying only
3. **Log all trades** — every action logged to console + CSV with timestamps
4. **Fail safely** — if any API call fails, skip trade, never retry blindly
5. **RSA-PSS authentication** — all trading calls use cryptographic signatures
6. **Circuit breakers** — auto-downgrade to alert-only if daily loss >20%, 5+ consecutive losses, or forecast miss >8°F
7. **Ensemble graceful degradation** — if Open-Meteo is unavailable, falls back to NOAA + normal distribution

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `KALSHI_API_KEY_ID` | Yes | Kalshi API key ID (from kalshi.com/account/api-keys) |
| `KALSHI_PRIVATE_KEY_PATH` | Yes* | Path to RSA private key PEM file |
| `KALSHI_PRIVATE_KEY_PEM` | Yes* | RSA private key PEM content (alternative to path) |
| `NOAA_USER_AGENT` | No | User-agent for NOAA API (recommended: your email) |

*One of KALSHI_PRIVATE_KEY_PATH or KALSHI_PRIVATE_KEY_PEM is required.

## Authentication

Kalshi uses RSA-PSS signing for API authentication:
1. Generate RSA key pair on kalshi.com/account/api-keys
2. Save private key as PEM file (`.gitignore` already covers `*.pem`)
3. Set `KALSHI_API_KEY_ID` and `KALSHI_PRIVATE_KEY_PATH` in `.env`
4. Signature: `RSA-SHA256-PSS(timestamp + METHOD + path)` with salt length = digest length

## Test Commands

```bash
# All unit tests (hits live NOAA + Kalshi public + Open-Meteo APIs, no credentials needed)
node --test skills/kalshi/tests/config.test.js skills/kalshi/tests/budget.test.js skills/kalshi/tests/forecast.test.js skills/kalshi/tests/client.test.js skills/kalshi/tests/analyze.test.js skills/kalshi/tests/markets.test.js skills/kalshi/tests/settlement.test.js skills/kalshi/tests/observations.test.js skills/kalshi/tests/sizing.test.js skills/kalshi/tests/calibration.test.js skills/kalshi/tests/risk.test.js skills/kalshi/tests/ensemble.test.js

# Integration tests (needs .env with Kalshi credentials, spends real money ≤$1)
node --test skills/kalshi/tests/integration.test.js

# Manual scan (uses current trading-config.json mode)
node scripts/kalshi-cron.js scan

# Cheapest-trade end-to-end test
node scripts/test-cheapest-trade.js
```
