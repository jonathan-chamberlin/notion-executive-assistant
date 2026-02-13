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

// Only process Bash tool output with errors
const stdout = hookData?.tool_result?.stdout || '';
const stderr = hookData?.tool_result?.stderr || '';
const exitCode = hookData?.tool_result?.exit_code;

if (exitCode === 0 || exitCode === undefined) {
  process.exit(0);
}

const combined = `${stdout}\n${stderr}`;

// Error pattern detection
const patterns = [
  { regex: /SyntaxError:\s*(.+)/m, type: 'SyntaxError' },
  { regex: /ReferenceError:\s*(.+)/m, type: 'ReferenceError' },
  { regex: /TypeError:\s*(.+)/m, type: 'TypeError' },
  { regex: /Cannot find module\s+'([^']+)'/m, type: 'ModuleNotFound' },
  { regex: /Error:\s*Cannot find module/m, type: 'ModuleNotFound' },
  { regex: /ERR!\s*(.+)/m, type: 'npm/pnpm Error' },
  { regex: /ENOENT:\s*(.+)/m, type: 'FileNotFound' },
  { regex: /EACCES:\s*(.+)/m, type: 'PermissionDenied' },
  { regex: /AssertionError\s*(.+)/m, type: 'AssertionError' },
];

const detected = [];
for (const { regex, type } of patterns) {
  const match = combined.match(regex);
  if (match) {
    detected.push({ type, message: match[1] || match[0] });
  }
}

// Extract file:line references
const fileRef = combined.match(/(?:at\s+)?(\S+\.(?:js|ts|mjs)):(\d+)(?::(\d+))?/m);
const fileInfo = fileRef ? `${fileRef[1]}:${fileRef[2]}${fileRef[3] ? ':' + fileRef[3] : ''}` : 'unknown';

if (detected.length > 0) {
  const lines = detected.map(
    (d) => `TOOL_ERROR [Bash] Exit code: ${exitCode} | Error type: ${d.type} | File: ${fileInfo} | Message: ${d.message}`,
  );
  const output = JSON.stringify({
    systemMessage: lines.join('\n'),
  });
  process.stdout.write(output);
}
