import { Router, Request, Response } from "express";
import express from "express";
import { authenticate, adminMiddleware } from "../middlewares/auth.middleware";
import logger from "../config/logger";
import redisClient from "../config/redis";
import postCacheRefresher from "../jobs/post-cache-refresher.job";
import { SuccessResponse } from "../utils/responses";

const router = Router();

// Protect all admin routes with authentication and admin check
router.use(authenticate, adminMiddleware);

/**
 * Manually refresh the post cache
 * @route GET /api/v1/admin/refresh-post-cache
 */
router.get("/refresh-post-cache", (async (req: Request, res: Response) => {
  try {
    logger.info("Manual cache refresh requested by admin");
    await postCacheRefresher.forceRefresh();

    return res.json(
      SuccessResponse({ status: "success" }, "Post cache refreshed")
    );
  } catch (error: any) {
    logger.error("Error in manual cache refresh:", error);
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to refresh post cache",
    });
  }
}) as unknown as express.RequestHandler);

/**
 * Get Redis cache debug info
 * @route GET /api/v1/admin/cache-status
 */
router.get("/cache-status", (async (req: Request, res: Response) => {
  try {
    // Get all keys for post minutes and hourly schedule
    const minuteKeys = await redisClient.keys("postsByMinute:*");
    const hourlyKeys = await redisClient.keys("hourlySchedule:*");

    // Get content for the hourly keys
    const hourlyData: Record<string, any> = {};
    for (const key of hourlyKeys) {
      hourlyData[key] = await redisClient.hgetall(key);
    }

    // Get content for minute keys
    const minuteData: Record<string, string[]> = {};
    for (const key of minuteKeys) {
      minuteData[key] = await redisClient.smembers(key);
    }

    return res.json(
      SuccessResponse(
        {
          minuteKeys,
          hourlyKeys,
          hourlyData,
          minuteData,
        },
        "Cache status retrieved"
      )
    );
  } catch (error: any) {
    logger.error("Error getting cache status:", error);
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to get cache status",
    });
  }
}) as unknown as express.RequestHandler);

export default router;
