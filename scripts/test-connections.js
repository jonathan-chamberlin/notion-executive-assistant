#!/usr/bin/env node
/**
 * Connection Test Suite for Executive Assistant
 *
 * Tests all external service connections:
 * 1. Telegram Bot API
 * 2. Notion API
 * 3. Email SMTP
 * 4. Google Calendar API
 *
 * Run: node scripts/test-connections.js
 */

import dotenv from 'dotenv';
dotenv.config();
import fs from 'fs/promises';

// ANSI colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  dim: '\x1b[2m',
};

function log(msg) { console.log(msg); }
function success(msg) { console.log(`${colors.green}✓${colors.reset} ${msg}`); }
function fail(msg) { console.log(`${colors.red}✗${colors.reset} ${msg}`); }
function warn(msg) { console.log(`${colors.yellow}⚠${colors.reset} ${msg}`); }
function info(msg) { console.log(`${colors.blue}ℹ${colors.reset} ${msg}`); }
function header(msg) { console.log(`\n${colors.blue}${'='.repeat(60)}${colors.reset}\n${msg}\n${colors.blue}${'='.repeat(60)}${colors.reset}`); }

const results = {
  telegram: { tested: false, success: false, error: null },
  notion: { tested: false, success: false, error: null },
  email: { tested: false, success: false, error: null },
  calendar: { tested: false, success: false, error: null },
};

// ============================================================
// 1. TELEGRAM BOT TEST
// ============================================================
async function testTelegram() {
  header('1. TELEGRAM BOT CONNECTION');

  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    fail('TELEGRAM_BOT_TOKEN is not set');
    info('Get your token from @BotFather on Telegram');
    info('Set it in .env: TELEGRAM_BOT_TOKEN=your_token_here');
    results.telegram.error = 'Missing TELEGRAM_BOT_TOKEN';
    return;
  }

  if (token === 'your_telegram_bot_token_here') {
    fail('TELEGRAM_BOT_TOKEN is still the placeholder value');
    results.telegram.error = 'Placeholder token not replaced';
    return;
  }

  success('TELEGRAM_BOT_TOKEN is set');
  results.telegram.tested = true;

  // Test the bot API
  info('Testing Telegram Bot API...');

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await response.json();

    if (data.ok) {
      success(`Bot connected: @${data.result.username}`);
      success(`Bot ID: ${data.result.id}`);
      success(`Bot name: ${data.result.first_name}`);
      results.telegram.success = true;

      log('');
      info('To complete Telegram setup with Clawdbot:');
      log('  1. Run: clawdbot onboard');
      log('  2. Select Telegram channel');
      log('  3. Enter your bot token when prompted');
      log('  4. Send /start to your bot from Telegram');
    } else {
      fail(`Telegram API error: ${data.description}`);
      results.telegram.error = data.description;
    }
  } catch (error) {
    fail(`Connection failed: ${error.message}`);
    results.telegram.error = error.message;
  }
}

// ============================================================
// 2. NOTION API TEST
// ============================================================
async function testNotion() {
  header('2. NOTION API CONNECTION');

  const apiKey = process.env.NOTION_API_KEY;
  const databaseId = process.env.NOTION_TASKS_DATABASE_ID;

  if (!apiKey) {
    fail('NOTION_API_KEY is not set');
    info('Create an integration at: https://www.notion.so/my-integrations');
    info('Set it in .env: NOTION_API_KEY=secret_xxxxx');
    results.notion.error = 'Missing NOTION_API_KEY';
    return;
  }

  if (apiKey === 'secret_xxxxx' || apiKey.includes('xxxxx')) {
    fail('NOTION_API_KEY is still the placeholder value');
    results.notion.error = 'Placeholder API key not replaced';
    return;
  }

  success('NOTION_API_KEY is set');
  results.notion.tested = true;

  // Test user info (validates token)
  info('Testing Notion API authentication...');

  try {
    const { Client } = await import('@notionhq/client');
    const notion = new Client({ auth: apiKey });

    // Test: Get current user/bot info
    const userResponse = await notion.users.me({});
    success(`Authenticated as: ${userResponse.name || userResponse.id}`);
    success(`Bot type: ${userResponse.type}`);
    results.notion.success = true;

    // Test database access if ID provided
    if (databaseId && databaseId !== 'your_database_id_here') {
      log('');
      info(`Testing database access: ${databaseId.substring(0, 8)}...`);

      try {
        const dbResponse = await notion.databases.retrieve({ database_id: databaseId });
        success(`Database found: "${dbResponse.title?.[0]?.plain_text || 'Untitled'}"`);

        // List properties
        const props = Object.keys(dbResponse.properties);
        info(`Properties (${props.length}): ${props.slice(0, 5).join(', ')}${props.length > 5 ? '...' : ''}`);

      } catch (dbError) {
        if (dbError.code === 'object_not_found') {
          fail('Database not found or not shared with integration');
          warn('Make sure to share the database with your integration:');
          log('  1. Open the database in Notion');
          log('  2. Click "..." menu → "Add connections"');
          log('  3. Select your integration');
        } else {
          fail(`Database error: ${dbError.message}`);
        }
      }
    } else {
      warn('NOTION_TASKS_DATABASE_ID not set - skipping database test');
      info('Set it in .env to test database access');
    }

  } catch (error) {
    if (error.code === 'unauthorized') {
      fail('Invalid API key');
      results.notion.error = 'Invalid API key';
    } else {
      fail(`Connection failed: ${error.message}`);
      results.notion.error = error.message;
    }
    results.notion.success = false;
  }
}

// ============================================================
// 3. EMAIL SMTP TEST
// ============================================================
async function testEmail() {
  header('3. EMAIL SMTP CONNECTION');

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  const missing = [];
  if (!host) missing.push('SMTP_HOST');
  if (!port) missing.push('SMTP_PORT');
  if (!user) missing.push('SMTP_USER');
  if (!pass) missing.push('SMTP_PASS');

  if (missing.length > 0) {
    fail(`Missing environment variables: ${missing.join(', ')}`);
    info('For Gmail, use:');
    log('  SMTP_HOST=smtp.gmail.com');
    log('  SMTP_PORT=587');
    log('  SMTP_USER=your_email@gmail.com');
    log('  SMTP_PASS=your_app_password');
    info('Get app password at: https://myaccount.google.com/apppasswords');
    results.email.error = `Missing: ${missing.join(', ')}`;
    return;
  }

  if (pass === 'your_app_password_here' || user === 'your_email@gmail.com') {
    fail('SMTP credentials are still placeholder values');
    results.email.error = 'Placeholder credentials not replaced';
    return;
  }

  success('SMTP credentials are set');
  success(`Host: ${host}:${port}`);
  success(`User: ${user}`);
  results.email.tested = true;

  info('Testing SMTP connection...');

  try {
    const nodemailer = await import('nodemailer');

    const transporter = nodemailer.default.createTransport({
      host: host,
      port: parseInt(port, 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: user,
        pass: pass,
      },
    });

    // Verify connection
    await transporter.verify();
    success('SMTP connection verified');
    results.email.success = true;

    log('');
    warn('To send a test email, run:');
    log('  npm run test:email');

  } catch (error) {
    fail(`SMTP connection failed: ${error.message}`);
    results.email.error = error.message;

    if (error.message.includes('Invalid login')) {
      warn('For Gmail, make sure you are using an App Password, not your regular password');
      info('Create one at: https://myaccount.google.com/apppasswords');
    }
  }
}

// ============================================================
// 4. GOOGLE CALENDAR TEST (Service Account)
// ============================================================
async function testCalendar() {
  header('4. GOOGLE CALENDAR CONNECTION (Service Account)');

  const serviceAccountPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH || './service-account.json';
  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

  // Check service account file
  info(`Checking service account file: ${serviceAccountPath}`);

  try {
    await fs.access(serviceAccountPath);
    success('Service account file found');
  } catch {
    fail(`Service account file not found: ${serviceAccountPath}`);
    log('');
    info('To set up Google Calendar with Service Account:');
    log('  1. Go to https://console.cloud.google.com/');
    log('  2. Create a new project (or select existing)');
    log('  3. Enable the Google Calendar API');
    log('  4. Go to IAM & Admin > Service Accounts');
    log('  5. Create a service account');
    log('  6. Create a key (JSON) and download it');
    log('  7. Save as service-account.json in project root');
    log('');
    info('Then share your calendar with the service account email');
    results.calendar.error = 'Missing service-account.json';
    return;
  }

  results.calendar.tested = true;

  // Read service account to get email
  let serviceAccountEmail = '';
  try {
    const saData = JSON.parse(await fs.readFile(serviceAccountPath, 'utf8'));
    serviceAccountEmail = saData.client_email;
    success(`Service account email: ${serviceAccountEmail}`);
  } catch (err) {
    fail(`Failed to read service account file: ${err.message}`);
    results.calendar.error = err.message;
    return;
  }

  // Try to use the calendar
  info('Testing Calendar API...');

  try {
    const { google } = await import('googleapis');
    const serviceAccount = JSON.parse(await fs.readFile(serviceAccountPath, 'utf8'));

    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    const authClient = await auth.getClient();
    const calendar = google.calendar({ version: 'v3', auth: authClient });

    // Try to access the calendar
    try {
      const calendarInfo = await calendar.calendars.get({ calendarId });
      success(`Calendar connected: ${calendarInfo.data.summary}`);

      // List upcoming events
      const now = new Date();
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      const events = await calendar.events.list({
        calendarId,
        timeMin: now.toISOString(),
        timeMax: endOfDay.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      success(`Found ${events.data.items?.length || 0} events remaining today`);
      results.calendar.success = true;

    } catch (calError) {
      if (calError.code === 404 || calError.message?.includes('Not Found')) {
        fail('Calendar not found or not shared with service account');
        log('');
        warn('You must share your calendar with the service account:');
        log(`  1. Open Google Calendar`);
        log(`  2. Click gear icon > Settings`);
        log(`  3. Select your calendar on the left`);
        log(`  4. Scroll to "Share with specific people"`);
        log(`  5. Add: ${serviceAccountEmail}`);
        log(`  6. Set permission to "Make changes to events"`);
        results.calendar.error = 'Calendar not shared with service account';
      } else {
        fail(`Calendar API error: ${calError.message}`);
        results.calendar.error = calError.message;
      }
    }

  } catch (apiError) {
    fail(`Calendar API error: ${apiError.message}`);
    results.calendar.error = apiError.message;
  }
}

// ============================================================
// SUMMARY
// ============================================================
function printSummary() {
  header('TEST SUMMARY');

  const tests = [
    { name: 'Telegram', result: results.telegram },
    { name: 'Notion', result: results.notion },
    { name: 'Email', result: results.email },
    { name: 'Calendar', result: results.calendar },
  ];

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const test of tests) {
    if (!test.result.tested) {
      warn(`${test.name}: SKIPPED (missing configuration)`);
      skipped++;
    } else if (test.result.success) {
      success(`${test.name}: PASSED`);
      passed++;
    } else {
      fail(`${test.name}: FAILED - ${test.result.error}`);
      failed++;
    }
  }

  log('');
  log(`Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);

  if (failed > 0 || skipped > 0) {
    log('');
    info('Next steps:');
    log('  1. Copy .env.example to .env');
    log('  2. Fill in all required API keys and credentials');
    log('  3. Run this test again: node scripts/test-connections.js');
  }

  if (passed === 4) {
    log('');
    success('All connections working! Ready to run Clawdbot.');
    log('');
    info('Start Clawdbot with:');
    log('  npm run onboard   # First time setup');
    log('  npm start         # Start gateway');
  }
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log('\n🦞 Executive Assistant - Connection Test Suite\n');

  // Check .env file exists
  try {
    await fs.access('.env');
  } catch {
    fail('.env file not found!');
    log('');
    info('Create .env file:');
    log('  Copy .env.example to .env');
    log('  Fill in your API keys and credentials');
    log('');
    process.exit(1);
  }

  await testTelegram();
  await testNotion();
  await testEmail();
  await testCalendar();

  printSummary();
}

main().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
