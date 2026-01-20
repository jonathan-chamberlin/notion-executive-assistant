import { z } from "zod";
import { NotionClient } from "../services/notionClient.js";
import { withErrorHandling } from "../utils/errors.js";
import { formatTaskList, formatPageContent, formatAreasList } from "../utils/formatting.js";
import type { ToolDefinition } from "../types.js";

// Tool input schemas
const QueryIntraySchema = z.object({});

const QueryWaitingSchema = z.object({});

const GetPageSchema = z.object({
  pageId: z.string().describe("The Notion page ID to retrieve"),
});

const GetLinkedPagesSchema = z.object({
  pageIds: z.array(z.string()).describe("Array of Notion page IDs to retrieve"),
});

const RenamePageSchema = z.object({
  pageId: z.string().describe("The Notion page ID to rename"),
  newTitle: z.string().describe("The new title for the page"),
});

const AddToggleSchema = z.object({
  pageId: z.string().describe("The Notion page ID to add toggle to"),
  toggleTitle: z.string().describe("The title of the toggle block"),
  content: z.string().describe("The content inside the toggle"),
});

const UpdateTagsSchema = z.object({
  pageId: z.string().describe("The Notion page ID to update"),
  addTags: z.array(z.string()).default([]).describe("Tags to add"),
  removeTags: z.array(z.string()).default([]).describe("Tags to remove"),
});

const SetAreasSchema = z.object({
  pageId: z.string().describe("The Notion page ID to update"),
  areaIds: z.array(z.string()).describe("Array of Area page IDs to set"),
});

const GetAreasListSchema = z.object({});

// Tool definitions for MCP
export const notionToolDefinitions: ToolDefinition[] = [
  {
    name: "notion_query_intray",
    description:
      "Query tasks that are in the In Tray and haven't been AI-processed yet. Returns tasks with 'In Tray' tag but without 'AI-Processed' tag.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "notion_query_waiting",
    description:
      "Query tasks that have the 'Waiting' tag. These are tasks waiting for a response from someone.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "notion_get_page",
    description:
      "Get a page's full content including title, properties (tags, date, priority, areas), and all block content. Also extracts URLs and linked Notion pages found in the content.",
    inputSchema: {
      type: "object",
      properties: {
        pageId: {
          type: "string",
          description: "The Notion page ID to retrieve",
        },
      },
      required: ["pageId"],
    },
  },
  {
    name: "notion_get_linked_pages",
    description:
      "Retrieve content from multiple linked Notion pages. Use this after notion_get_page to fetch any linked pages found in the content.",
    inputSchema: {
      type: "object",
      properties: {
        pageIds: {
          type: "array",
          items: { type: "string" },
          description: "Array of Notion page IDs to retrieve",
        },
      },
      required: ["pageIds"],
    },
  },
  {
    name: "notion_rename_page",
    description:
      "Update a page's title to a clarified, actionable task name. Use this to transform vague task titles into clear next actions.",
    inputSchema: {
      type: "object",
      properties: {
        pageId: {
          type: "string",
          description: "The Notion page ID to rename",
        },
        newTitle: {
          type: "string",
          description: "The new title for the page",
        },
      },
      required: ["pageId", "newTitle"],
    },
  },
  {
    name: "notion_add_toggle",
    description:
      "Add a toggle block to a page containing the original task title and any research findings. The toggle keeps the page clean while preserving context.",
    inputSchema: {
      type: "object",
      properties: {
        pageId: {
          type: "string",
          description: "The Notion page ID to add toggle to",
        },
        toggleTitle: {
          type: "string",
          description: "The title of the toggle block (e.g., 'AI Research Notes')",
        },
        content: {
          type: "string",
          description:
            "The content inside the toggle (original task, findings, etc.)",
        },
      },
      required: ["pageId", "toggleTitle", "content"],
    },
  },
  {
    name: "notion_update_tags",
    description:
      "Add or remove tags from a page. Use to remove 'In Tray' and add 'AI-Processed' after processing a task.",
    inputSchema: {
      type: "object",
      properties: {
        pageId: {
          type: "string",
          description: "The Notion page ID to update",
        },
        addTags: {
          type: "array",
          items: { type: "string" },
          description: "Tags to add",
        },
        removeTags: {
          type: "array",
          items: { type: "string" },
          description: "Tags to remove",
        },
      },
      required: ["pageId"],
    },
  },
  {
    name: "notion_set_areas",
    description:
      "Set the Areas relation field on a page. Areas categorize tasks (e.g., University, Health, Influence). Can set multiple areas.",
    inputSchema: {
      type: "object",
      properties: {
        pageId: {
          type: "string",
          description: "The Notion page ID to update",
        },
        areaIds: {
          type: "array",
          items: { type: "string" },
          description: "Array of Area page IDs to set as relations",
        },
      },
      required: ["pageId", "areaIds"],
    },
  },
  {
    name: "notion_get_areas_list",
    description:
      "Get all available Areas for categorization. Returns area names and IDs. Use this to know what areas are available before assigning them to tasks.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];

// Tool handlers
export function createNotionTools(client: NotionClient) {
  return {
    notion_query_intray: async () => {
      return withErrorHandling(async () => {
        const tasks = await client.queryInTray();
        return {
          count: tasks.length,
          tasks: tasks,
          formatted: formatTaskList(tasks),
        };
      });
    },

    notion_query_waiting: async () => {
      return withErrorHandling(async () => {
        const tasks = await client.queryWaiting();
        return {
          count: tasks.length,
          tasks: tasks,
          formatted: formatTaskList(tasks),
        };
      });
    },

    notion_get_page: async (args: unknown) => {
      const { pageId } = GetPageSchema.parse(args);
      return withErrorHandling(async () => {
        const content = await client.getPage(pageId);
        return {
          ...content,
          formatted: formatPageContent(content),
        };
      });
    },

    notion_get_linked_pages: async (args: unknown) => {
      const { pageIds } = GetLinkedPagesSchema.parse(args);
      return withErrorHandling(async () => {
        const pages = await client.getLinkedPages(pageIds);
        return {
          count: pages.length,
          pages: pages,
          formatted: pages.map(formatPageContent).join("\n\n---\n\n"),
        };
      });
    },

    notion_rename_page: async (args: unknown) => {
      const { pageId, newTitle } = RenamePageSchema.parse(args);
      return withErrorHandling(async () => {
        await client.renamePage(pageId, newTitle);
        return { pageId, newTitle, message: "Page renamed successfully" };
      });
    },

    notion_add_toggle: async (args: unknown) => {
      const { pageId, toggleTitle, content } = AddToggleSchema.parse(args);
      return withErrorHandling(async () => {
        await client.addToggle(pageId, toggleTitle, content);
        return { pageId, toggleTitle, message: "Toggle added successfully" };
      });
    },

    notion_update_tags: async (args: unknown) => {
      const { pageId, addTags, removeTags } = UpdateTagsSchema.parse(args);
      return withErrorHandling(async () => {
        await client.updateTags(pageId, addTags, removeTags);
        return {
          pageId,
          addedTags: addTags,
          removedTags: removeTags,
          message: "Tags updated successfully",
        };
      });
    },

    notion_set_areas: async (args: unknown) => {
      const { pageId, areaIds } = SetAreasSchema.parse(args);
      return withErrorHandling(async () => {
        await client.setAreas(pageId, areaIds);
        return { pageId, areaIds, message: "Areas set successfully" };
      });
    },

    notion_get_areas_list: async () => {
      return withErrorHandling(async () => {
        const areas = await client.getAreasList();
        return {
          count: areas.length,
          areas: areas,
          formatted: formatAreasList(areas),
        };
      });
    },
  };
}

export type NotionTools = ReturnType<typeof createNotionTools>;
