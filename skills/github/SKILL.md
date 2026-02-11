---
name: github-skill
description: Manage GitHub repositories, pull requests, issues, branches, and files via the GitHub REST API
user-invocable: true
requires:
  env:
    - GITHUB_TOKEN
---

# GitHubSkill

Manage GitHub repositories, pull requests, issues, branches, and files. Uses the Octokit REST client for structured, auditable operations.

## Capabilities

- **Repositories** — list, get details, create new repos
- **Issues** — list, create, update, close issues
- **Pull Requests** — list, create, merge PRs (with confirmation for protected branches)
- **Files** — read, create, update, delete files via the Contents API
- **Branches** — list, create, delete branches (with safeguards)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | Yes | Personal access token. Required scopes: `repo`, `workflow`. Create at https://github.com/settings/tokens |
| `GITHUB_DEFAULT_OWNER` | No | Default owner/org so you don't have to specify it every time |

## Commands

### Repositories

- `listRepos({ owner?, type?, sort?, limit? })` — list repos for a user/org
- `getRepo({ owner?, repo })` — get repo details (default branch, open issues, language)
- `createRepo({ name, description?, isPrivate?, autoInit? })` — create a new repo

### Issues

- `listIssues({ owner?, repo, state?, labels?, assignee?, limit? })` — list issues (excludes PRs)
- `createIssue({ owner?, repo, title, body?, labels?, assignees? })` — create an issue
- `updateIssue({ owner?, repo, issueNumber, title?, body?, state?, labels?, assignees? })` — update an issue
- `closeIssue({ owner?, repo, issueNumber })` — close an issue

### Pull Requests

- `listPulls({ owner?, repo, state?, base?, limit? })` — list PRs
- `createPull({ owner?, repo, title, body?, head, base? })` — create a PR (base defaults to default branch)
- `mergePull({ owner?, repo, pullNumber, mergeMethod?, confirmed? })` — merge a PR (requires confirmation for main/master)
- `confirmAction()` — confirm the last pending destructive action

### Files

- `readFile({ owner?, repo, path, ref? })` — read a file or list a directory
- `writeFile({ owner?, repo, path, content, message?, branch?, sha? })` — create or update a file
- `deleteFile({ owner?, repo, path, message?, branch?, sha?, confirmed? })` — delete a file (requires confirmation)

### Branches

- `listBranches({ owner?, repo, limit? })` — list branches
- `createBranch({ owner?, repo, branch, from? })` — create a branch (from defaults to default branch)
- `deleteBranch({ owner?, repo, branch, confirmed? })` — delete a branch (blocked on default branch, requires confirmation)

## Safety Rules

1. **Merge to main/master requires confirmation** — `mergePull` returns `needsConfirmation: true` when targeting a protected branch. Call again with `confirmed: true` or use `confirmAction()`.
2. **Cannot delete the default branch** — `deleteBranch` blocks this outright.
3. **File deletion requires confirmation** — `deleteFile` always asks for confirmation first.
4. **Branch deletion requires confirmation** — `deleteBranch` asks for confirmation.
5. **All mutations are logged** — every create, update, merge, and delete is logged with timestamps and details.
6. **Inputs are validated** — missing required fields return clear error messages.
7. **Rate limits are surfaced** — if GitHub returns a 403 rate limit, the error includes the reset time.

## Output Format

All functions return `{ success: boolean, ... }`:

```json
// Success
{ "success": true, "issue": { "number": 42, "title": "Bug report", "url": "..." } }

// Error
{ "success": false, "error": "title is required" }

// Needs confirmation
{ "success": false, "needsConfirmation": true, "message": "Merging PR #5 into main..." }
```

## Error Handling

| Error | Meaning |
|-------|---------|
| `GITHUB_TOKEN is not set` | Missing env var |
| `owner is required` | No owner passed and GITHUB_DEFAULT_OWNER not set |
| `Not found` | Repo, issue, branch, or file doesn't exist |
| `Validation failed` | GitHub rejected the request (e.g. duplicate branch name) |
| `Rate limit exceeded` | Too many API calls; includes reset time |
