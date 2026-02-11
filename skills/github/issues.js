import { octokit, validateEnv, logAction, validateOwnerRepo, formatApiError } from './client.js';

export async function listIssues({ owner, repo, state = 'open', labels, assignee, limit = 10 } = {}) {
  const envErrors = validateEnv();
  if (envErrors.length > 0) {
    return { success: false, error: envErrors.join(', ') };
  }

  const { errors, owner: resolved } = validateOwnerRepo(owner, repo);
  if (errors.length > 0) {
    return { success: false, error: errors.join(', ') };
  }

  try {
    const params = {
      owner: resolved,
      repo,
      state,
      per_page: limit,
    };
    if (labels) params.labels = Array.isArray(labels) ? labels.join(',') : labels;
    if (assignee) params.assignee = assignee;

    const { data } = await octokit.issues.listForRepo(params);

    // Filter out pull requests (GitHub API returns PRs as issues)
    const issues = data
      .filter(i => !i.pull_request)
      .map(i => ({
        number: i.number,
        title: i.title,
        state: i.state,
        labels: i.labels.map(l => l.name),
        assignees: i.assignees.map(a => a.login),
        url: i.html_url,
        createdAt: i.created_at,
        updatedAt: i.updated_at,
      }));

    logAction('list_issues', { owner: resolved, repo, state, count: issues.length });
    return { success: true, issues };
  } catch (error) {
    logAction('list_issues_error', { owner: resolved, repo, error: error.message });
    return { success: false, error: formatApiError(error) };
  }
}

export async function createIssue({ owner, repo, title, body, labels, assignees }) {
  const envErrors = validateEnv();
  if (envErrors.length > 0) {
    return { success: false, error: envErrors.join(', ') };
  }

  const { errors, owner: resolved } = validateOwnerRepo(owner, repo);
  if (errors.length > 0) {
    return { success: false, error: errors.join(', ') };
  }

  if (!title) {
    return { success: false, error: 'title is required' };
  }

  try {
    const params = {
      owner: resolved,
      repo,
      title,
    };
    if (body) params.body = body;
    if (labels) params.labels = Array.isArray(labels) ? labels : [labels];
    if (assignees) params.assignees = Array.isArray(assignees) ? assignees : [assignees];

    const { data } = await octokit.issues.create(params);

    const issue = {
      number: data.number,
      title: data.title,
      url: data.html_url,
      state: data.state,
    };

    logAction('create_issue', { owner: resolved, repo, number: data.number, title });
    return { success: true, issue };
  } catch (error) {
    logAction('create_issue_error', { owner: resolved, repo, title, error: error.message });
    return { success: false, error: formatApiError(error) };
  }
}

export async function updateIssue({ owner, repo, issueNumber, title, body, state, labels, assignees }) {
  const envErrors = validateEnv();
  if (envErrors.length > 0) {
    return { success: false, error: envErrors.join(', ') };
  }

  const { errors, owner: resolved } = validateOwnerRepo(owner, repo);
  if (errors.length > 0) {
    return { success: false, error: errors.join(', ') };
  }

  if (!issueNumber) {
    return { success: false, error: 'issueNumber is required' };
  }

  try {
    const params = {
      owner: resolved,
      repo,
      issue_number: issueNumber,
    };
    if (title !== undefined) params.title = title;
    if (body !== undefined) params.body = body;
    if (state !== undefined) params.state = state;
    if (labels !== undefined) params.labels = Array.isArray(labels) ? labels : [labels];
    if (assignees !== undefined) params.assignees = Array.isArray(assignees) ? assignees : [assignees];

    const { data } = await octokit.issues.update(params);

    const issue = {
      number: data.number,
      title: data.title,
      state: data.state,
      url: data.html_url,
    };

    logAction('update_issue', { owner: resolved, repo, number: issueNumber });
    return { success: true, issue };
  } catch (error) {
    logAction('update_issue_error', { owner: resolved, repo, number: issueNumber, error: error.message });
    return { success: false, error: formatApiError(error) };
  }
}

export async function closeIssue({ owner, repo, issueNumber }) {
  return updateIssue({ owner, repo, issueNumber, state: 'closed' });
}
