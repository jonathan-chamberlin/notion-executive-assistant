# GTD AI Executive Assistant

An MCP server that turns Claude Code into a GTD (Getting Things Done) executive assistant for Notion.

## How It Works

```
┌─────────────────┐
│  Claude Code    │  ← "Check my In Tray"
│  (Orchestrator) │
└────────┬────────┘
         │ MCP Protocol (stdio)
         ▼
┌─────────────────┐
│ notion-gtd-mcp  │  ← TypeScript MCP Server
│    Server       │
└────────┬────────┘
         │
    ┌────┴────┬────────┬────────┐
    ▼         ▼        ▼        ▼
 Notion    Web      Outlook   Slack
  API    Scraping    API       API
```

### The Flow

1. **You say**: "Check my In Tray and process new tasks"

2. **Claude queries Notion** via `notion_query_intray` → finds tasks tagged "In Tray" without "AI-Processed"

3. **For each task, Claude**:
   - Reads the page content and properties
   - Fetches any URLs found (event pages, job postings, etc.)
   - Analyzes what the task actually requires
   - Renames vague titles to clear next actions
   - Adds a toggle with original task + research findings
   - Auto-assigns relevant Areas (University, Health, etc.)
   - Marks as processed (removes "In Tray", adds "AI-Processed")

4. **For waiting tasks**: Checks Outlook for replies, sends Slack notifications if found

### Example Transformation

**Before**: "Register for this career networking event https://eventbrite.com/..."

**After**:
- **Title**: "Register for Tech Careers Mixer - Jan 25 @ 6pm - answer 3 questions"
- **Toggle**: Contains original task + the 3 registration questions
- **Areas**: University, Influence

## Project Structure

```
notion-gtd-mcp/
├── src/
│   ├── index.ts          # MCP server entry point
│   ├── tools/            # Tool definitions (notion, web, outlook, slack)
│   ├── services/         # API clients
│   └── utils/            # Error handling, formatting
├── dist/                 # Compiled JS (ready to run)
├── .env                  # Your API keys (gitignored)
└── README.md             # Detailed setup instructions
```

## Quick Start

1. `cd notion-gtd-mcp && npm install && npm run build`
2. Fill in `.env` with your Notion API key and database ID
3. Add to Claude Code MCP settings (see `notion-gtd-mcp/README.md`)
4. Say "Check my In Tray"

## Available Tools

| Category | Tools |
|----------|-------|
| Notion | query_intray, query_waiting, get_page, get_linked_pages, rename_page, add_toggle, update_tags, set_areas, get_areas_list |
| Web | fetch_url, extract_form |
| Outlook | search_from_sender, check_reply |
| Slack | notify_reply, send_message, send_summary |
