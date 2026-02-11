import { canvasFetch, canvasFetchAll, htmlToText, logAction, formatApiError, resolveCourseId } from './client.js';

export async function listPages({ courseId, searchTerm, limit = 30 } = {}) {
  const id = resolveCourseId(courseId);
  if (!id) return { success: false, error: 'courseId is required (set CANVAS_DEFAULT_COURSE_ID or pass courseId)' };

  try {
    logAction('listPages', { courseId: id, searchTerm });
    const params = { per_page: limit, sort: 'updated_at', order: 'desc' };
    if (searchTerm) params.search_term = searchTerm;

    const data = await canvasFetchAll(`/courses/${id}/pages`, params);

    const pages = data.map(p => ({
      pageId: p.page_id,
      url: p.url,
      title: p.title,
      updatedAt: p.updated_at,
      published: p.published,
    }));

    return { success: true, pages };
  } catch (error) {
    return { success: false, error: formatApiError(error) };
  }
}

export async function getPage({ courseId, pageUrl }) {
  const id = resolveCourseId(courseId);
  if (!id) return { success: false, error: 'courseId is required' };
  if (!pageUrl) return { success: false, error: 'pageUrl is required (the URL slug from listPages)' };

  try {
    logAction('getPage', { courseId: id, pageUrl });
    const { data } = await canvasFetch(`/courses/${id}/pages/${pageUrl}`);

    return {
      success: true,
      page: {
        pageId: data.page_id,
        url: data.url,
        title: data.title,
        bodyHtml: data.body,
        body: htmlToText(data.body),
        updatedAt: data.updated_at,
      },
    };
  } catch (error) {
    return { success: false, error: formatApiError(error) };
  }
}
