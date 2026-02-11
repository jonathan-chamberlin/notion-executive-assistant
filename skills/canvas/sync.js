import { getUpcomingAssignments } from './assignments.js';
import { createTask } from '../notion/create.js';
import { searchTasks } from '../notion/search.js';
import { logAction } from './client.js';

export async function syncAssignmentsToNotion({ daysAhead = 14 } = {}) {
  try {
    logAction('syncAssignmentsToNotion', { daysAhead });

    const result = await getUpcomingAssignments({ daysAhead });
    if (!result.success) return result;

    let created = 0;
    let alreadyExists = 0;
    const synced = [];

    for (const assignment of result.assignments) {
      const taskName = `${assignment.courseName}: ${assignment.name}`;

      // Check if a Notion task already exists for this assignment
      const existing = await searchTasks(assignment.name);
      if (existing.success && existing.tasks.length > 0) {
        alreadyExists++;
        continue;
      }

      // Calculate priority based on due date proximity
      const now = new Date();
      const dueDate = new Date(assignment.dueAt);
      const daysUntilDue = (dueDate - now) / (1000 * 60 * 60 * 24);
      let priority;
      if (daysUntilDue <= 3) priority = 'high';
      else if (daysUntilDue <= 7) priority = 'medium';
      else priority = 'low';

      const content = [
        `Canvas: ${assignment.htmlUrl}`,
        `Points: ${assignment.pointsPossible}`,
        assignment.submissionTypes ? `Submission: ${assignment.submissionTypes.join(', ')}` : null,
      ].filter(Boolean).join('\n');

      const createResult = await createTask({
        name: taskName,
        dueDate: assignment.dueAt.split('T')[0],
        priority,
        tags: ['School', assignment.courseName],
        content,
      });

      if (createResult.success) {
        created++;
        synced.push({
          name: taskName,
          dueAt: assignment.dueAt,
          notionId: createResult.task.id,
        });
      }
    }

    logAction('syncComplete', { created, alreadyExists, total: result.assignments.length });

    return {
      success: true,
      created,
      alreadyExists,
      total: result.assignments.length,
      synced,
    };
  } catch (error) {
    logAction('syncError', { error: error.message });
    return { success: false, error: `Sync failed: ${error.message}` };
  }
}
