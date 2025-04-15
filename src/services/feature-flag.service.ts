import { User, Subscription } from "../models";
import {
  hasFeature,
  getPlanLimit,
  PlanType,
  LegacyPlanType,
} from "../utils/plan-config";
import logger from "../config/logger";

/**
 * FeatureFlagService
 *
 * This service handles feature access control based on subscription plans.
 * It checks if a user has access to specific features and enforces plan limits.
 */
export class FeatureFlagService {
  /**
   * Check if a user has access to a specific feature
   *
   * @param userId User ID to check
   * @param featurePath Feature path in the format "category.feature"
   * @returns Promise<boolean> True if user has access to the feature
   */
  public async hasFeatureAccess(
    userId: number,
    featurePath: string
  ): Promise<boolean> {
    try {
      // Get user and their active subscription
      const user = await User.findByPk(userId);
      if (!user) {
        logger.warn(`Feature check failed: User with ID ${userId} not found`);
        return false;
      }

      const subscription = await Subscription.findOne({
        where: {
          user_id: userId,
          status: "active",
        },
      });

      // If no active subscription, use user's plan from user table
      const plan = subscription ? subscription.plan : user.plan;

      // Check if the feature is available for the plan
      return hasFeature(plan, featurePath);
    } catch (error) {
      logger.error(`Error checking feature access for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Get the limit for a specific feature based on the user's plan
   *
   * @param userId User ID to check
   * @param limitPath Path to the limit in the format "category.limit"
   * @returns Promise<number> The limit value based on the user's plan
   */
  public async getPlanLimit(
    userId: number,
    limitPath: string
  ): Promise<number> {
    try {
      // Get user and their active subscription
      const user = await User.findByPk(userId);
      if (!user) {
        logger.warn(`Limit check failed: User with ID ${userId} not found`);
        return 0;
      }

      const subscription = await Subscription.findOne({
        where: {
          user_id: userId,
          status: "active",
        },
      });

      // If no active subscription, use user's plan from user table
      const plan = subscription ? subscription.plan : user.plan;

      // Get the limit for the specified path
      return getPlanLimit(plan, limitPath);
    } catch (error) {
      logger.error(`Error getting plan limit for user ${userId}:`, error);
      return 0;
    }
  }

  /**
   * Check if a user has reached their monthly post limit
   *
   * @param userId User ID to check
   * @returns Promise<{hasAvailablePosts: boolean, usedCount: number, limit: number}>
   */
  public async hasAvailablePosts(userId: number): Promise<{
    hasAvailablePosts: boolean;
    usedCount: number;
    limit: number;
  }> {
    try {
      const user = await User.findByPk(userId);
      if (!user) {
        logger.warn(
          `Post limit check failed: User with ID ${userId} not found`
        );
        return { hasAvailablePosts: false, usedCount: 0, limit: 0 };
      }

      const subscription = await Subscription.findOne({
        where: {
          user_id: userId,
          status: "active",
        },
      });

      if (!subscription) {
        // If no active subscription, use user's plan from user table for the limit
        const limit = getPlanLimit(user.plan, "monthlyPostLimit");
        return { hasAvailablePosts: false, usedCount: 0, limit };
      }

      // Get post limit for the plan
      const limit = getPlanLimit(subscription.plan, "monthlyPostLimit");
      const usedCount = subscription.posts_used_count;

      // Check if user has available posts
      const hasAvailablePosts = usedCount < limit;

      return {
        hasAvailablePosts,
        usedCount,
        limit,
      };
    } catch (error) {
      logger.error(`Error checking available posts for user ${userId}:`, error);
      return { hasAvailablePosts: false, usedCount: 0, limit: 0 };
    }
  }

  /**
   * Increment the post usage count for a user
   *
   * @param userId User ID to update
   * @returns Promise<boolean> True if successfully incremented
   */
  public async incrementPostUsage(userId: number): Promise<boolean> {
    try {
      const subscription = await Subscription.findOne({
        where: {
          user_id: userId,
          status: "active",
        },
      });

      if (!subscription) {
        logger.warn(
          `Cannot increment post usage: No active subscription for user ${userId}`
        );
        return false;
      }

      // Increment post count
      subscription.incrementPostUsage();
      await subscription.save();

      return true;
    } catch (error) {
      logger.error(`Error incrementing post usage for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Reset post usage count for a user (typically at the start of a new billing cycle)
   *
   * @param userId User ID to reset
   * @returns Promise<boolean> True if successfully reset
   */
  public async resetPostUsage(userId: number): Promise<boolean> {
    try {
      const subscription = await Subscription.findOne({
        where: {
          user_id: userId,
          status: "active",
        },
      });

      if (!subscription) {
        logger.warn(
          `Cannot reset post usage: No active subscription for user ${userId}`
        );
        return false;
      }

      // Reset post count
      subscription.resetPostUsage();
      await subscription.save();

      return true;
    } catch (error) {
      logger.error(`Error resetting post usage for user ${userId}:`, error);
      return false;
    }
  }
}

export default new FeatureFlagService();
