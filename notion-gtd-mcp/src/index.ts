#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { NotionClient } from "./services/notionClient.js";
import { WebScraper } from "./services/webScraper.js";
import { OutlookClient } from "./services/outlookClient.js";
import { SlackClient } from "./services/slackClient.js";

import { notionToolDefinitions, createNotionTools } from "./tools/notion.js";
import { webToolDefinitions, createWebTools } from "./tools/web.js";
import { outlookToolDefinitions, createOutlookTools } from "./tools/outlook.js";
import { slackToolDefinitions, createSlackTools } from "./tools/slack.js";

// Environment variables
const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;
const NOTION_AREAS_DATABASE_ID = process.env.NOTION_AREAS_DATABASE_ID;

const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID;
const AZURE_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;
const AZURE_TENANT_ID = process.env.AZURE_TENANT_ID;
const OUTLOOK_REFRESH_TOKEN = process.env.OUTLOOK_REFRESH_TOKEN;

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

// Validate required environment variables
if (!NOTION_API_KEY) {
  console.error("Error: NOTION_API_KEY environment variable is required");
  process.exit(1);
}

if (!NOTION_DATABASE_ID) {
  console.error("Error: NOTION_DATABASE_ID environment variable is required");
  process.exit(1);
}

// Initialize clients
const notionClient = new NotionClient(
  NOTION_API_KEY,
  NOTION_DATABASE_ID,
  NOTION_AREAS_DATABASE_ID
);

const webScraper = new WebScraper();

// Outlook client (optional)
let outlookClient: OutlookClient | null = null;
if (AZURE_CLIENT_ID && AZURE_CLIENT_SECRET && AZURE_TENANT_ID && OUTLOOK_REFRESH_TOKEN) {
  outlookClient = new OutlookClient(
    AZURE_CLIENT_ID,
    AZURE_CLIENT_SECRET,
    AZURE_TENANT_ID,
    OUTLOOK_REFRESH_TOKEN
  );
}

// Slack client (optional)
let slackClient: SlackClient | null = null;
if (SLACK_WEBHOOK_URL) {
  slackClient = new SlackClient(SLACK_WEBHOOK_URL);
}

// Create tool handlers
const notionTools = createNotionTools(notionClient);
const webTools = createWebTools(webScraper);
const outlookTools = createOutlookTools(outlookClient);
const slackTools = createSlackTools(slackClient);

// Combine all tools
const allTools = {
  ...notionTools,
  ...webTools,
  ...outlookTools,
  ...slackTools,
};

// Combine all tool definitions
const allToolDefinitions = [
  ...notionToolDefinitions,
  ...webToolDefinitions,
  ...outlookToolDefinitions,
  ...slackToolDefinitions,
];

// Create MCP server
const server = new Server(
  {
    name: "notion-gtd-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: allToolDefinitions.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  };
});

// Handle call tool request
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  const handler = allTools[name as keyof typeof allTools];
  if (!handler) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ success: false, error: `Unknown tool: ${name}` }),
        },
      ],
    };
  }

  try {
    const result = await handler(args);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ success: false, error: errorMessage }),
        },
      ],
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log startup info to stderr (not stdout, which is used for MCP protocol)
  console.error("GTD MCP Server started");
  console.error(`Notion: Connected to database ${NOTION_DATABASE_ID}`);
  console.error(`Outlook: ${outlookClient ? "Configured" : "Not configured"}`);
  console.error(`Slack: ${slackClient ? "Configured" : "Not configured"}`);
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
