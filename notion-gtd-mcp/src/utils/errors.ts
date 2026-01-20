/**
 * Custom error classes for the GTD MCP server
 */

export class MCPError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "MCPError";
  }
}

export class NotionError extends MCPError {
  constructor(message: string, details?: unknown) {
    super(message, "NOTION_ERROR", details);
    this.name = "NotionError";
  }
}

export class WebFetchError extends MCPError {
  constructor(message: string, public url: string, details?: unknown) {
    super(message, "WEB_FETCH_ERROR", details);
    this.name = "WebFetchError";
  }
}

export class OutlookError extends MCPError {
  constructor(message: string, details?: unknown) {
    super(message, "OUTLOOK_ERROR", details);
    this.name = "OutlookError";
  }
}

export class SlackError extends MCPError {
  constructor(message: string, details?: unknown) {
    super(message, "SLACK_ERROR", details);
    this.name = "SlackError";
  }
}

/**
 * Format an error for MCP tool response
 */
export function formatError(error: unknown): { success: false; error: string } {
  if (error instanceof MCPError) {
    return {
      success: false,
      error: `[${error.code}] ${error.message}`,
    };
  }

  if (error instanceof Error) {
    return {
      success: false,
      error: error.message,
    };
  }

  return {
    success: false,
    error: String(error),
  };
}

/**
 * Wrap an async function with error handling
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    return formatError(error);
  }
}
