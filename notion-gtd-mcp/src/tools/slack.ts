import { z } from "zod";
import { SlackClient } from "../services/slackClient.js";
import { withErrorHandling } from "../utils/errors.js";
import type { ToolDefinition } from "../types.js";

// Tool input schemas
const NotifyReplySchema = z.object({
  taskTitle: z.string().describe("The title of the waiting task"),
  senderName: z.string().describe("Name of the person who replied"),
  emailSubject: z.string().describe("Subject of the email reply"),
  receivedAt: z.string().describe("ISO date string when the email was received"),
  notionPageUrl: z.string().url().describe("URL to the Notion task page"),
});

const SendMessageSchema = z.object({
  message: z.string().describe("The message to send to Slack"),
});

const SendSummarySchema = z.object({
  processedCount: z.number().describe("Number of tasks processed"),
  waitingChecked: z.number().describe("Number of waiting tasks checked"),
  repliesFound: z.number().describe("Number of email replies found"),
});

// Tool definitions for MCP
export const slackToolDefinitions: ToolDefinition[] = [
  {
    name: "slack_notify_reply",
    description:
      "Send a Slack notification that an email reply was received for a waiting task. Use this when outlook_check_reply finds a reply.",
    inputSchema: {
      type: "object",
      properties: {
        taskTitle: {
          type: "string",
          description: "The title of the waiting task",
        },
        senderName: {
          type: "string",
          description: "Name of the person who replied",
        },
        emailSubject: {
          type: "string",
          description: "Subject of the email reply",
        },
        receivedAt: {
          type: "string",
          description: "ISO date string when the email was received",
        },
        notionPageUrl: {
          type: "string",
          description: "URL to the Notion task page",
        },
      },
      required: ["taskTitle", "senderName", "emailSubject", "receivedAt", "notionPageUrl"],
    },
  },
  {
    name: "slack_send_message",
    description: "Send a custom message to Slack. Use for general notifications or updates.",
    inputSchema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "The message to send to Slack",
        },
      },
      required: ["message"],
    },
  },
  {
    name: "slack_send_summary",
    description:
      "Send a summary of the GTD processing run to Slack. Use after completing a full In Tray check.",
    inputSchema: {
      type: "object",
      properties: {
        processedCount: {
          type: "number",
          description: "Number of tasks processed",
        },
        waitingChecked: {
          type: "number",
          description: "Number of waiting tasks checked",
        },
        repliesFound: {
          type: "number",
          description: "Number of email replies found",
        },
      },
      required: ["processedCount", "waitingChecked", "repliesFound"],
    },
  },
];

// Tool handlers
export function createSlackTools(client: SlackClient | null) {
  // Return no-op handlers if Slack is not configured
  if (!client) {
    return {
      slack_notify_reply: async () => ({
        success: false,
        error: "Slack integration not configured. Set SLACK_WEBHOOK_URL environment variable.",
      }),
      slack_send_message: async () => ({
        success: false,
        error: "Slack integration not configured. Set SLACK_WEBHOOK_URL environment variable.",
      }),
      slack_send_summary: async () => ({
        success: false,
        error: "Slack integration not configured. Set SLACK_WEBHOOK_URL environment variable.",
      }),
    };
  }

  return {
    slack_notify_reply: async (args: unknown) => {
      const notification = NotifyReplySchema.parse(args);
      return withErrorHandling(async () => {
        await client.notifyReply(notification);
        return { message: "Slack notification sent successfully" };
      });
    },

    slack_send_message: async (args: unknown) => {
      const { message } = SendMessageSchema.parse(args);
      return withErrorHandling(async () => {
        await client.sendMessage(message);
        return { message: "Message sent to Slack" };
      });
    },

    slack_send_summary: async (args: unknown) => {
      const { processedCount, waitingChecked, repliesFound } = SendSummarySchema.parse(args);
      return withErrorHandling(async () => {
        await client.sendTaskSummary(processedCount, waitingChecked, repliesFound);
        return { message: "Summary sent to Slack" };
      });
    },
  };
}

export type SlackTools = ReturnType<typeof createSlackTools>;
