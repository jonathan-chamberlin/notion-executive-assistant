import { logAction } from './client.js';

/**
 * Calculate position size using fractional Kelly criterion for binary markets.
 *
 * For a binary bet at price p (cents) with estimated probability q:
 *   kellyFraction = (q - p) / (100 - p) = edge / (100 - yesPrice)
 *   positionSize = bankroll * kellyFraction * kellyMultiplier
 *
 * @param {Object} params
 * @param {number} params.bankroll - Total available in cents
 * @param {number} params.edge - Edge in percentage points (forecastConfidence - marketPrice)
 * @param {number} params.yesPrice - Market YES price in cents (1-99)
 * @param {number} [params.kellyMultiplier=0.25] - Fraction of full Kelly (0.25 = quarter-Kelly)
 * @param {number} [params.maxTradeSize=500] - Hard cap per trade in cents
 * @param {number} [params.minTradeSize=5] - Minimum viable trade in cents
 * @returns {{ amount: number, kellyFraction: number, adjustedFraction: number, contracts: number, reason: string }}
 */
export function calculatePositionSize({
  bankroll,
  edge,
  yesPrice,
  kellyMultiplier = 0.25,
  maxTradeSize = 500,
  minTradeSize = 5,
}) {
  // No edge = no trade
  if (edge <= 0) {
    return { amount: 0, kellyFraction: 0, adjustedFraction: 0, contracts: 0, reason: 'no edge' };
  }

  // Invalid inputs
  if (bankroll <= 0) {
    return { amount: 0, kellyFraction: 0, adjustedFraction: 0, contracts: 0, reason: 'no bankroll' };
  }

  if (yesPrice <= 0 || yesPrice >= 100) {
    return { amount: 0, kellyFraction: 0, adjustedFraction: 0, contracts: 0, reason: 'invalid price' };
  }

  // Kelly formula for binary markets
  const kellyFraction = edge / (100 - yesPrice);
  const adjustedFraction = kellyFraction * kellyMultiplier;

  // Raw position size
  let amount = Math.floor(bankroll * adjustedFraction);

  // Apply constraints
  if (amount > maxTradeSize) {
    amount = maxTradeSize;
  }

  if (amount < minTradeSize) {
    // If Kelly says less than min trade, check if we can afford even 1 contract
    if (yesPrice <= maxTradeSize && yesPrice <= bankroll) {
      amount = yesPrice; // Minimum: 1 contract
    } else {
      return { amount: 0, kellyFraction, adjustedFraction, contracts: 0, reason: 'below minimum size' };
    }
  }

  const contracts = Math.floor(amount / yesPrice);
  if (contracts < 1) {
    return { amount: 0, kellyFraction, adjustedFraction, contracts: 0, reason: 'cannot afford 1 contract' };
  }

  // Actual amount is contracts * yesPrice (exact cost)
  amount = contracts * yesPrice;

  const reason = `Kelly ${(kellyFraction * 100).toFixed(1)}% × ${kellyMultiplier} = ${(adjustedFraction * 100).toFixed(1)}% of bankroll`;

  logAction('position_sized', { bankroll, edge, yesPrice, kellyFraction: Math.round(kellyFraction * 1000) / 1000, amount, contracts });

  return { amount, kellyFraction, adjustedFraction, contracts, reason };
}
