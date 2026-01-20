import { GRAPH_API_BASE_URL, GRAPH_AUTH_URL, MAX_EMAIL_RESULTS, HTTP_TIMEOUT } from "../constants.js";
import { OutlookError } from "../utils/errors.js";
import type { EmailMessage, EmailSearchResult } from "../types.js";

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

interface GraphEmailResponse {
  value: GraphEmail[];
}

interface GraphEmail {
  id: string;
  subject: string;
  from: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
  receivedDateTime: string;
  bodyPreview: string;
  isRead: boolean;
}

export class OutlookClient {
  private clientId: string;
  private clientSecret: string;
  private tenantId: string;
  private refreshToken: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(
    clientId: string,
    clientSecret: string,
    tenantId: string,
    refreshToken: string
  ) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.tenantId = tenantId;
    this.refreshToken = refreshToken;
  }

  /**
   * Get a valid access token, refreshing if necessary
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 5 min buffer)
    if (this.accessToken && Date.now() < this.tokenExpiry - 300000) {
      return this.accessToken;
    }

    const tokenUrl = `${GRAPH_AUTH_URL}/${this.tenantId}/oauth2/v2.0/token`;

    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: this.refreshToken,
      grant_type: "refresh_token",
      scope: "https://graph.microsoft.com/Mail.Read offline_access",
    });

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new OutlookError(`Failed to refresh token: ${error}`);
    }

    const data = (await response.json()) as TokenResponse;
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + data.expires_in * 1000;

    // Update refresh token if a new one was provided
    if (data.refresh_token) {
      this.refreshToken = data.refresh_token;
    }

    return this.accessToken;
  }

  /**
   * Make an authenticated request to the Graph API
   */
  private async graphRequest<T>(endpoint: string): Promise<T> {
    const token = await this.getAccessToken();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HTTP_TIMEOUT);

    try {
      const response = await fetch(`${GRAPH_API_BASE_URL}${endpoint}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        throw new OutlookError(`Graph API error: ${response.status} - ${error}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof OutlookError) throw error;

      if (error instanceof Error && error.name === "AbortError") {
        throw new OutlookError("Request timed out");
      }

      throw new OutlookError(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Search for emails from a specific sender
   */
  async searchFromSender(senderEmail: string): Promise<EmailSearchResult> {
    // Use $filter to search by sender
    const filter = encodeURIComponent(`from/emailAddress/address eq '${senderEmail}'`);
    const endpoint = `/me/messages?$filter=${filter}&$top=${MAX_EMAIL_RESULTS}&$orderby=receivedDateTime desc`;

    const data = await this.graphRequest<GraphEmailResponse>(endpoint);
    const emails = data.value.map(this.parseEmail);

    return {
      found: emails.length > 0,
      emails,
      latestReply: emails.length > 0 ? emails[0] : null,
    };
  }

  /**
   * Search for emails by sender name (partial match)
   */
  async searchBySenderName(name: string): Promise<EmailSearchResult> {
    // Use $search for fuzzy name matching
    const search = encodeURIComponent(`from:${name}`);
    const endpoint = `/me/messages?$search="${search}"&$top=${MAX_EMAIL_RESULTS}&$orderby=receivedDateTime desc`;

    const data = await this.graphRequest<GraphEmailResponse>(endpoint);
    const emails = data.value.map(this.parseEmail);

    return {
      found: emails.length > 0,
      emails,
      latestReply: emails.length > 0 ? emails[0] : null,
    };
  }

  /**
   * Check if there's a reply from a specific person (by email or name)
   */
  async checkReply(identifier: string): Promise<EmailSearchResult> {
    // Determine if it's an email address or name
    const isEmail = identifier.includes("@");

    if (isEmail) {
      return this.searchFromSender(identifier);
    } else {
      return this.searchBySenderName(identifier);
    }
  }

  /**
   * Parse Graph API email to our format
   */
  private parseEmail(email: GraphEmail): EmailMessage {
    return {
      id: email.id,
      subject: email.subject,
      from: {
        name: email.from.emailAddress.name,
        address: email.from.emailAddress.address,
      },
      receivedDateTime: email.receivedDateTime,
      bodyPreview: email.bodyPreview,
      isRead: email.isRead,
    };
  }
}
