// Notion types
export interface NotionTask {
  id: string;
  title: string;
  tags: string[];
  date: string | null;
  archived: boolean;
  priority: string | null;
  areas: AreaReference[];
  createdTime: string;
  lastEditedTime: string;
  url: string;
}

export interface AreaReference {
  id: string;
  name: string;
}

export interface NotionPageContent {
  id: string;
  title: string;
  properties: NotionTask;
  blocks: NotionBlock[];
  linkedPages: string[];
  urls: string[];
}

export interface NotionBlock {
  id: string;
  type: string;
  content: string;
  children?: NotionBlock[];
}

export interface Area {
  id: string;
  name: string;
}

// Web scraping types
export interface WebPageContent {
  url: string;
  title: string;
  description: string;
  mainContent: string;
  forms: FormData[];
  metadata: Record<string, string>;
}

export interface FormData {
  action: string;
  method: string;
  fields: FormField[];
}

export interface FormField {
  name: string;
  type: string;
  label: string;
  required: boolean;
  options?: string[];
}

// Outlook types
export interface EmailMessage {
  id: string;
  subject: string;
  from: EmailAddress;
  receivedDateTime: string;
  bodyPreview: string;
  isRead: boolean;
}

export interface EmailAddress {
  name: string;
  address: string;
}

export interface EmailSearchResult {
  found: boolean;
  emails: EmailMessage[];
  latestReply: EmailMessage | null;
}

// Slack types
export interface SlackNotification {
  taskTitle: string;
  senderName: string;
  emailSubject: string;
  receivedAt: string;
  notionPageUrl: string;
}

// Tool response types
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// MCP tool definitions
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}
