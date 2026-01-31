import { notion, DATABASE_ID, PRIORITY_MAP, validateEnv, logAction, parseDate, getTodayET, mapPageToTask } from './client.js';

export async function queryTasks(filter = {}) {
  const envErrors = validateEnv();
  if (envErrors.length > 0) {
    return { success: false, error: envErrors.join(', ') };
  }

  try {
    const notionFilter = { and: [] };

    if (!filter.includeArchived) {
      notionFilter.and.push({
        property: 'Archived',
        checkbox: { equals: false },
      });
    }

    // Always require "Task" tag unless explicitly skipped
    if (!filter.skipTaskTag) {
      notionFilter.and.push({
        property: 'Tags',
        multi_select: { contains: 'Task' },
      });
    }

    if (filter.due === 'today') {
      notionFilter.and.push({
        property: 'Due Date (assignments only)',
        date: { equals: getTodayET() },
      });
    } else if (filter.due === 'overdue') {
      notionFilter.and.push({
        property: 'Due Date (assignments only)',
        date: { before: getTodayET() },
      });
    }

    if (filter.date) {
      const resolved = parseDate(filter.date);
      if (resolved) {
        notionFilter.and.push({
          property: 'Date',
          date: { equals: resolved },
        });
      }
    }

    if (filter.priority) {
      const mappedPriority = PRIORITY_MAP[filter.priority.toLowerCase()] || filter.priority;
      notionFilter.and.push({
        property: 'Priority',
        select: { equals: mappedPriority },
      });
    }

    if (filter.tag) {
      notionFilter.and.push({
        property: 'Tags',
        multi_select: { contains: filter.tag },
      });
    }

    const queryParams = {
      database_id: DATABASE_ID,
      sorts: [
        { property: 'Priority', direction: 'ascending' },
        { property: 'Date', direction: 'ascending' },
      ],
    };

    if (notionFilter.and.length > 0) {
      queryParams.filter = notionFilter;
    }

    const response = await notion.databases.query(queryParams);
    const tasks = response.results.map(mapPageToTask);

    logAction('query', { filter, resultCount: tasks.length });

    return { success: true, tasks };
  } catch (error) {
    logAction('query_error', { filter, error: error.message });
    return { success: false, error: `Notion API error: ${error.message}` };
  }
}

export async function tasksToday() {
  return queryTasks({ date: 'today' });
}

export async function tasksYesterday() {
  return queryTasks({ date: 'yesterday' });
}

export async function tasksTomorrow() {
  return queryTasks({ date: 'tomorrow' });
}
