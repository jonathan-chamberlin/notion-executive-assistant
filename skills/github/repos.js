import { octokit, validateEnv, logAction, resolveOwner, formatApiError } from './client.js';

export async function listRepos({ owner, type = 'owner', sort = 'updated', limit = 10 } = {}) {
  const envErrors = validateEnv();
  if (envErrors.length > 0) {
    return { success: false, error: envErrors.join(', ') };
  }

  const resolved = resolveOwner(owner);

  try {
    let data;
    if (resolved) {
      ({ data } = await octokit.repos.listForUser({
        username: resolved,
        type,
        sort,
        per_page: limit,
      }));
    } else {
      ({ data } = await octokit.repos.listForAuthenticatedUser({
        type,
        sort,
        per_page: limit,
      }));
    }

    const repos = data.map(r => ({
      name: r.name,
      fullName: r.full_name,
      description: r.description,
      private: r.private,
      url: r.html_url,
      defaultBranch: r.default_branch,
      updatedAt: r.updated_at,
    }));

    logAction('list_repos', { owner: resolved, count: repos.length });
    return { success: true, repos };
  } catch (error) {
    logAction('list_repos_error', { owner: resolved, error: error.message });
    return { success: false, error: formatApiError(error) };
  }
}

export async function getRepo({ owner, repo }) {
  const envErrors = validateEnv();
  if (envErrors.length > 0) {
    return { success: false, error: envErrors.join(', ') };
  }

  const resolved = resolveOwner(owner);
  if (!resolved) {
    return { success: false, error: 'owner is required (set GITHUB_DEFAULT_OWNER or pass owner)' };
  }
  if (!repo) {
    return { success: false, error: 'repo is required' };
  }

  try {
    const { data } = await octokit.repos.get({ owner: resolved, repo });

    const repoInfo = {
      name: data.name,
      fullName: data.full_name,
      description: data.description,
      private: data.private,
      url: data.html_url,
      defaultBranch: data.default_branch,
      openIssues: data.open_issues_count,
      language: data.language,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    logAction('get_repo', { owner: resolved, repo });
    return { success: true, repo: repoInfo };
  } catch (error) {
    logAction('get_repo_error', { owner: resolved, repo, error: error.message });
    return { success: false, error: formatApiError(error) };
  }
}

export async function createRepo({ name, description, isPrivate = true, autoInit = true }) {
  const envErrors = validateEnv();
  if (envErrors.length > 0) {
    return { success: false, error: envErrors.join(', ') };
  }

  if (!name) {
    return { success: false, error: 'name is required' };
  }

  try {
    const { data } = await octokit.repos.createForAuthenticatedUser({
      name,
      description,
      private: isPrivate,
      auto_init: autoInit,
    });

    const repoInfo = {
      name: data.name,
      fullName: data.full_name,
      url: data.html_url,
      private: data.private,
      defaultBranch: data.default_branch,
    };

    logAction('create_repo', { name, private: isPrivate });
    return { success: true, repo: repoInfo };
  } catch (error) {
    logAction('create_repo_error', { name, error: error.message });
    return { success: false, error: formatApiError(error) };
  }
}
