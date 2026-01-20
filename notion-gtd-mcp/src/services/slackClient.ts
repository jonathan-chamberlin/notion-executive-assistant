import { HTTP_TIMEOUT } from "../constants.js";
import { SlackError } from "../utils/errors.js";
import type { SlackNotification } from "../types.js";

interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
    emoji?: boolean;
  };
  elements?: Array<{
    type: string;
    text?: string;
    url?: string;
  }>;
  fields?: Array<{
    type: string;
    text: string;
  }>;
}

interface SlackMessage {
  text: string;
  blocks?: SlackBlock[];
}

export class SlackClient {
  private webhookUrl: string;

  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl;
  }

  /**
   * Send a raw message to Slack
   */
  async sendMessage(text: string): Promise<void> {
    await this.postToWebhook({ text });
  }

  /**
   * Send a notification that an email reply was received
   */
  async notifyReply(notification: SlackNotification): Promise<void> {
    const message: SlackMessage = {
      text: `Reply received for: ${notification.taskTitle}`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "📬 Email Reply Received",
            emoji: true,
          },
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Task:*\n${notification.taskTitle}`,
            },
            {
              type: "mrkdwn",
              text: `*From:*\n${notification.senderName}`,
            },
            {
              type: "mrkdwn",
              text: `*Subject:*\n${notification.emailSubject}`,
            },
            {
              type: "mrkdwn",
              text: `*Received:*\n${this.formatDate(notification.receivedAt)}`,
            },
          ],
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `<${notification.notionPageUrl}|View task in Notion>`,
          },
        },
      ],
    };

    await this.postToWebhook(message);
  }

  /**
   * Send a task processing summary
   */
  async sendTaskSummary(
    processedCount: number,
    waitingChecked: number,
    repliesFound: number
  ): Promise<void> {
    const message: SlackMessage = {
      text: `GTD processing complete: ${processedCount} tasks processed`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "✅ GTD Processing Complete",
            emoji: true,
          },
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Tasks Processed:*\n${processedCount}`,
            },
            {
              type: "mrkdwn",
              text: `*Waiting Tasks Checked:*\n${waitingChecked}`,
            },
            {
              type: "mrkdwn",
              text: `*Replies Found:*\n${repliesFound}`,
            },
          ],
        },
      ],
    };

    await this.postToWebhook(message);
  }

  /**
   * Post a message to the Slack webhook
   */
  private async postToWebhook(message: SlackMessage): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HTTP_TIMEOUT);

    try {
      const response = await fetch(this.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        throw new SlackError(`Slack webhook error: ${response.status} - ${error}`);
      }
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof SlackError) throw error;

      if (error instanceof Error && error.name === "AbortError") {
        throw new SlackError("Request timed out");
      }

      throw new SlackError(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Format a date string for display
   */
  private formatDate(isoDate: string): string {
    const date = new Date(isoDate);
    return date.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }
}
