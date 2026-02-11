import { canvasFetch, canvasFetchAll, logAction, formatApiError, resolveCourseId } from './client.js';

export async function listCourses({ enrollmentState = 'active', limit = 20 } = {}) {
  try {
    logAction('listCourses', { enrollmentState });
    const data = await canvasFetchAll('/courses', {
      enrollment_state: enrollmentState,
      per_page: limit,
      include: ['term', 'total_scores'],
    });

    const courses = data.map(c => ({
      id: c.id,
      name: c.name,
      courseCode: c.course_code,
      term: c.term?.name || null,
      enrollmentType: c.enrollments?.[0]?.type || null,
    }));

    return { success: true, courses };
  } catch (error) {
    return { success: false, error: formatApiError(error) };
  }
}

export async function getCourse({ courseId }) {
  const id = resolveCourseId(courseId);
  if (!id) return { success: false, error: 'courseId is required (set CANVAS_DEFAULT_COURSE_ID or pass courseId)' };

  try {
    logAction('getCourse', { courseId: id });
    const { data } = await canvasFetch(`/courses/${id}`, {
      include: ['syllabus_body', 'term', 'total_scores'],
    });

    return {
      success: true,
      course: {
        id: data.id,
        name: data.name,
        courseCode: data.course_code,
        term: data.term?.name || null,
        syllabusBody: data.syllabus_body || null,
      },
    };
  } catch (error) {
    return { success: false, error: formatApiError(error) };
  }
}
