import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "../types/auth.types";
import { SuccessResponse, ErrorResponse } from "../utils/responses";
import WordPressService from "../services/wordpress.service";
import { BusinessProfile, Post, PostKeyword, Keyword } from "../models";
import { PostStatus } from "../models/post.model";
import logger from "../config/logger";
import { FeatureFlagService } from "../services/feature-flag.service";

class WordPressController {
  /**
   * Helper method to safely extract keywords from PostKeyword records
   */
  private extractKeywordWords(postKeywords: PostKeyword[]): string[] {
    return postKeywords
      .filter((kw) => kw.keyword !== undefined)
      .map((kw) => kw.keyword!.word);
  }

  /**
   * Test WordPress connection
   */
  public testConnection = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json(ErrorResponse("Authentication required"));
      }

      // Find business profile for the user
      const businessProfile = await BusinessProfile.findOne({
        where: { user_id: userId },
      });

      if (!businessProfile) {
        return res
          .status(404)
          .json(ErrorResponse("Business profile not found"));
      }

      // Check if WordPress integration is configured
      if (
        !businessProfile.wordpress_site_url ||
        !businessProfile.wordpress_username ||
        !businessProfile.wordpress_api_key
      ) {
        return res
          .status(400)
          .json(ErrorResponse("WordPress integration not configured"));
      }

      // Create WordPress service
      const wordpressService = new WordPressService(businessProfile);

      // Test connection
      const isConnected = await wordpressService.testConnection();

      return res
        .status(200)
        .json(
          SuccessResponse(
            { connected: isConnected },
            isConnected
              ? "WordPress connection successful"
              : "WordPress connection failed"
          )
        );
    } catch (error) {
      logger.error("Error testing WordPress connection:", error);
      next(error);
    }
  };

  /**
   * Publish a post to WordPress
   */
  public publishToWordPress = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json(ErrorResponse("Authentication required"));
      }

      const { postId } = req.params;

      // Check if user has access to auto-publish feature
      const featureFlagService = new FeatureFlagService();
      const hasAccess = await featureFlagService.hasFeatureAccess(
        userId,
        "content.autoPublish"
      );

      if (!hasAccess) {
        return res
          .status(403)
          .json(
            ErrorResponse(
              "Your current plan does not include WordPress auto-publishing. Please upgrade to use this feature."
            )
          );
      }

      // Find the post
      const post = await Post.findOne({
        where: { id: postId, user_id: userId },
      });

      if (!post) {
        return res.status(404).json(ErrorResponse("Post not found"));
      }

      // Find business profile with WordPress settings
      const businessProfile = await BusinessProfile.findOne({
        where: { user_id: userId },
      });

      if (!businessProfile) {
        return res
          .status(404)
          .json(ErrorResponse("Business profile not found"));
      }

      // Check if WordPress integration is configured
      if (
        !businessProfile.wordpress_site_url ||
        !businessProfile.wordpress_username ||
        !businessProfile.wordpress_api_key
      ) {
        return res
          .status(400)
          .json(
            ErrorResponse(
              "WordPress integration not configured. Please add your WordPress credentials in profile settings."
            )
          );
      }

      // Create WordPress service
      const wordpressService = new WordPressService(businessProfile);

      // Get post keywords using association
      const postKeywords = await PostKeyword.findAll({
        where: { post_id: post.id },
        include: [
          {
            model: Keyword,
            as: "keyword",
            attributes: ["word"],
          },
        ],
      });

      // Extract keyword words using the helper method
      const keywordList = this.extractKeywordWords(postKeywords);

      // Publish to WordPress
      const wpStatus =
        post.status === PostStatus.PUBLISHED ? "publish" : "draft";
      const wpResponse = await wordpressService.publishPost(
        post.title,
        post.content,
        wpStatus,
        keywordList
      );

      // Update post with WordPress post ID if successful
      if (wpResponse && wpResponse.data && wpResponse.data.id) {
        await post.update({
          wordpress_id: wpResponse.data.id,
          wordpress_url: wpResponse.data.link,
        });
      }

      return res.status(200).json(
        SuccessResponse(
          {
            wordpress_id: wpResponse.data.id,
            wordpress_url: wpResponse.data.link,
          },
          "Post successfully published to WordPress"
        )
      );
    } catch (error) {
      logger.error("Error publishing to WordPress:", error);
      next(error);
    }
  };

  /**
   * Update a post on WordPress
   */
  public updateWordPressPost = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json(ErrorResponse("Authentication required"));
      }

      const { postId } = req.params;

      // Check if user has access to auto-publish feature
      const featureFlagService = new FeatureFlagService();
      const hasAccess = await featureFlagService.hasFeatureAccess(
        userId,
        "content.autoPublish"
      );

      if (!hasAccess) {
        return res
          .status(403)
          .json(
            ErrorResponse(
              "Your current plan does not include WordPress auto-publishing. Please upgrade to use this feature."
            )
          );
      }

      // Find the post
      const post = await Post.findOne({
        where: { id: postId, user_id: userId },
      });

      if (!post) {
        return res.status(404).json(ErrorResponse("Post not found"));
      }

      // Check if post has a WordPress ID
      if (!post.wordpress_id) {
        return res
          .status(400)
          .json(
            ErrorResponse(
              "This post has not been published to WordPress yet. Please publish it first."
            )
          );
      }

      // Find business profile with WordPress settings
      const businessProfile = await BusinessProfile.findOne({
        where: { user_id: userId },
      });

      if (!businessProfile) {
        return res
          .status(404)
          .json(ErrorResponse("Business profile not found"));
      }

      // Create WordPress service
      const wordpressService = new WordPressService(businessProfile);

      // Get post keywords using association
      const postKeywords = await PostKeyword.findAll({
        where: { post_id: post.id },
        include: [
          {
            model: Keyword,
            as: "keyword",
            attributes: ["word"],
          },
        ],
      });

      // Extract keyword words using the helper method
      const keywordList = this.extractKeywordWords(postKeywords);

      // Update on WordPress
      const wpStatus =
        post.status === PostStatus.PUBLISHED ? "publish" : "draft";
      const wpResponse = await wordpressService.updatePost(
        post.wordpress_id,
        post.title,
        post.content,
        wpStatus,
        keywordList
      );

      return res.status(200).json(
        SuccessResponse(
          {
            wordpress_id: wpResponse.data.id,
            wordpress_url: wpResponse.data.link,
          },
          "Post successfully updated on WordPress"
        )
      );
    } catch (error) {
      logger.error("Error updating WordPress post:", error);
      next(error);
    }
  };
}

export default new WordPressController();
