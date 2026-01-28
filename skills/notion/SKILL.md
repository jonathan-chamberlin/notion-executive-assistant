---
name: notion-skill
description: Manage tasks in Notion — the single source of truth for all tasks, projects, and workflows
user-invocable: true
requires:
  env:
    - NOTION_API_KEY
    - NOTION_TASKS_DATABASE_ID
---

# NotionSkill

Manage tasks in Notion. Notion is the single source of truth for all tasks, projects, and workflows.

## Capabilities

- **Query tasks** by status, due date, assignee, or custom filters
- **Create tasks** with title, status, due date, and metadata
- **Update tasks** (change status, due date, add notes)
- **Link tasks** to calendar events and email threads
- **Search** across all task properties

## Commands

### List Tasks
```
/tasks [filter]
```
Examples:
- `/tasks` - Show all active tasks
- `/tasks due:today` - Tasks due today
- `/tasks status:in-progress` - Tasks currently in progress
- `/tasks overdue` - All overdue tasks

### Create Task
```
/task add <title> [options]
```
Options:
- `due:<date>` - Set due date (today, tomorrow, 2024-01-15)
- `status:<status>` - Set initial status
- `priority:<high|medium|low>` - Set priority

Examples:
- `/task add Review quarterly report due:friday priority:high`
- `/task add Call dentist due:tomorrow`

### Update Task
```
/task update <task-id-or-title> <changes>
```
Examples:
- `/task update "Review report" status:done`
- `/task update abc123 due:next-monday`

### Complete Task
```
/task done <task-id-or-title>
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NOTION_API_KEY` | Yes | Notion integration token |
| `NOTION_TASKS_DATABASE_ID` | Yes | Database ID for tasks |

## Notion Database Schema

The tasks database has these properties. **Do not infer or guess property names — use these exactly.**

### Primary Fields (check these first)

| Property | Type | Notes |
|----------|------|-------|
| `Name` | title | Task name. Always required. |
| `Priority` | select | High, Medium, Low |
| `Date` | date | Includes time. General-purpose date. |
| `Due Date (assignments only)` | date | Includes time. For assignment deadlines specifically. |
| `Tags` | multi_select | Categorization tags |

### Secondary Fields

| Property | Type | Notes |
|----------|------|-------|
| `Areas` | relation (two-way) | Links to Areas database |
| `Sub-Task` | relation (two-way) | Links to parent/child tasks |
| `Archived` | checkbox | Use instead of deleting |
| `Created Time` | created_time | Auto-populated |
| `Last edited time` | last_edited_time | Auto-populated |

### Page Content

| Property | Type | Notes |
|----------|------|-------|
| `content_rich_text` | rich_text | Summary or body text within the page. Use this for reading/writing page content without needing to access block children. For full page body access, use the Notion blocks API (`blocks.children.list` / `blocks.children.append`). |

**Important:** The `Content` property is for lightweight text. For structured page content (headings, lists, embeds), use the blocks API to read and modify the page body directly.

## Safety Rules

1. **Never delete tasks** - only archive or mark as cancelled
2. **Log all mutations** - every create/update is logged with timestamp
3. **Validate inputs** - reject malformed dates, unknown statuses
4. **Fail gracefully** - if Notion API fails, report error clearly without crashing

## Output Format

All responses use structured JSON internally, rendered as human-readable text:

```
✅ Task created: "Review quarterly report"
   Due: Friday, Jan 17
   Priority: High
   ID: abc123
```
