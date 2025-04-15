import { Request, Response, NextFunction } from "express";
import featureFlagService from "../services/feature-flag.service";
import { ApiError } from "./error.middleware";
import logger from "../config/logger";

/**
 * Middleware to check if a user has access to a specific feature
 *
 * @param featurePath Feature path in the format "category.feature"
 * @returns Middleware function
 */
export const checkFeatureAccess = (featurePath: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return next(new ApiError(401, "Authentication required"));
      }

      const hasAccess = await featureFlagService.hasFeatureAccess(
        req.user.id,
        featurePath
      );

      if (!hasAccess) {
        return next(
          new ApiError(
            403,
            "Your current plan does not include access to this feature. Please upgrade to access this feature."
          )
        );
      }

      next();
    } catch (error) {
      logger.error(`Error in feature access middleware:`, error);
      next(error);
    }
  };
};

/**
 * Middleware to check if a user has available posts in their plan
 *
 * @returns Middleware function
 */
export const checkPostAvailability = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return next(new ApiError(401, "Authentication required"));
      }

      const { hasAvailablePosts, usedCount, limit } =
        await featureFlagService.hasAvailablePosts(req.user.id);

      if (!hasAvailablePosts) {
        return next(
          new ApiError(
            403,
            `You have reached your monthly limit of ${limit} posts. Please upgrade your plan or wait until your next billing cycle.`
          )
        );
      }

      // Add post limit info to request for potential use in controller
      req.postLimitInfo = {
        usedCount,
        limit,
        remaining: limit - usedCount,
      };

      next();
    } catch (error) {
      logger.error(`Error in post availability middleware:`, error);
      next(error);
    }
  };
};

/**
 * Middleware to check if a post's word count is within the plan's limit
 *
 * @returns Middleware function
 */
export const checkWordCountLimit = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return next(new ApiError(401, "Authentication required"));
      }

      // Get content from request body
      const { content } = req.body;

      if (!content) {
        return next();
      }

      // Count words in content
      const wordCount = content.split(/\s+/).filter(Boolean).length;

      // Get word count limit for user's plan
      const wordCountLimit = await featureFlagService.getPlanLimit(
        req.user.id,
        "content.wordCountLimit"
      );

      if (wordCount > wordCountLimit) {
        return next(
          new ApiError(
            403,
            `Your content exceeds the maximum word count (${wordCountLimit}) allowed for your plan. Please reduce the content length or upgrade your plan.`
          )
        );
      }

      next();
    } catch (error) {
      logger.error(`Error in word count limit middleware:`, error);
      next(error);
    }
  };
};

// Extend Express Request type to include post limit info
declare global {
  namespace Express {
    interface Request {
      postLimitInfo?: {
        usedCount: number;
        limit: number;
        remaining: number;
      };
    }
  }
}
