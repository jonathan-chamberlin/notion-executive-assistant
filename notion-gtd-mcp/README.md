# GTD MCP Server for Notion

An MCP (Model Context Protocol) server that enables Claude Code to act as a GTD (Getting Things Done) executive assistant. When you say "check my In Tray", Claude will process new tasks, research URLs, clarify next actions, and update Notion with findings.

## Features

- **In Tray Processing**: Query and process tasks tagged with "In Tray"
- **Task Clarification**: Rename vague tasks to clear, actionable next actions
- **URL Research**: Automatically fetch and parse URLs found in tasks
- **Form Detection**: Extract registration forms and questions from web pages
- **Area Assignment**: Auto-categorize tasks to relevant life areas
- **Waiting Task Tracking**: Check Outlook for replies on tasks you're waiting for
- **Slack Notifications**: Get notified when email replies are received

## Installation

1. Clone or copy this directory
2. Install dependencies:

```bash
cd notion-gtd-mcp
npm install
```

3. Build the TypeScript:

```bash
npm run build
```

4. Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

## Configuration

### Required: Notion Setup

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Create a new integration
3. Copy the "Internal Integration Token"
4. Share your "Resources (ORIGINAL)" database with the integration
5. Get the database ID from the database URL (the part after the workspace name and before the `?`)

Set in `.env`:
```
NOTION_API_KEY=your_integration_token
NOTION_DATABASE_ID=your_database_id
NOTION_AREAS_DATABASE_ID=your_areas_database_id  # Optional
```

### Optional: Microsoft Outlook Setup

For checking email replies on "Waiting" tasks:

1. Go to [portal.azure.com](https://portal.azure.com) → App registrations
2. Create a new app registration
3. Add the `Mail.Read` and `offline_access` delegated permissions
4. Create a client secret
5. Complete the OAuth flow to get a refresh token

Set in `.env`:
```
AZURE_CLIENT_ID=your_client_id
AZURE_CLIENT_SECRET=your_client_secret
AZURE_TENANT_ID=your_tenant_id
OUTLOOK_REFRESH_TOKEN=your_refresh_token
```

### Optional: Slack Setup

For receiving notifications:

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Create a new app (or use existing)
3. Enable Incoming Webhooks
4. Create a webhook for your channel

Set in `.env`:
```
SLACK_WEBHOOK_URL=your_webhook_url
```

## Claude Code Configuration

Add to your Claude Code MCP settings (`~/.claude/settings.json` or VS Code settings):

```json
{
  "mcpServers": {
    "notion-gtd": {
      "command": "node",
      "args": ["path/to/notion-gtd-mcp/dist/index.js"],
      "env": {
        "NOTION_API_KEY": "your_api_key",
        "NOTION_DATABASE_ID": "your_database_id"
      }
    }
  }
}
```

Or use environment variables from a shell that has them set:

```json
{
  "mcpServers": {
    "notion-gtd": {
      "command": "node",
      "args": ["path/to/notion-gtd-mcp/dist/index.js"]
    }
  }
}
```

## Available Tools

### Notion Tools

| Tool | Description |
|------|-------------|
| `notion_query_intray` | Get tasks with "In Tray" tag (excludes "AI-Processed") |
| `notion_query_waiting` | Get tasks with "Waiting" tag |
| `notion_get_page` | Read a page's title, properties, and content |
| `notion_get_linked_pages` | Read all pages linked within content |
| `notion_rename_page` | Update page title to clarified task |
| `notion_add_toggle` | Add a toggle block with original task and findings |
| `notion_update_tags` | Add/remove tags (e.g., remove "In Tray", add "AI-Processed") |
| `notion_set_areas` | Set the Areas relation field |
| `notion_get_areas_list` | Get available Areas for assignment |

### Web Tools

| Tool | Description |
|------|-------------|
| `web_fetch_url` | Fetch and parse a URL, return structured content |
| `web_extract_form` | Extract form fields and questions from a page |

### Email Tools

| Tool | Description |
|------|-------------|
| `outlook_search_from_sender` | Search for emails from a specific sender |
| `outlook_check_reply` | Check if there's a reply from someone |

### Slack Tools

| Tool | Description |
|------|-------------|
| `slack_notify_reply` | Notify that an email reply was received |
| `slack_send_message` | Send a custom message |
| `slack_send_summary` | Send a processing summary |

## Usage Examples

### Basic: Check In Tray

Say to Claude Code:
> "Check my In Tray and process new tasks"

Claude will:
1. Query unprocessed tasks from your In Tray
2. For each task, read the content and research any URLs
3. Rename vague tasks to clear next actions
4. Add a toggle with original task and findings
5. Assign relevant Areas
6. Remove "In Tray" tag and add "AI-Processed"

### Check Waiting Tasks

Say to Claude Code:
> "Check my waiting tasks for replies"

Claude will:
1. Query tasks with "Waiting" tag
2. Extract sender information from each task
3. Search Outlook for recent emails from that sender
4. Send Slack notification for any replies found

### Example Transformation

**Before**: Task titled "Register for this career networking event" with Eventbrite link

**After**:
- **Title**: "Register for Tech Careers Mixer - Jan 25 @ 6pm - answer 3 questions"
- **Toggle content**:
  ```
  Original task: Register for this career networking event https://eventbrite.com/...

  Questions to answer:
  1. Why are you interested in attending?
  2. What's your current role?
  3. Dietary restrictions?
  ```
- **Areas**: University, Influence

## Database Schema

Your Notion database should have these properties:

| Property | Type | Notes |
|----------|------|-------|
| Name | Title | Task title |
| Tags | Multi-select | Includes "Task", "In Tray", "Waiting", "AI-Processed" |
| Date | Date | Due/scheduled date |
| Archived | Checkbox | Completed tasks |
| Priority | Select | 1 Success, 2 Hard Deadline, 3 High, 4 Medium, 5 Low |
| Areas | Relation | Links to Areas table |
| Created Time | Created time | Auto-set |
| Last edited time | Last edited | Auto-set |

## Development

```bash
# Watch mode
npm run dev

# Build
npm run build

# Clean build directory
npm run clean
```

## License

MIT
