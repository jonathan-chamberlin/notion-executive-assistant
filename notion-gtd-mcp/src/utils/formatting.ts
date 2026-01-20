import type { NotionTask, NotionPageContent, Area, EmailMessage } from "../types.js";

/**
 * Format a NotionTask for display
 */
export function formatTask(task: NotionTask): string {
  const lines: string[] = [
    `**${task.title}**`,
    `- ID: ${task.id}`,
    `- Tags: ${task.tags.join(", ") || "None"}`,
  ];

  if (task.date) {
    lines.push(`- Date: ${task.date}`);
  }

  if (task.priority) {
    lines.push(`- Priority: ${task.priority}`);
  }

  if (task.areas.length > 0) {
    lines.push(`- Areas: ${task.areas.map((a) => a.name || a.id).join(", ")}`);
  }

  lines.push(`- URL: ${task.url}`);

  return lines.join("\n");
}

/**
 * Format a list of tasks
 */
export function formatTaskList(tasks: NotionTask[]): string {
  if (tasks.length === 0) {
    return "No tasks found.";
  }

  return tasks.map((task, i) => `${i + 1}. ${formatTask(task)}`).join("\n\n");
}

/**
 * Format page content for display
 */
export function formatPageContent(content: NotionPageContent): string {
  const lines: string[] = [
    `# ${content.title}`,
    "",
    "## Properties",
    formatTask(content.properties),
    "",
  ];

  if (content.blocks.length > 0) {
    lines.push("## Content");
    for (const block of content.blocks) {
      if (block.content) {
        lines.push(`[${block.type}] ${block.content}`);
      }
    }
    lines.push("");
  }

  if (content.linkedPages.length > 0) {
    lines.push(`## Linked Pages: ${content.linkedPages.length} found`);
    lines.push(content.linkedPages.join(", "));
    lines.push("");
  }

  if (content.urls.length > 0) {
    lines.push("## URLs Found:");
    for (const url of content.urls) {
      lines.push(`- ${url}`);
    }
  }

  return lines.join("\n");
}

/**
 * Format areas list
 */
export function formatAreasList(areas: Area[]): string {
  if (areas.length === 0) {
    return "No areas configured.";
  }

  return areas.map((area) => `- ${area.name} (${area.id})`).join("\n");
}

/**
 * Format email message
 */
export function formatEmail(email: EmailMessage): string {
  return [
    `**${email.subject}**`,
    `From: ${email.from.name} <${email.from.address}>`,
    `Received: ${email.receivedDateTime}`,
    `Preview: ${email.bodyPreview}`,
  ].join("\n");
}

/**
 * Format email search results
 */
export function formatEmailResults(emails: EmailMessage[]): string {
  if (emails.length === 0) {
    return "No emails found.";
  }

  return emails.map((email, i) => `${i + 1}. ${formatEmail(email)}`).join("\n\n");
}

/**
 * Truncate text to a maximum length
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

/**
 * Extract plain text from content, removing markdown
 */
export function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1") // Bold
    .replace(/\*(.+?)\*/g, "$1") // Italic
    .replace(/\[(.+?)\]\(.+?\)/g, "$1") // Links
    .replace(/^#+\s*/gm, "") // Headers
    .replace(/^-\s*/gm, "") // List items
    .trim();
}
