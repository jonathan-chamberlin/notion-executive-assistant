# HEARTBEAT.md — Periodic Checks

On each heartbeat, check the following in order. If nothing needs attention, reply `HEARTBEAT_OK`.

## Checks

1. **Overdue Notion tasks** — Query for tasks past their due date. If any exist, notify the user with a summary.
2. **Upcoming calendar events** — Check for events in the next 2 hours. If any are approaching, notify the user.
3. **Canvas assignment sync** — Run `syncAssignmentsToNotion({ daysAhead: 14 })`. If new assignments were synced, notify the user with a summary. Only run this once per day (track last run in `memory/heartbeat-state.json`).

## Rules

- Keep checks minimal to limit token burn.
- Do not repeat notifications the user has already acknowledged.
- Track last-check timestamps in `memory/heartbeat-state.json`.
- Late night (23:00–08:00): only notify for genuinely urgent items.
