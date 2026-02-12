import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkCircuitBreakers } from '../risk.js';

describe('checkCircuitBreakers', () => {
  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  it('no trades → canTrade: true', () => {
    const result = checkCircuitBreakers([], { maxDailySpend: 1000 });
    assert.equal(result.canTrade, true);
    assert.equal(result.reasons.length, 0);
  });

  it('daily loss triggers breaker', () => {
    const trades = [
      { date: todayStr, pnl_cents: '-150', settled_won: 'no', actual_high: '', forecast_temp: '' },
      { date: todayStr, pnl_cents: '-120', settled_won: 'no', actual_high: '', forecast_temp: '' },
    ];
    const result = checkCircuitBreakers(trades, { maxDailySpend: 1000 });
    assert.equal(result.canTrade, false);
    assert.equal(result.reasons.length, 1);
    assert.match(result.reasons[0], /Daily loss -270¢ exceeds 20% of budget \(-200¢\)/);
  });

  it('daily loss below threshold → canTrade: true', () => {
    const trades = [
      { date: todayStr, pnl_cents: '-150', settled_won: 'no', actual_high: '', forecast_temp: '' },
    ];
    const result = checkCircuitBreakers(trades, { maxDailySpend: 1000 });
    assert.equal(result.canTrade, true);
    assert.equal(result.reasons.length, 0);
  });

  it('5 consecutive losses trigger breaker', () => {
    const trades = [
      { date: yesterdayStr, pnl_cents: '-50', settled_won: 'no', actual_high: '', forecast_temp: '' },
      { date: yesterdayStr, pnl_cents: '-50', settled_won: 'no', actual_high: '', forecast_temp: '' },
      { date: todayStr, pnl_cents: '-50', settled_won: 'no', actual_high: '', forecast_temp: '' },
      { date: todayStr, pnl_cents: '-50', settled_won: 'no', actual_high: '', forecast_temp: '' },
      { date: todayStr, pnl_cents: '-50', settled_won: 'no', actual_high: '', forecast_temp: '' },
    ];
    const result = checkCircuitBreakers(trades, { maxDailySpend: 1000 });
    assert.equal(result.canTrade, false);
    assert.equal(result.reasons.length, 1);
    assert.match(result.reasons[0], /5 consecutive losses/);
  });

  it('4 consecutive losses → canTrade: true', () => {
    const trades = [
      { date: yesterdayStr, pnl_cents: '-50', settled_won: 'no', actual_high: '', forecast_temp: '' },
      { date: yesterdayStr, pnl_cents: '-50', settled_won: 'no', actual_high: '', forecast_temp: '' },
      { date: todayStr, pnl_cents: '-50', settled_won: 'no', actual_high: '', forecast_temp: '' },
      { date: todayStr, pnl_cents: '-50', settled_won: 'no', actual_high: '', forecast_temp: '' },
    ];
    const result = checkCircuitBreakers(trades, { maxDailySpend: 1000 });
    assert.equal(result.canTrade, true);
    assert.equal(result.reasons.length, 0);
  });

  it('losses broken by win → canTrade: true', () => {
    const trades = [
      { date: yesterdayStr, pnl_cents: '-50', settled_won: 'no', actual_high: '', forecast_temp: '' },
      { date: yesterdayStr, pnl_cents: '-50', settled_won: 'no', actual_high: '', forecast_temp: '' },
      { date: yesterdayStr, pnl_cents: '-50', settled_won: 'no', actual_high: '', forecast_temp: '' },
      { date: todayStr, pnl_cents: '100', settled_won: 'yes', actual_high: '', forecast_temp: '' },
      { date: todayStr, pnl_cents: '-50', settled_won: 'no', actual_high: '', forecast_temp: '' },
      { date: todayStr, pnl_cents: '-50', settled_won: 'no', actual_high: '', forecast_temp: '' },
    ];
    const result = checkCircuitBreakers(trades, { maxDailySpend: 1000 });
    assert.equal(result.canTrade, true);
    assert.equal(result.reasons.length, 0);
  });

  it('forecast miss > 8°F triggers breaker', () => {
    const trades = [
      { date: yesterdayStr, pnl_cents: '-50', settled_won: 'no', actual_high: '60', forecast_temp: '50', city: 'New York' },
    ];
    const result = checkCircuitBreakers(trades, { maxDailySpend: 1000 });
    assert.equal(result.canTrade, false);
    assert.equal(result.reasons.length, 1);
    assert.match(result.reasons[0], /Forecast miss of 10°F for New York/);
    assert.match(result.reasons[0], /forecast: 50°F, actual: 60°F/);
  });

  it('forecast miss ≤ 8°F → canTrade: true', () => {
    const trades = [
      { date: yesterdayStr, pnl_cents: '-50', settled_won: 'no', actual_high: '57', forecast_temp: '50', city: 'New York' },
    ];
    const result = checkCircuitBreakers(trades, { maxDailySpend: 1000 });
    assert.equal(result.canTrade, true);
    assert.equal(result.reasons.length, 0);
  });

  it('multiple breakers at once', () => {
    const trades = [
      { date: yesterdayStr, pnl_cents: '-50', settled_won: 'no', actual_high: '', forecast_temp: '' },
      { date: yesterdayStr, pnl_cents: '-50', settled_won: 'no', actual_high: '', forecast_temp: '' },
      { date: todayStr, pnl_cents: '-100', settled_won: 'no', actual_high: '', forecast_temp: '' },
      { date: todayStr, pnl_cents: '-70', settled_won: 'no', actual_high: '', forecast_temp: '' },
      { date: todayStr, pnl_cents: '-60', settled_won: 'no', actual_high: '', forecast_temp: '' },
    ];
    const result = checkCircuitBreakers(trades, { maxDailySpend: 1000 });
    assert.equal(result.canTrade, false);
    // Should have both daily loss AND consecutive losses breakers
    assert.ok(result.reasons.length >= 2);
    assert.ok(result.reasons.some(r => r.includes('Daily loss')));
    assert.ok(result.reasons.some(r => r.includes('consecutive losses')));
  });

  it('config with different maxDailySpend', () => {
    const trades = [
      { date: todayStr, pnl_cents: '-110', settled_won: 'no', actual_high: '', forecast_temp: '' },
    ];
    const result = checkCircuitBreakers(trades, { maxDailySpend: 500 });
    // 20% of 500 = 100, threshold = -100
    // -110 < -100, so breaker should trip
    assert.equal(result.canTrade, false);
    assert.equal(result.reasons.length, 1);
    assert.match(result.reasons[0], /Daily loss -110¢ exceeds 20% of budget \(-100¢\)/);
  });
});
