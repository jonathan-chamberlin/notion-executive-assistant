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
// 4. GOOGLE CALENDAR TEST
// ============================================================
async function testCalendar() {
  header('4. GOOGLE CALENDAR CONNECTION');

  const credentialsPath = process.env.GOOGLE_CREDENTIALS_PATH || './credentials.json';
  const tokenPath = process.env.GOOGLE_TOKEN_PATH || './token.json';

  // Check credentials file
  info(`Checking credentials file: ${credentialsPath}`);

  try {
    await fs.access(credentialsPath);
    success('Credentials file found');
  } catch {
    fail(`Credentials file not found: ${credentialsPath}`);
    log('');
    info('To set up Google Calendar:');
    log('  1. Go to https://console.cloud.google.com/');
    log('  2. Create a new project (or select existing)');
    log('  3. Enable the Google Calendar API');
    log('  4. Create OAuth 2.0 credentials (Desktop app)');
    log('  5. Download and save as credentials.json in project root');
    results.calendar.error = 'Missing credentials.json';
    return;
  }

  results.calendar.tested = true;

  // Check token file (indicates prior authorization)
  info(`Checking token file: ${tokenPath}`);

  try {
    await fs.access(tokenPath);
    success('Token file found - already authorized');

    // Try to use the calendar
    info('Testing Calendar API...');

    try {
      const { google } = await import('googleapis');
      const tokenData = JSON.parse(await fs.readFile(tokenPath, 'utf8'));
      const credData = JSON.parse(await fs.readFile(credentialsPath, 'utf8'));

      const { client_id, client_secret } = credData.installed || credData.web;
      const oauth2Client = new google.auth.OAuth2(client_id, client_secret);
      oauth2Client.setCredentials(tokenData);

      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      // Get primary calendar info
      const calendarInfo = await calendar.calendars.get({ calendarId: 'primary' });
      success(`Calendar connected: ${calendarInfo.data.summary}`);

      // List upcoming events
      const now = new Date();
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      const events = await calendar.events.list({
        calendarId: 'primary',
        timeMin: now.toISOString(),
        timeMax: endOfDay.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      success(`Found ${events.data.items?.length || 0} events remaining today`);
      results.calendar.success = true;

    } catch (apiError) {
      if (apiError.message?.includes('invalid_grant') || apiError.message?.includes('Token has been expired')) {
        fail('Token expired - need to re-authorize');
        warn('Delete token.json and run: npm run test:calendar');
        results.calendar.error = 'Token expired';
      } else {
        fail(`Calendar API error: ${apiError.message}`);
        results.calendar.error = apiError.message;
      }
    }

  } catch {
    warn('Token file not found - authorization required');
    log('');
    info('To authorize Google Calendar:');
    log('  1. Run: npm run test:calendar');
    log('  2. Visit the URL shown');
    log('  3. Sign in and grant access');
    log('  4. Copy the authorization code');
    log('  5. Complete the authorization flow');
    results.calendar.error = 'Not yet authorized';
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
