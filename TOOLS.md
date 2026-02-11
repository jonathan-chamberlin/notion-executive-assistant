# TOOLS.md — Tool Rules & Environment Notes

## Shell Rules

**Mode: Read-only.**

Allowed commands (exhaustive list):
- `ls`, `dir`, `tree` — list files/directories
- `cat`, `head`, `tail`, `less`, `type` — read file contents
- `git status`, `git log`, `git diff`, `git branch`, `git show` — repository inspection
- `echo`, `date`, `whoami`, `pwd` — environment info
- `pnpm list`, `node -v`, `pnpm -v` — dependency/runtime info

Everything else requires explicit user permission.

## Web Rules

**Search:** Allowed freely.
**Fetch URLs:** Allowed freely.

**Domain whitelist** (fetch without asking):
- `northeastern.instructure.com` — Canvas LMS API

## Skills

### Notion
- Location: `skills/notion/`
- Use for: task queries, task creation, task updates
- Reference: `skills/notion/SKILL.md`

### Email
- Location: `skills/email/`
- Use for: reading inbox, sending emails (with user confirmation)
- Reference: `skills/email/SKILL.md`

### Calendar
- Location: `skills/calendar/`
- Use for: checking schedule, creating events (with user confirmation)
- Reference: `skills/calendar/SKILL.md`

### Canvas
- Location: `skills/canvas/`
- Use for: reading Canvas LMS course content — assignments, pages, discussions, upcoming due dates
- Reference: `skills/canvas/SKILL.md`
