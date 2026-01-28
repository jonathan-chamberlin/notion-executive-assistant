import { notion, PRIORITY_MAP, validateEnv, logAction, parseDate } from './client.js';

export async function updateTask(taskId, updates) {
  const envErrors = validateEnv();
  if (envErrors.length > 0) {
    return { success: false, error: envErrors.join(', ') };
  }

  if (!taskId) {
    return { success: false, error: 'Task ID is required' };
  }

  try {
    const properties = {};

    if (updates.name) {
      properties.Name = {
        title: [{ text: { content: updates.name.trim() } }],
      };
    }

    if (updates.date) {
      const parsedDate = parseDate(updates.date);
      if (parsedDate) {
        properties.Date = { date: { start: parsedDate } };
      } else {
        return { success: false, error: `Invalid date format: ${updates.date}` };
      }
    }

    if (updates.dueDate) {
      const parsedDate = parseDate(updates.dueDate);
      if (parsedDate) {
        properties['Due Date (assignments only)'] = { date: { start: parsedDate } };
      } else {
        return { success: false, error: `Invalid date format: ${updates.dueDate}` };
      }
    }

    if (updates.priority) {
      const mappedPriority = PRIORITY_MAP[updates.priority.toLowerCase()];
      if (mappedPriority) {
        properties.Priority = { select: { name: mappedPriority } };
      }
    }

    if (updates.tags) {
      properties.Tags = {
        multi_select: updates.tags.map(t => ({ name: t })),
      };
    }

    if (updates.content) {
      properties.content_rich_text = {
        rich_text: [{ text: { content: updates.content } }],
      };
    }

    if (updates.archived !== undefined) {
      properties.Archived = { checkbox: updates.archived };
    }

    if (Object.keys(properties).length === 0) {
      return { success: false, error: 'No updates provided' };
    }

    const response = await notion.pages.update({
      page_id: taskId,
      properties,
    });

    logAction('update', { taskId, updates });

    return {
      success: true,
      task: {
        id: response.id,
        url: response.url,
        updatedFields: Object.keys(updates),
      }
    };
  } catch (error) {
    logAction('update_error', { taskId, updates, error: error.message });
    return { success: false, error: `Failed to update task: ${error.message}` };
  }
}

export async function completeTask(taskId) {
  return updateTask(taskId, { archived: true });
}
