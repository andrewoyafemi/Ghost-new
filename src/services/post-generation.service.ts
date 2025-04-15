import openai, { openaiConfig } from "../config/openai";
import logger from "../config/logger";
import {
  BusinessProfile,
  User,
  UserPreference,
  Post,
  PostKeyword,
  Keyword,
  Subscription,
} from "../models";
import { PostStatus } from "../models/post.model";
import WordPressService from "./wordpress.service";
import { SocialMediaService } from "./social-media.service";
import { PlanType } from "../utils/plan-config";
import { formatISO } from "date-fns";
import { promptTemplates } from "../utils/prompt-templates";
import sequelize from "../config/database";
import { SubscriptionStatus } from "../models/subscription.model";
import { SocialMediaPlatform } from "../models/social-media-caption.model";
import { premiumPromptTemplates } from "../utils/premium-prompt-template";
import { standardPromptTemplates } from "../utils/standard-prompt-template";
import { basicPromptTemplates } from "../utils/basic-prompt-templates";

export class PostGenerationService {
  /**
   * Generate a post for a user based on their profile and preferences
   * @param userId User ID
   * @param options Generation options
   */
  public async generatePost(
    userId: number,
    options: {
      overrideKeywords?: string[];
      saveAsDraft?: boolean;
      schedule?: Date;
      generateSocialCaptions?: boolean;
    } = {}
  ): Promise<Post> {
    try {
      // Get user with subscription and profile
      const user = await User.findByPk(userId, {
        include: [
          {
            model: Subscription,
            as: "subscription",
            where: { status: SubscriptionStatus.ACTIVE },
            required: false,
          },
          { model: BusinessProfile, as: "businessProfile" },
          { model: UserPreference, as: "preferences" },
        ],
      });

      if (!user) {
        throw new Error("User not found");
      }

      if (!user.businessProfile) {
        throw new Error("Business profile not found");
      }

      if (!user.preferences) {
        throw new Error("User preferences not found");
      }

      // Check if OpenAI is enabled
      if (!openaiConfig.enabled) {
        throw new Error("AI generation is currently disabled");
      }

      // Get user's plan
      const userPlan = user.subscription?.plan || PlanType.LONE_RANGER;

      // Get user's keywords (either override or default)
      const keywords =
        options.overrideKeywords ||
        (typeof user.preferences.default_keywords === "string"
          ? JSON.parse(user.preferences.default_keywords)
          : user.preferences.default_keywords) ||
        [];

      // Get previous posts for context
      // const previousPosts = await Post.findAll({
      //   where: {
      //     user_id: userId,
      //     status: PostStatus.PUBLISHED,
      //   },
      //   order: [["published_at", "DESC"]],
      //   limit: 3,
      // });
      const previousPosts = await Post.findAndCountAll({
        where: {
          user_id: userId,
          status: PostStatus.PUBLISHED,
        },
        order: [["published_at", "DESC"]],
        limit: 3,
      });

      const { count, rows } = previousPosts;

      // Generate content
      const content = await this.generatePostContent(
        user.businessProfile,
        userPlan,
        keywords,
        rows,
        count
      );

      // Generate title
      const title = await this.generatePostTitle(content, userPlan);

      // Calculate word count
      const wordCount = content.split(/\s+/).filter(Boolean).length;

      // Determine post status
      let status = options.saveAsDraft
        ? PostStatus.DRAFT
        : PostStatus.PUBLISHED;
      let scheduledFor = null;

      if (options.schedule) {
        status = PostStatus.SCHEDULED;
        // Preserve the exact scheduled time without timezone conversion
        scheduledFor = new Date(options.schedule);
      }

      // Start a transaction
      const transaction = await sequelize.transaction();

      try {
        // Create the post
        const post = await Post.create(
          {
            user_id: userId,
            title,
            content,
            status,
            word_count: wordCount,
            scheduled_for: scheduledFor,
            published_at: status === PostStatus.PUBLISHED ? new Date() : null,
            last_autosaved_at: new Date(),
          },
          { transaction }
        );

        // Add keywords to the post
        await this.attachKeywordsToPost(post.id, userId, keywords, transaction);

        // Generate social media captions if requested
        if (options.generateSocialCaptions) {
          try {
            const socialMediaService = new SocialMediaService();

            // Pass the post object directly rather than the ID
            const captions = await socialMediaService.generateCaptions(
              post,
              userId,
              [
                { platform: SocialMediaPlatform.FACEBOOK },
                { platform: SocialMediaPlatform.TWITTER },
                { platform: SocialMediaPlatform.LINKEDIN },
              ]
            );

            // Save the generated captions
            await socialMediaService.saveCaptions(post.id, userId, captions);

            logger.info(`Generated social media captions for post ${post.id}`);
          } catch (error) {
            // Log the error but continue with post creation
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            logger.error(
              `Caption generation failed, but continuing with post creation: ${errorMessage}`
            );
            // Don't rethrow - allow transaction to commit anyway
          }
        }

        // Publish to WordPress if status is PUBLISHED
        if (status === PostStatus.PUBLISHED) {
          await this.publishToWordPress(post, user.businessProfile, keywords);
        } else if (status === PostStatus.SCHEDULED) {
          // Schedule in WordPress if integrated
          await this.scheduleInWordPress(post, user.businessProfile, keywords);
        }

        await transaction.commit();

        return post;
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      logger.error("Error generating post:", error);
      throw error;
    }
  }

  /**
   * Generate post content using OpenAI
   */
  private async generatePostContent(
    businessProfile: BusinessProfile,
    plan: string,
    keywords: string[],
    previousPosts: Post[],
    count: number
  ): Promise<string> {
    try {
      // Select prompt template based on plan
      const template = this.getPromptTemplateByPlan(plan, count);

      // Get context from previous posts if available
      const previousPostContext = this.getPreviousPostContext(previousPosts);

      // Format client promises and expectations
      const clientPromises =
        typeof businessProfile.client_promises === "string"
          ? JSON.parse(businessProfile.client_promises)
          : businessProfile.client_promises;

      const clientExpectations =
        typeof businessProfile.client_expectations === "string"
          ? JSON.parse(businessProfile.client_expectations)
          : businessProfile.client_expectations;

      // Build the prompt
      const prompt = template
        .replace("{business_name}", businessProfile.business_name)
        .replace("{ideal_client}", businessProfile.ideal_client)
        .replace("{client_promises}", clientPromises.join(", "))
        .replace("{client_expectations}", clientExpectations.join(", "))
        .replace("{keywords}", keywords.join(", "))
        .replace("{previous_post_context}", previousPostContext);

      // Call OpenAI API
      const response = await openai.chat.completions.create({
        model: openaiConfig.model,
        messages: [
          {
            role: "system",
            content:
              "You are an expert content writer that creates engaging, informative blog posts optimized for SEO.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 2500,
      });

      const content = response.choices[0]?.message?.content || "";

      // Humanize the content // No need for this anymore
      // return await this.humanizeContent(content);
      return content;
    } catch (error) {
      logger.error("Error generating post content:", error);
      throw new Error(
        "Failed to generate post content. Please try again later."
      );
    }
  }

  /**
   * Humanize content to make it sound more natural
   */
  private async humanizeContent(content: string): Promise<string> {
    try {
      const response = await openai.chat.completions.create({
        model: openaiConfig.model,
        messages: [
          {
            role: "system",
            content:
              "You are a skilled editor who makes content sound more natural and human-written.",
          },
          {
            role: "user",
            content: `Rewrite the following content to make it more engaging, natural, and human-like. 
            Add relevant section headings with proper HTML formatting, and ensure good paragraph breaks.
            Create a natural flow between paragraphs. Format it as HTML with proper paragraph tags.
            
            Content to humanize:
            
            ${content}`,
          },
        ],
        temperature: 0.8,
        max_tokens: 2800,
      });

      return response.choices[0]?.message?.content || content;
    } catch (error) {
      logger.error("Error humanizing content:", error);
      return content; // Return original content if humanization fails
    }
  }

  /**
   * Generate a post title based on content
   */
  private async generatePostTitle(
    content: string,
    plan: string
  ): Promise<string> {
    try {
      const contentSummary = content.substring(0, 1500); // Use first 1500 chars to summarize

      const response = await openai.chat.completions.create({
        model: openaiConfig.model,
        messages: [
          {
            role: "system",
            content:
              "You are an expert copywriter who creates engaging, click-worthy titles.",
          },
          {
            role: "user",
            content: `Create an engaging, SEO-friendly title for this blog post. The title should be attention-grabbing and accurately reflect the content.
            
            Content:
            ${contentSummary}
            
            Return only the title text, without quotes or any other formatting.`,
          },
        ],
        temperature: 0.8,
        max_tokens: 50,
      });

      return response.choices[0]?.message?.content?.trim() || "New Blog Post";
    } catch (error) {
      logger.error("Error generating post title:", error);
      return "New Blog Post"; // Default title if generation fails
    }
  }

  /**
   * Get appropriate prompt template based on user's plan
   */
  private getPromptTemplateByPlan(plan: string, count: number): string {
    const paddedNumber = String(count + 1).padStart(3, "0");
    if (plan === PlanType.AUTHORITY_BUILDER) {
      return (
        premiumPromptTemplates[
          `prompt_${paddedNumber}` as keyof typeof premiumPromptTemplates
        ] || promptTemplates.basic
      );
    } else if (plan === PlanType.SMART_MARKETER) {
      return (
        standardPromptTemplates[
          `prompt_${paddedNumber}` as keyof typeof standardPromptTemplates
        ] || promptTemplates.basic
      );
    } else {
      return (
        basicPromptTemplates[
          `prompt_${paddedNumber}` as keyof typeof basicPromptTemplates
        ] || promptTemplates.basic
      );
    }
  }

  /**
   * Get context from previous posts
   */
  private getPreviousPostContext(previousPosts: Post[]): string {
    if (previousPosts.length === 0) {
      return "This will be the first post.";
    }

    let context = "Previous posts covered these topics:\n\n";

    previousPosts.forEach((post, index) => {
      context += `Post ${index + 1}: "${post.title}"\n`;

      // Add a brief snippet of content
      const contentPreview = post.content
        .replace(/<[^>]*>/g, "") // Remove HTML tags
        .substring(0, 150); // Take first 150 chars

      context += `${contentPreview}...\n\n`;
    });

    return context;
  }

  /**
   * Attach keywords to a post
   */
  private async attachKeywordsToPost(
    postId: number,
    userId: number,
    keywordStrings: string[],
    transaction: any
  ): Promise<void> {
    try {
      // Remove duplicate keywords first (in case the input contains duplicates)
      const uniqueKeywords = [...new Set(keywordStrings)];

      for (const word of uniqueKeywords) {
        try {
          // Find or create the keyword
          const [keyword] = await Keyword.findOrCreate({
            where: { user_id: userId, word },
            defaults: { user_id: userId, word, relevance: 0.5, usage_count: 0 },
            transaction,
          });

          // Increment usage count
          keyword.usage_count += 1;
          await keyword.save({ transaction });

          // Check if this keyword is already attached to the post
          const existingRelation = await PostKeyword.findOne({
            where: {
              post_id: postId,
              keyword_id: keyword.id,
            },
            transaction,
          });

          // Only create if it doesn't exist yet
          if (!existingRelation) {
            await PostKeyword.create(
              {
                post_id: postId,
                keyword_id: keyword.id,
                relevance: 0.7, // Default relevance
              },
              { transaction }
            );
          } else {
            logger.info(
              `Keyword "${word}" already attached to post ${postId}, skipping`
            );
          }
        } catch (error: any) {
          // Check if this is a unique constraint error
          if (error.name === "SequelizeUniqueConstraintError") {
            logger.warn(
              `Duplicate keyword attachment prevented for "${word}" to post ${postId}`
            );
            // Continue processing other keywords
            continue;
          }

          // Log other errors but continue processing other keywords
          logger.error(
            `Error attaching keyword "${word}" to post ${postId}:`,
            error
          );
          continue;
        }
      }
    } catch (error) {
      logger.error(`Failed to attach keywords to post ${postId}:`, error);
      throw error;
    }
  }

  /**
   * Publish post to WordPress if integration exists
   */
  private async publishToWordPress(
    post: Post,
    businessProfile: BusinessProfile,
    keywords: string[]
  ): Promise<void> {
    try {
      // Check if WordPress integration is configured
      if (!businessProfile.hasWordPressIntegration()) {
        return;
      }

      // Create WordPress service
      const wpService = new WordPressService(businessProfile);

      // Publish to WordPress
      const wpResult = await wpService.publishPost(
        post.title,
        post.content,
        "publish",
        keywords
      );

      // Update post with WordPress IDs
      if (wpResult && wpResult.id) {
        await post.update({
          wordpress_id: wpResult.id,
          wordpress_url: wpResult.link || null,
        });
      }
    } catch (error) {
      logger.error(`Failed to publish post to WordPress: ${error}`);
      // Continue without failing - we've already saved the post in our system
    }
  }

  /**
   * Schedule post in WordPress if integration exists
   */
  private async scheduleInWordPress(
    post: Post,
    businessProfile: BusinessProfile,
    keywords: string[]
  ): Promise<void> {
    try {
      // Check if WordPress integration is configured and post has scheduled_for
      if (!businessProfile.hasWordPressIntegration() || !post.scheduled_for) {
        return;
      }

      // Create WordPress service
      const wpService = new WordPressService(businessProfile);

      // Format scheduled date for WordPress
      // WordPress requires ISO 8601 format
      const scheduledDate = formatISO(post.scheduled_for);

      // Create draft post in WordPress with future date
      const wpResult = await wpService.publishPost(
        post.title,
        post.content,
        "draft", // Create as draft initially
        keywords
      );

      if (wpResult && wpResult.id) {
        // Update the post with future date in WordPress
        await wpService.updatePost(
          wpResult.id,
          undefined, // Keep title
          undefined, // Keep content
          "future", // Set to future status now that we've added it
          keywords, // Use the same keywords
          scheduledDate // Pass the scheduled date
        );

        // Update our post record with WordPress IDs
        await post.update({
          wordpress_id: wpResult.id,
          wordpress_url: wpResult.link || null,
        });
      }
    } catch (error) {
      logger.error(`Failed to schedule post in WordPress: ${error}`);
      // Continue without failing - we've already saved the post in our system
    }
  }
}

export default new PostGenerationService();
