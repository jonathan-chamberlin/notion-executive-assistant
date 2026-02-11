import { canvasFetch, canvasFetchAll, htmlToText, logAction, formatApiError, resolveCourseId } from './client.js';
import { listCourses } from './courses.js';

export async function listAssignments({ courseId, bucket, orderBy = 'due_at', limit = 30 } = {}) {
  const id = resolveCourseId(courseId);
  if (!id) return { success: false, error: 'courseId is required (set CANVAS_DEFAULT_COURSE_ID or pass courseId)' };

  try {
    logAction('listAssignments', { courseId: id, bucket });
    const params = { order_by: orderBy, per_page: limit };
    if (bucket) params.bucket = bucket;

    const data = await canvasFetchAll(`/courses/${id}/assignments`, params);

    const assignments = data.map(a => ({
      id: a.id,
      name: a.name,
      dueAt: a.due_at,
      description: htmlToText(a.description),
      submissionTypes: a.submission_types,
      pointsPossible: a.points_possible,
      htmlUrl: a.html_url,
      hasSubmittedSubmissions: a.has_submitted_submissions,
    }));

    return { success: true, assignments };
  } catch (error) {
    return { success: false, error: formatApiError(error) };
  }
}

export async function getAssignment({ courseId, assignmentId }) {
  const id = resolveCourseId(courseId);
  if (!id) return { success: false, error: 'courseId is required' };
  if (!assignmentId) return { success: false, error: 'assignmentId is required' };

  try {
    logAction('getAssignment', { courseId: id, assignmentId });
    const { data } = await canvasFetch(`/courses/${id}/assignments/${assignmentId}`);

    return {
      success: true,
      assignment: {
        id: data.id,
        name: data.name,
        dueAt: data.due_at,
        descriptionHtml: data.description,
        description: htmlToText(data.description),
        submissionTypes: data.submission_types,
        pointsPossible: data.points_possible,
        rubric: data.rubric || null,
        htmlUrl: data.html_url,
        lockAt: data.lock_at,
        unlockAt: data.unlock_at,
      },
    };
  } catch (error) {
    return { success: false, error: formatApiError(error) };
  }
}

export async function getUpcomingAssignments({ daysAhead = 14 } = {}) {
  try {
    logAction('getUpcomingAssignments', { daysAhead });
    const coursesResult = await listCourses({ enrollmentState: 'active' });
    if (!coursesResult.success) return coursesResult;

    const now = new Date();
    const cutoff = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
    const allUpcoming = [];

    for (const course of coursesResult.courses) {
      try {
        const data = await canvasFetchAll(`/courses/${course.id}/assignments`, {
          bucket: 'upcoming',
          order_by: 'due_at',
          per_page: 50,
        });

        for (const a of data) {
          if (!a.due_at) continue;
          const dueDate = new Date(a.due_at);
          if (dueDate <= cutoff) {
            allUpcoming.push({
              courseName: course.name,
              courseId: course.id,
              id: a.id,
              name: a.name,
              dueAt: a.due_at,
              pointsPossible: a.points_possible,
              submissionTypes: a.submission_types,
              htmlUrl: a.html_url,
            });
          }
        }
      } catch {
        // Skip courses where assignment listing fails (e.g., concluded courses)
      }
    }

    allUpcoming.sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
    return { success: true, assignments: allUpcoming };
  } catch (error) {
    return { success: false, error: formatApiError(error) };
  }
}
