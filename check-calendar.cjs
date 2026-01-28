const { google } = require('googleapis');
const fs = require('fs');

async function checkUpcomingEvents() {
  const credentials = JSON.parse(fs.readFileSync('./google-service-account.json'));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
  });
  
  const calendar = google.calendar({ version: 'v3', auth });
  
  const now = new Date();
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  
  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin: now.toISOString(),
    timeMax: twoHoursFromNow.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });
  
  const events = res.data.items || [];
  if (events.length > 0) {
    console.log('UPCOMING (next 2 hours):');
    events.forEach(e => {
      const start = e.start.dateTime || e.start.date;
      console.log('  - ' + e.summary + ' at ' + start);
    });
  } else {
    console.log('OK');
  }
}

checkUpcomingEvents().catch(console.error);
