#!/usr/bin/env node
/**
 * Direct Calendar API test using google-auth-library + fetch
 * Bypasses the broken googleapis dependency tree
 */

import fs from 'fs/promises';
import { GoogleAuth } from 'google-auth-library';

async function main() {
  const serviceAccountPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH || './google-service-account.json';
  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

  console.log('=== Google Calendar Direct Test ===\n');

  // 1. Load service account
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(await fs.readFile(serviceAccountPath, 'utf8'));
    console.log(`✓ Service account loaded: ${serviceAccount.client_email}`);
  } catch (err) {
    console.log(`✗ Failed to load service account: ${err.message}`);
    process.exit(1);
  }

  // 2. Authenticate
  let client;
  try {
    const auth = new GoogleAuth({
      credentials: serviceAccount,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });
    client = await auth.getClient();
    const token = await client.getAccessToken();
    console.log(`✓ Authenticated (token obtained)`);
    console.log();

    // 3. Test calendar access
    console.log(`Testing calendar: ${calendarId}`);

    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?` +
      `timeMin=${now.toISOString()}&timeMax=${endOfDay.toISOString()}&singleEvents=true&orderBy=startTime`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token.token}` },
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`✓ Calendar accessible`);
      console.log(`✓ Found ${data.items?.length || 0} events remaining today`);

      if (data.items?.length > 0) {
        const event = data.items[0];
        console.log(`  Next: "${event.summary}" at ${event.start?.dateTime || event.start?.date}`);
      }
      console.log('\n✓ CALENDAR TEST PASSED');
    } else {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error?.message || response.statusText;

      if (response.status === 404) {
        console.log(`✗ Calendar not found or not shared with service account`);
        console.log(`\n  Share your calendar with: ${serviceAccount.client_email}`);
        console.log('  1. Open Google Calendar');
        console.log('  2. Settings > Select your calendar');
        console.log('  3. "Share with specific people" > Add');
        console.log(`  4. Enter: ${serviceAccount.client_email}`);
        console.log('  5. Set "Make changes to events" permission');
      } else {
        console.log(`✗ API error (${response.status}): ${errorMsg}`);
      }
      console.log('\n✗ CALENDAR TEST FAILED');
    }

  } catch (err) {
    console.log(`✗ Auth failed: ${err.message}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
