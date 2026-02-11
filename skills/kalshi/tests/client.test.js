import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildEventTicker,
  formatApiError,
  validateEnv,
  logAction,
  kalshiFetch,
  noaaFetch,
} from '../client.js';

// ── 1. buildEventTicker ──────────────────────────────────────────────────────

describe('buildEventTicker', () => {
  it('returns correct ticker for NYC on Feb 11 2026', () => {
    const date = new Date(2026, 1, 11); // month is 0-indexed: 1 = February
    const result = buildEventTicker('NYC', date);
    assert.strictEqual(result, 'KXHIGHNY-26FEB11');
  });

  it('returns correct ticker for Chicago on Jan 1 2026', () => {
    const date = new Date(2026, 0, 1);
    const result = buildEventTicker('Chicago', date);
    assert.strictEqual(result, 'KXHIGHCHI-26JAN01');
  });

  it('returns correct ticker for Miami on Dec 25 2026', () => {
    const date = new Date(2026, 11, 25);
    const result = buildEventTicker('Miami', date);
    assert.strictEqual(result, 'KXHIGHMIA-26DEC25');
  });

  it('returns correct ticker for SF on Mar 5 2027', () => {
    const date = new Date(2027, 2, 5);
    const result = buildEventTicker('SF', date);
    assert.strictEqual(result, 'KXHIGHTSFO-27MAR05');
  });

  it('returns correct ticker for Denver on Jul 15 2026', () => {
    const date = new Date(2026, 6, 15);
    const result = buildEventTicker('Denver', date);
    assert.strictEqual(result, 'KXHIGHDEN-26JUL15');
  });

  it('verifies all 12 months produce correct abbreviations', () => {
    const expectedMonths = [
      'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
      'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
    ];
    for (let m = 0; m < 12; m++) {
      const date = new Date(2026, m, 10);
      const ticker = buildEventTicker('NYC', date);
      assert.ok(
        ticker.includes(expectedMonths[m]),
        `Month index ${m}: expected ticker to contain "${expectedMonths[m]}", got "${ticker}"`,
      );
    }
  });

  it('pads single-digit days with a leading zero', () => {
    const date = new Date(2026, 3, 5); // April 5
    const result = buildEventTicker('LA', date);
    assert.strictEqual(result, 'KXHIGHLAX-26APR05');
  });

  it('returns null for an unknown city', () => {
    const date = new Date(2026, 1, 11);
    const result = buildEventTicker('UnknownCity', date);
    assert.strictEqual(result, null);
  });

  it('returns null for an empty string city', () => {
    const date = new Date(2026, 1, 11);
    const result = buildEventTicker('', date);
    assert.strictEqual(result, null);
  });
});

// ── 2. formatApiError ────────────────────────────────────────────────────────

describe('formatApiError', () => {
  it('returns auth message for a 401 error', () => {
    const error = new Error('Kalshi API error: 401 Unauthorized');
    const result = formatApiError(error);
    assert.strictEqual(result, 'Authentication failed. Check your KALSHI_API_KEY_ID and private key.');
  });

  it('returns auth message for a 403 error', () => {
    const error = new Error('Kalshi API error: 403 Forbidden');
    const result = formatApiError(error);
    assert.strictEqual(result, 'Authentication failed. Check your KALSHI_API_KEY_ID and private key.');
  });

  it('returns rate limit message for a 429 error', () => {
    const error = new Error('Kalshi API error: 429 Too Many Requests');
    const result = formatApiError(error);
    assert.strictEqual(result, 'Rate limited. Wait a moment and try again.');
  });

  it('returns the error message for a generic error', () => {
    const error = new Error('Something unexpected happened');
    const result = formatApiError(error);
    assert.strictEqual(result, 'Something unexpected happened');
  });

  it('returns "Unknown API error" when the error has no message', () => {
    const error = { message: undefined };
    const result = formatApiError(error);
    assert.strictEqual(result, 'Unknown API error');
  });

  it('returns "Unknown API error" for an error with an empty string message', () => {
    const error = { message: '' };
    const result = formatApiError(error);
    assert.strictEqual(result, 'Unknown API error');
  });
});

// ── 3. validateEnv ───────────────────────────────────────────────────────────

describe('validateEnv', () => {
  it('returns an array with 2 error strings when env vars are not set', () => {
    // Save original values
    const origKeyId = process.env.KALSHI_API_KEY_ID;
    const origKeyPath = process.env.KALSHI_PRIVATE_KEY_PATH;
    const origKeyPem = process.env.KALSHI_PRIVATE_KEY_PEM;

    // Clear env vars
    delete process.env.KALSHI_API_KEY_ID;
    delete process.env.KALSHI_PRIVATE_KEY_PATH;
    delete process.env.KALSHI_PRIVATE_KEY_PEM;

    try {
      const errors = validateEnv();
      assert.ok(Array.isArray(errors), 'validateEnv should return an array');
      assert.strictEqual(errors.length, 2, `Expected 2 errors, got ${errors.length}: ${JSON.stringify(errors)}`);
    } finally {
      // Restore original values
      if (origKeyId !== undefined) process.env.KALSHI_API_KEY_ID = origKeyId;
      if (origKeyPath !== undefined) process.env.KALSHI_PRIVATE_KEY_PATH = origKeyPath;
      if (origKeyPem !== undefined) process.env.KALSHI_PRIVATE_KEY_PEM = origKeyPem;
    }
  });

  it('first error mentions KALSHI_API_KEY_ID', () => {
    const origKeyId = process.env.KALSHI_API_KEY_ID;
    const origKeyPath = process.env.KALSHI_PRIVATE_KEY_PATH;
    const origKeyPem = process.env.KALSHI_PRIVATE_KEY_PEM;

    delete process.env.KALSHI_API_KEY_ID;
    delete process.env.KALSHI_PRIVATE_KEY_PATH;
    delete process.env.KALSHI_PRIVATE_KEY_PEM;

    try {
      const errors = validateEnv();
      assert.ok(
        errors[0].includes('KALSHI_API_KEY_ID'),
        `Expected first error to mention KALSHI_API_KEY_ID, got: "${errors[0]}"`,
      );
    } finally {
      if (origKeyId !== undefined) process.env.KALSHI_API_KEY_ID = origKeyId;
      if (origKeyPath !== undefined) process.env.KALSHI_PRIVATE_KEY_PATH = origKeyPath;
      if (origKeyPem !== undefined) process.env.KALSHI_PRIVATE_KEY_PEM = origKeyPem;
    }
  });

  it('second error mentions KALSHI_PRIVATE_KEY', () => {
    const origKeyId = process.env.KALSHI_API_KEY_ID;
    const origKeyPath = process.env.KALSHI_PRIVATE_KEY_PATH;
    const origKeyPem = process.env.KALSHI_PRIVATE_KEY_PEM;

    delete process.env.KALSHI_API_KEY_ID;
    delete process.env.KALSHI_PRIVATE_KEY_PATH;
    delete process.env.KALSHI_PRIVATE_KEY_PEM;

    try {
      const errors = validateEnv();
      assert.ok(
        errors[1].includes('KALSHI_PRIVATE_KEY'),
        `Expected second error to mention KALSHI_PRIVATE_KEY, got: "${errors[1]}"`,
      );
    } finally {
      if (origKeyId !== undefined) process.env.KALSHI_API_KEY_ID = origKeyId;
      if (origKeyPath !== undefined) process.env.KALSHI_PRIVATE_KEY_PATH = origKeyPath;
      if (origKeyPem !== undefined) process.env.KALSHI_PRIVATE_KEY_PEM = origKeyPem;
    }
  });
});

// ── 4. logAction ─────────────────────────────────────────────────────────────

describe('logAction', () => {
  it('does not throw when called with 2 args (default level=info)', () => {
    assert.doesNotThrow(() => {
      logAction('test_action', { detail: 'some_detail' });
    });
  });

  it('does not throw when called with level=warn', () => {
    assert.doesNotThrow(() => {
      logAction('test_warn', { detail: 'warn_detail' }, 'warn');
    });
  });

  it('does not throw when called with level=error', () => {
    assert.doesNotThrow(() => {
      logAction('test_error', { detail: 'error_detail' }, 'error');
    });
  });
});

// ── 5. kalshiFetch (real API call) ───────────────────────────────────────────

describe('kalshiFetch (real API)', () => {
  it('returns an object for a known public event endpoint', async () => {
    // Use a recent date ticker to query an event that may or may not exist.
    // The key assertion is that kalshiFetch returns an object on success
    // or throws an error with a meaningful message on failure.
    const ticker = buildEventTicker('NYC', new Date(2026, 1, 11));
    assert.ok(ticker, 'ticker should not be null for NYC');

    try {
      const data = await kalshiFetch(`/events/${ticker}`);
      assert.strictEqual(typeof data, 'object', 'kalshiFetch should return an object');
      assert.notStrictEqual(data, null, 'kalshiFetch should not return null');
    } catch (err) {
      // If the event does not exist, the API returns a non-OK status and
      // kalshiFetch throws. Verify the error is well-formed.
      assert.ok(err instanceof Error, 'thrown value should be an Error');
      assert.ok(
        err.message.includes('Kalshi API error'),
        `Error message should contain "Kalshi API error", got: "${err.message}"`,
      );
    }
  }, { timeout: 30_000 });

  it('throws for a clearly non-existent event', async () => {
    await assert.rejects(
      () => kalshiFetch('/events/NONEXISTENT_TICKER_XYZ_99999'),
      (err) => {
        assert.ok(err instanceof Error, 'thrown value should be an Error');
        assert.ok(
          err.message.includes('Kalshi API error'),
          `Error message should contain "Kalshi API error", got: "${err.message}"`,
        );
        return true;
      },
    );
  }, { timeout: 30_000 });
});

// ── 6. noaaFetch (real API call) ─────────────────────────────────────────────

describe('noaaFetch (real API)', () => {
  it('returns forecast data for NYC gridpoint with properties.periods array', async () => {
    const data = await noaaFetch('/gridpoints/OKX/33,37/forecast');

    assert.strictEqual(typeof data, 'object', 'noaaFetch should return an object');
    assert.notStrictEqual(data, null, 'noaaFetch should not return null');

    // Verify expected shape
    assert.ok(
      data.properties !== undefined,
      'response should have a "properties" key',
    );
    assert.ok(
      Array.isArray(data.properties.periods),
      `properties.periods should be an array, got ${typeof data.properties?.periods}`,
    );
    assert.ok(
      data.properties.periods.length > 0,
      'properties.periods should not be empty',
    );

    // Verify each period has expected fields
    const firstPeriod = data.properties.periods[0];
    assert.strictEqual(typeof firstPeriod.name, 'string', 'period.name should be a string');
    assert.strictEqual(typeof firstPeriod.temperature, 'number', 'period.temperature should be a number');
  }, { timeout: 30_000 });
});
