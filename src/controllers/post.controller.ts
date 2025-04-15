import { Request, Response, NextFunction } from "express";
import { Post, Keyword, PostKeyword, User } from "../models";
import { PostStatus } from "../models/post.model";
import { ApiError } from "../middlewares/error.middleware";
import featureFlagService from "../services/feature-flag.service";
import logger from "../config/logger";
import { Transaction } from "sequelize";
import sequelize from "../config/database";
import { EmailService } from "../services/email.service";
import { SuccessResponse, ErrorResponse } from "../utils/responses";
import PostGenerationService from "../services/post-generation.service";
import WordPressService from "../services/wordpress.service";
import { postEventEmitter, PostEventType } from "../events/post-events";

const emailService = new EmailService();

/**
 * PostController handles all post-related operations
 */
export class PostController {
  /**
   * Create a new post
   *
   * @param req Request object
   * @param res Response object
   * @param next NextFunction
   */
  public createPost = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    let transaction: Transaction | null = null;

    try {
      if (!req.user) {
        return next(new ApiError(401, "Authentication required"));
      }

      const userId = req.user.id;
      const {
        title,
        content,
        keywords,
        status = PostStatus.DRAFT,
        scheduledFor = null,
      } = req.body;

      if (!title || !content) {
        return next(new ApiError(400, "Title and content are required"));
      }

      // Check if user has available posts only if creating a new post (not for drafts)
      if (status !== PostStatus.DRAFT) {
        // Check if user has available posts
        const { hasAvailablePosts } =
          await featureFlagService.hasAvailablePosts(userId);
        if (!hasAvailablePosts) {
          return next(
            new ApiError(
              403,
              "You've reached your post limit. Upgrade your plan to create more posts."
            )
          );
        }
      }

      // Check word count limit
      const wordCount = content.split(/\s+/).filter(Boolean).length;
      const wordCountLimit = await featureFlagService.getPlanLimit(
        userId,
        "content.wordCount"
      );
      if (wordCount > wordCountLimit) {
        return next(
          new ApiError(
            403,
            "Word count exceeds your plan limit. Upgrade your plan to create longer posts."
          )
        );
      }

      // Start a transaction
      transaction = await sequelize.transaction();

      try {
        // Create the post
        const post = await Post.create(
          {
            user_id: userId,
            title,
            content,
            status,
            scheduled_for: scheduledFor ? new Date(scheduledFor) : null,
            published_at: status === PostStatus.PUBLISHED ? new Date() : null,
            word_count: content.split(/\s+/).filter(Boolean).length,
          },
          { transaction }
        );

        // Process keywords
        if (keywords && keywords.length > 0) {
          for (const keywordData of keywords) {
            // Find or create the keyword
            const [keyword] = await Keyword.findOrCreate({
              where: {
                word: keywordData.word,
                user_id: userId,
              },
              defaults: {
                word: keywordData.word,
                user_id: userId,
                relevance: keywordData.relevance || 0.5,
              },
              transaction,
            });

            // Associate keyword with the post
            await PostKeyword.create(
              {
                post_id: post.id,
                keyword_id: keyword.id,
                relevance: keywordData.relevance || 0.7,
              },
              { transaction }
            );
          }
        }

        // Commit the transaction
        await transaction.commit();
        transaction = null;

        // If post is being published or scheduled, increment the post usage count
        if (
          status === PostStatus.PUBLISHED ||
          status === PostStatus.SCHEDULED
        ) {
          await featureFlagService.incrementPostUsage(userId);
        }

        // Send notification if post is scheduled
        if (post.status === PostStatus.SCHEDULED && post.scheduled_for) {
          try {
            const user = await User.findByPk(post.user_id);
            if (user) {
              await emailService.sendPostScheduledConfirmation(
                user,
                post.title,
                post.scheduled_for
              );
            }
          } catch (emailError: unknown) {
            // Log the error but don't let it stop the process
            if (emailError instanceof Error) {
              logger.error(
                `Failed to send scheduling notification: ${emailError.message}`
              );
            } else {
              logger.error(
                `Failed to send scheduling notification: ${String(emailError)}`
              );
            }
            // Continue with post creation - don't throw this error
          }
        }

        // Emit post created event
        postEventEmitter.emit(PostEventType.CREATED, { post });

        // If post is scheduled, also emit scheduled event
        if (post.status === PostStatus.SCHEDULED) {
          postEventEmitter.emit(PostEventType.SCHEDULED, { post });
        }

        // Send successful response
        res
          .status(201)
          .json(
            SuccessResponse(
              { post },
              post.status === PostStatus.SCHEDULED
                ? "Post scheduled successfully"
                : "Post created successfully"
            )
          );
      } catch (error) {
        // Rollback the transaction if something went wrong
        if (transaction) await transaction.rollback();
        logger.error("Error creating post:", error);
        return next(new ApiError(500, "Failed to create post"));
      }
    } catch (error) {
      // Rollback the transaction if something went wrong
      if (transaction) await transaction.rollback();
      logger.error("Error creating post:", error);
      next(new ApiError(500, "Failed to create post"));
    }
  };

  /**
   * Update an existing post
   *
   * @param req Request object
   * @param res Response object
   * @param next NextFunction
   */
  public updatePost = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    let transaction: Transaction | null = null;

    try {
      if (!req.user) {
        return next(new ApiError(401, "Authentication required"));
      }

      const userId = req.user.id;
      const postId = parseInt(req.params.id);
      const { title, content, keywords, status, scheduledFor } = req.body;

      if (isNaN(postId)) {
        return next(new ApiError(400, "Invalid post ID"));
      }

      // Fetch the post
      const post = await Post.findOne({
        where: { id: postId, user_id: userId },
      });

      if (!post) {
        return next(new ApiError(404, "Post not found"));
      }

      // Check if updating from draft to published/scheduled
      const isPublishingFromDraft =
        post.status === PostStatus.DRAFT &&
        (status === PostStatus.PUBLISHED || status === PostStatus.SCHEDULED);

      // If publishing from draft, check if user has available posts
      if (isPublishingFromDraft) {
        const { hasAvailablePosts } =
          await featureFlagService.hasAvailablePosts(userId);
        if (!hasAvailablePosts) {
          return next(
            new ApiError(
              403,
              "You've reached your post limit. Upgrade your plan to publish more posts."
            )
          );
        }
      }

      // Check word count if content is updated
      if (content) {
        const wordCount = content.split(/\s+/).filter(Boolean).length;
        const wordCountLimit = await featureFlagService.getPlanLimit(
          userId,
          "content.wordCount"
        );
        if (wordCount > wordCountLimit) {
          return next(
            new ApiError(
              403,
              "Word count exceeds your plan limit. Upgrade your plan to create longer posts."
            )
          );
        }
      }

      // Start a transaction
      transaction = await sequelize.transaction();

      try {
        // Update post fields
        if (title) post.title = title;
        if (content) {
          post.content = content;
          post.word_count = content.split(/\s+/).filter(Boolean).length;
        }
        if (status) post.status = status;
        if (scheduledFor)
          post.scheduled_for = scheduledFor ? new Date(scheduledFor) : null;

        // Set published_at if publishing
        if (status === PostStatus.PUBLISHED && post.published_at === null) {
          post.published_at = new Date();
        }

        // Save the post
        await post.save({ transaction });

        // Process keywords if provided
        if (keywords && Array.isArray(keywords)) {
          // Get current keywords
          const currentKeywords = await PostKeyword.findAll({
            where: { post_id: post.id },
            transaction,
          });

          // Delete current keywords
          for (const keyword of currentKeywords) {
            await keyword.destroy({ transaction });
          }

          // Add new keywords
          for (const keywordData of keywords) {
            // Find or create the keyword
            const [keyword] = await Keyword.findOrCreate({
              where: {
                word: keywordData.word,
                user_id: userId,
              },
              defaults: {
                word: keywordData.word,
                user_id: userId,
                relevance: keywordData.relevance || 0.5,
              },
              transaction,
            });

            // Associate keyword with the post
            await PostKeyword.create(
              {
                post_id: post.id,
                keyword_id: keyword.id,
                relevance: keywordData.relevance || 0.7,
              },
              { transaction }
            );
          }
        }

        // Commit the transaction
        await transaction.commit();
        transaction = null;

        // If user is publishing a draft, increment post usage
        if (isPublishingFromDraft) {
          await featureFlagService.incrementPostUsage(userId);
        }

        // Send notification if post status changed to scheduled
        if (
          post.status === PostStatus.SCHEDULED &&
          post.scheduled_for &&
          post.changed("status")
        ) {
          try {
            const user = await User.findByPk(post.user_id);
            if (user) {
              await emailService.sendPostScheduledConfirmation(
                user,
                post.title,
                post.scheduled_for
              );
            }
          } catch (emailError: unknown) {
            // Log the error but don't let it stop the process
            if (emailError instanceof Error) {
              logger.error(
                `Failed to send scheduling notification: ${emailError.message}`
              );
            } else {
              logger.error(
                `Failed to send scheduling notification: ${String(emailError)}`
              );
            }
            // Continue with post update - don't throw this error
          }
        }

        // Emit post updated event
        postEventEmitter.emit(PostEventType.UPDATED, { post });

        // If post status changed to SCHEDULED, also emit scheduled event
        if (post.status === PostStatus.SCHEDULED) {
          postEventEmitter.emit(PostEventType.SCHEDULED, { post });
        }

        // Send successful response
        res
          .status(200)
          .json(SuccessResponse({ post }, "Post updated successfully"));
      } catch (error) {
        // Rollback the transaction if something went wrong
        if (transaction) await transaction.rollback();
        logger.error("Error updating post:", error);
        return next(new ApiError(500, "Failed to update post"));
      }
    } catch (error) {
      // Rollback the transaction if something went wrong
      if (transaction) await transaction.rollback();
      logger.error("Error updating post:", error);
      next(new ApiError(500, "Failed to update post"));
    }
  };

  /**
   * Get a single post by ID
   *
   * @param req Request object
   * @param res Response object
   * @param next NextFunction
   */
  public getPost = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return next(new ApiError(401, "Authentication required"));
      }

      const userId = req.user.id;
      const postId = parseInt(req.params.id);

      if (isNaN(postId)) {
        return next(new ApiError(400, "Invalid post ID"));
      }

      // Get the post with its keywords
      const post = await Post.findOne({
        where: { id: postId, user_id: userId },
        include: [
          {
            model: Keyword,
            as: "keywords",
            through: { attributes: ["relevance"] },
          },
        ],
      });

      if (!post) {
        return next(new ApiError(404, "Post not found"));
      }

      return res.status(200).json({
        success: true,
        data: post,
      });
    } catch (error) {
      logger.error("Error fetching post:", error);
      next(error);
    }
  };

  /**
   * Get all posts for the authenticated user
   *
   * @param req Request object
   * @param res Response object
   * @param next NextFunction
   */
  public getPosts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return next(new ApiError(401, "Authentication required"));
      }

      const userId = req.user.id;
      const {
        status,
        page = 1,
        limit = 10,
        sort = "created_at",
        order = "DESC",
      } = req.query;

      const pageNumber = parseInt(page as string) || 1;
      const pageSize = parseInt(limit as string) || 10;
      const offset = (pageNumber - 1) * pageSize;

      // Build where clause
      const whereClause: any = { user_id: userId };
      if (status) whereClause.status = status;

      // Get posts
      const { count, rows: posts } = await Post.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: Keyword,
            as: "keywords",
            through: { attributes: ["relevance"] },
          },
        ],
        limit: pageSize,
        offset,
        order: [[sort as string, order as string]],
      });

      // Get post usage information
      const { usedCount, limit: postLimit } =
        await featureFlagService.hasAvailablePosts(userId);

      return res.status(200).json({
        success: true,
        data: {
          posts,
          pagination: {
            total: count,
            page: pageNumber,
            pageSize,
            totalPages: Math.ceil(count / pageSize),
          },
          usage: {
            used: usedCount,
            limit: postLimit,
            remaining: postLimit - usedCount,
          },
        },
      });
    } catch (error) {
      logger.error("Error fetching posts:", error);
      next(error);
    }
  };

  /**
   * Delete a post
   *
   * @param req Request object
   * @param res Response object
   * @param next NextFunction
   */
  public deletePost = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    let transaction: Transaction | null = null;

    try {
      if (!req.user) {
        return next(new ApiError(401, "Authentication required"));
      }

      const userId = req.user.id;
      const postId = parseInt(req.params.id);

      if (isNaN(postId)) {
        return next(new ApiError(400, "Invalid post ID"));
      }

      // Get the post
      const post = await Post.findOne({
        where: { id: postId, user_id: userId },
      });

      if (!post) {
        return next(new ApiError(404, "Post not found"));
      }

      // Start a transaction
      transaction = await sequelize.transaction();

      // Delete post keywords
      await PostKeyword.destroy({
        where: { post_id: postId },
        transaction,
      });

      // Delete the post
      await post.destroy({ transaction });

      // Commit the transaction
      await transaction.commit();
      transaction = null;

      return res.status(200).json({
        success: true,
        message: "Post deleted successfully",
      });
    } catch (error) {
      logger.error("Error deleting post:", error);

      // Rollback transaction if it exists
      if (transaction) await transaction.rollback();

      next(error);
    }
  };

  /**
   * Generate a post using AI
   *
   * @param req Request object
   * @param res Response object
   * @param next NextFunction
   */
  public generatePost = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.user) {
        return next(new ApiError(401, "Authentication required"));
      }

      const userId = req.user.id;
      const {
        keywords,
        saveAsDraft = false,
        scheduledFor = null,
        generateSocialCaptions = true,
      } = req.body;

      // Check if user has available posts
      // const canGenerate = await featureFlagService.hasFeatureAccess(
      //   userId,
      //   "content.aiGeneration"
      // );
      // console.log("canGenerate", canGenerate);
      // if (!canGenerate) {
      //   return next(
      //     new ApiError(
      //       403,
      //       "Your plan does not allow AI post generation or you've reached your limit"
      //     )
      //   );
      // }

      // Generate post
      const options: any = {
        overrideKeywords: keywords,
        saveAsDraft,
        generateSocialCaptions,
      };

      if (scheduledFor) {
        options.schedule = new Date(scheduledFor);
      }

      console.log("options", options);

      const post = await PostGenerationService.generatePost(userId, options);
      console.log("This is the POST", post);
      res.status(201).json(
        SuccessResponse({
          post,
          message: "Post generated successfully",
        })
      );
    } catch (error) {
      logger.error("Error generating post:", error);
      next(new ApiError(500, "Failed to generate post"));
    }
  };

  /**
   * Schedule a post generation
   *
   * @param req Request object
   * @param res Response object
   * @param next NextFunction
   */
  public schedulePostGeneration = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.user) {
        return next(new ApiError(401, "Authentication required"));
      }

      const userId = req.user.id;
      const { scheduledTimes, timezone } = req.body;

      if (!scheduledTimes) {
        return next(new ApiError(400, "Scheduled times are required"));
      }

      // Check if user can schedule posts
      const canSchedule = await featureFlagService.hasFeatureAccess(
        userId,
        "content.scheduling"
      );

      if (!canSchedule) {
        return next(
          new ApiError(
            403,
            "Your plan does not allow post scheduling or you've reached your limit"
          )
        );
      }

      // Update user preferences
      const user = await User.findByPk(userId, {
        include: ["preferences"],
      });

      if (!user || !user.preferences) {
        return next(new ApiError(404, "User preferences not found"));
      }

      // Update scheduling preferences
      await user.preferences.update({
        enable_scheduling: true,
        scheduled_times: JSON.stringify(scheduledTimes),
      
      });

      res.status(200).json(
        SuccessResponse({
          message: "Post generation schedule updated successfully",
          scheduledTimes,
        })
      );
    } catch (error) {
      logger.error("Error scheduling post generation:", error);
      next(new ApiError(500, "Failed to schedule post generation"));
    }
  };

  /**
   * Test WordPress connection
   *
   * @param req Request object
   * @param res Response object
   * @param next NextFunction
   */
  public testWordPressConnection = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.user) {
        return next(new ApiError(401, "Authentication required"));
      }

      const userId = req.user.id;

      // Find user's business profile
      const user = await User.findByPk(userId, {
        include: ["businessProfile"],
      });

      if (!user || !user.businessProfile) {
        return next(new ApiError(404, "Business profile not found"));
      }

      // Test WordPress connection
      const wpService = new WordPressService(user.businessProfile);
      const isConnected = await wpService.testConnection();

      if (!isConnected) {
        return res
          .status(400)
          .json(ErrorResponse("WordPress connection failed"));
      }

      res.status(200).json(
        SuccessResponse({
          message: "WordPress connection successful",
          success: true,
        })
      );
    } catch (error) {
      logger.error("Error testing WordPress connection:", error);
      next(new ApiError(500, "Failed to test WordPress connection"));
    }
  };
}

// Create an instance of the controller for route usage
const postController = new PostController();

export default postController;
