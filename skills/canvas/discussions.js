import { canvasFetch, canvasFetchAll, htmlToText, logAction, formatApiError, resolveCourseId } from './client.js';

export async function listDiscussions({ courseId, limit = 20 } = {}) {
  const id = resolveCourseId(courseId);
  if (!id) return { success: false, error: 'courseId is required (set CANVAS_DEFAULT_COURSE_ID or pass courseId)' };

  try {
    logAction('listDiscussions', { courseId: id });
    const data = await canvasFetchAll(`/courses/${id}/discussion_topics`, {
      per_page: limit,
      order_by: 'recent_activity',
    });

    const discussions = data.map(d => ({
      id: d.id,
      title: d.title,
      message: htmlToText(d.message),
      postedAt: d.posted_at,
      dueAt: d.assignment?.due_at || null,
      discussionType: d.discussion_type,
      published: d.published,
      entryCount: d.discussion_subentry_count || 0,
    }));

    return { success: true, discussions };
  } catch (error) {
    return { success: false, error: formatApiError(error) };
  }
}

export async function getDiscussion({ courseId, topicId }) {
  const id = resolveCourseId(courseId);
  if (!id) return { success: false, error: 'courseId is required' };
  if (!topicId) return { success: false, error: 'topicId is required' };

  try {
    logAction('getDiscussion', { courseId: id, topicId });
    const { data } = await canvasFetch(`/courses/${id}/discussion_topics/${topicId}`);

    return {
      success: true,
      discussion: {
        id: data.id,
        title: data.title,
        messageHtml: data.message,
        message: htmlToText(data.message),
        dueAt: data.assignment?.due_at || null,
        discussionType: data.discussion_type,
        published: data.published,
        htmlUrl: data.html_url,
      },
    };
  } catch (error) {
    return { success: false, error: formatApiError(error) };
  }
}

export async function getDiscussionEntries({ courseId, topicId }) {
  const id = resolveCourseId(courseId);
  if (!id) return { success: false, error: 'courseId is required' };
  if (!topicId) return { success: false, error: 'topicId is required' };

  try {
    logAction('getDiscussionEntries', { courseId: id, topicId });
    const { data } = await canvasFetch(`/courses/${id}/discussion_topics/${topicId}/view`);

    function mapEntry(entry) {
      return {
        id: entry.id,
        userName: entry.user_name || entry.user?.display_name || 'Unknown',
        message: htmlToText(entry.message),
        createdAt: entry.created_at,
        replies: (entry.replies || []).map(mapEntry),
      };
    }

    const entries = (data.view || []).map(mapEntry);

    return { success: true, entries };
  } catch (error) {
    return { success: false, error: formatApiError(error) };
  }
}
