import { Request, Response, NextFunction } from "express";
import User from "../models/user.model";
import Post from "../models/post.model";
import Keyword from "../models/keyword.model";
import Subscription from "../models/subscription.model";
import { Op } from "sequelize";
import logger from "../config/logger";

/**
 * Get dashboard overview statistics for the authenticated user
 */
export const getDashboardStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    // Get user and subscription information
    const user = await User.findByPk(userId, {
      include: [
        {
          model: Subscription,
          as: "subscription",
          attributes: [
            "plan",
            "current_period_end",
            "cancel_at_period_end",
            "trial_end",
            "status",
          ],
        },
      ],
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    // Count posts by status
    const totalPosts = await Post.count({ where: { user_id: userId } });
    const publishedPosts = await Post.count({
      where: {
        user_id: userId,
        status: "published",
      },
    });
    const draftPosts = await Post.count({
      where: {
        user_id: userId,
        status: "draft",
      },
    });
    const scheduledPosts = await Post.count({
      where: {
        user_id: userId,
        status: "scheduled",
      },
    });

    // Get posts for monthly stats
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const monthlyPosts = await Post.count({
      where: {
        user_id: userId,
        created_at: {
          [Op.gte]: thirtyDaysAgo,
        },
      },
    });

    // Get recent activity (posts)
    const recentActivity = await Post.findAll({
      where: { user_id: userId },
      order: [["updated_at", "DESC"]],
      limit: 5,
      attributes: ["id", "title", "status", "created_at", "updated_at"],
    });

    // Get next scheduled posts
    const currentDate = new Date();
    const nextScheduledContent = await Post.findAll({
      where: {
        user_id: userId,
        status: "scheduled",
        scheduled_for: {
          [Op.gt]: currentDate,
        },
      },
      order: [["scheduled_for", "ASC"]],
      limit: 3,
      attributes: ["id", "title", "scheduled_for", "status"],
    });

    // Get total keywords
    const totalKeywords = await Keyword.count({
      where: { user_id: userId },
    });

    // Calculate plan usage limits based on the user's plan
    let postsLimit = 10; // Default for basic plan
    let keywordsLimit = 5; // Default for basic plan

    if (user.subscription?.plan === "standard") {
      postsLimit = 50;
      keywordsLimit = 10;
    } else if (user.subscription?.plan === "premium") {
      postsLimit = 100;
      keywordsLimit = 15;
    }

    // Format next billing date and amount
    const nextBillingDate = user.subscription?.current_period_end
      ? new Date(user.subscription.current_period_end)
      : null;

    // Default amount for plan tiers
    let billingAmount = "N/A";
    if (user.subscription?.plan === "basic") {
      billingAmount = "$9.99";
    } else if (user.subscription?.plan === "standard") {
      billingAmount = "$19.99";
    } else if (user.subscription?.plan === "premium") {
      billingAmount = "$29.99";
    }

    // Format response
    const dashboardStats = {
      stats: [
        {
          name: "Total Posts",
          value: totalPosts.toString(),
          change: "+12%", // This could be calculated based on previous period
          trend: "up",
          color: "blue",
        },
        {
          name: "Published Posts",
          value: publishedPosts.toString(),
          change: "+8%",
          trend: "up",
          color: "green",
        },
        {
          name: "Pending Posts",
          value: draftPosts.toString(),
          change: "-2%",
          trend: "down",
          color: "yellow",
        },
        {
          name: "Monthly Posts",
          value: monthlyPosts.toString(),
          change: "+5%",
          trend: "up",
          color: "purple",
        },
      ],
      recentActivity: recentActivity.map((post: any) => ({
        id: post.id,
        title: post.title,
        type: post.status === "published" ? "post" : "draft",
        status: post.status,
        date: getTimeAgo(post.updated_at),
        keywords: [], // Would need to fetch associated keywords for each post
      })),
      nextBilling: {
        date: nextBillingDate
          ? nextBillingDate.toISOString().split("T")[0]
          : "N/A",
        amount: billingAmount,
        plan: user.subscription?.plan || "Basic",
        willCancel: user.subscription?.cancel_at_period_end || false,
      },
      nextScheduledContent: nextScheduledContent.map((post: any) => ({
        id: post.id,
        title: post.title,
        scheduledFor: post.scheduled_for?.toISOString() || "",
        type: "blog",
        status: post.status,
      })),
      planUsage: {
        postsLimit,
        postsUsed: totalPosts,
        keywordsLimit,
        keywordsUsed: totalKeywords,
        postsPercentage: Math.round((totalPosts / postsLimit) * 100),
        keywordsPercentage: Math.round((totalKeywords / keywordsLimit) * 100),
      },
    };

    res.status(200).json({
      success: true,
      data: dashboardStats,
    });
  } catch (error) {
    logger.error("Error getting dashboard stats:", error);
    next(error);
  }
};

/**
 * Helper function to convert date to relative time (e.g., "2 hours ago")
 */
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHour = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHour / 24);

  if (diffSec < 60) {
    return `${diffSec} second${diffSec !== 1 ? "s" : ""} ago`;
  } else if (diffMin < 60) {
    return `${diffMin} minute${diffMin !== 1 ? "s" : ""} ago`;
  } else if (diffHour < 24) {
    return `${diffHour} hour${diffHour !== 1 ? "s" : ""} ago`;
  } else if (diffDay < 30) {
    return `${diffDay} day${diffDay !== 1 ? "s" : ""} ago`;
  } else {
    return date.toLocaleDateString();
  }
}
