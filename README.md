# Notion Executive Assistant

A personal executive assistant powered by [Clawdbot](https://github.com/clawdbot/clawdbot) with Notion, Email, and Google Calendar integration.

## Architecture

```
Telegram → Clawdbot Gateway → Skills → External APIs
              │                  │
              ├─ Sessions        ├─ NotionSkill  → Notion API
              ├─ Memory          ├─ EmailSkill   → SMTP
              └─ Orchestration   └─ CalendarSkill → Google Calendar
```

**Notion is the single source of truth** for all tasks. Calendar events and emails are linked to Notion tasks.

## Prerequisites

- **Node.js 22+** ([download](https://nodejs.org/))
- **Telegram account** (for bot interaction)
- **Notion workspace** with integration access
- **Gmail account** (or other SMTP provider)
- **Google Cloud project** (for Calendar API)

## Quick Start

### 1. Install Dependencies

```powershell
npm install
```

### 2. Configure Environment

```powershell
# Copy the example and fill in your values
cp .env.example .env
```

Edit `.env` with your credentials (see [Configuration](#configuration) below).

### 3. Run Clawdbot Onboarding

```powershell
npm run onboard
```

This wizard will:
- Set up the Clawdbot workspace at `~/clawd`
- Configure your Telegram bot connection
- Register the skills in `./skills/`
- Set up Claude as the AI model

### 4. Start the Gateway

```powershell
npm run start
```

Or run as a daemon:
```powershell
npm run start:daemon
```

### 5. Test via Telegram

Open your Telegram bot and send:
```
/tasks
```

---

## Configuration

### Telegram Bot

1. Open Telegram and message [@BotFather](https://t.me/BotFather)
2. Send `/newbot` and follow the prompts
3. Copy the token to `TELEGRAM_BOT_TOKEN` in `.env`

### Notion Integration

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Click **"New integration"**
3. Name it (e.g., "Executive Assistant")
4. Select your workspace
5. Copy the **Internal Integration Token** to `NOTION_API_KEY`
6. Create a Tasks database with this schema:

| Property | Type | Values |
|----------|------|--------|
| Title | Title | (task name) |
| Status | Select | To Do, In Progress, Done, Blocked |
| Due Date | Date | |
| Priority | Select | High, Medium, Low |
| Calendar Event | URL | (link to calendar) |
| Email Thread | URL | (link to email) |
| Notes | Text | |

7. Share the database with your integration (click "..." → "Connections" → select your integration)
8. Copy the database ID from the URL to `NOTION_TASKS_DATABASE_ID`

### Email (SMTP)

For Gmail:
1. Enable 2FA on your Google account
2. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
3. Generate an app password for "Mail"
4. Use these settings:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your_email@gmail.com
   SMTP_PASS=your_app_password
   ```

### Google Calendar

1. Go to [console.cloud.google.com](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable **Google Calendar API**:
   - APIs & Services → Library → Search "Calendar" → Enable
4. Create OAuth credentials:
   - APIs & Services → Credentials → Create Credentials → OAuth client ID
   - Application type: **Desktop app**
   - Download the JSON file
5. Save as `credentials.json` in project root
6. Set paths in `.env`:
   ```
   GOOGLE_CREDENTIALS_PATH=./credentials.json
   GOOGLE_TOKEN_PATH=./token.json
   ```

First time you use calendar commands, you'll be prompted to authorize via browser.

---

## Skills Reference

### NotionSkill

| Command | Description |
|---------|-------------|
| `/tasks` | List all active tasks |
| `/tasks due:today` | Tasks due today |
| `/tasks status:in-progress` | Tasks in progress |
| `/tasks overdue` | Overdue tasks |
| `/task add <title> due:<date> priority:<level>` | Create task |
| `/task update <id> status:done` | Update task |
| `/task done <id>` | Mark complete |

### EmailSkill

| Command | Description |
|---------|-------------|
| `/email send <to> "<subject>" "<body>"` | Send email |
| `/email draft <to> "<subject>" "<body>"` | Create draft |
| `/email confirm` | Send current draft |
| `/email cancel` | Discard draft |
| `/email reply ack <to>` | Send acknowledgment |

### CalendarSkill

| Command | Description |
|---------|-------------|
| `/calendar` | Today's events |
| `/calendar tomorrow` | Tomorrow's events |
| `/calendar week` | This week's events |
| `/calendar add "<title>" <date> <time>` | Create event |
| `/calendar update <id> time:15:00` | Reschedule |
| `/calendar cancel <id>` | Cancel event |
| `/calendar free tomorrow` | Find free slots |

---

## Testing

### Test Individual Skills

```powershell
# Test Notion connection
npm run test:notion

# Test Email sending
npm run test:email

# Test Calendar access
npm run test:calendar
```

### Testing Checklist

- [ ] **Telegram**: Bot responds to `/status`
- [ ] **Notion**: `/tasks` returns your task list
- [ ] **Notion**: `/task add "Test task" due:tomorrow` creates a task
- [ ] **Email**: `/email draft test@example.com "Test" "Hello"` creates draft
- [ ] **Calendar**: `/calendar` shows today's events
- [ ] **Calendar**: `/calendar add "Test" tomorrow 10:00` creates event
- [ ] **Cross-link**: Task shows calendar event URL after linking

---

## Project Structure

```
notion-executive-assistant/
├── .claude/
│   ├── CLAUDE.md              # Development instructions
│   └── settings.local.json    # Claude Code permissions
├── skills/
│   ├── notion/
│   │   ├── SKILL.md           # Skill definition
│   │   └── index.js           # Implementation
│   ├── email/
│   │   ├── SKILL.md
│   │   └── index.js
│   └── calendar/
│       ├── SKILL.md
│       └── index.js
├── scripts/
│   ├── test-notion.js         # Notion test script
│   ├── test-email.js          # Email test script
│   └── test-calendar.js       # Calendar test script
├── .env.example               # Environment template
├── .gitignore                 # Git ignore rules
├── package.json               # Dependencies
├── Dockerfile                 # Container config
├── docker-compose.yml         # Docker orchestration
└── README.md                  # This file
```

---

## Deployment

### Docker (Recommended)

```powershell
# Build image
docker build -t notion-assistant .

# Run container
docker run -d \
  --name notion-assistant \
  --env-file .env \
  -v ./credentials.json:/app/credentials.json:ro \
  -v ./token.json:/app/token.json \
  notion-assistant
```

### Docker Compose

```powershell
docker-compose up -d
```

### Cloud Deployment

Recommended platforms:
- **Railway** - Easy Docker deployment
- **Fly.io** - Global edge deployment
- **DigitalOcean App Platform** - Simple container hosting
- **Self-hosted VPS** - Full control (~$5/month)

---

## Troubleshooting

### "Notion API error: Could not find database"
- Ensure the database is shared with your integration
- Check `NOTION_TASKS_DATABASE_ID` is correct (32-character ID from URL)

### "Google Calendar not authorized"
- Run `/calendar setup` to get the authorization URL
- Complete OAuth flow in browser
- Use `/calendar auth <code>` with the code

### "SMTP connection failed"
- For Gmail: ensure you're using an App Password, not your regular password
- Check firewall isn't blocking port 587

### "Rate limit exceeded"
- EmailSkill has a 10 emails/minute limit for safety
- Wait and retry

---

## Security Notes

1. **Never commit `.env`** - it's in `.gitignore`
2. **Never commit `credentials.json` or `token.json`**
3. **Rotate tokens** if you suspect compromise
4. **Use app passwords** instead of main passwords for email
5. **Review Notion integration permissions** - only grant necessary access

---

## License

MIT
