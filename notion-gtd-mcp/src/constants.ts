// Notion API
export const NOTION_API_VERSION = "2022-06-28";
export const NOTION_API_BASE_URL = "https://api.notion.com/v1";

// Tags used for GTD workflow
export const GTD_TAGS = {
  TASK: "Task",
  IN_TRAY: "In Tray",
  WAITING: "Waiting",
  AI_PROCESSED: "AI-Processed",
  AI_EXECUTE: "AI-Execute",
} as const;

// Priority levels (for reference)
export const PRIORITY_LEVELS = {
  SUCCESS: "1 Success",
  HARD_DEADLINE: "2 Hard Deadline",
  HIGH: "3 High",
  MEDIUM: "4 Medium",
  LOW: "5 Low",
} as const;

// Microsoft Graph API
export const GRAPH_API_BASE_URL = "https://graph.microsoft.com/v1.0";
export const GRAPH_AUTH_URL = "https://login.microsoftonline.com";

// Limits
export const MAX_BLOCKS_PER_REQUEST = 100;
export const MAX_URL_CONTENT_LENGTH = 50000;
export const MAX_EMAIL_RESULTS = 10;

// HTTP timeouts (ms)
export const HTTP_TIMEOUT = 30000;
export const NOTION_REQUEST_TIMEOUT = 10000;

// Web scraping
export const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// Areas (from the plan - these will be fetched dynamically)
export const DEFAULT_AREAS = [
  "Girls",
  "Boxing",
  "Health",
  "Looksmaxxing",
  "Fraternities",
  "University",
  "Influence",
] as const;
