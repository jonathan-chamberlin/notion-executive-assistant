import { octokit, validateEnv, logAction, validateOwnerRepo, getDefaultBranch, formatApiError } from './client.js';

export async function readFile({ owner, repo, path, ref }) {
  const envErrors = validateEnv();
  if (envErrors.length > 0) {
    return { success: false, error: envErrors.join(', ') };
  }

  const { errors, owner: resolved } = validateOwnerRepo(owner, repo);
  if (errors.length > 0) {
    return { success: false, error: errors.join(', ') };
  }

  if (!path) {
    return { success: false, error: 'path is required' };
  }

  try {
    const params = { owner: resolved, repo, path };
    if (ref) params.ref = ref;

    const { data } = await octokit.repos.getContent(params);

    if (Array.isArray(data)) {
      // It's a directory listing
      const entries = data.map(entry => ({
        name: entry.name,
        type: entry.type,
        path: entry.path,
        size: entry.size,
      }));
      logAction('read_dir', { owner: resolved, repo, path, count: entries.length });
      return { success: true, type: 'directory', entries };
    }

    // It's a file
    const content = data.encoding === 'base64'
      ? Buffer.from(data.content, 'base64').toString('utf-8')
      : data.content;

    logAction('read_file', { owner: resolved, repo, path, sha: data.sha });
    return {
      success: true,
      type: 'file',
      file: {
        path: data.path,
        sha: data.sha,
        size: data.size,
        content,
      },
    };
  } catch (error) {
    logAction('read_file_error', { owner: resolved, repo, path, error: error.message });
    return { success: false, error: formatApiError(error) };
  }
}

export async function writeFile({ owner, repo, path, content, message, branch, sha }) {
  const envErrors = validateEnv();
  if (envErrors.length > 0) {
    return { success: false, error: envErrors.join(', ') };
  }

  const { errors, owner: resolved } = validateOwnerRepo(owner, repo);
  if (errors.length > 0) {
    return { success: false, error: errors.join(', ') };
  }

  if (!path) {
    return { success: false, error: 'path is required' };
  }
  if (content === undefined || content === null) {
    return { success: false, error: 'content is required' };
  }

  try {
    const targetBranch = branch || await getDefaultBranch(resolved, repo);
    const commitMessage = message || `Update ${path}`;

    const params = {
      owner: resolved,
      repo,
      path,
      message: commitMessage,
      content: Buffer.from(content).toString('base64'),
      branch: targetBranch,
    };

    // If sha is provided, it's an update; otherwise try to get existing sha
    if (sha) {
      params.sha = sha;
    } else {
      try {
        const { data: existing } = await octokit.repos.getContent({
          owner: resolved,
          repo,
          path,
          ref: targetBranch,
        });
        if (!Array.isArray(existing)) {
          params.sha = existing.sha;
        }
      } catch (e) {
        // File doesn't exist yet — creating new file, no sha needed
      }
    }

    const { data } = await octokit.repos.createOrUpdateFileContents(params);

    logAction('write_file', {
      owner: resolved,
      repo,
      path,
      branch: targetBranch,
      commitSha: data.commit.sha,
    });

    return {
      success: true,
      commit: {
        sha: data.commit.sha,
        message: data.commit.message,
        url: data.commit.html_url,
      },
      file: {
        path: data.content.path,
        sha: data.content.sha,
      },
    };
  } catch (error) {
    logAction('write_file_error', { owner: resolved, repo, path, error: error.message });
    return { success: false, error: formatApiError(error) };
  }
}

export async function deleteFile({ owner, repo, path, message, branch, sha, confirmed = false }) {
  const envErrors = validateEnv();
  if (envErrors.length > 0) {
    return { success: false, error: envErrors.join(', ') };
  }

  const { errors, owner: resolved } = validateOwnerRepo(owner, repo);
  if (errors.length > 0) {
    return { success: false, error: errors.join(', ') };
  }

  if (!path) {
    return { success: false, error: 'path is required' };
  }

  if (!confirmed) {
    return {
      success: false,
      needsConfirmation: true,
      message: `Delete ${path} from ${repo}? Call again with confirmed: true to proceed.`,
    };
  }

  try {
    const targetBranch = branch || await getDefaultBranch(resolved, repo);

    // Get file sha if not provided
    let fileSha = sha;
    if (!fileSha) {
      const { data: existing } = await octokit.repos.getContent({
        owner: resolved,
        repo,
        path,
        ref: targetBranch,
      });
      fileSha = existing.sha;
    }

    const { data } = await octokit.repos.deleteFile({
      owner: resolved,
      repo,
      path,
      message: message || `Delete ${path}`,
      sha: fileSha,
      branch: targetBranch,
    });

    logAction('delete_file', {
      owner: resolved,
      repo,
      path,
      branch: targetBranch,
      commitSha: data.commit.sha,
    });

    return {
      success: true,
      commit: {
        sha: data.commit.sha,
        message: data.commit.message,
      },
    };
  } catch (error) {
    logAction('delete_file_error', { owner: resolved, repo, path, error: error.message });
    return { success: false, error: formatApiError(error) };
  }
}
