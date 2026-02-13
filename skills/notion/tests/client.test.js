import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  PRIORITY_MAP,
  validateEnv,
  getDateET,
  getTodayET,
  parseDate,
  mapPageToTask,
} from '../client.js';

// ── PRIORITY_MAP ────────────────────────────────────────────────────────────────

describe('PRIORITY_MAP', () => {
  it('maps "high" to "High"', () => {
    assert.strictEqual(PRIORITY_MAP['high'], 'High');
  });

  it('maps "medium" to "Medium"', () => {
    assert.strictEqual(PRIORITY_MAP['medium'], 'Medium');
  });

  it('maps "med" shorthand to "Medium"', () => {
    assert.strictEqual(PRIORITY_MAP['med'], 'Medium');
  });

  it('maps "low" to "Low"', () => {
    assert.strictEqual(PRIORITY_MAP['low'], 'Low');
  });
});

// ── validateEnv ─────────────────────────────────────────────────────────────────

describe('validateEnv', () => {
  it('returns errors when env vars are missing', () => {
    const origKey = process.env.NOTION_API_KEY;
    const origDb = process.env.NOTION_TASKS_DATABASE_ID;
    delete process.env.NOTION_API_KEY;
    delete process.env.NOTION_TASKS_DATABASE_ID;

    const errors = validateEnv();
    assert.ok(errors.length >= 2, `Expected at least 2 errors, got ${errors.length}`);
    assert.ok(errors.some((e) => e.includes('NOTION_API_KEY')));
    assert.ok(errors.some((e) => e.includes('NOTION_TASKS_DATABASE_ID')));

    // Restore
    if (origKey) process.env.NOTION_API_KEY = origKey;
    if (origDb) process.env.NOTION_TASKS_DATABASE_ID = origDb;
  });

  it('returns empty array when env vars are set', () => {
    const origKey = process.env.NOTION_API_KEY;
    const origDb = process.env.NOTION_TASKS_DATABASE_ID;
    process.env.NOTION_API_KEY = 'test-key';
    process.env.NOTION_TASKS_DATABASE_ID = 'test-db-id';

    const errors = validateEnv();
    assert.strictEqual(errors.length, 0);

    // Restore
    if (origKey) process.env.NOTION_API_KEY = origKey;
    else delete process.env.NOTION_API_KEY;
    if (origDb) process.env.NOTION_TASKS_DATABASE_ID = origDb;
    else delete process.env.NOTION_TASKS_DATABASE_ID;
  });
});

// ── getDateET / getTodayET ──────────────────────────────────────────────────────

describe('getDateET', () => {
  it('returns a string in YYYY-MM-DD format', () => {
    const result = getDateET(0);
    assert.match(result, /^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns a different date for offset 1', () => {
    const today = getDateET(0);
    const tomorrow = getDateET(1);
    assert.notStrictEqual(today, tomorrow);
  });
});

describe('getTodayET', () => {
  it('returns same value as getDateET(0)', () => {
    assert.strictEqual(getTodayET(), getDateET(0));
  });
});

// ── parseDate ───────────────────────────────────────────────────────────────────

describe('parseDate', () => {
  it('returns null for null input', () => {
    assert.strictEqual(parseDate(null), null);
  });

  it('returns null for empty string', () => {
    assert.strictEqual(parseDate(''), null);
  });

  it('returns today for "today"', () => {
    assert.strictEqual(parseDate('today'), getDateET(0));
  });

  it('returns tomorrow for "tomorrow"', () => {
    assert.strictEqual(parseDate('tomorrow'), getDateET(1));
  });

  it('returns yesterday for "yesterday"', () => {
    assert.strictEqual(parseDate('yesterday'), getDateET(-1));
  });

  it('passes through YYYY-MM-DD dates unchanged', () => {
    assert.strictEqual(parseDate('2026-03-15'), '2026-03-15');
  });

  it('returns null for unparseable strings', () => {
    assert.strictEqual(parseDate('not-a-date-at-all'), null);
  });
});

// ── mapPageToTask ───────────────────────────────────────────────────────────────

describe('mapPageToTask', () => {
  const mockPage = {
    id: 'page-123',
    url: 'https://notion.so/page-123',
    properties: {
      Name: { title: [{ plain_text: 'Test Task' }] },
      Priority: { select: { name: 'High' } },
      Date: { date: { start: '2026-02-15' } },
      'Due Date (assignments only)': { date: { start: '2026-02-20' } },
      Tags: { multi_select: [{ name: 'work' }, { name: 'urgent' }] },
      Archived: { checkbox: false },
      content_rich_text: { rich_text: [{ plain_text: 'Some content' }] },
    },
  };

  it('extracts task name from title', () => {
    const task = mapPageToTask(mockPage);
    assert.strictEqual(task.name, 'Test Task');
  });

  it('extracts priority', () => {
    const task = mapPageToTask(mockPage);
    assert.strictEqual(task.priority, 'High');
  });

  it('extracts date', () => {
    const task = mapPageToTask(mockPage);
    assert.strictEqual(task.date, '2026-02-15');
  });

  it('extracts tags as array', () => {
    const task = mapPageToTask(mockPage);
    assert.deepStrictEqual(task.tags, ['work', 'urgent']);
  });

  it('extracts page ID and URL', () => {
    const task = mapPageToTask(mockPage);
    assert.strictEqual(task.id, 'page-123');
    assert.strictEqual(task.url, 'https://notion.so/page-123');
  });

  it('defaults name to Untitled when missing', () => {
    const emptyPage = {
      id: 'page-456',
      url: 'https://notion.so/page-456',
      properties: {
        Name: { title: [] },
        Priority: { select: null },
        Date: { date: null },
        'Due Date (assignments only)': { date: null },
        Tags: { multi_select: [] },
        Archived: { checkbox: false },
        content_rich_text: { rich_text: [] },
      },
    };
    const task = mapPageToTask(emptyPage);
    assert.strictEqual(task.name, 'Untitled');
    assert.strictEqual(task.priority, null);
    assert.strictEqual(task.date, null);
    assert.deepStrictEqual(task.tags, []);
  });
});
