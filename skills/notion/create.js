import { notion, DATABASE_ID, PRIORITY_MAP, validateEnv, logAction, parseDate } from './client.js';

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

    if (date) {
      const parsedDate = parseDate(date);
      if (parsedDate) {
        properties.Date = { date: { start: parsedDate } };
      } else {
        return { success: false, error: `Invalid date format: ${date}` };
      }
    }

    if (dueDate) {
      const parsedDate = parseDate(dueDate);
      if (parsedDate) {
        properties['Due Date (assignments only)'] = { date: { start: parsedDate } };
      } else {
        return { success: false, error: `Invalid date format: ${dueDate}` };
      }
    }

    if (priority) {
      const mappedPriority = PRIORITY_MAP[priority.toLowerCase()];
      if (mappedPriority) {
        properties.Priority = { select: { name: mappedPriority } };
      } else {
        return { success: false, error: `Invalid priority: ${priority}. Use high, medium, or low.` };
      }
    }

    if (tags && tags.length > 0) {
      properties.Tags = {
        multi_select: tags.map(t => ({ name: t })),
      };
    }

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
      date: properties.Date?.date?.start || null,
      dueDate: properties['Due Date (assignments only)']?.date?.start || null,
      priority: properties.Priority?.select?.name || null,
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
