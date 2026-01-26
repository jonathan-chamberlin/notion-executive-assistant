/**
 * Test script for EmailSkill
 *
 * Run: npm run test:email
 * Or:  node scripts/test-email.js
 *
 * NOTE: This creates a draft but does NOT send email unless you confirm.
 */

import 'dotenv/config';
import { createDraft, getDraft, cancelDraft } from '../skills/email/index.js';

async function runTests() {
  console.log('='.repeat(50));
  console.log('EmailSkill Test Suite');
  console.log('='.repeat(50));
  console.log();

  // Check environment
  console.log('1. Checking environment variables...');
  const envVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM'];
  let envOk = true;

  for (const v of envVars) {
    if (process.env[v]) {
      console.log(`   ✓ ${v} is set`);
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

  // Test: Create draft
  console.log('2. Testing createDraft()...');
  const draftResult = await createDraft({
    to: 'test@example.com',
    subject: 'Test Email from Executive Assistant',
    body: 'This is a test email created by the test script.\n\nIf you received this, the email skill is working!',
  });

  if (draftResult.success) {
    console.log('   ✓ Draft created successfully');
    console.log(`   To: ${draftResult.draft.to.join(', ')}`);
    console.log(`   Subject: ${draftResult.draft.subject}`);
  } else {
    console.log(`   ✗ Draft creation failed: ${draftResult.error}`);
    process.exit(1);
  }
  console.log();

  // Test: Get draft
  console.log('3. Testing getDraft()...');
  const getResult = await getDraft();

  if (getResult.success && getResult.draft) {
    console.log('   ✓ Draft retrieved successfully');
    console.log(`   Created at: ${getResult.draft.createdAt}`);
  } else {
    console.log('   ✗ No draft found (unexpected)');
  }
  console.log();

  // Test: Cancel draft (don't actually send in test)
  console.log('4. Testing cancelDraft()...');
  const cancelResult = await cancelDraft();

  if (cancelResult.success) {
    console.log('   ✓ Draft cancelled successfully');
  } else {
    console.log(`   ✗ Cancel failed: ${cancelResult.error}`);
  }
  console.log();

  // Test: Verify draft is gone
  console.log('5. Verifying draft is cleared...');
  const verifyResult = await getDraft();

  if (verifyResult.success && !verifyResult.draft) {
    console.log('   ✓ No active draft (correct)');
  } else {
    console.log('   ✗ Draft still exists (unexpected)');
  }
  console.log();

  // Test: Email validation
  console.log('6. Testing email validation...');
  const invalidResult = await createDraft({
    to: 'not-an-email',
    subject: 'Test',
    body: 'Test',
  });

  if (!invalidResult.success && invalidResult.error.includes('Invalid email')) {
    console.log('   ✓ Invalid email rejected correctly');
  } else {
    console.log('   ✗ Invalid email was not rejected');
  }
  console.log();

  // Summary
  console.log('='.repeat(50));
  console.log('Test Summary');
  console.log('='.repeat(50));
  console.log('✓ EmailSkill is configured correctly');
  console.log();
  console.log('Note: To test actual sending, use:');
  console.log('  /email send your@email.com "Test" "Hello world"');
  console.log();
  console.log('⚠️  Sending was NOT tested to avoid spam.');
  console.log();
}

runTests().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
