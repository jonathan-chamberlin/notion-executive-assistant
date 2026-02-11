---
name: canvas-skill
description: Read course content from Canvas LMS — assignments, pages, discussions, and modules for Northeastern University
user-invocable: true
requires:
  env:
    - CANVAS_API_TOKEN
    - CANVAS_BASE_URL
---

# CanvasSkill

Read course content from Canvas LMS at Northeastern University. Canvas is the source of truth for assignments, course pages, and discussion posts.

## Capabilities

- **List courses** — see all active courses with IDs
- **View assignments** — list assignments with due dates, descriptions, rubrics
- **Read pages** — get full page content from any course
- **Read discussions** — list discussion topics and read all entries/replies
- **Upcoming assignments** — cross-course view of what's due soon
- **Sync to Notion** — create Notion tasks for upcoming assignments automatically

## Commands

### List Courses

`listCourses()` — returns all active courses.

Example: "What courses am I enrolled in?"

### Get Course Details

`getCourse({ courseId })` — returns course info including syllabus.

### List Assignments

`listAssignments({ courseId, bucket, orderBy, limit })`

- `courseId` (required) — the Canvas course ID
- `bucket` — filter: `'upcoming'`, `'past'`, `'overdue'`, `'unsubmitted'`, `'future'`
- `orderBy` — `'due_at'` (default), `'name'`
- `limit` — max results (default 30)

Examples:
- "Show CY2550 assignments" → `listAssignments({ courseId: <id> })`
- "What assignments are overdue?" → `listAssignments({ courseId: <id>, bucket: 'overdue' })`

### Get Assignment Details

`getAssignment({ courseId, assignmentId })` — returns full description, rubric, due date.

Example: "Read the Unit 3 assignment details"

### Upcoming Assignments (All Courses)

`getUpcomingAssignments({ daysAhead })` — scans all active courses for assignments due within `daysAhead` days (default 14). Sorted by due date.

Examples:
- "What's due this week?" → `getUpcomingAssignments({ daysAhead: 7 })`
- "What assignments are coming up?" → `getUpcomingAssignments()`

### List Pages

`listPages({ courseId, searchTerm, limit })`

- `searchTerm` — optional text filter
- Returns page titles and URL slugs (use the slug with `getPage`)

### Read a Page

`getPage({ courseId, pageUrl })` — returns full page content as plain text.

- `pageUrl` is the URL slug from `listPages` (e.g., `'week-5-overview'`)

### List Discussion Topics

`listDiscussions({ courseId, limit })` — returns discussion topics with post counts.

### Read a Discussion Topic

`getDiscussion({ courseId, topicId })` — returns the topic prompt/instructions.

### Read Discussion Entries

`getDiscussionEntries({ courseId, topicId })` — returns all posts and replies with author names.

Example: "Show me the discussion posts for topic 12345"

### Sync Assignments to Notion

`syncAssignmentsToNotion({ daysAhead })` — fetches upcoming assignments and creates Notion tasks for any that don't already exist.

- Sets priority: high (due within 3 days), medium (within 7 days), low (beyond 7 days)
- Tags with `School` and the course name
- Skips assignments that already have a matching Notion task

Example: "Sync my Canvas assignments to Notion"

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CANVAS_API_TOKEN` | Yes | Canvas personal access token |
| `CANVAS_BASE_URL` | Yes | Canvas instance URL (default: `https://northeastern.instructure.com`) |
| `CANVAS_DEFAULT_COURSE_ID` | No | Default course ID for quick lookups |

## Safety Rules

1. **Read-only.** Never submit assignments, post to discussions, or modify any Canvas data.
2. All submissions happen manually by the user through the Canvas web interface.
3. Never expose the Canvas API token in messages or logs.
4. Respect rate limits — Canvas allows ~700 requests per 10 minutes.

## Output Format

All responses use structured JSON internally, rendered as human-readable text:

```
📚 Upcoming Assignments (next 7 days):

1. ENGW3309: Unit 3 Analytical Response
   Due: Feb 18, 2026 at 11:59 PM
   Points: 100

2. CY2550: Project 6 Submission
   Due: Feb 20, 2026 at 11:59 PM
   Points: 50
```
