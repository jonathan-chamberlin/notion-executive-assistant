#!/usr/bin/env node
/**
 * Quick end-to-end test: find cheapest opportunity and place 1 contract.
 */
import 'dotenv/config';
import { findOpportunities } from '../skills/kalshi/analyze.js';
import { executeTrade, getBalance, getPositions } from '../skills/kalshi/trade.js';

// 1. Check balance before
const balBefore = await getBalance();
console.log('Balance before:', balBefore.balance.available, '¢');

// 2. Find opportunities
const result = await findOpportunities({ minEdge: 20 });
if (!result.success) {
  console.log('Scan failed:', result.error);
  process.exit(1);
}

console.log(`Found ${result.opportunities.length} opportunities`);

if (result.opportunities.length === 0) {
  console.log('No opportunities — nothing to test');
  process.exit(0);
}

// 3. Pick cheapest (by market price, prefer higher-priced for better fill)
// For a test, use the opportunity with lowest market price (1¢) and buy just 1 contract
const sorted = result.opportunities.sort((a, b) => a.marketPrice - b.marketPrice);
const pick = sorted[0];

console.log('\nSelected opportunity:');
console.log(`  City: ${pick.city}`);
console.log(`  Bucket: ${pick.bucket.low ?? '≤'}${pick.bucket.low != null && pick.bucket.high != null ? '-' : ''}${pick.bucket.high ?? '≥'}°F`);
console.log(`  Confidence: ${pick.forecastConfidence}% (${pick.confidenceSource})`);
console.log(`  Market price: ${pick.marketPrice}¢`);
console.log(`  Edge: +${pick.edge}pp`);
console.log(`  Ticker: ${pick.ticker}`);

// 4. Place 1 contract at market price + 1¢ (minimum possible trade)
const tradePrice = pick.marketPrice + 1;
console.log(`\nPlacing: 1 contract YES @ ${tradePrice}¢ on ${pick.ticker}`);

const tradeResult = await executeTrade({
  ticker: pick.ticker,
  side: 'yes',
  amount: tradePrice, // 1 contract costs tradePrice cents
  yesPrice: tradePrice,
  opportunity: pick,
});

if (tradeResult.success) {
  console.log('Trade SUCCESS');
  console.log(`  Order ID: ${tradeResult.trade.orderId}`);
  console.log(`  Contracts: ${tradeResult.trade.count}`);
  console.log(`  Price: ${tradeResult.trade.yesPrice}¢`);
} else {
  console.log('Trade FAILED:', tradeResult.error);
}

// 5. Check balance after
const balAfter = await getBalance();
console.log(`\nBalance after: ${balAfter.balance.available}¢`);
console.log(`Cost: ${balBefore.balance.available - balAfter.balance.available}¢`);

// 6. Check positions
const positions = await getPositions();
if (positions.success) {
  const match = positions.positions.find(p => p.ticker === pick.ticker);
  if (match) {
    console.log(`\nPosition confirmed: ${match.ticker} — ${match.count} contracts`);
  } else {
    console.log('\nPosition not found (order may be pending fill)');
  }
}

console.log('\nEnd-to-end test complete.');
