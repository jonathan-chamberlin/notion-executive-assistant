/**
 * NotionSkill - Notion task management for Clawdbot
 *
 * This skill provides CRUD operations for tasks stored in Notion.
 * Notion is the single source of truth for all task data.
 */

import { Client } from '@notionhq/client';

// Initialize Notion client
const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

const DATABASE_ID = process.env.NOTION_TASKS_DATABASE_ID;

// Status mapping for consistent handling
const STATUS_MAP = {
  'todo': 'To Do',
  'to-do': 'To Do',
  'in-progress': 'In Progress',
  'inprogress': 'In Progress',
  'done': 'Done',
  'completed': 'Done',
  'blocked': 'Blocked',
};

const PRIORITY_MAP = {
  'high': 'High',
  'medium': 'Medium',
  'med': 'Medium',
  'low': 'Low',
};

/**
 * Parse natural language date into ISO format
 */
function parseDate(dateStr) {
  if (!dateStr) return null;

  const today = new Date();
  const lower = dateStr.toLowerCase().trim();

  if (lower === 'today') {
    return today.toISOString().split('T')[0];
  }
  if (lower === 'tomorrow') {
    today.setDate(today.getDate() + 1);
    return today.toISOString().split('T')[0];
  }
  if (lower === 'next-week' || lower === 'next week') {
    today.setDate(today.getDate() + 7);
    return today.toISOString().split('T')[0];
  }

  // Day names
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayIndex = days.indexOf(lower);
  if (dayIndex !== -1) {
    const currentDay = today.getDay();
    let daysUntil = dayIndex - currentDay;
    if (daysUntil <= 0) daysUntil += 7;
    today.setDate(today.getDate() + daysUntil);
    return today.toISOString().split('T')[0];
  }

  // Try ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  // Try parsing as date
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return null;
}

/**
 * Validate environment variables
 */
function validateEnv() {
  const errors = [];
  if (!process.env.NOTION_API_KEY) {
    errors.push('NOTION_API_KEY is not set');
  }
  if (!process.env.NOTION_TASKS_DATABASE_ID) {
    errors.push('NOTION_TASKS_DATABASE_ID is not set');
  }
  return errors;
}

/**
 * Log an action for auditability
 */
function logAction(action, details) {
  const timestamp = new Date().toISOString();
  console.log(JSON.stringify({
    skill: 'NotionSkill',
    action,
    timestamp,
    ...details,
  }));
}

/**
 * Query tasks from Notion database
 */
export async function queryTasks(filter = {}) {
  const envErrors = validateEnv();
  if (envErrors.length > 0) {
    return { success: false, error: envErrors.join(', ') };
  }

  try {
    const notionFilter = { and: [] };

    // Status filter
    if (filter.status) {
      const mappedStatus = STATUS_MAP[filter.status.toLowerCase()] || filter.status;
      notionFilter.and.push({
        property: 'Status',
        select: { equals: mappedStatus },
      });
    }

    // Due date filter
    if (filter.due === 'today') {
      const today = new Date().toISOString().split('T')[0];
      notionFilter.and.push({
        property: 'Due Date',
        date: { equals: today },
      });
    } else if (filter.due === 'overdue') {
      const today = new Date().toISOString().split('T')[0];
      notionFilter.and.push({
        property: 'Due Date',
        date: { before: today },
      });
      notionFilter.and.push({
        property: 'Status',
        select: { does_not_equal: 'Done' },
      });
    }

    // Priority filter
    if (filter.priority) {
      const mappedPriority = PRIORITY_MAP[filter.priority.toLowerCase()] || filter.priority;
      notionFilter.and.push({
        property: 'Priority',
        select: { equals: mappedPriority },
      });
    }

    const queryParams = {
      database_id: DATABASE_ID,
      sorts: [{ property: 'Due Date', direction: 'ascending' }],
    };

    if (notionFilter.and.length > 0) {
      queryParams.filter = notionFilter;
    }

    const response = await notion.databases.query(queryParams);

    const tasks = response.results.map(page => ({
      id: page.id,
      title: page.properties.Title?.title?.[0]?.plain_text || 'Untitled',
      status: page.properties.Status?.select?.name || 'Unknown',
      dueDate: page.properties['Due Date']?.date?.start || null,
      priority: page.properties.Priority?.select?.name || null,
      notes: page.properties.Notes?.rich_text?.[0]?.plain_text || null,
      calendarEvent: page.properties['Calendar Event']?.url || null,
      emailThread: page.properties['Email Thread']?.url || null,
      url: page.url,
    }));

    logAction('query', { filter, resultCount: tasks.length });

    return { success: true, tasks };
  } catch (error) {
    logAction('query_error', { filter, error: error.message });
    return { success: false, error: `Notion API error: ${error.message}` };
  }
}

/**
 * Create a new task in Notion
 */
export async function createTask({ title, status, dueDate, priority, notes }) {
  const envErrors = validateEnv();
  if (envErrors.length > 0) {
    return { success: false, error: envErrors.join(', ') };
  }

  // Input validation
  if (!title || title.trim().length === 0) {
    return { success: false, error: 'Task title is required' };
  }

  try {
    const properties = {
      Title: {
        title: [{ text: { content: title.trim() } }],
      },
    };

    // Status
    if (status) {
      const mappedStatus = STATUS_MAP[status.toLowerCase()] || status;
      properties.Status = { select: { name: mappedStatus } };
    } else {
      properties.Status = { select: { name: 'To Do' } };
    }

    // Due date
    if (dueDate) {
      const parsedDate = parseDate(dueDate);
      if (parsedDate) {
        properties['Due Date'] = { date: { start: parsedDate } };
      } else {
        return { success: false, error: `Invalid date format: ${dueDate}` };
      }
    }

    // Priority
    if (priority) {
      const mappedPriority = PRIORITY_MAP[priority.toLowerCase()];
      if (mappedPriority) {
        properties.Priority = { select: { name: mappedPriority } };
      } else {
        return { success: false, error: `Invalid priority: ${priority}. Use high, medium, or low.` };
      }
    }

    // Notes
    if (notes) {
      properties.Notes = {
        rich_text: [{ text: { content: notes } }],
      };
    }

    const response = await notion.pages.create({
      parent: { database_id: DATABASE_ID },
      properties,
    });

    const task = {
      id: response.id,
      title: title.trim(),
      status: properties.Status.select.name,
      dueDate: properties['Due Date']?.date?.start || null,
      priority: properties.Priority?.select?.name || null,
      url: response.url,
    };

    logAction('create', { task });

    return { success: true, task };
  } catch (error) {
    logAction('create_error', { title, error: error.message });
    return { success: false, error: `Failed to create task: ${error.message}` };
  }
}

/**
 * Update an existing task
 */
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

    if (updates.title) {
      properties.Title = {
        title: [{ text: { content: updates.title.trim() } }],
      };
    }

    if (updates.status) {
      const mappedStatus = STATUS_MAP[updates.status.toLowerCase()] || updates.status;
      properties.Status = { select: { name: mappedStatus } };
    }

    if (updates.dueDate) {
      const parsedDate = parseDate(updates.dueDate);
      if (parsedDate) {
        properties['Due Date'] = { date: { start: parsedDate } };
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

    if (updates.notes) {
      properties.Notes = {
        rich_text: [{ text: { content: updates.notes } }],
      };
    }

    if (updates.calendarEvent) {
      properties['Calendar Event'] = { url: updates.calendarEvent };
    }

    if (updates.emailThread) {
      properties['Email Thread'] = { url: updates.emailThread };
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

/**
 * Mark a task as done
 */
export async function completeTask(taskId) {
  return updateTask(taskId, { status: 'done' });
}

/**
 * Search tasks by title
 */
export async function searchTasks(query) {
  const envErrors = validateEnv();
  if (envErrors.length > 0) {
    return { success: false, error: envErrors.join(', ') };
  }

  if (!query || query.trim().length === 0) {
    return { success: false, error: 'Search query is required' };
  }

  try {
    const response = await notion.databases.query({
      database_id: DATABASE_ID,
      filter: {
        property: 'Title',
        title: { contains: query.trim() },
      },
    });

    const tasks = response.results.map(page => ({
      id: page.id,
      title: page.properties.Title?.title?.[0]?.plain_text || 'Untitled',
      status: page.properties.Status?.select?.name || 'Unknown',
      dueDate: page.properties['Due Date']?.date?.start || null,
      url: page.url,
    }));

    logAction('search', { query, resultCount: tasks.length });

    return { success: true, tasks };
  } catch (error) {
    logAction('search_error', { query, error: error.message });
    return { success: false, error: `Search failed: ${error.message}` };
  }
}

// Default export for Clawdbot skill registration
export default {
  name: 'NotionSkill',
  description: 'Manage tasks in Notion',
  functions: {
    queryTasks,
    createTask,
    updateTask,
    completeTask,
    searchTasks,
  },
};
