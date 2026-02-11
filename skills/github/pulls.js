import { octokit, validateEnv, logAction, validateOwnerRepo, getDefaultBranch, formatApiError } from './client.js';

// Pending confirmation for destructive operations
let pendingAction = null;

export async function listPulls({ owner, repo, state = 'open', base, limit = 10 } = {}) {
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
    if (base) params.base = base;

    const { data } = await octokit.pulls.list(params);

    const pulls = data.map(pr => ({
      number: pr.number,
      title: pr.title,
      state: pr.state,
      head: pr.head.ref,
      base: pr.base.ref,
      author: pr.user.login,
      mergeable: pr.mergeable,
      url: pr.html_url,
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
    }));

    logAction('list_pulls', { owner: resolved, repo, state, count: pulls.length });
    return { success: true, pulls };
  } catch (error) {
    logAction('list_pulls_error', { owner: resolved, repo, error: error.message });
    return { success: false, error: formatApiError(error) };
  }
}

export async function createPull({ owner, repo, title, body, head, base }) {
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
  if (!head) {
    return { success: false, error: 'head branch is required' };
  }

  try {
    // Default base to repo's default branch if not specified
    const baseBranch = base || await getDefaultBranch(resolved, repo);

    const { data } = await octokit.pulls.create({
      owner: resolved,
      repo,
      title,
      body: body || '',
      head,
      base: baseBranch,
    });

    const pull = {
      number: data.number,
      title: data.title,
      head: data.head.ref,
      base: data.base.ref,
      url: data.html_url,
      state: data.state,
    };

    logAction('create_pull', { owner: resolved, repo, number: data.number, title, head, base: baseBranch });
    return { success: true, pull };
  } catch (error) {
    logAction('create_pull_error', { owner: resolved, repo, title, error: error.message });
    return { success: false, error: formatApiError(error) };
  }
}

export async function mergePull({ owner, repo, pullNumber, mergeMethod = 'squash', confirmed = false }) {
  const envErrors = validateEnv();
  if (envErrors.length > 0) {
    return { success: false, error: envErrors.join(', ') };
  }

  const { errors, owner: resolved } = validateOwnerRepo(owner, repo);
  if (errors.length > 0) {
    return { success: false, error: errors.join(', ') };
  }

  if (!pullNumber) {
    return { success: false, error: 'pullNumber is required' };
  }

  try {
    // Fetch PR details to check target branch
    const { data: pr } = await octokit.pulls.get({
      owner: resolved,
      repo,
      pull_number: pullNumber,
    });

    const targetBranch = pr.base.ref;
    const isProtected = targetBranch === 'main' || targetBranch === 'master';

    if (isProtected && !confirmed) {
      pendingAction = { type: 'merge_pull', owner: resolved, repo, pullNumber, mergeMethod };
      return {
        success: false,
        needsConfirmation: true,
        message: `Merging PR #${pullNumber} into ${targetBranch}. Call again with confirmed: true to proceed.`,
        pull: {
          number: pr.number,
          title: pr.title,
          head: pr.head.ref,
          base: targetBranch,
        },
      };
    }

    const { data } = await octokit.pulls.merge({
      owner: resolved,
      repo,
      pull_number: pullNumber,
      merge_method: mergeMethod,
    });

    logAction('merge_pull', {
      owner: resolved,
      repo,
      pullNumber,
      mergeMethod,
      sha: data.sha,
      baseBranch: targetBranch,
    });

    return {
      success: true,
      merge: {
        sha: data.sha,
        message: data.message,
        pullNumber,
        baseBranch: targetBranch,
      },
    };
  } catch (error) {
    logAction('merge_pull_error', { owner: resolved, repo, pullNumber, error: error.message });
    return { success: false, error: formatApiError(error) };
  }
}

export async function confirmAction() {
  if (!pendingAction) {
    return { success: false, error: 'No pending action to confirm.' };
  }

  const action = pendingAction;
  pendingAction = null;

  if (action.type === 'merge_pull') {
    return mergePull({
      owner: action.owner,
      repo: action.repo,
      pullNumber: action.pullNumber,
      mergeMethod: action.mergeMethod,
      confirmed: true,
    });
  }

  return { success: false, error: `Unknown pending action type: ${action.type}` };
}
