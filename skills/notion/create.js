import { notion, DATABASE_ID, PRIORITY_MAP, validateEnv, logAction, parseDate, getTodayET } from './client.js';

export async function createTask({ name, date, dueDate, priority, tags, content }) {
  const envErrors = validateEnv();
  if (envErrors.length > 0) {
    return { success: false, error: envErrors.join(', ') };
  }

  if (!name || name.trim().length === 0) {
    return { success: false, error: 'Task name is required' };
  }

  try {
    const properties = {
      Name: {
        title: [{ text: { content: name.trim() } }],
      },
    };

    // Default to today (Eastern Time) if no date specified
    const taskDate = date ? parseDate(date) : getTodayET();
    if (date && !taskDate) {
      return { success: false, error: `Invalid date format: ${date}` };
    }
    properties.Date = { date: { start: taskDate } };

    if (dueDate) {
      const parsedDate = parseDate(dueDate);
      if (parsedDate) {
        properties['Due Date (assignments only)'] = { date: { start: parsedDate } };
      } else {
        return { success: false, error: `Invalid date format: ${dueDate}` };
      }
    }

    // Default to Low priority if not specified
    const priorityValue = priority ? PRIORITY_MAP[priority.toLowerCase()] : 'Low';
    if (priority && !PRIORITY_MAP[priority.toLowerCase()]) {
      return { success: false, error: `Invalid priority: ${priority}. Use high, medium, or low.` };
    }
    properties.Priority = { select: { name: priorityValue } };

    // Always include "Task" tag, plus any additional tags
    const allTags = ['Task', ...(tags || [])];
    properties.Tags = {
      multi_select: [...new Set(allTags)].map(t => ({ name: t })),
    };

    if (content) {
      properties.content_rich_text = {
        rich_text: [{ text: { content } }],
      };
    }

    const response = await notion.pages.create({
      parent: { database_id: DATABASE_ID },
      properties,
    });

    const task = {
      id: response.id,
      name: name.trim(),
      date: taskDate,
      dueDate: properties['Due Date (assignments only)']?.date?.start || null,
      priority: priorityValue,
      tags: tags || [],
      url: response.url,
    };

    logAction('create', { task });

    return { success: true, task };
  } catch (error) {
    logAction('create_error', { name, error: error.message });
    return { success: false, error: `Failed to create task: ${error.message}` };
  }
}
