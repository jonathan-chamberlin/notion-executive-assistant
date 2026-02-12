# Claude Code Instructions — OpenClaw Executive Assistant

## Purpose of This File

This file defines **how Claude Code should behave while building the system**, not how the executive assistant behaves at runtime.

Claude Code must treat this repository as:
- A **OpenClaw workspace**
- Focused on **skills development**, configuration, and integration
- Governed by the system design defined in:

docs/system-specifications.md

Claude must follow that specification as the source of truth.

use pnpm install instead of npm install

---

## Core Development Philosophy

- **OpenClaw is the agent runtime**
- **Skills are the only place where custom logic lives**
- Do **not** re-implement messaging, orchestration, or session handling
- Prefer **explicit, deterministic code** over clever abstractions
- Every action must be auditable and reversible where possible

Claude Code should optimize for:
- Reliability
- Clarity
- Maintainability
- Minimal surface area

---

## What Claude Code Is Responsible For

Claude Code may:

- Create and modify **OpenClaw skills**
- Write `SKILL.md` files for each skill
- Implement API integrations (Notion, email, calendar)
- Add validation, schemas, and structured outputs
- Improve error handling and logging
- Refactor for clarity and safety
- Adjust configuration files required by OpenClaw

Claude Code must assume:
- OpenClaw handles sessions, memory, and messaging
- Telegram is already connected at the platform level
- LLM configuration is handled via OpenClaw settings

---

## What Claude Code Must NOT Do

Claude Code must NOT:

- Rebuild an agent framework
- Create a custom task router or planner
- Implement its own memory system
- Bypass OpenClaw’s skill execution model
- Embed large prompt logic directly into application code
- Hardcode secrets, tokens, or credentials

If a feature seems to require orchestration logic, it should be implemented as:
- A **skill**
- Or a **composition of skills**, not a new agent layer

---

## Skill Development Rules

When creating or modifying skills:

1. Each skill must live in its own directory under `/skills`
2. Each skill must include:
   - `SKILL.md` describing intent, inputs, outputs, and constraints
   - Clear, minimal code implementing the behavior
3. Skills must:
   - Accept structured inputs
   - Validate inputs defensively
   - Return structured, machine-readable outputs
4. Side effects (Notion writes, emails, calendar changes) must be explicit

Claude Code should prefer:
- Simple functions
- Clear data flow
- Predictable behavior

---

## Notion Integration Rules

- Notion is the **single source of truth** for tasks
- Skills must conform to the Notion schema defined in `system_specifications.md`
- Never infer schema dynamically
- Always validate property names and types
- Fail safely if schema mismatches occur

---

## Model Usage Guidance

- Claude is the **primary development model**
- If the system references GPT-5.2 Instant, that is a runtime configuration concern
- Claude Code should not hardcode or assume a specific model backend
- Prompt logic belongs in SKILL.md files, not embedded inline in code

---

## Code Quality Standards

Claude Code must ensure:

- Clear naming (no vague abstractions)
- Explicit error handling
- No silent failures
- Logs that explain *what happened and why*
- Comments only where they add clarity (not redundancy)

Prefer correctness over brevity.

---

## Change Discipline

Before making changes, Claude Code should:

1. Identify which part of the system specification applies
2. Confirm the change does not violate OpenClaw’s architecture
3. Make the smallest change that solves the problem
4. Avoid speculative or premature features

If a requested change conflicts with the system design, Claude Code must:
- Call out the conflict explicitly
- Propose a compliant alternative

---

## Assumptions

Claude Code may assume:

- The repository is version-controlled via Git
- Deployment happens outside this repo
- Secrets are injected via environment variables
- Kalshi API credentials are in `.env` (gitignored) and `kalshi-private-key.pem` (gitignored) at the repo root. Scripts load them via `import 'dotenv/config'`.
- The developer understands OpenClaw basics

Claude Code should **not** explain OpenClaw concepts unless directly relevant to a code decision.

---

## Success Criteria for Claude Code

Claude Code is doing its job well if:

- Skills are easy to reason about
- The system matches `system_specifications.md`
- No unnecessary infrastructure is introduced
- Another engineer could maintain this repo without confusion

---

## Kalshi Weather Trading — What Works

The `skills/kalshi/` skill is **live and trading real money autonomously**. The Kalshi account is funded, credentials are configured, and the bot runs 24/7 on an Oracle Cloud VM via Docker.

### Architecture

```
scripts/kalshi-scheduler.js   Long-running Node.js scheduler (Docker entrypoint)
  ├── runScan()               Every 30 min: forecast → market scan → score → trade
  ├── getUsageAlert()         Every 10 min: OpenClaw API cost tracking
  └── getDailySummary()       Once at 9 PM ET: P&L, settlements, calibration
```

**Deployment**: Docker container on Oracle Cloud Free Tier ARM VM (1 OCPU, ~1GB RAM). The `kalshi-trader` service runs with a 128MB memory limit. See `docker-compose.yml` for full config.

**Scheduling**: `scripts/kalshi-scheduler.js` replaces Windows Task Scheduler. Does NOT use dotenv — Docker provides env vars via `env_file`. For local testing: `node --env-file=.env scripts/kalshi-scheduler.js`

**Telegram alerts**: The bot sends scan results, trade confirmations, and daily summaries directly via the Telegram bot API (bypasses OpenClaw gateway).

### Modules (16 files, 236 tests)

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
- Each opportunity includes: ticker, city, bucket, forecastTemp, forecastConfidence, confidenceSource, ensembleSpread, marketPrice, edge, side, suggestedAmount, suggestedYesPrice, contracts, sizingReason

**Position sizing** (`sizing.js`, `sizing.test.js` — 12 tests)
- `calculatePositionSize()` — fractional Kelly criterion for binary markets
- Formula: `kellyFraction = edge / (100 - yesPrice)`, scaled by `kellyMultiplier` (default 0.25 = quarter-Kelly)
- Enforces maxTradeSize cap, minTradeSize floor, and minimum 1 contract

**Budget enforcement** (`budget.js`, `budget.test.js` — 10 tests)
- Daily spend tracking persisted to `~/.kalshi-spend.json`, auto-resets each day
- `canAffordTrade(amount)` checks both per-trade and daily limits

**Trade execution** (`trade.js`, `integration.test.js` — 19 tests)
- `executeTrade()` — places limit orders on Kalshi, tracks spend, logs to CSV
- `getBalance()` — fetches account balance in cents
- `getPositions()` — lists open positions with ticker, count, avg price, P&L
- Integration test places real trades (1 contract at cheapest price), verifies position, reconciles balance

**Scanner / orchestrator** (`scanner.js`, `scanner.test.js` — 12 tests)
- `runScan()` — main cron entry point: read mode → findOpportunities → format alert → optionally trade
- **Duplicate prevention**: checks open positions before trading, skips tickers already held
- **Circuit breakers**: daily loss >20% of budget, 5+ consecutive losses, forecast miss >8°F → auto-downgrade to alert-only
- `setMode()` — paused / alert-only / alert-then-trade / autonomous
- `getStatus()` — mode, budget, trade count, balance
- `getDailySummary()` — P&L, settlements, forecast accuracy, usage stats

**Risk management** (`risk.js`, `risk.test.js` — 10 tests)
- `checkCircuitBreakers()` — three independent breakers with auto-downgrade

**Settlement & logging** (`settlement.js`, `settlement.test.js` — 24 tests)
- CSV trade log at `skills/kalshi/trades.csv` with full audit trail
- `checkSettlements()` — reconciles settled trades with actual observed temperatures
- `getTradeLog()` — parses CSV into structured objects

**Observations** (`observations.js`, `observations.test.js` — 8 tests)
- `getObservedHigh(city, date)` — fetches actual high temperature from NOAA observation stations
- `getObservedHighs()` — batch fetch for all 9 cities

**Calibration** (`calibration.js`, `calibration.test.js` — 17 tests)
- `computeForecastErrors()` — MAE, realized sigma, deduplication by city+date
- `computeCalibration()` — confidence bucket win rates (calibration curve)
- `getCalibrationReport()` — formatted Telegram-ready report

**Usage tracking** (`usage.js`, `usage.test.js` — 15 tests)
- OpenClaw API cost tracking with watermark-based new activity detection

### Trading Config (`trading-config.json`)

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

All values in cents. `minEdge` is in percentage points. Modes: `paused`, `alert-only`, `alert-then-trade`, `autonomous`.

### Test Commands

```bash
# All unit tests (no credentials needed, hits live NOAA + Kalshi public + Open-Meteo APIs)
node --test skills/kalshi/tests/config.test.js skills/kalshi/tests/budget.test.js skills/kalshi/tests/forecast.test.js skills/kalshi/tests/sizing.test.js skills/kalshi/tests/risk.test.js skills/kalshi/tests/calibration.test.js skills/kalshi/tests/scanner.test.js skills/kalshi/tests/usage.test.js skills/kalshi/tests/observations.test.js skills/kalshi/tests/settlement.test.js skills/kalshi/tests/client.test.js skills/kalshi/tests/markets.test.js skills/kalshi/tests/ensemble.test.js skills/kalshi/tests/analyze.test.js

# Integration tests (needs .env with KALSHI_API_KEY_ID + private key, spends real money ≤$1)
node --test skills/kalshi/tests/integration.test.js
```

### Deployment

```bash
# Build and run on Oracle Cloud VM
docker compose build kalshi-trader
docker compose up -d kalshi-trader

# Check status
ssh ubuntu@150.136.132.12 "docker ps && docker logs kalshi-trader --tail 20"
```

The VM is Oracle Cloud Always Free tier (ARM A1.Flex). The `kalshi-trader` container runs at ~80MB within its 128MB limit.

### Trading Agents (`.claude/agents/`)

Five specialized agents for different trading strategies:
- `kalshi-researcher` — weather model monitoring, forecast accuracy tracking
- `kalshi-experimenter` — controlled parameter optimization (sigma, edge, Kelly fraction)
- `kalshi-market-maker` — Avellaneda-Stoikov two-sided quoting
- `kalshi-arbitrage` — bucket overround, cross-city correlation, today/tomorrow spread scanning
- `kalshi-risk-manager` — fractional Kelly sizing, circuit breakers, daily P&L reporting

---

End of instructions.
