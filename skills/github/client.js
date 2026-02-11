import { Octokit } from '@octokit/rest';

export const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
  userAgent: 'OpenClaw-GitHubSkill/1.0',
});

export const DEFAULT_OWNER = process.env.GITHUB_DEFAULT_OWNER || null;

export function validateEnv() {
  const errors = [];
  if (!process.env.GITHUB_TOKEN) {
    errors.push('GITHUB_TOKEN is not set');
  }
  return errors;
}

export function logAction(action, details) {
  const timestamp = new Date().toISOString();
  console.log(JSON.stringify({
    skill: 'GitHubSkill',
    action,
    timestamp,
    ...details,
  }));
}

export function resolveOwner(owner) {
  return owner || DEFAULT_OWNER;
}

export function validateOwnerRepo(owner, repo) {
  const errors = [];
  const resolved = resolveOwner(owner);
  if (!resolved) {
    errors.push('owner is required (set GITHUB_DEFAULT_OWNER or pass owner)');
  }
  if (!repo) {
    errors.push('repo is required');
  }
  return { errors, owner: resolved };
}

export async function getDefaultBranch(owner, repo) {
  const { data } = await octokit.repos.get({ owner, repo });
  return data.default_branch;
}

export function formatApiError(error) {
  if (error.status === 403 && error.response?.headers?.['x-ratelimit-remaining'] === '0') {
    const resetTime = parseInt(error.response.headers['x-ratelimit-reset']) * 1000;
    const resetDate = new Date(resetTime);
    return `GitHub API rate limit exceeded. Resets at ${resetDate.toLocaleString()}.`;
  }
  if (error.status === 404) {
    return 'Not found. Check that the owner, repo, and resource exist.';
  }
  if (error.status === 422) {
    return `Validation failed: ${error.message}`;
  }
  return error.message || 'Unknown GitHub API error';
}
