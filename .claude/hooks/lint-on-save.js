import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Read hook input from stdin
let input = '';
try {
  input = readFileSync(0, 'utf8');
} catch {
  process.exit(0);
}

let hookData;
try {
  hookData = JSON.parse(input);
} catch {
  process.exit(0);
}

// Only lint .js files
const filePath = hookData?.tool_input?.file_path || hookData?.tool_input?.command || '';
const jsFileMatch = filePath.match(/[\w/\\.-]+\.js/);
if (!jsFileMatch) {
  process.exit(0);
}

const targetFile = jsFileMatch[0];

try {
  execSync(`npx eslint --format json "${targetFile}"`, {
    cwd: process.env.CLAUDE_PROJECT_DIR || '.',
    encoding: 'utf8',
    timeout: 15000,
  });
  // No errors — exit silently
} catch (err) {
  if (err.stdout) {
    try {
      const results = JSON.parse(err.stdout);
      const messages = [];
      for (const result of results) {
        for (const msg of result.messages || []) {
          const severity = msg.severity === 2 ? 'ERROR' : 'WARN';
          const file = result.filePath.split(/[/\\]/).slice(-3).join('/');
          messages.push(
            `${severity} [ESLint] ${file}:${msg.line}:${msg.column} ${msg.ruleId} — ${msg.message}`,
          );
        }
      }
      if (messages.length > 0) {
        const output = JSON.stringify({
          systemMessage: `Lint results for edited file:\n${messages.join('\n')}`,
        });
        process.stdout.write(output);
      }
    } catch {
      // Can't parse ESLint output — skip
    }
  }
}
