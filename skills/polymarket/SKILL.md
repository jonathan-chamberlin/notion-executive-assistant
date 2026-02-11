---
name: polymarket
description: Automated weather prediction market trading on Kalshi using NOAA forecast data
---

# WeatherTradingSkill (Kalshi)

Trade weather prediction markets on Kalshi by comparing NOAA forecast data against market odds. When forecasts show high confidence but market prices are low, the bot identifies mispriced contracts and can execute trades.

## Status

- **Forecasting**: Working (NOAA NWS API for all 9 US cities)
- **Market scanning**: Working (Kalshi public events API, event ticker lookup)
- **Opportunity detection**: Working (normal distribution model, σ=3°F)
- **Trade execution**: Ready (Kalshi REST API with RSA-PSS authentication)

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

Markets settle based on official weather station data.

## Strategy

1. Fetch NOAA forecasts for all 9 cities (today + tomorrow)
2. Calculate probability distribution across temperature buckets using normal distribution (σ=3°F)
3. Compare forecast confidence to mid-market prices (average of yes_bid and yes_ask)
4. Buy YES when forecast confidence significantly exceeds market price (edge > 20%)
5. Small position sizes ($5) across multiple cities for diversification

## Functions

### Data

- `getAllForecasts()` — fetch NOAA forecasts for all 9 cities
- `getForecast(city)` — fetch forecast for one city
- `scanWeatherMarkets()` — fetch today + tomorrow events for all cities with live prices
- `getCityWeatherEvent(city, date)` — fetch specific city/date event

### Analysis

- `findOpportunities({ minEdge })` — full pipeline: forecasts + markets + compare = edges
- `temperatureBucketConfidence(forecastTemp, bucketLow, bucketHigh)` — calculate model probability

### Trading

- `executeTrade({ ticker, side, amount, yesPrice })` — place limit order on Kalshi
- `getPositions()` — list open positions
- `getBalance()` — get account balance
- `getPerformance()` — daily budget + balance summary

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `cities` | NYC, Chicago, Miami, Austin, LA, Philadelphia, DC, Denver, SF | Cities to monitor |
| `scanInterval` | 10 min | How often to check for opportunities |
| `maxTradeSize` | $5 | Maximum per-trade amount |
| `maxDailySpend` | $50 | Maximum daily trading volume |
| `minEdge` | 0.20 | Minimum forecast-vs-market edge to trigger trade |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `KALSHI_API_KEY_ID` | Yes | Kalshi API key ID (from kalshi.com/account/api-keys) |
| `KALSHI_PRIVATE_KEY_PATH` | Yes* | Path to RSA private key PEM file |
| `KALSHI_PRIVATE_KEY_PEM` | Yes* | RSA private key PEM content (alternative to path) |
| `NOAA_USER_AGENT` | No | User-agent for NOAA API (recommended: your email) |

*One of KALSHI_PRIVATE_KEY_PATH or KALSHI_PRIVATE_KEY_PEM is required.

## Cities

| City | Series Ticker | NOAA Gridpoint | Market Units |
|------|--------------|----------------|-------------|
| NYC | KXHIGHNY | OKX/33,37 | °F |
| Chicago | KXHIGHCHI | LOT/76,73 | °F |
| Miami | KXHIGHMIA | MFL/110,50 | °F |
| Austin | KXHIGHAUS | EWX/156,91 | °F |
| LA | KXHIGHLAX | LOX/154,44 | °F |
| Philadelphia | KXHIGHPHIL | PHI/57,97 | °F |
| DC | KXHIGHTDC | LWX/97,71 | °F |
| Denver | KXHIGHDEN | BOU/62,60 | °F |
| SF | KXHIGHTSFO | MTR/85,105 | °F |

## Safety Rules

1. **Hard position limits** — never exceed `maxTradeSize` per trade or `maxDailySpend` per day
2. **No market-making** — directional YES buying only
3. **Log all trades** — every action logged to console with timestamps
4. **Fail safely** — if any API call fails, skip trade, never retry blindly
5. **RSA-PSS authentication** — all trading calls use cryptographic signatures

## Authentication

Kalshi uses RSA-PSS signing for API authentication:
1. Generate RSA key pair on kalshi.com/account/api-keys
2. Save private key as PEM file (`.gitignore` already covers `*.pem`)
3. Set `KALSHI_API_KEY_ID` and `KALSHI_PRIVATE_KEY_PATH` in `.env`
4. Signature: `RSA-SHA256-PSS(timestamp + METHOD + path)` with salt length = digest length
