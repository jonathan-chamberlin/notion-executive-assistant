import { getForecast, getAllForecasts } from './forecast.js';
import { scanWeatherMarkets, getCityWeatherEvent } from './markets.js';
import { findOpportunities } from './analyze.js';
import { executeTrade, getPositions, getBalance, getPerformance } from './trade.js';
import { checkSettlements, getTradeLog } from './settlement.js';
import { runScan, setMode, getStatus, getUsageAlert, getDailySummary } from './scanner.js';
import { getUsageStats } from './usage.js';
import { getObservedHigh, getObservedHighs } from './observations.js';
import { calculatePositionSize } from './sizing.js';
import { getCalibrationReport, computeForecastErrors, computeCalibration } from './calibration.js';
import { checkCircuitBreakers } from './risk.js';
import { getEnsembleForecast, getAllEnsembleForecasts, ensembleBucketConfidence } from './ensemble.js';

export { getForecast, getAllForecasts, scanWeatherMarkets, getCityWeatherEvent, findOpportunities, executeTrade, getPositions, getBalance, getPerformance, checkSettlements, getTradeLog, runScan, setMode, getStatus, getUsageAlert, getDailySummary, getUsageStats, getObservedHigh, getObservedHighs, calculatePositionSize, getCalibrationReport, computeForecastErrors, computeCalibration, checkCircuitBreakers, getEnsembleForecast, getAllEnsembleForecasts, ensembleBucketConfidence };

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
    getObservedHigh,
    getObservedHighs,
    calculatePositionSize,
    getCalibrationReport,
    computeForecastErrors,
    computeCalibration,
    checkCircuitBreakers,
    getEnsembleForecast,
    getAllEnsembleForecasts,
    ensembleBucketConfidence,
  },
};
