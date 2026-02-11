import { octokit, validateEnv, logAction, validateOwnerRepo, getDefaultBranch, formatApiError } from './client.js';

export async function listBranches({ owner, repo, limit = 30 } = {}) {
  const envErrors = validateEnv();
  if (envErrors.length > 0) {
    return { success: false, error: envErrors.join(', ') };
  }

  const { errors, owner: resolved } = validateOwnerRepo(owner, repo);
  if (errors.length > 0) {
    return { success: false, error: errors.join(', ') };
  }

  try {
    const { data } = await octokit.repos.listBranches({
      owner: resolved,
      repo,
      per_page: limit,
    });

    const branches = data.map(b => ({
      name: b.name,
      sha: b.commit.sha,
      protected: b.protected,
    }));

    logAction('list_branches', { owner: resolved, repo, count: branches.length });
    return { success: true, branches };
  } catch (error) {
    logAction('list_branches_error', { owner: resolved, repo, error: error.message });
    return { success: false, error: formatApiError(error) };
  }
}

export async function createBranch({ owner, repo, branch, from }) {
  const envErrors = validateEnv();
  if (envErrors.length > 0) {
    return { success: false, error: envErrors.join(', ') };
  }

  const { errors, owner: resolved } = validateOwnerRepo(owner, repo);
  if (errors.length > 0) {
    return { success: false, error: errors.join(', ') };
  }

  if (!branch) {
    return { success: false, error: 'branch name is required' };
  }

  try {
    // Get the SHA to branch from
    const sourceBranch = from || await getDefaultBranch(resolved, repo);
    const { data: ref } = await octokit.git.getRef({
      owner: resolved,
      repo,
      ref: `heads/${sourceBranch}`,
    });

    const { data } = await octokit.git.createRef({
      owner: resolved,
      repo,
      ref: `refs/heads/${branch}`,
      sha: ref.object.sha,
    });

    logAction('create_branch', { owner: resolved, repo, branch, from: sourceBranch, sha: data.object.sha });
    return {
      success: true,
      branch: {
        name: branch,
        sha: data.object.sha,
        from: sourceBranch,
      },
    };
  } catch (error) {
    logAction('create_branch_error', { owner: resolved, repo, branch, error: error.message });
    return { success: false, error: formatApiError(error) };
  }
}

export async function deleteBranch({ owner, repo, branch, confirmed = false }) {
  const envErrors = validateEnv();
  if (envErrors.length > 0) {
    return { success: false, error: envErrors.join(', ') };
  }

  const { errors, owner: resolved } = validateOwnerRepo(owner, repo);
  if (errors.length > 0) {
    return { success: false, error: errors.join(', ') };
  }

  if (!branch) {
    return { success: false, error: 'branch name is required' };
  }

  // Prevent deletion of default branch
  try {
    const defaultBranch = await getDefaultBranch(resolved, repo);
    if (branch === defaultBranch) {
      return { success: false, error: `Cannot delete the default branch (${defaultBranch}).` };
    }
  } catch (error) {
    return { success: false, error: formatApiError(error) };
  }

  if (!confirmed) {
    return {
      success: false,
      needsConfirmation: true,
      message: `Delete branch '${branch}' from ${repo}? Call again with confirmed: true to proceed.`,
    };
  }

  try {
    await octokit.git.deleteRef({
      owner: resolved,
      repo,
      ref: `heads/${branch}`,
    });

    logAction('delete_branch', { owner: resolved, repo, branch });
    return { success: true, message: `Branch '${branch}' deleted.` };
  } catch (error) {
    logAction('delete_branch_error', { owner: resolved, repo, branch, error: error.message });
    return { success: false, error: formatApiError(error) };
  }
}
