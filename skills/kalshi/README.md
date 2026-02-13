# Kalshi Weather Trading — What Works

The `skills/kalshi/` skill is **live and trading real money autonomously**. The Kalshi account is funded, credentials are configured, and the bot runs 24/7 on an Oracle Cloud VM via Docker.

## Architecture

```
scripts/kalshi-scheduler.js   Long-running Node.js scheduler (Docker entrypoint)
  ├── runScan()               Every 30 min: forecast → market scan → score → trade
  ├── getUsageAlert()         Every 10 min: OpenClaw API cost tracking
  └── getDailySummary()       Once at 9 PM ET: P&L, settlements, calibration
```

**Deployment**: Docker container on Oracle Cloud Free Tier ARM VM (1 OCPU, ~1GB RAM). The `kalshi-trader` service runs with a 128MB memory limit. See `docker-compose.yml` for full config.

**Scheduling**: `scripts/kalshi-scheduler.js` replaces Windows Task Scheduler. Does NOT use dotenv — Docker provides env vars via `env_file`. For local testing: `node --env-file=.env scripts/kalshi-scheduler.js`

**Telegram alerts**: The bot sends scan results, trade confirmations, and daily summaries directly via the Telegram bot API (bypasses OpenClaw gateway).

## Modules (16 files, 236 tests)

**Config & data** (`config.js`, `config.test.js` — 37 tests)
- 9 US cities with matching CITY_SERIES tickers, NOAA gridpoints, CITY_COORDS, CITY_TIMEZONES, and CITY_OBSERVATION_STATIONS
- All lookup maps validated for cross-consistency
- Runtime config via `trading-config.json` with `loadTradingConfig()` / `saveTradingConfig()`
- Sigma split: `sigmaToday=2.0°F` (same-day forecast error), `sigmaTomorrow=3.5°F` (next-day)

**API clients** (`client.js`, `client.test.js` — 15 tests)
- `kalshiFetch()` — public Kalshi API (events, markets)
- `kalshiAuthFetch()` — authenticated Kalshi API (trades, balance, positions) via RSA-PSS signing
- `noaaFetch()` — NOAA NWS API for forecast gridpoint data
- Event ticker builder: `KXHIGHNY-26FEB12` format for any city/date

**Forecasting** (`forecast.js`, `forecast.test.js` — 10 tests)
- `getForecast(city)` — single city NOAA forecast (today + tomorrow high temps in °F)
- `getAllForecasts()` — all 9 cities in parallel
- `temperatureBucketConfidence()` — normal distribution model (configurable sigma) for bucket probability

**Ensemble forecasting** (`ensemble.js`, `ensemble.test.js` — 16 tests)
- `getEnsembleForecast(city)` — fetches 31 GFS ensemble members from Open-Meteo API
- `getAllEnsembleForecasts()` — all 9 cities in parallel
- `ensembleBucketConfidence()` — empirical probability from ensemble member count in bucket
- Preferred over normal model when ≥10 members available (no assumed sigma)

**Market scanning** (`markets.js`, `markets.test.js` — 8 tests)
- `getCityWeatherEvent(city, date)` — fetches a single event with all markets, parses buckets (≤X, X-Y, ≥X)
- `scanWeatherMarkets()` — scans all 9 cities × today/tomorrow, returns deduplicated events with prices in cents

**Opportunity detection** (`analyze.js`, `analyze.test.js` — 11 tests)
- `findOpportunities({ minEdge })` — full pipeline: forecasts + ensemble + markets → score → sort by edge
- `scoreMarket()` — uses ensemble probability when available, falls back to normal distribution
- **90% confidence cap**: normal model capped at 90% to prevent false tail edges; only ensemble can justify >90%
- **2 PM local cutoff**: skips today's markets after 2 PM in each city's timezone (high already recorded)
- **Bankroll adjustment**: subtracts open position cost from available balance for Kelly sizing

**Position sizing** (`sizing.js`, `sizing.test.js` — 12 tests)
- `calculatePositionSize()` — fractional Kelly criterion for binary markets
- Formula: `kellyFraction = edge / (100 - yesPrice)`, scaled by `kellyMultiplier` (default 0.25 = quarter-Kelly)

**Budget enforcement** (`budget.js`, `budget.test.js` — 10 tests)
- Daily spend tracking persisted to `~/.kalshi-spend.json`, auto-resets each day
- `canAffordTrade(amount)` checks both per-trade and daily limits

**Trade execution** (`trade.js`, `integration.test.js` — 19 tests)
- `executeTrade()` — places limit orders on Kalshi, tracks spend, logs to CSV
- `getBalance()`, `getPositions()` — account status queries

**Scanner / orchestrator** (`scanner.js`, `scanner.test.js` — 12 tests)
- `runScan()` — main cron entry point: findOpportunities → format alert → optionally trade
- Duplicate prevention, circuit breakers, mode management (paused/alert-only/alert-then-trade/autonomous)

**Risk management** (`risk.js`, `risk.test.js` — 10 tests)
- `checkCircuitBreakers()` — daily loss >20%, 5+ consecutive losses, forecast miss >8°F → auto-downgrade

**Settlement & logging** (`settlement.js`, `settlement.test.js` — 24 tests)
- CSV trade log at `skills/kalshi/trades.csv` with full audit trail
- `checkSettlements()` — reconciles settled trades with actual observed temperatures

**Observations** (`observations.js`, `observations.test.js` — 8 tests)
- `getObservedHigh(city, date)` — fetches actual high temperature from NOAA observation stations

**Calibration** (`calibration.js`, `calibration.test.js` — 17 tests)
- `computeForecastErrors()` — MAE, realized sigma, deduplication by city+date
- `computeCalibration()` — confidence bucket win rates (calibration curve)

**Usage tracking** (`usage.js`, `usage.test.js` — 15 tests)
- OpenClaw API cost tracking with watermark-based new activity detection

## Trading Config (`trading-config.json`)

```json
{
  "mode": "autonomous",
  "maxDailySpend": 1000,
  "minEdge": 25,
  "maxTradeSize": 200,
  "sigmaToday": 2.0,
  "sigmaTomorrow": 3.5,
  "kellyMultiplier": 0.25,
  "autoTradeMaxPerScan": 2
}
```

All values in cents. `minEdge` is in percentage points.

## Test Commands

```bash
# All unit tests (no credentials needed)
node --test skills/kalshi/tests/config.test.js skills/kalshi/tests/budget.test.js skills/kalshi/tests/forecast.test.js skills/kalshi/tests/sizing.test.js skills/kalshi/tests/risk.test.js skills/kalshi/tests/calibration.test.js skills/kalshi/tests/scanner.test.js skills/kalshi/tests/usage.test.js skills/kalshi/tests/observations.test.js skills/kalshi/tests/settlement.test.js skills/kalshi/tests/client.test.js skills/kalshi/tests/markets.test.js skills/kalshi/tests/ensemble.test.js skills/kalshi/tests/analyze.test.js

# Integration tests (needs .env + private key, spends real money ≤$1)
node --test skills/kalshi/tests/integration.test.js
```

## Deployment

```bash
# Build and run on Oracle Cloud VM
docker compose build kalshi-trader
docker compose up -d kalshi-trader

# Check status
ssh ubuntu@150.136.132.12 "docker ps && docker logs kalshi-trader --tail 20"
```

## Trading Agents (`.claude/agents/`)

Five specialized agents: kalshi-researcher, kalshi-experimenter, kalshi-market-maker, kalshi-arbitrage, kalshi-risk-manager.
