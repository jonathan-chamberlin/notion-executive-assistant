import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { calculatePositionSize } from '../sizing.js';

describe('calculatePositionSize - quarter-Kelly with known inputs', () => {
  it('bankroll=2972, edge=25, yesPrice=30 → 8 contracts at 240¢', () => {
    const result = calculatePositionSize({
      bankroll: 2972,
      edge: 25,
      yesPrice: 30,
      kellyMultiplier: 0.25,
    });

    // kellyFraction = 25 / 70 ≈ 0.357
    // adjustedFraction = 0.357 * 0.25 ≈ 0.089
    // amount = floor(2972 * 0.089) = floor(264.5) = 264
    // contracts = floor(264 / 30) = 8
    // actual amount = 8 * 30 = 240

    assert.equal(result.contracts, 8);
    assert.equal(result.amount, 240);
    assert.ok(result.kellyFraction > 0.35 && result.kellyFraction < 0.36);
    assert.ok(result.adjustedFraction > 0.08 && result.adjustedFraction < 0.09);
  });
});

describe('calculatePositionSize - zero and negative edge', () => {
  it('edge=0 returns 0 contracts (no edge)', () => {
    const result = calculatePositionSize({
      bankroll: 1000,
      edge: 0,
      yesPrice: 50,
    });

    assert.equal(result.amount, 0);
    assert.equal(result.contracts, 0);
    assert.equal(result.kellyFraction, 0);
    assert.equal(result.reason, 'no edge');
  });

  it('negative edge returns 0 contracts (no edge)', () => {
    const result = calculatePositionSize({
      bankroll: 1000,
      edge: -10,
      yesPrice: 50,
    });

    assert.equal(result.amount, 0);
    assert.equal(result.contracts, 0);
    assert.equal(result.kellyFraction, 0);
    assert.equal(result.reason, 'no edge');
  });
});

describe('calculatePositionSize - invalid bankroll', () => {
  it('bankroll=0 returns 0 contracts (no bankroll)', () => {
    const result = calculatePositionSize({
      bankroll: 0,
      edge: 20,
      yesPrice: 50,
    });

    assert.equal(result.amount, 0);
    assert.equal(result.contracts, 0);
    assert.equal(result.reason, 'no bankroll');
  });

  it('negative bankroll returns 0 contracts (no bankroll)', () => {
    const result = calculatePositionSize({
      bankroll: -100,
      edge: 20,
      yesPrice: 50,
    });

    assert.equal(result.amount, 0);
    assert.equal(result.contracts, 0);
    assert.equal(result.reason, 'no bankroll');
  });
});

describe('calculatePositionSize - position capped at maxTradeSize', () => {
  it('large bankroll and edge capped at 500¢', () => {
    const result = calculatePositionSize({
      bankroll: 100000,
      edge: 50,
      yesPrice: 10,
      kellyMultiplier: 1.0,
      maxTradeSize: 500,
    });

    // Kelly would suggest huge position, but capped at 500
    assert.equal(result.amount, 500);
    assert.equal(result.contracts, 50); // 500 / 10 = 50
  });
});

describe('calculatePositionSize - small edge below minTradeSize', () => {
  it('Kelly suggests <5¢ but can afford 1 contract at 5¢', () => {
    const result = calculatePositionSize({
      bankroll: 100,
      edge: 1,
      yesPrice: 5,
      kellyMultiplier: 0.25,
      minTradeSize: 5,
    });

    // Kelly = 1 / 95 ≈ 0.0105
    // adjustedFraction = 0.0105 * 0.25 ≈ 0.0026
    // amount = floor(100 * 0.0026) = 0
    // Falls below minTradeSize (5¢), but can afford 1 contract at 5¢
    assert.equal(result.amount, 5);
    assert.equal(result.contracts, 1);
  });

  it('Kelly suggests <5¢ and cannot afford even 1 contract', () => {
    const result = calculatePositionSize({
      bankroll: 100,
      edge: 1,
      yesPrice: 50,
      kellyMultiplier: 0.25,
      minTradeSize: 5,
    });

    // Kelly = 1 / 50 = 0.02
    // adjustedFraction = 0.02 * 0.25 = 0.005
    // amount = floor(100 * 0.005) = 0
    // Falls below minTradeSize, and yesPrice=50 > minTradeSize
    // but bankroll=100 can afford 1 contract at 50¢
    assert.equal(result.amount, 50);
    assert.equal(result.contracts, 1);
  });

  it('Kelly suggests tiny amount and yesPrice > bankroll → cannot afford', () => {
    const result = calculatePositionSize({
      bankroll: 10,
      edge: 1,
      yesPrice: 20,
      kellyMultiplier: 0.25,
      minTradeSize: 5,
    });

    // Kelly suggests ~0.03¢, falls below minTradeSize
    // yesPrice=20 > bankroll=10 → cannot afford 1 contract
    assert.equal(result.amount, 0);
    assert.equal(result.contracts, 0);
    assert.equal(result.reason, 'below minimum size');
  });
});

describe('calculatePositionSize - invalid yesPrice', () => {
  it('yesPrice=0 returns 0 contracts (invalid price)', () => {
    const result = calculatePositionSize({
      bankroll: 1000,
      edge: 20,
      yesPrice: 0,
    });

    assert.equal(result.amount, 0);
    assert.equal(result.contracts, 0);
    assert.equal(result.reason, 'invalid price');
  });

  it('yesPrice=100 returns 0 contracts (invalid price)', () => {
    const result = calculatePositionSize({
      bankroll: 1000,
      edge: 20,
      yesPrice: 100,
    });

    assert.equal(result.amount, 0);
    assert.equal(result.contracts, 0);
    assert.equal(result.reason, 'invalid price');
  });

  it('yesPrice=-5 returns 0 contracts (invalid price)', () => {
    const result = calculatePositionSize({
      bankroll: 1000,
      edge: 20,
      yesPrice: -5,
    });

    assert.equal(result.amount, 0);
    assert.equal(result.contracts, 0);
    assert.equal(result.reason, 'invalid price');
  });
});

describe('calculatePositionSize - half-Kelly vs quarter-Kelly', () => {
  it('half-Kelly gives approximately 2x the amount of quarter-Kelly', () => {
    const quarterKelly = calculatePositionSize({
      bankroll: 2000,
      edge: 20,
      yesPrice: 40,
      kellyMultiplier: 0.25,
    });

    const halfKelly = calculatePositionSize({
      bankroll: 2000,
      edge: 20,
      yesPrice: 40,
      kellyMultiplier: 0.5,
    });

    // kellyFraction = 20 / 60 = 0.333
    // quarter-Kelly: 0.333 * 0.25 = 0.0833 → 2000 * 0.0833 = 166 → 4 contracts = 160¢
    // half-Kelly: 0.333 * 0.5 = 0.1665 → 2000 * 0.1665 = 333 → 8 contracts = 320¢

    assert.equal(quarterKelly.contracts, 4);
    assert.equal(quarterKelly.amount, 160);

    assert.equal(halfKelly.contracts, 8);
    assert.equal(halfKelly.amount, 320);

    // Verify that half-Kelly is exactly 2x quarter-Kelly in this case
    assert.equal(halfKelly.amount, quarterKelly.amount * 2);
  });
});

describe('calculatePositionSize - large edge does not exceed maxTradeSize', () => {
  it('edge=80, yesPrice=10, huge Kelly → capped at 500¢', () => {
    const result = calculatePositionSize({
      bankroll: 10000,
      edge: 80,
      yesPrice: 10,
      kellyMultiplier: 0.25,
      maxTradeSize: 500,
    });

    // kellyFraction = 80 / 90 ≈ 0.889
    // adjustedFraction = 0.889 * 0.25 ≈ 0.222
    // amount = floor(10000 * 0.222) = 2220 → capped at 500
    assert.equal(result.amount, 500);
    assert.equal(result.contracts, 50); // 500 / 10 = 50
  });
});

describe('calculatePositionSize - contracts calculation is correct', () => {
  it('amount / yesPrice = correct integer number of contracts', () => {
    const result = calculatePositionSize({
      bankroll: 5000,
      edge: 30,
      yesPrice: 25,
      kellyMultiplier: 0.25,
    });

    // kellyFraction = 30 / 75 = 0.4
    // adjustedFraction = 0.4 * 0.25 = 0.1
    // amount = floor(5000 * 0.1) = 500 → capped at maxTradeSize
    // contracts = floor(500 / 25) = 20
    // actual amount = 20 * 25 = 500

    assert.equal(result.contracts, 20);
    assert.equal(result.amount, 500);
    assert.equal(result.amount, result.contracts * 25);
  });

  it('fractional contracts are floored, actual amount matches contracts × yesPrice', () => {
    const result = calculatePositionSize({
      bankroll: 1000,
      edge: 15,
      yesPrice: 37,
      kellyMultiplier: 0.25,
    });

    // kellyFraction = 15 / 63 ≈ 0.238
    // adjustedFraction = 0.238 * 0.25 ≈ 0.0595
    // amount = floor(1000 * 0.0595) = 59
    // contracts = floor(59 / 37) = 1
    // actual amount = 1 * 37 = 37

    assert.equal(result.contracts, 1);
    assert.equal(result.amount, 37);
    assert.equal(result.amount, result.contracts * 37);
  });
});

describe('calculatePositionSize - reason string includes Kelly percentage', () => {
  it('reason contains Kelly fraction and adjusted fraction', () => {
    const result = calculatePositionSize({
      bankroll: 1000,
      edge: 20,
      yesPrice: 50,
      kellyMultiplier: 0.25,
    });

    // kellyFraction = 20 / 50 = 0.4 = 40%
    // adjustedFraction = 0.4 * 0.25 = 0.1 = 10%
    assert.ok(result.reason.includes('40.0%'));
    assert.ok(result.reason.includes('10.0%'));
    assert.ok(result.reason.includes('0.25'));
  });
});
