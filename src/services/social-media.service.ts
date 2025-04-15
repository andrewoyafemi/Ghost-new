import { Post, SocialMediaCaption, User } from "../models";
import {
  SocialMediaPlatform,
  CaptionStatus,
  SocialMediaCaptionAttributes,
} from "../models/social-media-caption.model";
import openai, { openaiConfig } from "../config/openai";
import logger from "../config/logger";
import { BusinessProfile } from "../models";
import { Transaction } from "sequelize";
import sequelize from "../config/database";

/**
 * Interface for caption generation options
 */
interface CaptionGenerationOptions {
  platform: SocialMediaPlatform;
  tone?: string;
  includeHashtags?: boolean;
  maxLength?: number;
}

/**
 * Generated caption interface
 */
interface GeneratedCaption {
  platform: SocialMediaPlatform;
  text: string;
}

/**
 * SocialMediaService
 *
 * This service handles social media caption generation and management.
 * It uses OpenAI to generate captions for different platforms based on post content.
 */
export class SocialMediaService {
  /**
   * Generate social media captions for a post
   *
   * @param postIdOrPost Post ID or Post object to generate captions for
   * @param userId User ID
   * @param options Caption generation options
   * @returns Promise<GeneratedCaption[]> Array of generated captions
   */
  public async generateCaptions(
    postIdOrPost: number | Post,
    userId: number,
    options: CaptionGenerationOptions[]
  ): Promise<GeneratedCaption[]> {
    try {
      // Handle both post object and post ID
      let post: Post | null;

      if (typeof postIdOrPost === "number") {
        // If a post ID was provided, verify post ownership
        post = await Post.findOne({
          where: { id: postIdOrPost, user_id: userId },
        });

        if (!post) {
          throw new Error("Post not found or access denied");
        }
      } else {
        // If post object was provided, use it directly
        post = postIdOrPost;

        // Verify ownership as a safeguard
        if (post.user_id !== userId) {
          throw new Error("Access denied to this post");
        }
      }

      // Get business profile for context
      const businessProfile = await BusinessProfile.findOne({
        where: { user_id: userId },
      });

      if (!businessProfile) {
        throw new Error("Business profile not found");
      }

      const businessName = businessProfile.business_name;
      const title = post.title;
      const content = post.content;

      // Generate captions for each platform
      const generatedCaptions: GeneratedCaption[] = [];

      for (const option of options) {
        try {
          const caption = await this.generateSingleCaption(
            title,
            content,
            option,
            businessName
          );
          generatedCaptions.push(caption);
        } catch (error) {
          logger.error(
            `Error generating caption for ${option.platform}:`,
            error
          );
          // Add fallback caption if AI generation fails
          const fallbackCaption = this.generateFallbackCaption(
            title,
            content,
            option
          );
          generatedCaptions.push(fallbackCaption);
        }
      }

      return generatedCaptions;
    } catch (error) {
      logger.error("Error generating captions:", error);
      throw new Error("Failed to generate social media captions");
    }
  }

  /**
   * Save generated captions to the database
   *
   * @param postId Post ID
   * @param userId User ID
   * @param captions Generated captions to save
   * @returns Promise<SocialMediaCaption[]> Saved caption objects
   */
  public async saveCaptions(
    postId: number,
    userId: number,
    captions: GeneratedCaption[]
  ): Promise<SocialMediaCaption[]> {
    const transaction = await sequelize.transaction();

    try {
      const savedCaptions: SocialMediaCaption[] = [];

      for (const caption of captions) {
        const savedCaption = await SocialMediaCaption.create(
          {
            user_id: userId,
            post_id: postId,
            platform: caption.platform,
            caption_text: caption.text,
            status: CaptionStatus.DRAFT,
          },
          { transaction }
        );

        savedCaptions.push(savedCaption);
      }

      await transaction.commit();
      return savedCaptions;
    } catch (error) {
      await transaction.rollback();
      logger.error("Error saving captions:", error);
      throw new Error("Failed to save social media captions");
    }
  }

  /**
   * Generate caption for a single platform
   *
   * @param title Post title
   * @param content Post content
   * @param options Generation options
   * @param businessName Business name for context
   * @returns Promise<GeneratedCaption> Generated caption
   */
  private async generateSingleCaption(
    title: string,
    content: string,
    options: CaptionGenerationOptions,
    businessName: string
  ): Promise<GeneratedCaption> {
    try {
      // Check if OpenAI is enabled
      if (!openaiConfig.enabled) {
        return this.generateFallbackCaption(title, content, options);
      }

      // Prepare platform-specific instructions
      const platformInstructions = this.getPlatformInstructions(
        options.platform
      );

      // Prepare tone instructions
      const toneInstructions = options.tone
        ? `Use a ${options.tone} tone.`
        : "Use a professional and engaging tone.";

      // Prepare hashtag instructions
      const hashtagInstructions = options.includeHashtags
        ? "Include 3-5 relevant hashtags."
        : "Do not include hashtags.";

      // Prepare length instructions
      const lengthInstructions = options.maxLength
        ? `Keep the caption under ${options.maxLength} characters.`
        : "Keep the caption concise and engaging.";

      // Create the prompt
      const prompt = `
        Generate a social media caption for ${
          options.platform
        } based on the following content.
        
        Business name: ${businessName}
        Post title: ${title}
        
        ${platformInstructions}
        ${toneInstructions}
        ${hashtagInstructions}
        ${lengthInstructions}
        
        Focus on creating an engaging caption that will drive user interaction.
        Don't include the title in the caption.
        Return ONLY the caption text, nothing else.
        
        Content:
        ${content.substring(0, 1500)}
      `;

      // Call OpenAI API
      const response = await openai.chat.completions.create({
        model: openaiConfig.model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7, // More creativity for social media captions
        max_tokens: 300,
      });

      // Extract and clean the caption
      const captionText = response.choices[0]?.message?.content?.trim() || "";

      return {
        platform: options.platform,
        text: captionText,
      };
    } catch (error) {
      logger.error(`Error generating caption for ${options.platform}:`, error);
      // Fallback to a simpler caption generation
      return this.generateFallbackCaption(title, content, options);
    }
  }

  /**
   * Generate a fallback caption when AI generation fails
   *
   * @param title Post title
   * @param content Post content
   * @param options Generation options
   * @returns GeneratedCaption Fallback caption
   */
  private generateFallbackCaption(
    title: string,
    content: string,
    options: CaptionGenerationOptions
  ): GeneratedCaption {
    // Extract first 2 sentences or 200 characters, whichever is shorter
    const contentPreview = content.split(/[.!?]/).slice(0, 2).join(".").trim();

    let captionText = `${contentPreview.substring(0, 200)}`;

    // Add ellipsis if text was truncated
    if (content.length > 200) {
      captionText += "...";
    }

    // Add platform-specific ending
    switch (options.platform) {
      case SocialMediaPlatform.TWITTER:
        captionText += " #content";
        break;
      case SocialMediaPlatform.INSTAGRAM:
        captionText += " #content #marketing";
        break;
      case SocialMediaPlatform.LINKEDIN:
        captionText += " What are your thoughts on this?";
        break;
      default:
        captionText += " Read more on our website.";
    }

    return {
      platform: options.platform,
      text: captionText,
    };
  }

  /**
   * Get platform-specific instructions for caption generation
   *
   * @param platform Social media platform
   * @returns string Instructions specific to the platform
   */
  private getPlatformInstructions(platform: SocialMediaPlatform): string {
    switch (platform) {
      case SocialMediaPlatform.TWITTER:
        return "Create a concise and engaging tweet. Focus on a single key point. Use appropriate hashtags.";

      case SocialMediaPlatform.INSTAGRAM:
        return "Create an Instagram caption that's visually descriptive and emotionally engaging. Use line breaks for readability.";

      case SocialMediaPlatform.FACEBOOK:
        return "Create a Facebook post that encourages discussion. Ask a question to promote engagement.";

      case SocialMediaPlatform.LINKEDIN:
        return "Create a professional LinkedIn post that demonstrates expertise. Focus on business value and insights.";

      case SocialMediaPlatform.PINTEREST:
        return "Create a Pinterest description that's descriptive and includes relevant keywords.";

      default:
        return "Create an engaging social media caption that summarizes the key point.";
    }
  }

  /**
   * Get captions for a specific post
   *
   * @param postId Post ID
   * @param userId User ID
   * @returns Promise<SocialMediaCaption[]> Array of captions for the post
   */
  public async getCaptionsByPost(
    postId: number,
    userId: number
  ): Promise<SocialMediaCaption[]> {
    try {
      return await SocialMediaCaption.findAll({
        where: { post_id: postId, user_id: userId },
        order: [["created_at", "DESC"]],
      });
    } catch (error) {
      logger.error("Error fetching captions:", error);
      throw new Error("Failed to fetch social media captions");
    }
  }

  /**
   * Get a caption by ID
   *
   * @param captionId Caption ID
   * @param userId User ID
   * @returns Promise<SocialMediaCaption | null> Caption object or null if not found
   */
  public async getCaptionById(
    captionId: number,
    userId: number
  ): Promise<SocialMediaCaption | null> {
    try {
      return await SocialMediaCaption.findOne({
        where: { id: captionId, user_id: userId },
      });
    } catch (error) {
      logger.error("Error fetching caption:", error);
      throw new Error("Failed to fetch social media caption");
    }
  }

  /**
   * Update a caption
   *
   * @param captionId Caption ID
   * @param userId User ID
   * @param data Update data
   * @returns Promise<SocialMediaCaption | null> Updated caption or null if not found
   */
  public async updateCaption(
    captionId: number,
    userId: number,
    data: Partial<SocialMediaCaptionAttributes>
  ): Promise<SocialMediaCaption | null> {
    try {
      const caption = await SocialMediaCaption.findOne({
        where: { id: captionId, user_id: userId },
      });

      if (!caption) {
        return null;
      }

      // Remove fields that shouldn't be updated directly
      delete data.id;
      delete data.user_id;
      delete data.created_at;
      delete data.updated_at;

      await caption.update(data);
      return caption;
    } catch (error) {
      logger.error("Error updating caption:", error);
      throw new Error("Failed to update social media caption");
    }
  }

  /**
   * Delete a caption
   *
   * @param captionId Caption ID
   * @param userId User ID
   * @returns Promise<boolean> True if deleted successfully
   */
  public async deleteCaption(
    captionId: number,
    userId: number
  ): Promise<boolean> {
    try {
      const result = await SocialMediaCaption.destroy({
        where: { id: captionId, user_id: userId },
      });

      return result > 0;
    } catch (error) {
      logger.error("Error deleting caption:", error);
      throw new Error("Failed to delete social media caption");
    }
  }

  /**
   * Get default maximum length for each platform
   *
   * @param platform Social media platform
   * @returns Maximum character length
   */
  private getDefaultMaxLength(platform: SocialMediaPlatform): number {
    switch (platform) {
      case SocialMediaPlatform.TWITTER:
        return 280;
      case SocialMediaPlatform.INSTAGRAM:
        return 2200;
      case SocialMediaPlatform.LINKEDIN:
        return 3000;
      case SocialMediaPlatform.FACEBOOK:
        return 5000;
      case SocialMediaPlatform.PINTEREST:
        return 500;
      default:
        return 1000;
    }
  }

  /**
   * Summarize content to a specified length
   *
   * @param content Content to summarize
   * @param maxLength Maximum length of summary
   * @returns Summarized content
   */
  private summarizeContent(content: string, maxLength: number = 200): string {
    if (!content) return "";

    if (content.length <= maxLength) {
      return content;
    }

    // Try to find a sentence break
    const sentences = content.split(/[.!?](\s|$)/);
    let summary = "";

    for (let i = 0; i < sentences.length; i++) {
      if ((summary + sentences[i]).length <= maxLength) {
        summary += sentences[i];
      } else {
        break;
      }
    }

    // If no good sentence break, just truncate
    if (!summary) {
      summary = content.substring(0, maxLength - 3) + "...";
    }

    return summary;
  }
}

// Create a singleton instance
const socialMediaService = new SocialMediaService();
export default socialMediaService;
