---
name: email-skill
description: Send and manage emails through SMTP with draft/confirm workflow and rate limiting
user-invocable: true
requires:
  env:
    - SMTP_HOST
    - SMTP_USER
    - SMTP_PASS
---

# EmailSkill

Send and manage emails through SMTP. Integrates with Notion tasks for email-task linking.

## Capabilities

- **Send emails** with subject, body, and recipients
- **Draft emails** for review before sending
- **Link emails to tasks** in Notion
- **Reply templates** for common responses

## Commands

### Send Email
```
/email send <recipient> "<subject>" "<body>"
```
Examples:
- `/email send john@example.com "Meeting Follow-up" "Thanks for the meeting today..."`
- `/email send team@company.com "Status Update" "Here's this week's progress..."`

### Draft Email
```
/email draft <recipient> "<subject>" "<body>"
```
Creates a draft for review. Respond with `/email confirm` to send or `/email cancel` to discard.

### Quick Reply Templates
```
/email reply <template> <recipient>
```
Templates:
- `ack` - Acknowledge receipt
- `followup` - Request follow-up
- `thanks` - Thank you message
- `decline` - Polite decline

### Link to Task
```
/email link <task-id>
```
Associates the last sent email with a Notion task.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SMTP_HOST` | Yes | SMTP server hostname |
| `SMTP_PORT` | Yes | SMTP port (usually 587 or 465) |
| `SMTP_SECURE` | No | Use TLS (true for port 465) |
| `SMTP_USER` | Yes | SMTP username/email |
| `SMTP_PASS` | Yes | SMTP password or app password |
| `EMAIL_FROM` | Yes | Default sender address |

## Safety Rules

1. **Confirm before sending** - All emails require explicit confirmation unless using `/email send --force`
2. **Log all emails** - Every sent email is logged with timestamp, recipient, and subject
3. **Rate limiting** - Maximum 10 emails per minute to prevent abuse
4. **No BCC by default** - BCC must be explicitly requested
5. **Validate recipients** - Check email format before attempting send

## Output Format

```
📧 Email sent successfully
   To: john@example.com
   Subject: Meeting Follow-up
   Sent: 2024-01-15 14:30 UTC
   Message ID: <abc123@smtp.gmail.com>
```

## Error Handling

- **Invalid recipient**: "Invalid email format: [address]"
- **SMTP failure**: "Failed to send email: [SMTP error]. Email saved as draft."
- **Rate limited**: "Rate limit exceeded. Try again in [X] seconds."
