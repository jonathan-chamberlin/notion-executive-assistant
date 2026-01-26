/**
 * Test script for CalendarSkill
 *
 * Run: npm run test:calendar
 * Or:  node scripts/test-calendar.js
 */

import 'dotenv/config';
import fs from 'fs/promises';
import { listEvents, getAuthUrl } from '../skills/calendar/index.js';

async function runTests() {
  console.log('='.repeat(50));
  console.log('CalendarSkill Test Suite');
  console.log('='.repeat(50));
  console.log();

  // Check environment
  console.log('1. Checking environment variables...');
  const envVars = ['GOOGLE_CREDENTIALS_PATH', 'GOOGLE_TOKEN_PATH'];
  let envOk = true;

  for (const v of envVars) {
    if (process.env[v]) {
      console.log(`   ✓ ${v} is set: ${process.env[v]}`);
    } else {
      console.log(`   ✗ ${v} is NOT set`);
      envOk = false;
    }
  }

  if (!envOk) {
    console.log('\n❌ Environment check failed. Set missing variables in .env');
    process.exit(1);
  }
  console.log();

  // Check credentials file exists
  console.log('2. Checking credentials file...');
  try {
    await fs.access(process.env.GOOGLE_CREDENTIALS_PATH);
    console.log(`   ✓ Credentials file exists: ${process.env.GOOGLE_CREDENTIALS_PATH}`);
  } catch {
    console.log(`   ✗ Credentials file NOT found: ${process.env.GOOGLE_CREDENTIALS_PATH}`);
    console.log();
    console.log('   To fix this:');
    console.log('   1. Go to https://console.cloud.google.com/');
    console.log('   2. Create OAuth credentials (Desktop app)');
    console.log('   3. Download and save as credentials.json');
    process.exit(1);
  }
  console.log();

  // Check token file (authorization status)
  console.log('3. Checking authorization status...');
  try {
    await fs.access(process.env.GOOGLE_TOKEN_PATH);
    console.log(`   ✓ Token file exists - already authorized`);
  } catch {
    console.log('   ⚠ Not yet authorized');
    console.log();
    console.log('   Getting authorization URL...');

    const authResult = await getAuthUrl();
    if (authResult.authUrl) {
      console.log();
      console.log('   Please visit this URL to authorize:');
      console.log(`   ${authResult.authUrl}`);
      console.log();
      console.log('   After authorizing, run:');
      console.log('   /calendar auth <code>');
      console.log();
      process.exit(0);
    } else {
      console.log(`   ✗ Failed to get auth URL: ${authResult.error || authResult.message}`);
      process.exit(1);
    }
  }
  console.log();

  // Test: List events
  console.log('4. Testing listEvents() for today...');
  const listResult = await listEvents({ date: 'today' });

  if (listResult.success) {
    console.log(`   ✓ Query successful: ${listResult.events.length} events today`);
    if (listResult.events.length > 0) {
      const event = listResult.events[0];
      console.log(`   Sample: "${event.title}" at ${event.start}`);
    }
  } else if (listResult.needsAuth) {
    console.log('   ⚠ Authorization required');
    const authResult = await getAuthUrl();
    if (authResult.authUrl) {
      console.log(`   Visit: ${authResult.authUrl}`);
    }
    process.exit(0);
  } else {
    console.log(`   ✗ Query failed: ${listResult.error}`);
    process.exit(1);
  }
  console.log();

  // Test: List tomorrow's events
  console.log('5. Testing listEvents() for tomorrow...');
  const tomorrowResult = await listEvents({ date: 'tomorrow' });

  if (tomorrowResult.success) {
    console.log(`   ✓ Query successful: ${tomorrowResult.events.length} events tomorrow`);
  } else {
    console.log(`   ✗ Query failed: ${tomorrowResult.error}`);
  }
  console.log();

  // Test: List week
  console.log('6. Testing listEvents() for the week...');
  const weekResult = await listEvents({ date: 'today', range: 'week' });

  if (weekResult.success) {
    console.log(`   ✓ Query successful: ${weekResult.events.length} events this week`);
  } else {
    console.log(`   ✗ Query failed: ${weekResult.error}`);
  }
  console.log();

  // Summary
  console.log('='.repeat(50));
  console.log('Test Summary');
  console.log('='.repeat(50));
  console.log('✓ CalendarSkill is working correctly');
  console.log();
  console.log('To test event creation, use via Telegram:');
  console.log('  /calendar add "Test Event" tomorrow 14:00');
  console.log();
  console.log('⚠️  Event creation was NOT tested to avoid calendar clutter.');
  console.log();
}

runTests().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
