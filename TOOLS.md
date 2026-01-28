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
**Fetch URLs:** Must ask user first, unless the domain is whitelisted below.

### Domain Whitelist

Domains listed here may be fetched without asking:

```
(none yet — add domains as the user approves them)
```

To add a domain: when the user approves fetching from a new domain, add it here.

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
