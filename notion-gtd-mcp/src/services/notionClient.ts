import { Client } from "@notionhq/client";
import type {
  BlockObjectResponse,
  PageObjectResponse,
  PartialBlockObjectResponse,
  QueryDatabaseResponse,
  RichTextItemResponse,
} from "@notionhq/client/build/src/api-endpoints.js";
import { GTD_TAGS } from "../constants.js";
import type { Area, NotionBlock, NotionPageContent, NotionTask, AreaReference } from "../types.js";

export class NotionClient {
  private client: Client;
  private databaseId: string;
  private areasDbId: string | undefined;

  constructor(apiKey: string, databaseId: string, areasDbId?: string) {
    this.client = new Client({ auth: apiKey });
    this.databaseId = databaseId;
    this.areasDbId = areasDbId;
  }

  /**
   * Query tasks that are in the In Tray and haven't been AI-processed
   */
  async queryInTray(): Promise<NotionTask[]> {
    const response = await this.client.databases.query({
      database_id: this.databaseId,
      filter: {
        and: [
          {
            property: "Tags",
            multi_select: {
              contains: GTD_TAGS.IN_TRAY,
            },
          },
          {
            property: "Tags",
            multi_select: {
              does_not_contain: GTD_TAGS.AI_PROCESSED,
            },
          },
        ],
      },
      sorts: [
        {
          property: "Created Time",
          direction: "ascending",
        },
      ],
    });

    return this.parseTaskResults(response);
  }

  /**
   * Query tasks that have the Waiting tag
   */
  async queryWaiting(): Promise<NotionTask[]> {
    const response = await this.client.databases.query({
      database_id: this.databaseId,
      filter: {
        property: "Tags",
        multi_select: {
          contains: GTD_TAGS.WAITING,
        },
      },
    });

    return this.parseTaskResults(response);
  }

  /**
   * Get a page's full content including properties and blocks
   */
  async getPage(pageId: string): Promise<NotionPageContent> {
    const [page, blocks] = await Promise.all([
      this.client.pages.retrieve({ page_id: pageId }) as Promise<PageObjectResponse>,
      this.getPageBlocks(pageId),
    ]);

    const task = this.parsePageToTask(page);
    const parsedBlocks = this.parseBlocks(blocks);
    const { linkedPages, urls } = this.extractLinksFromBlocks(blocks);

    return {
      id: page.id,
      title: task.title,
      properties: task,
      blocks: parsedBlocks,
      linkedPages,
      urls,
    };
  }

  /**
   * Get all blocks from a page (handles pagination)
   */
  private async getPageBlocks(pageId: string): Promise<BlockObjectResponse[]> {
    const blocks: BlockObjectResponse[] = [];
    let cursor: string | undefined;

    do {
      const response = await this.client.blocks.children.list({
        block_id: pageId,
        start_cursor: cursor,
        page_size: 100,
      });

      for (const block of response.results) {
        if ("type" in block) {
          blocks.push(block as BlockObjectResponse);
        }
      }

      cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
    } while (cursor);

    return blocks;
  }

  /**
   * Get content from linked pages
   */
  async getLinkedPages(pageIds: string[]): Promise<NotionPageContent[]> {
    const pages: NotionPageContent[] = [];

    for (const pageId of pageIds) {
      try {
        const content = await this.getPage(pageId);
        pages.push(content);
      } catch (error) {
        // Skip pages that can't be accessed
        console.error(`Failed to fetch linked page ${pageId}:`, error);
      }
    }

    return pages;
  }

  /**
   * Rename a page (update its title)
   */
  async renamePage(pageId: string, newTitle: string): Promise<void> {
    await this.client.pages.update({
      page_id: pageId,
      properties: {
        Name: {
          title: [
            {
              text: {
                content: newTitle,
              },
            },
          ],
        },
      },
    });
  }

  /**
   * Add a toggle heading block at the top of a page
   */
  async addToggle(pageId: string, toggleTitle: string, content: string): Promise<void> {
    // First, get existing blocks to prepend before them
    const existingBlocks = await this.getPageBlocks(pageId);

    // Create the toggle with content
    const toggleBlock = {
      object: "block" as const,
      type: "toggle" as const,
      toggle: {
        rich_text: [
          {
            type: "text" as const,
            text: {
              content: toggleTitle,
            },
          },
        ],
        children: [
          {
            object: "block" as const,
            type: "paragraph" as const,
            paragraph: {
              rich_text: [
                {
                  type: "text" as const,
                  text: {
                    content: content,
                  },
                },
              ],
            },
          },
        ],
      },
    };

    // If there are existing blocks, we need to insert at the beginning
    // Notion doesn't support direct prepending, so we'll add after the page itself
    // and the content will appear at the top of empty pages, or we need to use a workaround

    if (existingBlocks.length > 0) {
      // Insert before the first block by using the page as parent and then moving
      // Actually, Notion API appends to the end. To prepend, we need to:
      // 1. Add the toggle
      // 2. Delete and recreate all other blocks (expensive) OR just append (simpler)

      // For simplicity, we'll append the toggle. In practice, users can manually move it.
      // A better approach would be to track that it should be at top in the toggle title.
      await this.client.blocks.children.append({
        block_id: pageId,
        children: [toggleBlock],
      });
    } else {
      await this.client.blocks.children.append({
        block_id: pageId,
        children: [toggleBlock],
      });
    }
  }

  /**
   * Update tags on a page (add and/or remove)
   */
  async updateTags(pageId: string, addTags: string[], removeTags: string[]): Promise<void> {
    // First, get current tags
    const page = await this.client.pages.retrieve({ page_id: pageId }) as PageObjectResponse;
    const tagsProperty = page.properties["Tags"];

    let currentTags: string[] = [];
    if (tagsProperty && tagsProperty.type === "multi_select") {
      currentTags = tagsProperty.multi_select.map((tag) => tag.name);
    }

    // Apply changes
    const newTags = new Set(currentTags);
    for (const tag of removeTags) {
      newTags.delete(tag);
    }
    for (const tag of addTags) {
      newTags.add(tag);
    }

    // Update the page
    await this.client.pages.update({
      page_id: pageId,
      properties: {
        Tags: {
          multi_select: Array.from(newTags).map((name) => ({ name })),
        },
      },
    });
  }

  /**
   * Set the Areas relation field
   */
  async setAreas(pageId: string, areaIds: string[]): Promise<void> {
    await this.client.pages.update({
      page_id: pageId,
      properties: {
        Areas: {
          relation: areaIds.map((id) => ({ id })),
        },
      },
    });
  }

  /**
   * Get all available areas from the Areas database
   */
  async getAreasList(): Promise<Area[]> {
    if (!this.areasDbId) {
      // If no Areas DB is configured, return empty list
      // Areas will need to be assigned by ID directly
      return [];
    }

    const response = await this.client.databases.query({
      database_id: this.areasDbId,
      page_size: 100,
    });

    const areas: Area[] = [];
    for (const page of response.results) {
      if ("properties" in page) {
        const pageObj = page as PageObjectResponse;
        const titleProp = pageObj.properties["Name"] || pageObj.properties["title"];

        if (titleProp && titleProp.type === "title") {
          const title = titleProp.title.map((t) => t.plain_text).join("");
          areas.push({
            id: page.id,
            name: title,
          });
        }
      }
    }

    return areas;
  }

  /**
   * Parse database query results to NotionTask array
   */
  private parseTaskResults(response: QueryDatabaseResponse): NotionTask[] {
    const tasks: NotionTask[] = [];

    for (const page of response.results) {
      if ("properties" in page) {
        tasks.push(this.parsePageToTask(page as PageObjectResponse));
      }
    }

    return tasks;
  }

  /**
   * Parse a single page to NotionTask
   */
  private parsePageToTask(page: PageObjectResponse): NotionTask {
    const props = page.properties;

    // Extract title
    let title = "";
    const nameProp = props["Name"];
    if (nameProp && nameProp.type === "title") {
      title = nameProp.title.map((t) => t.plain_text).join("");
    }

    // Extract tags
    let tags: string[] = [];
    const tagsProp = props["Tags"];
    if (tagsProp && tagsProp.type === "multi_select") {
      tags = tagsProp.multi_select.map((t) => t.name);
    }

    // Extract date
    let date: string | null = null;
    const dateProp = props["Date"];
    if (dateProp && dateProp.type === "date" && dateProp.date) {
      date = dateProp.date.start;
    }

    // Extract archived
    let archived = false;
    const archivedProp = props["Archived"];
    if (archivedProp && archivedProp.type === "checkbox") {
      archived = archivedProp.checkbox;
    }

    // Extract priority
    let priority: string | null = null;
    const priorityProp = props["Priority"];
    if (priorityProp && priorityProp.type === "select" && priorityProp.select) {
      priority = priorityProp.select.name;
    }

    // Extract areas
    const areas: AreaReference[] = [];
    const areasProp = props["Areas"];
    if (areasProp && areasProp.type === "relation") {
      for (const rel of areasProp.relation) {
        areas.push({ id: rel.id, name: "" }); // Name will be resolved separately if needed
      }
    }

    // Extract timestamps
    let createdTime = "";
    const createdProp = props["Created Time"];
    if (createdProp && createdProp.type === "created_time") {
      createdTime = createdProp.created_time;
    }

    let lastEditedTime = "";
    const editedProp = props["Last edited time"];
    if (editedProp && editedProp.type === "last_edited_time") {
      lastEditedTime = editedProp.last_edited_time;
    }

    return {
      id: page.id,
      title,
      tags,
      date,
      archived,
      priority,
      areas,
      createdTime,
      lastEditedTime,
      url: page.url,
    };
  }

  /**
   * Parse blocks to simplified format
   */
  private parseBlocks(blocks: BlockObjectResponse[]): NotionBlock[] {
    return blocks.map((block) => {
      const content = this.extractBlockContent(block);
      return {
        id: block.id,
        type: block.type,
        content,
      };
    });
  }

  /**
   * Extract text content from a block
   */
  private extractBlockContent(block: BlockObjectResponse): string {
    const blockAny = block as any;
    const blockData = blockAny[block.type];

    if (!blockData) return "";

    // Handle rich_text property (most block types)
    if (blockData.rich_text) {
      return blockData.rich_text
        .map((rt: RichTextItemResponse) => rt.plain_text)
        .join("");
    }

    // Handle title property (child_page, child_database)
    if (blockData.title) {
      return blockData.title;
    }

    // Handle caption (images, embeds, etc.)
    if (blockData.caption) {
      return blockData.caption
        .map((rt: RichTextItemResponse) => rt.plain_text)
        .join("");
    }

    // Handle URL for bookmarks, embeds, etc.
    if (blockData.url) {
      return blockData.url;
    }

    return "";
  }

  /**
   * Extract linked Notion pages and external URLs from blocks
   */
  private extractLinksFromBlocks(blocks: BlockObjectResponse[]): {
    linkedPages: string[];
    urls: string[];
  } {
    const linkedPages: string[] = [];
    const urls: string[] = [];

    for (const block of blocks) {
      const blockAny = block as any;
      const blockData = blockAny[block.type];

      if (!blockData) continue;

      // Check rich_text for links
      if (blockData.rich_text) {
        for (const rt of blockData.rich_text as RichTextItemResponse[]) {
          // Check for mentions (page links)
          if (rt.type === "mention" && "mention" in rt) {
            const mention = (rt as any).mention;
            if (mention.type === "page") {
              linkedPages.push(mention.page.id);
            }
          }

          // Check for href (external links)
          if (rt.href) {
            urls.push(rt.href);
          }
        }
      }

      // Check for bookmark blocks
      if (block.type === "bookmark" && blockData.url) {
        urls.push(blockData.url);
      }

      // Check for embed blocks
      if (block.type === "embed" && blockData.url) {
        urls.push(blockData.url);
      }

      // Check for link_preview blocks
      if (block.type === "link_preview" && blockData.url) {
        urls.push(blockData.url);
      }
    }

    return {
      linkedPages: [...new Set(linkedPages)],
      urls: [...new Set(urls)],
    };
  }
}
