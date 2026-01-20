import { z } from "zod";
import { WebScraper } from "../services/webScraper.js";
import { withErrorHandling } from "../utils/errors.js";
import { truncate } from "../utils/formatting.js";
import type { ToolDefinition, FormData } from "../types.js";

// Tool input schemas
const FetchUrlSchema = z.object({
  url: z.string().url().describe("The URL to fetch and parse"),
});

const ExtractFormSchema = z.object({
  url: z.string().url().describe("The URL to extract form fields from"),
});

// Tool definitions for MCP
export const webToolDefinitions: ToolDefinition[] = [
  {
    name: "web_fetch_url",
    description:
      "Fetch and parse a URL, returning the page title, description, main content, any forms found, and metadata. Use this to research URLs found in tasks. Silently fails for login-walled or broken URLs.",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The URL to fetch and parse",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "web_extract_form",
    description:
      "Extract form fields and questions from a URL. Returns all form fields with their labels, types, and whether they're required. Use this to identify what questions need to be answered for registration forms, applications, etc.",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The URL to extract form fields from",
        },
      },
      required: ["url"],
    },
  },
];

/**
 * Format form fields for display
 */
function formatForms(forms: FormData[]): string {
  if (forms.length === 0) {
    return "No forms found on page.";
  }

  const lines: string[] = [];

  for (let i = 0; i < forms.length; i++) {
    const form = forms[i];
    lines.push(`## Form ${i + 1}`);
    lines.push(`Action: ${form.action || "(same page)"}`);
    lines.push(`Method: ${form.method}`);
    lines.push("");
    lines.push("Fields:");

    for (const field of form.fields) {
      const required = field.required ? " (required)" : "";
      const options = field.options ? ` [options: ${field.options.join(", ")}]` : "";
      lines.push(`- ${field.label}${required}${options}`);
    }

    lines.push("");
  }

  return lines.join("\n");
}

// Tool handlers
export function createWebTools(scraper: WebScraper) {
  return {
    web_fetch_url: async (args: unknown) => {
      const { url } = FetchUrlSchema.parse(args);
      return withErrorHandling(async () => {
        const content = await scraper.fetchUrl(url);
        return {
          url: content.url,
          title: content.title,
          description: content.description,
          mainContent: truncate(content.mainContent, 10000),
          forms: content.forms,
          metadata: content.metadata,
          formsFormatted: formatForms(content.forms),
        };
      });
    },

    web_extract_form: async (args: unknown) => {
      const { url } = ExtractFormSchema.parse(args);
      return withErrorHandling(async () => {
        const forms = await scraper.extractFormFields(url);
        return {
          url,
          formCount: forms.length,
          forms: forms,
          formatted: formatForms(forms),
        };
      });
    },
  };
}

export type WebTools = ReturnType<typeof createWebTools>;
