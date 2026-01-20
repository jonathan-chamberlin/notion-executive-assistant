import { z } from "zod";
import { OutlookClient } from "../services/outlookClient.js";
import { withErrorHandling } from "../utils/errors.js";
import { formatEmailResults } from "../utils/formatting.js";
import type { ToolDefinition } from "../types.js";

// Tool input schemas
const SearchFromSenderSchema = z.object({
  senderEmail: z.string().email().describe("The sender's email address to search for"),
});

const CheckReplySchema = z.object({
  identifier: z
    .string()
    .describe("The sender's email address or name to check for replies from"),
});

// Tool definitions for MCP
export const outlookToolDefinitions: ToolDefinition[] = [
  {
    name: "outlook_search_from_sender",
    description:
      "Search for emails from a specific sender by their email address. Returns the most recent emails from that sender.",
    inputSchema: {
      type: "object",
      properties: {
        senderEmail: {
          type: "string",
          description: "The sender's email address to search for",
        },
      },
      required: ["senderEmail"],
    },
  },
  {
    name: "outlook_check_reply",
    description:
      "Check if there's a reply from a specific person. Can search by email address or name. Use this for tasks with 'Waiting' tag to check if you've received a response.",
    inputSchema: {
      type: "object",
      properties: {
        identifier: {
          type: "string",
          description:
            "The sender's email address or name to check for replies from",
        },
      },
      required: ["identifier"],
    },
  },
];

// Tool handlers
export function createOutlookTools(client: OutlookClient | null) {
  // Return no-op handlers if Outlook is not configured
  if (!client) {
    return {
      outlook_search_from_sender: async () => ({
        success: false,
        error: "Outlook integration not configured. Set AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID, and OUTLOOK_REFRESH_TOKEN environment variables.",
      }),
      outlook_check_reply: async () => ({
        success: false,
        error: "Outlook integration not configured. Set AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID, and OUTLOOK_REFRESH_TOKEN environment variables.",
      }),
    };
  }

  return {
    outlook_search_from_sender: async (args: unknown) => {
      const { senderEmail } = SearchFromSenderSchema.parse(args);
      return withErrorHandling(async () => {
        const result = await client.searchFromSender(senderEmail);
        return {
          ...result,
          formatted: formatEmailResults(result.emails),
        };
      });
    },

    outlook_check_reply: async (args: unknown) => {
      const { identifier } = CheckReplySchema.parse(args);
      return withErrorHandling(async () => {
        const result = await client.checkReply(identifier);
        return {
          ...result,
          formatted: result.found
            ? `Found ${result.emails.length} email(s) from "${identifier}":\n\n${formatEmailResults(result.emails)}`
            : `No emails found from "${identifier}"`,
        };
      });
    },
  };
}

export type OutlookTools = ReturnType<typeof createOutlookTools>;
