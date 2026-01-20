import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import { USER_AGENT, HTTP_TIMEOUT, MAX_URL_CONTENT_LENGTH } from "../constants.js";
import { WebFetchError } from "../utils/errors.js";
import type { WebPageContent, FormData, FormField } from "../types.js";

export class WebScraper {
  /**
   * Fetch and parse a URL, returning structured content
   */
  async fetchUrl(url: string): Promise<WebPageContent> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), HTTP_TIMEOUT);

      const response = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
        signal: controller.signal,
        redirect: "follow",
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new WebFetchError(
          `HTTP ${response.status}: ${response.statusText}`,
          url
        );
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
        throw new WebFetchError(
          `Unsupported content type: ${contentType}`,
          url
        );
      }

      let html = await response.text();

      // Truncate if too large
      if (html.length > MAX_URL_CONTENT_LENGTH) {
        html = html.slice(0, MAX_URL_CONTENT_LENGTH);
      }

      return this.parseHtml(url, html);
    } catch (error) {
      if (error instanceof WebFetchError) throw error;

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new WebFetchError("Request timed out", url);
        }
        throw new WebFetchError(error.message, url);
      }

      throw new WebFetchError(String(error), url);
    }
  }

  /**
   * Parse HTML and extract structured content
   */
  private parseHtml(url: string, html: string): WebPageContent {
    const $ = cheerio.load(html);

    // Remove script, style, and other non-content elements
    $("script, style, noscript, iframe, svg, nav, footer, header").remove();

    // Extract title
    const title = $("title").text().trim() || $("h1").first().text().trim() || "";

    // Extract meta description
    const description =
      $('meta[name="description"]').attr("content") ||
      $('meta[property="og:description"]').attr("content") ||
      "";

    // Extract main content
    const mainContent = this.extractMainContent($);

    // Extract forms
    const forms = this.extractForms($);

    // Extract metadata
    const metadata: Record<string, string> = {};

    // Open Graph metadata
    $('meta[property^="og:"]').each((_, el) => {
      const prop = $(el).attr("property")?.replace("og:", "");
      const content = $(el).attr("content");
      if (prop && content) metadata[`og_${prop}`] = content;
    });

    // Event-specific metadata (Eventbrite, etc.)
    const eventDate =
      $('[data-testid="event-date"]').text().trim() ||
      $(".event-date").text().trim() ||
      $('time[datetime]').first().attr("datetime") ||
      "";
    if (eventDate) metadata["event_date"] = eventDate;

    const eventLocation =
      $('[data-testid="event-location"]').text().trim() ||
      $(".event-location").text().trim() ||
      $('[itemprop="location"]').text().trim() ||
      "";
    if (eventLocation) metadata["event_location"] = eventLocation;

    return {
      url,
      title,
      description,
      mainContent,
      forms,
      metadata,
    };
  }

  /**
   * Extract the main content from the page
   */
  private extractMainContent($: cheerio.CheerioAPI): string {
    // Try to find the main content area
    const contentSelectors = [
      "main",
      "article",
      '[role="main"]',
      ".content",
      ".main-content",
      "#content",
      "#main",
    ];

    let $content: cheerio.Cheerio<AnyNode> | null = null;

    for (const selector of contentSelectors) {
      const $el = $(selector);
      if ($el.length > 0) {
        $content = $el.first();
        break;
      }
    }

    // Fall back to body if no main content found
    if (!$content) {
      $content = $("body");
    }

    // Get text content with some structure preserved
    const lines: string[] = [];

    // Extract headings and paragraphs
    $content.find("h1, h2, h3, h4, h5, h6, p, li").each((_, el) => {
      const $el = $(el);
      const text = $el.text().trim();
      if (text) {
        const tagName = el.tagName?.toLowerCase();
        if (tagName?.startsWith("h")) {
          lines.push(`\n## ${text}\n`);
        } else if (tagName === "li") {
          lines.push(`- ${text}`);
        } else {
          lines.push(text);
        }
      }
    });

    return lines.join("\n").trim();
  }

  /**
   * Extract form fields from the page
   */
  extractForms($: cheerio.CheerioAPI): FormData[] {
    const forms: FormData[] = [];

    $("form").each((_, form) => {
      const $form = $(form);
      const action = $form.attr("action") || "";
      const method = $form.attr("method")?.toUpperCase() || "GET";
      const fields: FormField[] = [];

      // Extract input fields
      $form.find("input, textarea, select").each((_, el) => {
        const $el = $(el);
        const name = $el.attr("name") || "";
        const type = $el.attr("type") || el.tagName?.toLowerCase() || "text";
        const id = $el.attr("id") || "";
        const required = $el.attr("required") !== undefined;

        // Try to find the label
        let label = "";
        if (id) {
          label = $(`label[for="${id}"]`).text().trim();
        }
        if (!label) {
          // Check for parent label or adjacent label
          label =
            $el.closest("label").text().trim() ||
            $el.siblings("label").first().text().trim() ||
            $el.attr("placeholder") ||
            name;
        }

        // Skip hidden fields and submit buttons
        if (type === "hidden" || type === "submit" || type === "button") {
          return;
        }

        // Extract select options
        let options: string[] | undefined;
        if (el.tagName?.toLowerCase() === "select") {
          options = [];
          $el.find("option").each((_, opt) => {
            const optText = $(opt).text().trim();
            if (optText) options!.push(optText);
          });
        }

        fields.push({
          name,
          type,
          label: label.replace(/\n/g, " ").trim(),
          required,
          options,
        });
      });

      if (fields.length > 0) {
        forms.push({ action, method, fields });
      }
    });

    return forms;
  }

  /**
   * Extract just the form questions/fields from a URL
   */
  async extractFormFields(url: string): Promise<FormData[]> {
    const content = await this.fetchUrl(url);
    return content.forms;
  }
}
