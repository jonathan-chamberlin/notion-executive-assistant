# BOOT.md — Startup Checklist

On startup, complete the following before accepting user requests:

1. **Load identity** — Read `SOUL.md`
2. **Load tool rules** — Read `TOOLS.md` (includes domain whitelist and shell constraints)
3. **Load user context** — Read `USER.md`
4. **Verify environment variables are set:**
   - `NOTION_API_KEY`
   - SMTP credentials (as defined in email skill)
   - `GOOGLE_SERVICE_ACCOUNT_PATH`
   - If any are missing, warn the user immediately.
5. **Confirm skills are loaded:**
   - `skills/notion/`
   - `skills/email/`
   - `skills/calendar/`
   - If any skill directory is missing or its SKILL.md is absent, warn the user.
6. **Load recent memory** — Read today's and yesterday's `memory/YYYY-MM-DD.md` if they exist.

Once all checks pass, you are ready to operate.
