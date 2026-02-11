# Kalshi Trading Bot: Research & Implementation Guide

> **Goal:** OpenClaw making money on Kalshi by 2/15/2026
> **Primary Strategy:** Weather Bot via Simmer SDK + OpenClaw
> **Repo:** Same repo as executive assistant (split later when working)

---

## 1. Master Plan Extraction

From `openclaw-master-plan.md` — Polymarket is identified as the **#1 money-making priority** after core integrations are verified.

### High-Alpha Automated Trading Strategies

| Strategy | Reported Returns | How It Works | Complexity |
|----------|-----------------|--------------|------------|
| **Polymarket Weather Bots** | 95% win rate, +51.7% ROI | GFS + ECMWF weather model data → bet on temperature/precipitation markets before odds adjust | Medium |
| **Crypto Orderbook Scanner** | $190K in 10 days (claimed) | Monitor exchange orderbooks for large imbalances → front-run price movements on Polymarket | High |
| **Wallet Copy-Trading** | $100 → $1,740 (17x) | Track 400-600 top-performing wallets hourly, mirror their trades automatically | Medium |
| **Latency Arbitrage** | $98K/day (claimed, likely exaggerated) | Pull exchange data (Binance, Coinbase) before Polymarket updates → bet on known outcomes | Very High |

**Reality check:** The highest claims ($98K/day, $190K in 10 days) are likely exaggerated or cherry-picked. The weather bot strategy is the most consistently documented and verifiable — weather data is public (GFS/ECMWF models), the edge is computational speed, and the markets are liquid enough.

### Phase 1 Build — Weather Bot

1. Skill that pulls GFS/ECMWF forecast data via public APIs
2. Compare forecast data against current Polymarket odds for weather markets
3. Identify mispriced contracts (model predicts >70% but market says <50%)
4. Place bets via Polymarket API (start with $5-10 per bet)
5. Track performance in Notion database

### Phase 2 Build — Wallet Tracker

1. Skill that monitors top-performing Polymarket wallets via their public API
2. Aggregate wallet activity (what are the best traders buying?)
3. Alert via Telegram when consensus among top wallets forms
4. Optional: auto-execute copy trades with position limits

### Priority Order

1. **Polymarket Weather Bot** — Most proven, verifiable edge, public data, start small ($50-100 bankroll)
2. **Freelance Arbitrage** — Low risk, leverages existing skills, immediate revenue potential
3. **UGC TikTok Shop** — Scalable but requires more setup and video tooling
4. **Content Repurposing Service** — Steady recurring revenue but slower to build client base

### ML Portfolio Relevance

The Polymarket weather bot doubles as an ML portfolio piece — it demonstrates time series forecasting, API integration, and automated decision-making. Directly relevant to the ML Engineer career path.

---

## 2. X.com Post Research

### [@PredictFolio](https://x.com/PredictFolio/status/2021067417208738022)

**What it is:** A free portfolio tracking and analysis platform for Polymarket traders.

**Key capabilities:**
- Real-time profit/loss data and volume metrics
- Portfolio size tracking and historical performance trends
- Performance comparison and benchmarking against other traders
- Useful for identifying profitable whales to copy-trade

**Why it matters:** Before building a copy-trading bot, you need to identify *who* to copy. PredictFolio provides the analytics layer to find consistently profitable traders and validate their performance before mirroring their trades.

### [@0xMovez](https://x.com/0xMovez/status/2021576597044679096)

**What it is:** A step-by-step guide to building a Polymarket weather trading bot using OpenClaw + Simmer SDK.

**The strategy:** Based on gopfan2's +$2M weather trading strategy. No need to snipe 0.01-0.15 cent odds — the bot finds the best opportunities automatically.

**5 Setup Steps:**
1. Install OpenClaw (`curl -fsSL https://molt.bot/install.sh | bash` then `openclaw onboard`)
2. Connect Telegram bot (@BotFather) + ChatGPT/API key
3. Create Simmer Markets account at simmer.markets, connect EVM wallet, deposit USDCe (Polygon) + POL + USDC (Base)
4. Install weather trading skill from Simmer SDK marketplace
5. Configure and go: cities, scan interval, max trade size, confidence threshold

**Default config:**
- Max value per trade: $5
- Cities: NYC, Chicago, Seattle, Atlanta, Dallas, Miami
- Market scan interval: every 10 minutes
- Trading logic: fetch NOAA forecast data, execute when confidence exceeds threshold

**Related Simmer SDK skills (6 total):**
- Weather trading via NOAA forecasts
- Copytrading of whale wallets
- Signal Sniper (RSS feed news trading)
- Trade Journal (auto-logging with calibration)
- Arbitrage Scanner (correlated market detection)
- X Sentiment analysis

Source: [Collava summary of 0xMovez guide](https://www.collava.app/c/renews/ai-openclaw/movez-no-x-how-to-run-polymarket-weather-trading-clawdbot-no-code-using-simmer-sdk-spartanlab-skill-base-x)

### [@thejayden](https://x.com/thejayden/status/2021286977857880298)

**What it is:** "Inside the Mind of a Polymarket BOT" — an analysis of how bots profit on BTC 15-minute markets.

**Key insight:** Bots profit **without predicting market direction.** They use a mathematical hedge-and-grind strategy:
- Wait for cheap opportunities on either side of binary markets
- Green YES buys appear when prices temporarily dip
- Pink NO buys cluster when sentiment flips
- Quantities remain closely balanced as a hedge
- Profit comes from mechanical execution, not prediction

**Why it matters:** This is a fundamentally different approach than the weather bot. Instead of using an informational edge (forecast data), this strategy exploits market microstructure — temporary mispricings that occur in fast-moving 15-minute binary markets.

Earlier related post: ["Inside the Mind of a Polymarket BOT"](https://x.com/thejayden/status/1996281508550877314)

### [@Argona0x](https://x.com/Argona0x/status/2021458639660126442)

**What it is:** Polymarket ecosystem analysis showing the scale of bot activity.

**Key stats:**
- 170+ third-party tools across 19 categories in the Polymarket ecosystem
- Bots achieve **85%+ win rates** and **$206K profits**
- Humans using similar strategies capture only ~$100K
- The bot advantage is speed, consistency, and 24/7 execution
- Some agents already achieving **98% accuracy** in short-term forecasting

**Why it matters:** The Polymarket ecosystem is mature enough that tooling exists for every strategy type. You don't need to build from scratch — assemble from existing components.

Source: [DeFi Prime ecosystem guide](https://defiprime.com/definitive-guide-to-the-polymarket-ecosystem)

### [@milesdeutscher](https://x.com/milesdeutscher/status/2021388743756874174)

**What it is:** Announcement of a public GitHub copy-trading bot that allows users to copy-trade Polymarket whales live.

**Key details:**
- Open-source repo available on GitHub
- Mirrors moves of high-stakes Polymarket players
- Lowers barriers to whale-strategy trading for retail users
- Built on Polygon blockchain infrastructure

**Cautions raised:**
- Whales can and do incur losses
- Bot relies on real-time data — slippage and Polygon network delays affect execution
- Copy-trading isn't foolproof

Source: [Blockchain News coverage](https://blockchain.news/flashnews/polymarket-whale-copy-trading-bot-released-on-github)

### [@polydao](https://x.com/polydao/status/2021415767611224239)

**What it is:** Copy-trading ecosystem hub and community for Polymarket automated trading.

**Key context:**
- Multiple open-source copy-trading repos now available on GitHub
- Tools like Stand.trade and Polycule available for tracking and copying whales
- Production-ready implementations exist in TypeScript/JavaScript with Docker support
- Common features: proportional position sizing, risk management, real-time monitoring

---

## 3. Proven Strategies (Ranked by Risk/Return)

From research across [datawallet.com](https://www.datawallet.com/crypto/top-polymarket-trading-strategies), [crypticorn.com](https://www.crypticorn.com/how-to-trade-polymarket-profitably-what-actually-works-in-2026/), and community analysis:

### Near-Zero Risk (Arbitrage)

| Strategy | Return | How It Works |
|----------|--------|--------------|
| **Binary Complement Arbitrage** | ~2% per bundle | Buy YES + NO when combined cost < $1.00. Guaranteed profit. Requires real-time market depth tracking. |
| **Multi-Outcome Bundle Arbitrage** | ~3% per bundle | Same concept across multi-option markets. All outcomes sum below $1 = riskless profit. |
| **Cross-Platform Arbitrage** | 7.5% in <1hr | Buy YES on one platform, NO on another when prices diverge. Guaranteed $1 payout. Account for bridge fees. |

### Low Risk (Edge Strategies)

| Strategy | Return | How It Works |
|----------|--------|--------------|
| **Weather Bot** | 95% win rate, +51.7% ROI | Forecast data vs market odds. Bet when model confidence exceeds market price significantly. |
| **"Favorite" Compounder** | ~5.2% yield in 72hrs | Bet on 90%+ implied outcomes when real-world data suggests near-certainty. Compound incrementally. |
| **Rules/Settlement-Edge** | 2%+ | Trade resolution criteria, not headlines. Convert rules into probability trees. |
| **Mention Market "No" Bias** | 42%+ | Target phrase-specific markets where YES is overpriced. Review speaker transcripts for documented usage. |

### Moderate Risk

| Strategy | Return | How It Works |
|----------|--------|--------------|
| **Whale Copy-Trading** | 74%+ win rate | Mirror top wallet trades. Filter for consistent performers, not one-hit wonders. |
| **Catalyst Momentum** | Varies | Trade rapid repricing after breaking news. Requires speed. Edges decay quickly. |
| **Term-Structure Spreads** | Varies | Compare same-theme markets with different expirations. Buy underpriced date, sell overpriced. |
| **Correlation Hedging** | Basis reversion | Use correlated markets to hedge, isolate relative value. Regime changes create losses. |

### High Risk / High Complexity

| Strategy | Return | How It Works |
|----------|--------|--------------|
| **15-Min Crypto Markets** | High volume ($100K+ fees/day) | Bet BTC/ETH/SOL up/down in 15-min windows. Launched Jan 2026. Extremely competitive. |
| **Latency Arbitrage** | Claimed $98K/day | Exploit price lag between exchanges (Binance/Coinbase) and Polymarket. Requires ultra-low latency. |

**Key stat:** Only **16.8% of all Polymarket wallets show net gain.** Bots capture approximately **$40M annually** in profits. The edge goes to systematic, automated strategies.

---

## 4. Weather Bot Technical Architecture (Primary Strategy)

### Stack

| Component | Tool | Notes |
|-----------|------|-------|
| Agent framework | OpenClaw (already installed) | Handles messaging, scheduling, skill execution |
| Trading skills | Simmer SDK | Pre-built Python modules for weather, copy-trade, arbitrage |
| Weather data | NOAA GFS/ECMWF APIs | Public, free, updated every 6 hours |
| Market data | Polymarket CLOB API | `https://clob.polymarket.com`, Polygon chain ID 137 |
| Order execution | `py-clob-client` (PyPI) | Official Python client for Polymarket CLOB |
| Messaging | Telegram bot | Already planned in master plan config |
| Tracking | Notion database | Existing skill in `skills/notion/` |

### How the Weather Bot Works

```
NOAA Forecast Data (every 10 min)
    │
    ▼
Map to market buckets ("34-35°F NYC tomorrow")
    │
    ▼
Compare: model confidence vs Polymarket odds
    │
    ▼
If model > 70% AND market < 50% → BUY
    │
    ▼
Execute via Polymarket CLOB API ($5 max/trade)
    │
    ▼
Log trade to Notion + alert via Telegram
```

### Setup Steps (0xMovez / Simmer SDK Approach)

**Step 1: Install OpenClaw** (if not already)
```bash
curl -fsSL https://molt.bot/install.sh | bash
openclaw onboard
# Select: Quick Start → OpenAI with ChatGPT OAuth
```

**Step 2: Connect Telegram**
- Message @BotFather → `/newbot` → copy API token
- Send bot a message to generate pairing code
- Input credentials into terminal

**Step 3: Set Up Simmer Markets**
1. Visit simmer.markets and connect EVM wallet (MetaMask or similar)
2. Deposit:
   - USDCe on Polygon (for trading)
   - POL on Polygon (for gas)
   - USDC on Base (if using Base markets)
3. Navigate to Agent tab → OpenClaw → Overview
4. Select manual installation, copy the provided code message
5. Send message to your Telegram bot to receive registration link
6. Complete wallet connection

**Step 4: Install Weather Trading Skill**
1. Browse Simmer Markets skill marketplace
2. Copy installation command for weather trading skill
3. Send to bot via Telegram
4. Skill installs automatically

**Step 5: Configure**
- Max trade size: $5 (start conservative)
- Cities: NYC, Chicago, Seattle, Atlanta, Dallas, Miami
- Scan interval: every 10 minutes
- Confidence threshold: configurable (default uses gopfan2's parameters)

### Polymarket API Details

| Detail | Value |
|--------|-------|
| CLOB endpoint | `https://clob.polymarket.com` |
| Chain | Polygon (chain ID 137) |
| Python client | `pip install py-clob-client` |
| Signature types | 0 = EOA/MetaMask, 1 = Magic/email, 2 = Gnosis/browser |
| Wallet funding | USDC on Polygon |
| Gas token | POL (formerly MATIC) |
| Official docs | https://docs.polymarket.com/developers/CLOB/quickstart |

---

## 5. Open-Source Tools & Repos

### Official Polymarket

| Repo | Description | URL |
|------|------------|-----|
| `Polymarket/agents` | Official AI agent framework for autonomous trading | https://github.com/Polymarket/agents |
| `Polymarket/py-clob-client` | Official Python CLOB client | https://github.com/Polymarket/py-clob-client |
| Polymarket Docs | API documentation & quickstart | https://docs.polymarket.com |

### Copy-Trading Bots

| Repo | Description | URL |
|------|------------|-----|
| `Trust412/polymarket-copy-trading-bot-version-3` | Mirrors target wallet positions every 4s. Customizable risk management. | https://github.com/Trust412/polymarket-copy-trading-bot-version-3 |
| `dexorynlabs/polymarket-copy-trading-bot-v2.0` | Another copy-trade option | https://github.com/dexorynlabs/polymarket-copy-trading-bot-v2.0 |
| `lorine93s/polymarket-copy-trading-bot` | TypeScript + Docker, proportional sizing | https://github.com/lorine93s/polymarket-copy-trading-bot |
| `iengineer/polymarket-whale-trading-bot` | Whale tracking + adaptive take-profit + trailing stop | https://github.com/iengineer/polymarket--whale-trading-bot |
| `Novus-Tech-LLC/Polymarket-Copytrading-Bot` | Low latency, high reliability | https://github.com/Novus-Tech-LLC/Polymarket-Copytrading-Bot |

### Trading Bots (Other Strategies)

| Repo | Description | URL |
|------|------------|-----|
| `Trust412/Polymarket-spike-bot-v1` | HFT spike detection, real-time price monitoring | https://github.com/Trust412/Polymarket-spike-bot-v1 |
| `lorine93s/polymarket-market-maker-bot` | Market making, inventory management, spread capture | https://github.com/lorine93s/polymarket-market-maker-bot |
| `djienne/Polymarket-bot` | HFT with Kelly Criterion position sizing | https://github.com/djienne/Polymarket-bot |

### Analytics & Tracking

| Tool | Description | URL |
|------|------------|-----|
| PredictFolio | Portfolio tracking, whale identification | https://x.com/PredictFolio |
| Simmer SDK | No-code skills: weather, copy-trade, arbitrage, sentiment | https://simmer.markets |
| Polymarket CLOB Quickstart | Official API docs | https://docs.polymarket.com/developers/CLOB/quickstart |

---

## 6. Legal & Risk

### US Person Restrictions (For Awareness)

- Polymarket's ToS technically restricts US persons from API trading
- In practice: thousands of US-based users openly build and share Polymarket bots on X.com and GitHub
- Polymarket itself publishes `Polymarket/agents` — an official autonomous trading framework
- Simmer SDK openly markets turnkey Polymarket bots to a global audience
- The restriction applies to Polymarket specifically — **Kalshi** (https://kalshi.com) is a CFTC-regulated, US-legal prediction market with API access

### Financial Risk

- Only **16.8% of Polymarket wallets show net gain** across all traders
- "95% win rate" claims are on specific market types (weather) with small edges per trade
- The bot that turned $313 → $438K is an extreme outlier, not typical
- Weather bot strategy has a documented edge but small per-trade profit margins
- Black swan events can wipe gains from "favorite" compounding strategies

### Risk Management Rules

- Start with **$50-100 maximum bankroll**
- Max **$5 per trade** until strategy is proven
- Set **hard position limits** — never more than 20% of bankroll on one market
- Track every trade in Notion
- Review performance daily for the first 2 weeks
- Scale up only after 50+ trades with positive expectancy

### Alternatives

| Platform | Legal Status | API | Notes |
|----------|-------------|-----|-------|
| **Kalshi** | US-legal, CFTC-regulated | Yes | **HAS weather markets** (temp + precipitation). Best US-legal option. See Section 8. |
| **Paper trading** | N/A | N/A | Run the bot with simulated capital to prove strategy before risking real money |
| **Portfolio project** | N/A | N/A | Build the ML forecasting pipeline without live trading — still a strong ML portfolio piece |

---

## 7. Implementation Roadmap (Updated 2/11)

### Done (2/11)

- [x] Create research document with all X.com post findings
- [x] Research Polymarket weather markets (live, 7 cities, slug-based API)
- [x] Research Kalshi as US-legal alternative
- [x] Research Simmer SDK (alpha/invite-only)
- [x] Build `skills/kalshi/` skill — full analysis pipeline
- [x] Verify NOAA + Open-Meteo forecasts for all 7 cities
- [x] Verify Polymarket Gamma API returns live weather markets with prices
- [x] End-to-end test: forecasts → market scan → opportunity detection → 8 edges found

### Next: Account & Wallet Setup

- [ ] Create Polymarket account at polymarket.com
- [ ] Set up EVM wallet (MetaMask, Rabby, or hardware wallet)
- [ ] Fund Polygon wallet: USDC.e (trading capital) + POL (gas)
- [ ] Derive CLOB API credentials from wallet (API key, secret, passphrase)

### Next: Wire Up Trading

- [ ] `pnpm add @polymarket/clob-client` — install official CLOB client
- [ ] Implement real trade execution in `trade.js` (replace stub)
- [ ] Set env vars: POLYMARKET_PRIVATE_KEY, API_KEY, API_SECRET, API_PASSPHRASE
- [ ] Test with $1-2 trade on a high-confidence bucket

### Then: Go Live & Monitor

- [ ] Run bot with $5 max/trade, scan every 10 minutes
- [ ] Monitor first 12 hours manually
- [ ] Track trades in Notion
- [ ] Review overnight performance
- [ ] If profitable: scale to $10/trade

---

## 8. Kalshi: US-Legal Alternative with Weather Markets

**Why this matters:** Kalshi is a CFTC-regulated prediction market that is **fully legal for US persons**. It has weather markets identical to Polymarket's, and the Simmer SDK supports it natively.

### Kalshi Weather Markets

| Detail | Info |
|--------|------|
| **Available cities** | NYC, LA, Chicago (and more) |
| **Contract types** | Temperature (high temp, temp ranges) and Precipitation |
| **Settlement source** | National Weather Service (NWS) Daily Climate Report — released next morning |
| **Resolution** | Next-morning settlement based on NWS data. Consumer weather apps do NOT determine outcomes. |
| **DST note** | During Daylight Saving Time, temps recorded using local standard time (high may be recorded 1:00 AM - 12:59 AM next day) |

### Kalshi API

| Detail | Info |
|--------|------|
| **API type** | REST + WebSocket + FIX 4.4 |
| **Base URL** | `https://api.elections.kalshi.com/trade-api/v2` (covers ALL markets, not just elections) |
| **Auth** | API key ID + private key |
| **Official Python client** | `pip install kalshi-python` (v2.1.4) |
| **Best third-party client** | `pip install pykalshi` — adds real-time data, error recovery, production infrastructure |
| **Async option** | `pip install aiokalshi` — asyncio-native, no auth required for read-only |
| **Docs** | https://docs.kalshi.com/welcome |

### Kalshi Trading Bots (Open Source)

| Repo | Description |
|------|------------|
| `ryanfrigo/kalshi-ai-trading-bot` | AI-powered with Grok-4 integration, multi-agent decision making, portfolio optimization |
| `OctagonAI/kalshi-deep-trading-bot` | Uses Octagon Deep Research + OpenAI for structured betting |
| `akshatgurbuxani/Kalshi-Weather-Forecasting-Financial-Trading` | Weather forecasting Jupyter notebook for Kalshi trading |

### Kalshi vs Polymarket for Weather Bots

| Factor | Kalshi | Polymarket |
|--------|--------|-----------|
| **US Legal** | Yes (CFTC-regulated) | No (ToS prohibits US API trading) |
| **Weather markets** | Yes | Yes |
| **Settlement** | NWS Daily Climate Report | Similar (NOAA/NWS) |
| **API maturity** | REST + WebSocket + FIX | REST + WebSocket (CLOB) |
| **Python clients** | `kalshi-python`, `pykalshi`, `aiokalshi` | `py-clob-client` |
| **Liquidity** | Lower than Polymarket | Higher |
| **Simmer SDK support** | Yes (via Solana/DFlow) | Yes (via Polygon) |

**Recommendation:** Start with **Kalshi for US-legal safety**, and add Polymarket later for more liquidity. The weather bot logic is identical — only the API layer changes.

---

## 9. Simmer SDK Deep-Dive

**What it is:** A Python SDK from Spartan Labs that abstracts trading across multiple prediction markets (Polymarket, Kalshi, and Simmer's own virtual market).

### Installation

```bash
# Base SDK
pip install simmer-sdk

# For Polymarket (real money on Polygon)
pip install eth-account py-order-utils py-clob-client

# For Kalshi (real money on Solana via DFlow)
cd /path/to/simmer-sdk && npm install
```

### Authentication

- **API Key:** Invite-only from simmer.markets (alpha access)
- **Polymarket:** EVM wallet private key + USDC.e + POL on Polygon
- **Kalshi:** Solana wallet + USDC + SOL

### Environment Variables

```
SIMMER_PRIVATE_KEY=0x...     # EVM wallet for Polymarket
SIMMER_SOLANA_KEY=...        # Solana wallet for Kalshi
```

### Code Examples

```python
# Virtual training mode ($SIM currency, no real money)
from simmer_sdk import SimmerClient
client = SimmerClient(api_key="sk_live_...", venue="simmer")
client.trade(market_id="...", side="yes", amount=10)

# Real trading on Polymarket
client = SimmerClient(
    api_key="sk_live_...",
    venue="polymarket",
    private_key="0x..."
)
client.ensure_approvals()  # Check token approvals first
result = client.trade(market_id="...", side="yes", amount=10.0)

# Real trading on Kalshi
client = SimmerClient(
    api_key="sk_live_...",
    venue="kalshi",
    solana_key="..."
)
result = client.trade(market_id="...", side="yes", amount=10.0)
```

### Trading Venues

| Venue | Currency | Blockchain | Use |
|-------|----------|-----------|-----|
| `"simmer"` | $SIM (virtual) | N/A | Practice/training |
| `"polymarket"` | USDC.e | Polygon | Real money |
| `"kalshi"` | USDC | Solana (DFlow) | Real money, US-legal |

### Limits (Alpha)

- **$100 per trade maximum**
- **$500 daily maximum**
- Alpha access only — requires invite API key

### Available Skills (via OpenClaw integration)

1. **Weather Trader** — gopfan2-style temperature bets via NOAA
2. **Copytrading** — follow top wallets automatically
3. **Signal Sniper** — trade on RSS feed news
4. **Trade Journal** — auto-logging with calibration
5. **Arbitrage Scanner** — correlated market detection
6. **X Sentiment** — trade based on Twitter/X sentiment analysis

Source: [Simmer SDK GitHub](https://github.com/SpartanLabsXyz/simmer-sdk), [Simmer Markets](https://www.simmer.markets/dashboard?tab=openclaw)

---

## 10. Current Build Status & What's Left

### What's Built (at `skills/kalshi/`)

The weather trading skill is built and the full analysis pipeline works end-to-end:

- **`client.js`** — API clients for Gamma (market data), NOAA (US forecasts), Open-Meteo (international forecasts). Config for 7 cities, position limits, daily spend tracking.
- **`forecast.js`** — Fetches NOAA forecasts for NYC/Atlanta/Dallas, Open-Meteo for London/Toronto/Seoul/Ankara. Returns high temps in °F for today + tomorrow.
- **`markets.js`** — Scans Polymarket weather markets via Gamma API using slug-based lookups. Parses °F ranges, °C single-degree buckets, negative temps. Normalizes prices (raw YES prices sum >100% across buckets).
- **`analyze.js`** — Compares forecast confidence vs normalized market prices. Uses normal distribution (σ=3°F) to calculate bucket probabilities. Returns sorted opportunities with edge calculations.
- **`trade.js`** — **STUB** — has the API structure but needs real CLOB authentication (EIP-712 signing).
- **`scripts/test-kalshi.js`** — End-to-end test script that runs the full pipeline.

**Tested and verified (Feb 11, 2026):**
- All 7 cities' forecasts fetch successfully
- All 14 events (7 cities × today + tomorrow) found with live prices
- 8 opportunities detected with ≥15% edge (e.g., Seoul ≥45°F: Model 87% vs Market 50% = +37% edge)

### What's Needed to Go Live

1. **Polymarket account** — Create account at polymarket.com
2. **Polygon wallet** — Fund with USDC.e (for trading) + POL (for gas)
3. **Derive CLOB API credentials** — Use wallet to generate: API key, API secret, API passphrase
4. **Install CLOB client** — `pnpm add @polymarket/clob-client` for EIP-712 order signing
5. **Set env vars** — `POLYMARKET_PRIVATE_KEY`, `POLYMARKET_API_KEY`, `POLYMARKET_API_SECRET`, `POLYMARKET_API_PASSPHRASE`
6. **Wire up trade.js** — Replace stub with real CLOB client calls

### Fallback: Kalshi (US-Legal Alternative)

If Polymarket's US restrictions become a blocker:
- Kalshi is CFTC-regulated, explicitly US-legal
- Has weather markets (temperature, precipitation)
- API with Python client (`kalshi-python` on PyPI)
- The forecast + analysis code is platform-agnostic — only `trade.js` and market scanning would change

---

## Sources

### Articles
- [Polymarket Strategies: 2026 Guide (CryptoNews)](https://cryptonews.com/cryptocurrency/polymarket-strategies/)
- [Top 10 Polymarket Trading Strategies (DataWallet)](https://www.datawallet.com/crypto/top-polymarket-trading-strategies)
- [How to Trade Polymarket Profitably in 2026 (Crypticorn)](https://www.crypticorn.com/how-to-trade-polymarket-profitably-what-actually-works-in-2026/)
- [The Complete Polymarket Playbook (Medium)](https://medium.com/thecapital/the-complete-polymarket-playbook-finding-real-edges-in-the-9b-prediction-market-revolution-a2c1d0a47d9d)
- [Definitive Guide to the Polymarket Ecosystem (DeFi Prime)](https://defiprime.com/definitive-guide-to-the-polymarket-ecosystem)
- [Trading Bot Turns $313 into $438K (Finbold)](https://finbold.com/trading-bot-turns-313-into-438000-on-polymarket-in-a-month/)
- [Arbitrage Bots Dominate Polymarket (BeInCrypto)](https://beincrypto.com/arbitrage-bots-polymarket-humans/)
- [Polymarket Bot Setup Tutorial (TradingVPS)](https://tradingvps.io/polymarket-trading-bot-setup-tutorial/)
- [Polymarket Copy Trading Bot Guide (TradingVPS)](https://tradingvps.io/polymarket-copy-trading-bot/)
- [Polymarket Price Prediction Bot Development (Coinmonks/Medium)](https://medium.com/coinmonks/polymarket-price-prediction-bot-development-a-complete-guide-for-2026-111a2ce61555)
- [0xMovez Weather Bot Guide (Collava)](https://www.collava.app/c/renews/ai-openclaw/movez-no-x-how-to-run-polymarket-weather-trading-clawdbot-no-code-using-simmer-sdk-spartanlab-skill-base-x)

### X.com Posts
- [@PredictFolio — Portfolio tracking platform](https://x.com/PredictFolio/status/2021067417208738022)
- [@0xMovez — Weather bot setup guide](https://x.com/0xMovez/status/2021576597044679096)
- [@thejayden — Inside the Mind of a Polymarket BOT](https://x.com/thejayden/status/2021286977857880298)
- [@Argona0x — Ecosystem stats](https://x.com/Argona0x/status/2021458639660126442)
- [@milesdeutscher — Copy-trading bot announcement](https://x.com/milesdeutscher/status/2021388743756874174)
- [@polydao — Copy-trading ecosystem](https://x.com/polydao/status/2021415767611224239)

### Master Plan Sources
- [@LeonidShturworker — Polymarket weather bot, 95% win rate](https://x.com/LeonidShturworker/status/1925325959533842647)
- [@0xdiid — Crypto orderbook scanner, $190K in 10 days](https://x.com/0xdiid/status/1924913296995393977)
- [@ZoomerOracle — Wallet copy-trading, $100→$1,740](https://x.com/ZoomerOracle/status/1922367244622614627)
- [@LookOnchain — Latency arbitrage, $98K/day](https://x.com/LookOnchain/status/1910672710515573203)
- [@ClayTrading — High-speed crypto trading](https://x.com/ClayTrading/status/1910396627769643484)
- [@EasyEatsBodega — Fiverr/Upwork AI freelance arbitrage](https://x.com/EasyEatsBodega/status/1908386556512657692)

### Technical Docs — Polymarket
- [Polymarket CLOB API Quickstart](https://docs.polymarket.com/developers/CLOB/quickstart)
- [py-clob-client (PyPI)](https://pypi.org/project/py-clob-client/)
- [Polymarket/agents (GitHub)](https://github.com/Polymarket/agents)

### Technical Docs — Kalshi
- [Kalshi API Documentation](https://docs.kalshi.com/welcome)
- [Kalshi Weather Markets](https://help.kalshi.com/markets/popular-markets/weather-markets)
- [Kalshi Climate/Weather Category](https://kalshi.com/category/climate)
- [kalshi-python (PyPI)](https://pypi.org/project/kalshi-python/)
- [pykalshi (GitHub)](https://github.com/ArshKA/pykalshi)
- [aiokalshi — async client (GitHub)](https://github.com/the-odds-company/aiokalshi)
- [Kalshi Weather Forecasting Trading Notebook](https://github.com/akshatgurbuxani/Kalshi-Weather-Forecasting-Financial-Trading)
- [Kalshi AI Trading Bot (GitHub)](https://github.com/ryanfrigo/kalshi-ai-trading-bot)
- [Kalshi Deep Trading Bot (GitHub)](https://github.com/OctagonAI/kalshi-deep-trading-bot)
- [Kalshi Official Tools & Analysis](https://github.com/Kalshi/tools-and-analysis)

### Technical Docs — Simmer SDK
- [Simmer SDK (GitHub)](https://github.com/SpartanLabsXyz/simmer-sdk)
- [Simmer SDK (PyPI)](https://pypi.org/project/simmer-sdk/)
- [Simmer Markets Dashboard](https://www.simmer.markets/dashboard?tab=openclaw)
- [Spartan Labs — SDK announcement](https://x.com/TheSpartanLabs/status/2016713865149763796)
