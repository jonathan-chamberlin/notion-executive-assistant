# CalendarSkill

Manage calendar events via Google Calendar API. Links events to Notion tasks for unified task management.

## Capabilities

- **View events** for today, this week, or custom date ranges
- **Create events** with title, time, duration, and attendees
- **Update events** (reschedule, add attendees, change details)
- **Delete/cancel events**
- **Link events to Notion tasks**
- **Find free time** slots for scheduling

## Commands

### View Events
```
/calendar [range]
```
Examples:
- `/calendar` - Show today's events
- `/calendar today` - Today's events
- `/calendar tomorrow` - Tomorrow's events
- `/calendar week` - This week's events
- `/calendar 2024-01-15` - Events on specific date

### Create Event
```
/calendar add "<title>" <date> <time> [duration] [options]
```
Options:
- `duration:<minutes>` - Event duration (default: 60)
- `attendees:<email1,email2>` - Invite attendees
- `location:<place>` - Add location
- `description:<text>` - Add description

Examples:
- `/calendar add "Team Standup" tomorrow 9:00 duration:30`
- `/calendar add "Client Call" monday 14:00 attendees:client@example.com`
- `/calendar add "Dentist" friday 10:00 location:"123 Main St"`

### Update Event
```
/calendar update <event-id> <changes>
```
Examples:
- `/calendar update abc123 time:15:00`
- `/calendar update abc123 date:tomorrow`
- `/calendar update abc123 add-attendee:jane@example.com`

### Cancel Event
```
/calendar cancel <event-id> [notify]
```
- `notify:true` - Send cancellation email to attendees (default)
- `notify:false` - Cancel silently

### Find Free Time
```
/calendar free <date> [duration]
```
Examples:
- `/calendar free tomorrow` - Find free slots tomorrow
- `/calendar free monday duration:90` - Find 90-minute slots on Monday

### Link to Task
```
/calendar link <event-id> <task-id>
```
Associates a calendar event with a Notion task (updates both).

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_CREDENTIALS_PATH` | Yes | Path to OAuth credentials JSON |
| `GOOGLE_TOKEN_PATH` | Yes | Path to store OAuth tokens |
| `GOOGLE_CALENDAR_ID` | No | Calendar ID (default: 'primary') |

## Setup Requirements

1. **Google Cloud Project** with Calendar API enabled
2. **OAuth 2.0 credentials** (Desktop application type)
3. **First-run authorization** via browser

## Safety Rules

1. **Confirm before delete** - Cancellations require confirmation
2. **Notify attendees by default** - Changes to events with attendees trigger notifications
3. **Log all mutations** - Every create/update/delete is logged
4. **Validate times** - Reject invalid date/time formats
5. **Conflict warnings** - Warn when creating overlapping events

## Output Format

```
📅 Event created: "Team Standup"
   Date: Tomorrow (Jan 16, 2024)
   Time: 9:00 AM - 9:30 AM
   Calendar: primary
   Event ID: abc123xyz
```

## Error Handling

- **Auth required**: "Google Calendar not authorized. Run setup first."
- **Invalid time**: "Could not parse time: [input]. Use HH:MM format."
- **Conflict detected**: "Warning: This overlaps with [existing event]. Create anyway? /calendar confirm"
- **API error**: "Calendar API error: [message]. Please try again."
