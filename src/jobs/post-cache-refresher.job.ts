import cron from "node-cron";
import { format, addHours } from "date-fns";
import { Op } from "sequelize";
import { Post } from "../models";
import { PostStatus } from "../models/post.model";
import logger from "../config/logger";
import redisClient from "../config/redis";
import Redlock from "redlock";

export class PostCacheRefresher {
  private redlock: Redlock;
  private hourlySchedulePrefix = "hourlySchedule:";
  private postsByMinutePrefix = "postsByMinute:";

  constructor() {
    // Setup Redlock with the Redis client for distributed locking
    this.redlock = new Redlock([redisClient], {
      driftFactor: 0.01,
      retryCount: 3,
      retryDelay: 200,
      retryJitter: 200,
    });

    logger.info("Post cache refresher initialized");
  }

  /**
   * Start the cache refresher
   */
  public start(): void {
    // Run at the start of every 15 min of every hour (minute 0)
    cron.schedule("16 * * * *", () => {
      this.refreshPostCache().catch((error) => {
        logger.error("Error refreshing post cache:", error);
      });
    });

    // Also run immediately on startup to prime the cache
    this.refreshPostCache().catch((error) => {
      logger.error("Error in initial post cache refresh:", error);
    });

    logger.info("Post cache refresher started");
  }

  /**
   * Refresh the post cache for the current hour
   */
  private async refreshPostCache(): Promise<void> {
    let lock = null;

    try {
      // Try to acquire a lock with a 5-minute TTL
      lock = await this.redlock.acquire(
        ["locks:post-cache-refresh"],
        5 * 60 * 1000
      );

      // Get current time and next hour in UTC
      const now = new Date(); // UTC time
      const nextHour = addHours(now, 1); // UTC time + 1 hour

      // Format the hour key in UTC
      const currentHourKey = format(now, "yyyy-MM-dd:HH");

      logger.info(`Refreshing post cache for hour ${currentHourKey} (UTC)`);
      logger.info(
        `Current time: ${now.toISOString()}, Next hour: ${nextHour.toISOString()}`
      );

      // Log the query parameters we're using
      logger.info(
        `Searching for posts with status=${
          PostStatus.SCHEDULED
        }, scheduled between ${now.toISOString()} and ${nextHour.toISOString()} (UTC)`
      );

      // Find all posts scheduled for the next hour - using BETWEEN for more reliable comparison
      const posts = await Post.findAll({
        where: {
          status: PostStatus.SCHEDULED,
          scheduled_for: {
            [Op.between]: [now, nextHour],
          },
        },
        attributes: ["id", "user_id", "title", "scheduled_for"],
      });

      // If no posts found, try a broader search for debugging
      if (posts.length === 0) {
        logger.info(
          "No posts found for current hour, checking for any scheduled posts"
        );

        const allScheduledPosts = await Post.findAll({
          where: {
            status: PostStatus.SCHEDULED,
          },
          attributes: ["id", "scheduled_for"],
        });

        if (allScheduledPosts.length > 0) {
          logger.info(
            `Found ${allScheduledPosts.length} scheduled posts in total`
          );
          allScheduledPosts.forEach((post) => {
            logger.info(
              `Post ${post.id} scheduled for ${
                post.scheduled_for ? post.scheduled_for.toISOString() : "null"
              }`
            );
          });
        } else {
          logger.info("No scheduled posts found in the database");
        }
      }

      logger.info(`Found ${posts.length} posts scheduled for the next hour`);

      // Start a Redis transaction
      const pipeline = redisClient.pipeline();

      // Clear any existing cache for this hour
      pipeline.del(`${this.hourlySchedulePrefix}${currentHourKey}`);

      // Add each post to the hourly schedule
      for (const post of posts) {
        // Store post metadata in the hourly hash
        pipeline.hset(
          `${this.hourlySchedulePrefix}${currentHourKey}`,
          post.id.toString(),
          JSON.stringify({
            id: post.id,
            user_id: post.user_id,
            title: post.title,
            scheduled_for: post.scheduled_for?.toISOString(),
          })
        );

        // Add to the specific minute set (using UTC time)
        const minuteKey = format(
          post.scheduled_for as Date,
          "yyyy-MM-dd:HH:mm"
        );
        pipeline.sadd(
          `${this.postsByMinutePrefix}${minuteKey}`,
          post.id.toString()
        );

        // Set expiry for each minute key (2 hours)
        pipeline.expire(`${this.postsByMinutePrefix}${minuteKey}`, 7200);

        logger.info(
          `Added post ${post.id} scheduled for ${
            post.scheduled_for instanceof Date
              ? post.scheduled_for.toISOString()
              : "unknown"
          } to minute key ${minuteKey} (UTC)`
        );
      }

      // Set expiry for the hourly key (2 hours)
      pipeline.expire(`${this.hourlySchedulePrefix}${currentHourKey}`, 7200);

      // Execute the transaction
      await pipeline.exec();
      logger.info(
        `Post cache refreshed for hour ${currentHourKey} (UTC) with ${posts.length} posts`
      );
    } catch (error) {
      logger.error("Error refreshing post cache:", error);
    } finally {
      // Release the lock if it was acquired
      if (lock) {
        try {
          await lock.release();
        } catch (error) {
          logger.error("Error releasing post cache refresh lock:", error);
        }
      }
    }
  }

  /**
   * Add a single post to the cache
   */
  public async addPostToCache(post: Post): Promise<void> {
    if (post.status !== PostStatus.SCHEDULED || !post.scheduled_for) {
      return;
    }

    try {
      // Check if the post is scheduled for the current hour
      const now = new Date();
      const nextHour = addHours(now, 1);

      if (post.scheduled_for >= now && post.scheduled_for < nextHour) {
        // Add to the current hour's cache
        const currentHourKey = format(now, "yyyy-MM-dd:HH");
        const minuteKey = format(post.scheduled_for, "yyyy-MM-dd:HH:mm");

        // Store in Redis pipeline
        const pipeline = redisClient.pipeline();

        pipeline.hset(
          `${this.hourlySchedulePrefix}${currentHourKey}`,
          post.id.toString(),
          JSON.stringify({
            id: post.id,
            user_id: post.user_id,
            title: post.title,
            scheduled_for: post.scheduled_for,
          })
        );

        pipeline.sadd(
          `${this.postsByMinutePrefix}${minuteKey}`,
          post.id.toString()
        );
        pipeline.expire(`${this.postsByMinutePrefix}${minuteKey}`, 7200);

        await pipeline.exec();
        logger.info(`Added post ${post.id} to cache for ${minuteKey}`);
      }
    } catch (error) {
      logger.error(`Error adding post ${post.id} to cache:`, error);
    }
  }

  /**
   * Clean up resources
   */
  public async shutdown(): Promise<void> {
    // No additional cleanup needed here as we're using a shared Redis client
    logger.info("Post cache refresher shut down");
  }

  /**
   * Force a cache refresh (for debugging or testing)
   */
  public async forceRefresh(): Promise<void> {
    logger.info("Manually forcing post cache refresh");
    await this.refreshPostCache();
    logger.info("Manual cache refresh completed");
  }
}

// Create and export a singleton instance
const postCacheRefresher = new PostCacheRefresher();
export default postCacheRefresher;
