import logger from "../config/logger";
import { Keyword, User, Subscription, BusinessProfile } from "../models";
import { KeywordAttributes } from "../models/keyword.model";
import { Op } from "sequelize";
import { BillingCycle, SubscriptionStatus } from "../models/subscription.model";
import { STOP_WORDS } from "../utils/constants";
import _ from "lodash";
import sequelize from "../config/database";
import openai, { openaiConfig } from "../config/openai";

/**
 * Interface for keyword generation options
 */
interface KeywordGenerationOptions {
  content: string;
  focusWords?: string[];
  maxKeywords?: number;
  userId: number;
  useAI?: boolean;
}

/**
 * Interface for generated keywords
 */
interface GeneratedKeyword {
  word: string;
  relevance: number;
}

/**
 * Service for generating and managing keywords
 */
export class KeywordService {
  /**
   * Generate keywords from content using NLP and/or AI
   * @param options Keyword generation options
   * @returns Array of generated keywords
   */
  static async generateKeywords(
    options: KeywordGenerationOptions
  ): Promise<GeneratedKeyword[]> {
    try {
      const {
        content,
        focusWords = [],
        maxKeywords = 30,
        userId,
        useAI = true,
      } = options;

      // Check user plan and limits
      const limits = await this.getPlanLimits(userId);
      const actualMaxKeywords = Math.min(
        maxKeywords,
        limits.maxKeywordsPerGeneration
      );

      if (!content || content.trim().length < 10) {
        throw new Error("Content must be at least 10 characters long");
      }

      // Normalize text
      const normalizedText = this.normalizeText(content);

      let extractedKeywords: GeneratedKeyword[] = [];

      // Try AI-based keyword generation if enabled and requested
      if (useAI && openaiConfig.enabled && limits.canUseAI) {
        try {
          const aiKeywords = await this.generateKeywordsWithAI(
            content,
            focusWords,
            actualMaxKeywords,
            userId
          );

          if (aiKeywords && aiKeywords.length > 0) {
            extractedKeywords = aiKeywords;
            logger.info(`Generated ${aiKeywords.length} keywords using AI`);
          }
        } catch (aiError) {
          logger.error("Error generating keywords with AI:", aiError);
          // Fallback to traditional extraction if AI fails
        }
      }

      // Fallback to traditional keyword extraction if AI is disabled or failed
      if (extractedKeywords.length === 0) {
        extractedKeywords = this.extractKeywords(
          normalizedText,
          focusWords,
          actualMaxKeywords
        );
        logger.info(
          `Generated ${extractedKeywords.length} keywords using traditional NLP`
        );
      }

      return extractedKeywords;
    } catch (error: any) {
      logger.error("Error generating keywords:", error);
      throw new Error(`Failed to generate keywords: ${error.message}`);
    }
  }

  /**
   * Generate keywords using OpenAI
   * @param content Text content to analyze
   * @param focusWords Optional focus words to emphasize
   * @param maxKeywords Maximum number of keywords to generate
   * @returns Array of generated keywords with relevance scores
   */
  private static async generateKeywordsWithAI(
    content: string,
    focusWords: string[] = [],
    maxKeywords: number,
    userId: number
  ): Promise<GeneratedKeyword[]> {
    try {
      // Get business information for better context
      const user = await User.findByPk(userId, {
        include: [{ model: BusinessProfile, as: "businessProfile" }],
      });

      const businessName =
        user?.businessProfile?.business_name || "the business";
      const idealClient = user?.businessProfile?.ideal_client;
      const clientPromises = user?.businessProfile?.client_promises;
      const clientExpectations = user?.businessProfile?.client_expectations;

      // Prepare focus words text if available
      let focusWordsText = "";
      if (focusWords && focusWords.length > 0) {
        focusWordsText = `\nAdditionally, focus on these specific themes or topics: ${focusWords.join(
          ", "
        )}`;
      }

      const prompt = `
      You are a $5 million/year mentor analyzing ${businessName}:
** Here are the details clearly provided by the business owner:
- Ideal Client Description: ${idealClient}
- Top Three Promises to Clients: ${clientPromises}
- Top Three Things Clients Expect from the Business: ${clientExpectations}

** Now, clearly complete these tasks:
Ideal Client Map (Clearly structured):
- Demographics: Clearly define age range, gender, occupation, typical location, and income bracket.
- Psychographics: Clearly outline key pain points, fears, desires, and aspirations of the ideal client.
- Buying Triggers: Clearly identify specific factors that influence buying decisions.
- Preferred Communication Channels: Clearly list where these ideal clients spend most of their time (online/offline).
- Common Objections: Clearly state typical hesitations and doubts they have before buying.

** Business Insight Analysis (Clearly structured):
1. What keeps ${businessName}’s clients up at night?
2. What pain points is ${businessName} overlooking or underestimating?
3. How is ${businessName}’s clients leaving money on the table?
4. What does a true turning point look like for ${businessName}’s clients?
5. What unspoken fears, doubts, or hesitations do ${businessName}’s clients have that they might never openly admit?
6. What specific desires or aspirations fuel their buying decisions?
7. What untapped angles or hidden hooks could capture more attention?
8. What unique advantage does ${businessName} have that they are not fully leveraging?
9. How can ${businessName} position itself as the only logical choice in the market?
10. Where might ${businessName} be confusing or repelling potential clients in its messaging?
11. What common objections need to be preemptively addressed in their content?
12. How can ${businessName} structure a value ladder that increases lifetime customer value?
13. Clearly identify five ways ${businessName} can increase perceived value.
14. Clearly identify five ways ${businessName} can remove friction and make it easier for clients to buy.
15. Clearly identify five ways ${businessName} can add urgency to boost sales.
16. What is the easiest low-effort, high-impact way for ${businessName} to generate more revenue?
17. If ${businessName} had to double revenue in 6 months without adding more offers, clearly outline the simplest path.

**SEO Keyword Generation:**
Based on these insights, clearly generate a list of at least 30 core SEO-optimized keywords and messaging themes aligned with Google’s latest SEO standards. These keywords will shape future blog posts, prompts, and frameworks for ${businessName}. Keywords should be spread around point 1 to 7 and 12  to 17 
 `;

      // Call OpenAI API
      const response = await openai.chat.completions.create({
        model: openaiConfig.model,
        messages: [{ role: "user", content: prompt }],
        temperature: openaiConfig.temperature,
        max_tokens: openaiConfig.maxTokens,
        response_format: { type: "json_object" },
      });

      // Extract and parse the response
      const responseContent = response.choices[0]?.message?.content || "{}";

      try {
        const parsedResponse = JSON.parse(responseContent);
        // Handle both formats: direct array or nested under "keywords" property
        let keywords = Array.isArray(parsedResponse)
          ? parsedResponse
          : parsedResponse.keywords || [];

        if (!Array.isArray(keywords)) {
          logger.warn(
            "AI did not return an array of keywords:",
            parsedResponse
          );
          return [];
        }

        // Validate the keywords format and normalize
        return keywords
          .filter(
            (k: any) =>
              k && typeof k.word === "string" && typeof k.relevance === "number"
          )
          .map((k: any) => ({
            word: k.word.toLowerCase().trim(),
            relevance: Math.max(0, Math.min(1, k.relevance)), // Ensure relevance is between 0 and 1
          }))
          .slice(0, maxKeywords);
      } catch (parseError) {
        logger.error("Failed to parse AI response:", parseError);
        logger.debug("AI Response:", responseContent);
        return [];
      }
    } catch (error) {
      logger.error("Error calling OpenAI API:", error);
      throw new Error("Failed to generate keywords with AI");
    }
  }

  /**
   * Save generated keywords to the database
   * @param keywords Array of keywords to save
   * @param userId User ID
   * @returns Saved keywords
   */
  static async saveKeywords(
    keywords: GeneratedKeyword[],
    userId: number
  ): Promise<Keyword[]> {
    try {
      const savedKeywords: Keyword[] = [];

      for (const keyword of keywords) {
        // Check if keyword already exists for this user
        const existingKeyword = await Keyword.findOne({
          where: {
            user_id: userId,
            word: keyword.word,
          },
        });

        if (existingKeyword) {
          // Update relevance and increment usage count
          existingKeyword.relevance =
            (existingKeyword.relevance || 0) + keyword.relevance / 2;
          await existingKeyword.incrementUsage();
          savedKeywords.push(existingKeyword);
        } else {
          // Create new keyword
          const newKeyword = await Keyword.create({
            user_id: userId,
            word: keyword.word,
            relevance: keyword.relevance,
            usage_count: 1,
          });
          savedKeywords.push(newKeyword);
        }
      }

      return savedKeywords;
    } catch (error: any) {
      logger.error("Error saving keywords:", error);
      throw new Error(`Failed to save keywords: ${error.message}`);
    }
  }

  /**
   * Get all keywords for a user with filtering and pagination
   * @param userId User ID
   * @param page Page number
   * @param limit Items per page
   * @param search Search term
   * @param sortBy Sort field
   * @param sortOrder Sort order
   * @returns Paginated keywords
   */
  static async getKeywords(
    userId: number,
    page: number = 1,
    limit: number = 20,
    search?: string,
    sortBy: string = "relevance",
    sortOrder: "asc" | "desc" = "desc"
  ) {
    try {
      // Build where clause
      const whereClause: any = { user_id: userId };

      // Add search filter if provided
      if (search) {
        whereClause.word = { [Op.like]: `%${search}%` };
      }

      // Determine sort field and order
      const order: any = [];

      switch (sortBy) {
        case "word":
          order.push(["word", sortOrder]);
          break;
        case "usage_count":
          order.push(["usage_count", sortOrder]);
          break;
        case "created_at":
          order.push(["created_at", sortOrder]);
          break;
        case "relevance":
        default:
          order.push(["relevance", sortOrder]);
          break;
      }

      // Calculate offset
      const offset = (page - 1) * limit;

      // Get total count
      const total = await Keyword.count({ where: whereClause });

      // Calculate total pages
      const totalPages = Math.ceil(total / limit);

      // Fetch keywords with pagination
      const keywords = await Keyword.findAll({
        where: whereClause,
        order,
        limit,
        offset,
      });

      return {
        keywords,
        total,
        totalPages,
      };
    } catch (error: any) {
      logger.error("Error fetching keywords:", error);
      throw new Error(`Failed to fetch keywords: ${error.message}`);
    }
  }

  /**
   * Normalize text for keyword extraction
   * @param text Text to normalize
   * @returns Normalized text
   */
  private static normalizeText(text: string): string {
    // Convert to lowercase
    let normalized = text.toLowerCase();

    // Remove special characters and numbers
    normalized = normalized.replace(/[^\w\s]|[\d]/g, " ");

    // Replace multiple spaces with a single space
    normalized = normalized.replace(/\s+/g, " ").trim();

    return normalized;
  }

  /**
   * Extract keywords from normalized text
   * @param normalizedText Normalized text
   * @param focusWords Array of focus words
   * @param maxKeywords Maximum number of keywords to extract
   * @returns Array of extracted keywords
   */
  private static extractKeywords(
    normalizedText: string,
    focusWords: string[] = [],
    maxKeywords: number
  ): GeneratedKeyword[] {
    // Split text into words
    const words = normalizedText.split(" ");

    // Count word frequency
    const wordCount: Record<string, number> = {};

    for (const word of words) {
      // Skip empty strings and short words (less than 3 characters)
      if (word.length < 3) continue;

      // Skip common stop words
      if (STOP_WORDS.includes(word)) continue;

      // Increment word count
      wordCount[word] = (wordCount[word] || 0) + 1;
    }

    // Convert to array of objects
    const wordObjects = Object.entries(wordCount).map(([word, count]) => {
      // Calculate base relevance based on frequency
      let relevance = count / words.length;

      // Increase relevance for focus words
      if (focusWords.some((fw) => word.includes(fw) || fw.includes(word))) {
        relevance *= 1.5;
      }

      return { word, relevance };
    });

    // Sort by relevance and take the top N keywords
    const sortedKeywords = _.sortBy(wordObjects, "relevance").reverse();

    // Return top keywords up to maxKeywords
    return sortedKeywords.slice(0, maxKeywords);
  }

  /**
   * Get plan limits for a user
   * @param userId User ID
   * @returns Plan limits
   */
  private static async getPlanLimits(userId: number) {
    try {
      // Find user with subscription
      const user = await User.findByPk(userId, {
        include: [
          {
            model: Subscription,
            as: "subscription",
          },
        ],
      });

      if (!user) {
        throw new Error("User not found");
      }

      // Default limits for free tier
      let maxKeywordsPerGeneration = 5;
      let maxKeywordsPerMonth = 100;
      let canUseAI = false;

      // Check user subscription for plan-specific limits
      if (user.subscription && user.subscription.isActive) {
        const plan = user.plan || user.subscription.plan;

        switch (plan) {
          case "basic":
            maxKeywordsPerGeneration = 15;
            maxKeywordsPerMonth = 300;
            canUseAI = false;
            break;
          case "standard":
            maxKeywordsPerGeneration = 25;
            maxKeywordsPerMonth = 500;
            canUseAI = true;
            break;
          case "premium":
            maxKeywordsPerGeneration = 50;
            maxKeywordsPerMonth = 1000;
            canUseAI = true;
            break;
        }
      }

      return {
        maxKeywordsPerGeneration,
        maxKeywordsPerMonth,
        canUseAI,
      };
    } catch (error: any) {
      logger.error("Error getting plan limits:", error);
      // Return default free tier limits if there's an error
      return {
        maxKeywordsPerGeneration: 5,
        maxKeywordsPerMonth: 100,
        canUseAI: false,
      };
    }
  }

  /**
   * Get keyword suggestions based on content and user history
   * @param content The content to analyze
   * @param userId User ID
   * @param limit Maximum number of suggestions
   * @returns Array of keyword suggestions with relevance scores
   */
  static async getSuggestions(
    content: string,
    userId: number,
    limit: number = 10
  ): Promise<Keyword[]> {
    try {
      // 1. Extract potential keywords from content
      const normalizedText = this.normalizeText(content);

      // Get top words from content (more than we need, we'll filter later)
      const extractedWords = this.extractKeywords(
        normalizedText,
        [],
        limit * 2
      ).map((keyword) => keyword.word);

      if (extractedWords.length === 0) {
        return [];
      }

      // 2. Find existing keywords that match content themes
      const contentBasedKeywords = await Keyword.findAll({
        where: {
          word: {
            [Op.in]: extractedWords,
          },
          user_id: userId,
        },
        order: [["usage_count", "DESC"]],
        limit: Math.floor(limit / 2),
      });

      // 3. Find frequently used keywords by this user that aren't already included
      const contentKeywordIds = contentBasedKeywords.map((k) => k.id);
      const frequentlyUsedKeywords = await Keyword.findAll({
        where: {
          user_id: userId,
          id: {
            [Op.notIn]: contentKeywordIds,
          },
        },
        order: [["usage_count", "DESC"]],
        limit: limit - contentBasedKeywords.length,
      });

      // Combine results, prioritizing content-matched keywords
      return [...contentBasedKeywords, ...frequentlyUsedKeywords];
    } catch (error: any) {
      logger.error("Error getting keyword suggestions:", error);
      throw new Error(`Failed to get keyword suggestions: ${error.message}`);
    }
  }

  /**
   * Get frequently used keywords across the platform
   * @param limit Maximum number of keywords to return
   * @param excludeUserId User ID to exclude from results (to avoid showing user's own keywords)
   * @returns Array of trending keywords
   */
  static async getTrendingKeywords(
    limit: number = 20,
    excludeUserId?: number
  ): Promise<{ word: string; usage_count: number }[]> {
    try {
      // Build where clause
      const whereClause: any = {};
      if (excludeUserId) {
        whereClause.user_id = {
          [Op.ne]: excludeUserId,
        };
      }

      // Use sequelize to group keywords and count usage
      const trendingKeywords = await Keyword.findAll({
        where: whereClause,
        attributes: [
          "word",
          [sequelize.fn("SUM", sequelize.col("usage_count")), "total_usage"],
        ],
        group: ["word"],
        order: [[sequelize.literal("total_usage"), "DESC"]],
        limit: limit,
        raw: true,
      });

      // Format results
      return trendingKeywords.map((result: any) => ({
        word: result.word,
        usage_count: parseInt(result.total_usage),
      }));
    } catch (error: any) {
      logger.error("Error getting trending keywords:", error);
      throw new Error(`Failed to get trending keywords: ${error.message}`);
    }
  }

  /**
   * Get frequently used keywords for a specific user
   * @param userId User ID to get keywords for
   * @param limit Maximum number of keywords to return
   * @returns Array of user's frequently used keywords
   */
  static async getFrequentlyUsedKeywords(
    userId: number,
    limit: number = 10
  ): Promise<Keyword[]> {
    try {
      return await Keyword.findAll({
        where: {
          user_id: userId,
        },
        order: [["usage_count", "DESC"]],
        limit: limit,
      });
    } catch (error: any) {
      logger.error("Error getting frequently used keywords:", error);
      throw new Error(
        `Failed to get frequently used keywords: ${error.message}`
      );
    }
  }
}
