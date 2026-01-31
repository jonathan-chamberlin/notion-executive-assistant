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

### Quick Date Queries (most common)

- **"tasks today"** → calls `tasksToday()` — returns tasks where Date = today, Archived = false
- **"tasks yesterday"** → calls `tasksYesterday()` — returns tasks where Date = yesterday, Archived = false
- **"tasks tomorrow"** → calls `tasksTomorrow()` — returns tasks where Date = tomorrow, Archived = false

These are the primary way the user checks tasks. Always use these when the user asks about today's/yesterday's/tomorrow's tasks.

### List Tasks with Filters

`queryTasks(filter)` accepts:
- `date` — any date string: `'today'`, `'yesterday'`, `'tomorrow'`, `'monday'`, `'2026-01-28'`
- `due` — `'today'` or `'overdue'` (filters on `Due Date (assignments only)`)
- `priority` — `'high'`, `'medium'`, `'low'`
- `tag` — filter by tag name
- `includeArchived` — set `true` to include archived tasks (default: excludes archived)

Examples:
- "Show my tasks" → `queryTasks({})` (all non-archived tasks)
- "High priority tasks" → `queryTasks({ priority: 'high' })`
- "Tasks tagged homework" → `queryTasks({ tag: 'homework' })`
- "Overdue assignments" → `queryTasks({ due: 'overdue' })`

### Search Tasks

`searchTasks(query)` — search tasks by name. Returns matching non-archived tasks.

### Create Task

`createTask({ name, date, dueDate, priority, tags, content })`

- `name` (required) — task title
- `date` — general date (today, tomorrow, friday, 2026-01-28)
- `dueDate` — assignment deadline
- `priority` — high, medium, low
- `tags` — array of tag names (note: "Task" tag is auto-added)
- `content` — body text

## Natural Language Task Creation

When the user wants to create a task, parse their message and call `createTask()`. The "Task" tag is automatically added.

### Trigger Phrases

Recognize these patterns as task creation requests:
- "Remind me to..."
- "Add task..."
- "Create task..."
- "I need to..."
- "Don't forget to..."
- "Remember to..."
- "Todo:..."
- "Add to my list:..."
- "Schedule..."
- "Put on my calendar..." (if no specific time, create task; if specific time, consider calendar)

### Parsing Rules

1. **Extract the task name** — the core action the user wants to do
2. **Extract date** — look for time references (all dates use Eastern Time):
   - "tomorrow" → `date: 'tomorrow'`
   - "on Friday" → `date: 'friday'`
   - "next week" → `date: 'next week'`
   - "today" → `date: 'today'`
   - **No date mentioned → defaults to today (Eastern Time)**. You don't need to pass a date; the system auto-sets it.
3. **Extract priority** — look for urgency words:
   - "urgent", "ASAP", "important", "critical" → `priority: 'high'`
   - "whenever", "low priority", "eventually" → `priority: 'low'`
   - No priority mentioned → defaults to Low
4. **Extract tags** — look for category hints:
   - "work", "job", "office" → add tag "Work"
   - "personal", "home" → add tag "Personal"
   - "school", "class", "homework", "assignment" → add tag "School"

### Examples

| User says | Parsed as |
|-----------|-----------|
| "Remind me to call the dentist tomorrow" | `createTask({ name: "Call the dentist", date: "tomorrow" })` |
| "Add task: buy groceries" | `createTask({ name: "Buy groceries" })` — no date specified |
| "I need to finish the report by Friday, it's urgent" | `createTask({ name: "Finish the report", date: "friday", priority: "high" })` |
| "Don't forget to email John about the project" | `createTask({ name: "Email John about the project" })` — no date specified |
| "Remind me to submit homework on Monday" | `createTask({ name: "Submit homework", date: "monday", tags: ["School"] })` |
| "Todo: review PR" | `createTask({ name: "Review PR" })` — no date specified |
| "Schedule a call with Sarah next week" | `createTask({ name: "Call with Sarah", date: "next week" })` |
| "Make urgent task called test" | `createTask({ name: "test", priority: "high" })` — no date specified |

### Confirmation

After creating a task, confirm with the user:
```
✅ Created: "Call the dentist"
   Date: Tomorrow (Jan 31)
   Tags: Task
```

### Update Task

`updateTask(taskId, updates)` — update any field: `name`, `date`, `dueDate`, `priority`, `tags`, `content`, `archived`

### Complete/Archive Task

`completeTask(taskId)` — sets Archived = true

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
