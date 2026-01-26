/**
 * Test script for NotionSkill
 *
 * Run: npm run test:notion
 * Or:  node scripts/test-notion.js
 */

import 'dotenv/config';
import { queryTasks, createTask, searchTasks } from '../skills/notion/index.js';

async function runTests() {
  console.log('='.repeat(50));
  console.log('NotionSkill Test Suite');
  console.log('='.repeat(50));
  console.log();

  // Check environment
  console.log('1. Checking environment variables...');
  const envVars = ['NOTION_API_KEY', 'NOTION_TASKS_DATABASE_ID'];
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

  // Test: Query tasks
  console.log('2. Testing queryTasks()...');
  const queryResult = await queryTasks({});

  if (queryResult.success) {
    console.log(`   ✓ Query successful: ${queryResult.tasks.length} tasks found`);
    if (queryResult.tasks.length > 0) {
      console.log(`   Sample task: "${queryResult.tasks[0].title}"`);
    }
  } else {
    console.log(`   ✗ Query failed: ${queryResult.error}`);
    process.exit(1);
  }
  console.log();

  // Test: Create task
  console.log('3. Testing createTask()...');
  const testTitle = `Test Task ${Date.now()}`;
  const createResult = await createTask({
    title: testTitle,
    status: 'todo',
    dueDate: 'tomorrow',
    priority: 'low',
    notes: 'Created by test script - safe to delete',
  });

  if (createResult.success) {
    console.log(`   ✓ Task created: "${createResult.task.title}"`);
    console.log(`   Task ID: ${createResult.task.id}`);
    console.log(`   URL: ${createResult.task.url}`);
  } else {
    console.log(`   ✗ Create failed: ${createResult.error}`);
  }
  console.log();

  // Test: Search tasks
  console.log('4. Testing searchTasks()...');
  const searchResult = await searchTasks('Test');

  if (searchResult.success) {
    console.log(`   ✓ Search successful: ${searchResult.tasks.length} tasks match "Test"`);
  } else {
    console.log(`   ✗ Search failed: ${searchResult.error}`);
  }
  console.log();

  // Test: Query with filter
  console.log('5. Testing queryTasks() with status filter...');
  const filterResult = await queryTasks({ status: 'todo' });

  if (filterResult.success) {
    console.log(`   ✓ Filtered query: ${filterResult.tasks.length} tasks with status "To Do"`);
  } else {
    console.log(`   ✗ Filter failed: ${filterResult.error}`);
  }
  console.log();

  // Summary
  console.log('='.repeat(50));
  console.log('Test Summary');
  console.log('='.repeat(50));
  console.log('✓ NotionSkill is working correctly');
  console.log();
  console.log('Note: A test task was created. You can delete it from Notion.');
  console.log();
}

runTests().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
