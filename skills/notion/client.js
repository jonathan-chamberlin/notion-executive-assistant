import { Client } from '@notionhq/client';

export const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

export const DATABASE_ID = process.env.NOTION_TASKS_DATABASE_ID;

export const PRIORITY_MAP = {
  'high': 'High',
  'medium': 'Medium',
  'med': 'Medium',
  'low': 'Low',
};

export function validateEnv() {
  const errors = [];
  if (!process.env.NOTION_API_KEY) {
    errors.push('NOTION_API_KEY is not set');
  }
  if (!process.env.NOTION_TASKS_DATABASE_ID) {
    errors.push('NOTION_TASKS_DATABASE_ID is not set');
  }
  return errors;
}

export function logAction(action, details) {
  const timestamp = new Date().toISOString();
  console.log(JSON.stringify({
    skill: 'NotionSkill',
    action,
    timestamp,
    ...details,
  }));
}

// Get a date in Eastern Time with optional day offset, returns YYYY-MM-DD
export function getDateET(offsetDays = 0) {
  const now = new Date();
  // Add offset in milliseconds
  const target = new Date(now.getTime() + offsetDays * 24 * 60 * 60 * 1000);
  // Format in Eastern Time
  return target.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

// Alias for backwards compatibility
export function getTodayET() {
  return getDateET(0);
}

// Get current day of week in ET (0 = Sunday, 6 = Saturday)
function getDayOfWeekET() {
  const now = new Date();
  const etDate = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short'
  }).format(now);
  const dayMap = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
  return dayMap[etDate];
}

export function parseDate(dateStr) {
  if (!dateStr) return null;

  const lower = dateStr.toLowerCase().trim();

  if (lower === 'today') {
    return getDateET(0);
  }
  if (lower === 'yesterday') {
    return getDateET(-1);
  }
  if (lower === 'tomorrow') {
    return getDateET(1);
  }
  if (lower === 'next-week' || lower === 'next week') {
    return getDateET(7);
  }

  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayIndex = days.indexOf(lower);
  if (dayIndex !== -1) {
    const currentDay = getDayOfWeekET();
    let daysUntil = dayIndex - currentDay;
    if (daysUntil <= 0) daysUntil += 7;
    return getDateET(daysUntil);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return null;
}

export function mapPageToTask(page) {
  return {
    id: page.id,
    name: page.properties.Name?.title?.[0]?.plain_text || 'Untitled',
    priority: page.properties.Priority?.select?.name || null,
    date: page.properties.Date?.date?.start || null,
    dueDate: page.properties['Due Date (assignments only)']?.date?.start || null,
    tags: page.properties.Tags?.multi_select?.map(t => t.name) || [],
    archived: page.properties.Archived?.checkbox || false,
    content: page.properties.content_rich_text?.rich_text?.[0]?.plain_text || null,
    url: page.url,
  };
}
