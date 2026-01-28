import { notion, DATABASE_ID, validateEnv, logAction, mapPageToTask } from './client.js';

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
        and: [
          { property: 'Name', title: { contains: query.trim() } },
          { property: 'Archived', checkbox: { equals: false } },
          { property: 'Tags', multi_select: { contains: 'Task' } },
        ],
      },
    });

    const tasks = response.results.map(mapPageToTask);

    logAction('search', { query, resultCount: tasks.length });

    return { success: true, tasks };
  } catch (error) {
    logAction('search_error', { query, error: error.message });
    return { success: false, error: `Search failed: ${error.message}` };
  }
}
