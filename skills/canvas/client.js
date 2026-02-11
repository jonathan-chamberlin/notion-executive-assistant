export const CANVAS_BASE_URL = (process.env.CANVAS_BASE_URL || 'https://northeastern.instructure.com').replace(/\/$/, '');
export const CANVAS_API_TOKEN = process.env.CANVAS_API_TOKEN;
export const DEFAULT_COURSE_ID = process.env.CANVAS_DEFAULT_COURSE_ID || null;

export function validateEnv() {
  const errors = [];
  if (!CANVAS_API_TOKEN) {
    errors.push('CANVAS_API_TOKEN is not set');
  }
  if (!CANVAS_BASE_URL) {
    errors.push('CANVAS_BASE_URL is not set');
  }
  return errors;
}

export function logAction(action, details) {
  const timestamp = new Date().toISOString();
  console.log(JSON.stringify({
    skill: 'CanvasSkill',
    action,
    timestamp,
    ...details,
  }));
}

function parseLinkHeader(header) {
  if (!header) return {};
  const links = {};
  const parts = header.split(',');
  for (const part of parts) {
    const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
    if (match) {
      links[match[2]] = match[1];
    }
  }
  return links;
}

export async function canvasFetch(path, params = {}) {
  const url = new URL(`/api/v1${path}`, CANVAS_BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        for (const v of value) {
          url.searchParams.append(`${key}[]`, v);
        }
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${CANVAS_API_TOKEN}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const error = new Error(`Canvas API ${response.status}: ${response.statusText}`);
    error.status = response.status;
    error.body = body;
    error.rateLimitRemaining = response.headers.get('x-rate-limit-remaining');
    throw error;
  }

  const data = await response.json();
  const linkHeader = response.headers.get('link');
  const links = parseLinkHeader(linkHeader);

  return { data, links };
}

export async function canvasFetchAll(path, params = {}) {
  const allData = [];
  let url = null;

  // First request uses path + params
  const first = await canvasFetch(path, { ...params, per_page: params.per_page || 50 });
  allData.push(...(Array.isArray(first.data) ? first.data : [first.data]));
  url = first.links.next || null;

  // Follow pagination links
  while (url) {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${CANVAS_API_TOKEN}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) break;

    const data = await response.json();
    allData.push(...(Array.isArray(data) ? data : [data]));

    const linkHeader = response.headers.get('link');
    const links = parseLinkHeader(linkHeader);
    url = links.next || null;
  }

  return allData;
}

export function htmlToText(html) {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '  - ')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<h[1-6][^>]*>/gi, '\n## ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function formatApiError(error) {
  if (error.status === 401) {
    return 'Canvas API authentication failed. Your token may be expired or invalid. Generate a new one at Account > Settings > Approved Integrations.';
  }
  if (error.status === 403) {
    if (error.rateLimitRemaining === '0') {
      return 'Canvas API rate limit exceeded. Wait a few minutes and try again.';
    }
    return 'Canvas API access denied. You may not have permission to access this resource.';
  }
  if (error.status === 404) {
    return 'Not found. Check that the course ID and resource ID are correct.';
  }
  return error.message || 'Unknown Canvas API error';
}

export function resolveCourseId(courseId) {
  return courseId || DEFAULT_COURSE_ID;
}
