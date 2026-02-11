import { CONFIG } from './config.js';
import { kalshiAuthFetch, logAction, formatApiError } from './client.js';
import { canAffordTrade, trackSpend, getRemainingDailyBudget } from './budget.js';

/**
 * Validate trade inputs. Returns an error string if invalid, or null if valid.
 */
function validateTradeInputs({ ticker, side, amount, yesPrice }) {
  if (!ticker) return 'ticker is required (Kalshi market ticker)';
  if (!side || !['yes', 'no'].includes(side.toLowerCase())) return 'side must be "yes" or "no"';
  if (!amount || amount <= 0) return 'amount must be positive';
  if (!yesPrice || yesPrice < 1 || yesPrice > 99) return 'yesPrice must be between 1 and 99 cents';
  return null;
}

/**
 * Calculate contract count from dollar amount and price.
 * Returns { count } or { error }.
 */
function calculateContractCount(amount, yesPrice) {
  const count = Math.floor((amount * 100) / yesPrice);
  if (count < 1) {
    return { error: `Amount $${amount} too small for price ${yesPrice}¢ (need at least $${(yesPrice / 100).toFixed(2)})` };
  }
  return { count };
}

/**
 * Execute a trade on Kalshi.
 * Places a limit order to buy YES or NO contracts on a specific market.
 *
 * @param {Object} params
 * @param {string} params.ticker - Market ticker (e.g., "KXHIGHNY-26FEB12-B36.5")
 * @param {string} params.side - "yes" or "no"
 * @param {number} params.amount - Dollar amount to spend
 * @param {number} [params.yesPrice] - Limit price in cents (1-99). If buying YES, this is your max price.
 */
export async function executeTrade({ ticker, side, amount, yesPrice }) {
  const inputError = validateTradeInputs({ ticker, side, amount, yesPrice });
  if (inputError) return { success: false, error: inputError };

  if (amount > CONFIG.maxTradeSize) {
    return { success: false, error: `Trade amount $${amount} exceeds max trade size $${CONFIG.maxTradeSize}` };
  }
  if (!canAffordTrade(amount)) {
    const remaining = getRemainingDailyBudget();
    return { success: false, error: `Daily budget exceeded. Remaining: $${remaining.toFixed(2)}` };
  }

  const { count, error: countError } = calculateContractCount(amount, yesPrice);
  if (countError) return { success: false, error: countError };

  try {
    const order = { ticker, action: 'buy', side: side.toLowerCase(), count, type: 'limit', yes_price: yesPrice };
    logAction('trade_submitting', { ticker, side: side.toLowerCase(), count, yesPrice, amount });

    const result = await kalshiAuthFetch('POST', '/portfolio/orders', order);

    const actualCost = (result.order?.yes_price || yesPrice) * count / 100;
    trackSpend(actualCost);

    const trade = {
      orderId: result.order?.order_id, ticker, side: side.toLowerCase(), count, yesPrice,
      cost: actualCost, status: result.order?.status || 'submitted', timestamp: new Date().toISOString(),
    };
    logAction('trade_executed', trade);
    return { success: true, trade };
  } catch (error) {
    logAction('trade_error', { ticker, side, amount, error: error.message });
    return { success: false, error: formatApiError(error) };
  }
}

/**
 * Get current positions on Kalshi.
 */
export async function getPositions() {
  try {
    const data = await kalshiAuthFetch('GET', '/portfolio/positions');

    const positions = (data.market_positions || []).map(p => ({
      ticker: p.ticker,
      marketTitle: p.market_title,
      yesCount: p.position,
      avgYesPrice: p.market_exposure,
      realizedPnl: p.realized_pnl,
      restingOrderCount: p.resting_orders_count,
    }));

    logAction('positions_fetched', { count: positions.length });
    return { success: true, positions };

  } catch (error) {
    logAction('positions_error', { error: error.message });
    return { success: false, error: formatApiError(error) };
  }
}

/**
 * Get Kalshi account balance.
 */
export async function getBalance() {
  try {
    const data = await kalshiAuthFetch('GET', '/portfolio/balance');

    logAction('balance_fetched', { balance: data.balance });
    return {
      success: true,
      balance: {
        available: (data.balance || 0) / 100,        // cents to dollars
        payout: (data.payout || 0) / 100,
      },
    };

  } catch (error) {
    logAction('balance_error', { error: error.message });
    return { success: false, error: formatApiError(error) };
  }
}

/**
 * Get performance summary.
 */
export async function getPerformance() {
  const balanceResult = await getBalance().catch(() => null);

  return {
    success: true,
    performance: {
      dailyBudgetRemaining: getRemainingDailyBudget().toFixed(2),
      maxTradeSize: CONFIG.maxTradeSize,
      maxDailySpend: CONFIG.maxDailySpend,
      kalshiBalance: balanceResult?.success ? balanceResult.balance : 'Unable to fetch (check credentials)',
    },
  };
}
