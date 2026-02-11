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

The `skills/kalshi/` skill is **live and trading real money**. The Kalshi account is funded, credentials are configured, and the first trade has been placed.

### Verified Working (82 unit tests + 7-phase integration test)

**Config & data consistency** (`config.js`, `config.test.js` — 20 tests)
- 9 US cities with matching CITY_SERIES tickers and NOAA gridpoints
- All limits validated (maxTradeSize=500¢, maxDailySpend=5000¢, minEdge=20pp)

**API clients** (`client.js`, `client.test.js` — 15 tests)
- Kalshi public API: fetches events by ticker, returns structured data
- Kalshi authenticated API: RSA-PSS signing with API key + private PEM
- NOAA API: fetches forecast gridpoint data for all 9 cities
- Event ticker builder: `KXHIGHNY-26FEB12` format for any city/date

**Forecasting** (`forecast.js`, `forecast.test.js` — 10 tests)
- `getForecast(city)` — single city NOAA forecast (today + tomorrow high temps in °F)
- `getAllForecasts()` — all 9 cities in parallel
- `temperatureBucketConfidence()` — normal distribution model (configurable sigma) for bucket probability

**Market scanning** (`markets.js`, `markets.test.js` — 8 tests)
- `getCityWeatherEvent(city, date)` — fetches a single event with all markets, parses buckets (≤X, X-Y, ≥X), validates bid/ask ordering
- `scanWeatherMarkets()` — scans all 9 cities × today/tomorrow, returns deduplicated events with normalized prices in cents

**Opportunity detection** (`analyze.js`, `analyze.test.js` — 7 tests)
- `findOpportunities({ minEdge })` — full pipeline: forecasts → markets → compare → sorted by edge descending
- Each opportunity includes: ticker, city, bucket, forecastTemp, forecastConfidence, marketPrice, edge, suggestedAmount, suggestedYesPrice

**Budget enforcement** (`budget.js`, `budget.test.js` — 10 tests)
- Daily spend tracking persisted to `~/.kalshi-spend.json`, auto-resets each day
- `canAffordTrade(amount)` checks both per-trade and daily limits
- Accumulation across multiple trades works correctly

**Trade execution** (`trade.js`, `integration.test.js` — 19 tests)
- Input validation: rejects missing ticker, invalid side, zero amount, out-of-range price, over-budget
- `executeTrade()` — places limit orders on Kalshi via authenticated API, tracks spend
- `getBalance()` — fetches account balance in cents
- `getPositions()` — lists open positions with ticker, count, P&L
- `getPerformance()` — budget + balance summary
- Integration test places real trades (1 contract at cheapest price), verifies position appears, reconciles balance within ±5¢

### Test Commands

```bash
# Unit tests (no credentials needed, hits live NOAA + Kalshi public APIs)
node --test skills/kalshi/tests/config.test.js skills/kalshi/tests/budget.test.js skills/kalshi/tests/forecast.test.js skills/kalshi/tests/client.test.js skills/kalshi/tests/analyze.test.js skills/kalshi/tests/markets.test.js

# Integration tests (needs .env with KALSHI_API_KEY_ID + private key, spends real money ≤$1)
node --test skills/kalshi/tests/integration.test.js

# Manual end-to-end pipeline (no trades, just scan + detect)
node scripts/test-kalshi.js
```

### Trading Agents (`.claude/agents/`)

Five specialized agents for different trading strategies:
- `kalshi-researcher` — weather model monitoring, forecast accuracy tracking
- `kalshi-experimenter` — controlled parameter optimization (sigma, edge, Kelly fraction)
- `kalshi-market-maker` — Avellaneda-Stoikov two-sided quoting
- `kalshi-arbitrage` — bucket overround, cross-city correlation, today/tomorrow spread scanning
- `kalshi-risk-manager` — fractional Kelly sizing, circuit breakers, daily P&L reporting

---

End of instructions.
