import fs from 'fs';
import path from 'path';

const HOME = process.env.HOME || process.env.USERPROFILE || '.';
const SESSIONS_DIR = path.join(HOME, '.openclaw', 'agents', 'main', 'sessions');
const USAGE_FILE = path.join(HOME, '.kalshi-usage.json');

/**
 * Parse all session JSONL files and sum today's LLM costs and token counts.
 * Each line in a session JSONL may have usage.cost.total (dollars) and usage token fields.
 */
export function getSessionCosts() {
  const today = new Date().toISOString().split('T')[0];
  let totalCost = 0;
  let tokensIn = 0;
  let tokensOut = 0;
  let invocations = 0;

  let files;
  try {
    files = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.jsonl'));
  } catch {
    return { today, totalCost: 0, tokensIn: 0, tokensOut: 0, invocations: 0 };
  }

  for (const file of files) {
    let content;
    try {
      content = fs.readFileSync(path.join(SESSIONS_DIR, file), 'utf-8');
    } catch {
      continue;
    }

    for (const line of content.split('\n')) {
      if (!line.trim()) continue;
      let entry;
      try {
        entry = JSON.parse(line);
      } catch {
        continue;
      }

      // Only count today's entries
      const timestamp = entry.timestamp || entry.created_at || '';
      if (!timestamp.startsWith(today)) continue;

      const usage = entry.usage;
      if (!usage) continue;

      if (usage.cost?.total) {
        totalCost += usage.cost.total;
        invocations++;
      }
      if (usage.input_tokens) tokensIn += usage.input_tokens;
      if (usage.output_tokens) tokensOut += usage.output_tokens;
    }
  }

  return { today, totalCost, tokensIn, tokensOut, invocations };
}

/**
 * Load the persisted usage watermark (last alerted snapshot).
 */
function loadWatermark() {
  try {
    return JSON.parse(fs.readFileSync(USAGE_FILE, 'utf-8'));
  } catch {
    return { date: '', totalCost: 0, tokensIn: 0, tokensOut: 0, invocations: 0 };
  }
}

/**
 * Save the current usage as the watermark.
 */
function saveWatermark(stats) {
  try {
    fs.writeFileSync(USAGE_FILE, JSON.stringify(stats, null, 2) + '\n', 'utf-8');
  } catch {
    // non-fatal
  }
}

/**
 * Get a usage report comparing current costs to last-alerted snapshot.
 * Returns { hasNewActivity, message }.
 */
export function getUsageReport() {
  const current = getSessionCosts();
  const watermark = loadWatermark();

  // Reset watermark if it's a different day
  const isNewDay = watermark.date !== current.today;
  const deltaCost = isNewDay ? current.totalCost : current.totalCost - (watermark.totalCost || 0);
  const deltaInvocations = isNewDay ? current.invocations : current.invocations - (watermark.invocations || 0);

  if (deltaCost <= 0 && deltaInvocations <= 0) {
    return { hasNewActivity: false, message: '' };
  }

  const lines = [
    `📊 OpenClaw Usage Update`,
    ``,
    `Since last report:`,
    `  Cost: +$${deltaCost.toFixed(4)}`,
    `  Invocations: +${deltaInvocations}`,
    ``,
    `Today's totals:`,
    `  Total cost: $${current.totalCost.toFixed(4)}`,
    `  Tokens in: ${current.tokensIn.toLocaleString()}`,
    `  Tokens out: ${current.tokensOut.toLocaleString()}`,
    `  Invocations: ${current.invocations}`,
  ];

  return { hasNewActivity: true, message: lines.join('\n') };
}

/**
 * Snapshot current totals so next report only shows delta.
 */
export function markUsageAlerted() {
  const current = getSessionCosts();
  saveWatermark(current);
}

/**
 * Return raw usage stats for today.
 */
export function getUsageStats() {
  return getSessionCosts();
}

// Export internals for testing
export { USAGE_FILE, SESSIONS_DIR };
