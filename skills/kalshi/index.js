import { getForecast, getAllForecasts } from './forecast.js';
import { scanWeatherMarkets, getCityWeatherEvent } from './markets.js';
import { findOpportunities } from './analyze.js';
import { executeTrade, getPositions, getBalance, getPerformance } from './trade.js';
import { checkSettlements, getTradeLog } from './settlement.js';
import { runScan, setMode, getStatus, getUsageAlert, getDailySummary } from './scanner.js';
import { getUsageStats } from './usage.js';

export { getForecast, getAllForecasts, scanWeatherMarkets, getCityWeatherEvent, findOpportunities, executeTrade, getPositions, getBalance, getPerformance, checkSettlements, getTradeLog, runScan, setMode, getStatus, getUsageAlert, getDailySummary, getUsageStats };

export default {
  name: 'WeatherTradingSkill',
  description: 'Automated weather prediction market trading on Kalshi using NOAA forecast data',
  functions: {
    getForecast,
    getAllForecasts,
    scanWeatherMarkets,
    getCityWeatherEvent,
    findOpportunities,
    executeTrade,
    getPositions,
    getBalance,
    getPerformance,
    checkSettlements,
    getTradeLog,
    runScan,
    setMode,
    getStatus,
    getUsageAlert,
    getDailySummary,
    getUsageStats,
  },
};
