# GTD MCP Server - Implementation Plan

## Current Status: Phase 1 Complete

The core MCP server is built and compiles. All 16 tools are implemented.

---

## Next Steps

### 1. Configure & Test Notion Connection
- [ ] Get Notion Integration Token from [notion.so/my-integrations](https://notion.so/my-integrations)
- [ ] Share "Resources (ORIGINAL)" database with the integration
- [ ] Copy database ID from the URL
- [ ] Add credentials to `.env`
- [ ] Test: Run server and call `notion_query_intray`

### 2. Add MCP to Claude Code
- [ ] Add server config to Claude Code settings:
  ```json
  {
    "mcpServers": {
      "notion-gtd": {
        "command": "node",
        "args": ["C:/Repositories for Git/claude-skill-testing/notion-gtd-mcp/dist/index.js"],
        "env": {
          "NOTION_API_KEY": "your_key",
          "NOTION_DATABASE_ID": "your_db_id"
        }
      }
    }
  }
  ```
- [ ] Restart Claude Code
- [ ] Verify tools appear with `/mcp`

### 3. Test Core Workflow
- [ ] Create a test task in Notion with "In Tray" and "Task" tags
- [ ] Say "Check my In Tray"
- [ ] Verify: task gets renamed, toggle added, tags updated

### 4. Test Web Research
- [ ] Add a task with an Eventbrite/event URL
- [ ] Process it and verify URL content is fetched
- [ ] Check that form questions are extracted

---

## Future Phases (Optional)

### Phase 2: Outlook Integration
- [ ] Create Azure App Registration
- [ ] Add Mail.Read permission
- [ ] Complete OAuth flow to get refresh token
- [ ] Add credentials to `.env`
- [ ] Test `outlook_check_reply` with a known sender

### Phase 3: Slack Notifications
- [ ] Create Slack App with Incoming Webhook
- [ ] Add webhook URL to `.env`
- [ ] Test `slack_notify_reply`

### Phase 4: Advanced Features
- [ ] Add support for "AI-Execute" tag (auto-submit forms, etc.)
- [ ] Create a skill/prompt for "daily GTD review"
- [ ] Add recurring task detection
- [ ] Calendar integration for event dates

---

## Known Limitations

1. **Toggle placement**: Notion API appends blocks to end of page, not beginning
2. **Login-walled URLs**: Silently skipped (Eventbrite auth pages, etc.)
3. **Outlook OAuth**: Requires manual token refresh setup
4. **Areas matching**: Currently by ID, not fuzzy name matching

---

## Verification Checklist

### Phase 1 (Core Notion)
- [x] `npm run build` completes without errors
- [ ] `notion_query_intray` returns tasks
- [ ] `notion_get_page` reads content correctly
- [ ] `notion_rename_page` updates title
- [ ] `notion_add_toggle` adds toggle block
- [ ] `notion_update_tags` modifies tags
- [ ] `notion_set_areas` assigns areas
- [ ] Full flow: test task → clarified and processed

### Phase 2 (Web)
- [ ] `web_fetch_url` returns page content
- [ ] `web_extract_form` finds form fields
- [ ] Handles failed URLs gracefully

### Phase 3 (Outlook)
- [ ] OAuth token refresh works
- [ ] `outlook_check_reply` finds emails

### Phase 4 (Slack)
- [ ] `slack_notify_reply` sends message
