import axios, { AxiosInstance } from "axios";
import logger from "../config/logger";
import { BusinessProfile } from "../models";

/**
 * Service for WordPress integration
 */
export class WordPressService {
  private client: AxiosInstance | null = null;
  private siteUrl: string;
  private username: string;
  private apiKey: string;
  private readonly timeout: number;
  private readonly maxRetries: number;

  /**
   * Create a WordPress service instance for a specific business profile
   * @param businessProfile Business profile with WordPress credentials
   */
  constructor(businessProfile: BusinessProfile) {
    this.siteUrl = businessProfile.wordpress_site_url || "";
    this.username = businessProfile.wordpress_username || "";
    this.apiKey = businessProfile.wordpress_api_key || "";
    this.timeout = parseInt(process.env.WORDPRESS_API_TIMEOUT || "5000", 10);
    this.maxRetries = parseInt(process.env.WORDPRESS_MAX_RETRIES || "3", 10);

    // Initialize client if all credentials are available
    if (this.siteUrl && this.username && this.apiKey) {
      this.initClient();
    }
  }

  /**
   * Check if WordPress integration is configured
   */
  public isConfigured(): boolean {
    return !!(this.siteUrl && this.username && this.apiKey && this.client);
  }

  /**
   * Initialize the WordPress API client
   */
  private initClient(): void {
    try {
      // Normalize site URL
      const baseUrl = this.siteUrl.endsWith("/")
        ? `${this.siteUrl}wp-json/wp/v2`
        : `${this.siteUrl}/wp-json/wp/v2`;

      this.client = axios.create({
        baseURL: baseUrl,
        timeout: this.timeout,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(
            `${this.username}:${this.apiKey}`
          ).toString("base64")}`,
        },
      });

      logger.info(`WordPress client initialized for site: ${this.siteUrl}`);
    } catch (error) {
      logger.error("Failed to initialize WordPress client:", error);
      this.client = null;
    }
  }

  /**
   * Publish a post to WordPress
   * @param title Post title
   * @param content Post content
   * @param status Post status (publish, draft, etc.)
   * @param keywords Keywords/tags for the post
   * @returns Published post data
   */
  public async publishPost(
    title: string,
    content: string,
    status: "publish" | "draft" = "publish",
    keywords: string[] = []
  ): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error("WordPress integration not configured");
    }

    try {
      // Create tags/categories if they don't exist
      const tagIds = await this.createTagsIfNeeded(keywords);

      // Prepare post data
      const postData = {
        title,
        content,
        status,
        tags: tagIds,
      };

      // Publish the post with retry logic
      return await this.executeWithRetry(() =>
        this.client!.post("/posts", postData)
      );
    } catch (error) {
      logger.error("Failed to publish post to WordPress:", error);
      throw new Error(
        "Failed to publish post to WordPress. Please check your credentials and try again."
      );
    }
  }

  /**
   * Update an existing WordPress post
   * @param postId WordPress post ID
   * @param title Post title
   * @param content Post content
   * @param status Post status
   * @param keywords Keywords/tags for the post
   * @param date Scheduled date in ISO format
   * @returns Updated post data
   */
  public async updatePost(
    postId: number,
    title?: string,
    content?: string,
    status?: "publish" | "draft" | "future",
    keywords?: string[],
    date?: string
  ): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error("WordPress integration not configured");
    }

    try {
      const updateData: any = {};

      if (title !== undefined) updateData.title = title;
      if (content !== undefined) updateData.content = content;
      if (status !== undefined) updateData.status = status;
      if (date !== undefined) updateData.date = date;

      // Update tags if provided
      if (keywords && keywords.length > 0) {
        const tagIds = await this.createTagsIfNeeded(keywords);
        updateData.tags = tagIds;
      }

      // Update the post with retry logic
      return await this.executeWithRetry(() =>
        this.client!.put(`/posts/${postId}`, updateData)
      );
    } catch (error) {
      logger.error("Failed to update WordPress post:", error);
      throw new Error(
        "Failed to update WordPress post. Please check your credentials and try again."
      );
    }
  }

  /**
   * Create tags if they don't exist and return their IDs
   * @param tags Array of tag names
   * @returns Array of tag IDs
   */
  private async createTagsIfNeeded(tags: string[]): Promise<number[]> {
    if (!tags || tags.length === 0) return [];

    const tagIds: number[] = [];

    for (const tag of tags) {
      try {
        // Check if tag exists
        const existingTags = await this.executeWithRetry(() =>
          this.client!.get("/tags", {
            params: { search: tag, per_page: 1 },
          })
        );

        if (existingTags.data && existingTags.data.length > 0) {
          // Use existing tag
          tagIds.push(existingTags.data[0].id);
        } else {
          // Create new tag
          const newTag = await this.executeWithRetry(() =>
            this.client!.post("/tags", { name: tag })
          );
          tagIds.push(newTag.data.id);
        }
      } catch (error) {
        logger.warn(`Failed to create/find WordPress tag: ${tag}`, error);
        // Continue with other tags even if one fails
      }
    }

    return tagIds;
  }

  /**
   * Execute a function with retry logic
   * @param fn Function to execute
   * @returns Function result
   */
  private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: any;
    let retries = 0;

    while (retries < this.maxRetries) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        retries++;
        // Wait before retrying (exponential backoff)
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, retries) * 1000)
        );
      }
    }

    throw lastError;
  }

  /**
   * Test WordPress connection
   * @returns True if connection is successful
   */
  public async testConnection(): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    try {
      const response = await this.client!.get("/");
      return response.status === 200;
    } catch (error) {
      logger.error("WordPress connection test failed:", error);
      return false;
    }
  }
}

export default WordPressService;
