import cron from "node-cron";
import { format } from "date-fns";
import { postPublishingQueue } from "../config/queue";
import logger from "../config/logger";
import redisClient from "../config/redis";
import Redlock from "redlock";
import { Post, User, BusinessProfile } from "../models";

export class PostMinutePublisher {
  private redlock: Redlock;
  private postsByMinutePrefix = "postsByMinute:";

  constructor() {
    // Setup Redlock with the Redis client for distributed locking
    this.redlock = new Redlock([redisClient], {
      driftFactor: 0.01,
      retryCount: 3,
      retryDelay: 200,
      retryJitter: 200,
    });

    logger.info("Post minute publisher initialized");
  }

  /**
   * Start the publisher
   */
  public start(): void {
    // Run every minute
    cron.schedule("* * * * *", () => {
      this.checkAndQueuePosts().catch((error) => {
        logger.error("Error checking and queuing posts:", error);
      });
    });

    logger.info("Post minute publisher started");
  }

  /**
   * Check for posts due this minute and queue them for publishing
   */
  private async checkAndQueuePosts(): Promise<void> {
    let lock = null;
    let minuteKey: string = "";

    try {
      // Get current minute in UTC
      const now = new Date();
      minuteKey = format(now, "yyyy-MM-dd:HH:mm");
      const lockKey = `locks:publish-minute-${minuteKey}`;

      // Log the current check with UTC time
      logger.info(
        `Starting post publishing check for minute ${minuteKey} (UTC)`
      );

      // Try to acquire a lock with a 20-second TTL
      lock = await this.redlock.acquire([lockKey], 20 * 1000);
      logger.info(`Acquired lock for minute ${minuteKey} (UTC)`);

      // Check Redis for posts due this minute
      const cacheKey = `${this.postsByMinutePrefix}${minuteKey}`;
      logger.info(`Checking Redis key: ${cacheKey}`);

      // Check keys in Redis for debugging
      if (process.env.NODE_ENV === "development") {
        const keys = await redisClient.keys(`${this.postsByMinutePrefix}*`);
        if (keys.length > 0) {
          logger.info(
            `Found ${keys.length} minute keys in Redis: ${keys.join(", ")}`
          );
        }
      }

      const postIds = await redisClient.smembers(cacheKey);
      logger.info(
        `Redis set contents for ${cacheKey}: ${JSON.stringify(postIds)}`
      );

      if (postIds.length === 0) {
        logger.info(`No posts found to publish at ${minuteKey} (UTC)`);
        return;
      }

      logger.info(
        `Found ${postIds.length} posts to publish at ${minuteKey} (UTC)`
      );

      // Queue each post for publishing
      for (const postId of postIds) {
        try {
          // Get post details for logging
          const post = (await Post.findByPk(postId, {
            include: [
              {
                model: User,
                as: "user",
                include: [{ model: BusinessProfile, as: "businessProfile" }],
              },
            ],
          })) as Post & {
            user?: User & {
              businessProfile?: BusinessProfile & {
                hasWordPressIntegration: () => boolean;
              };
            };
          };

          if (post) {
            logger.info(`Processing post ${postId}:`, {
              title: post.title,
              scheduledFor: post.scheduled_for?.toISOString(),
              hasWordPressIntegration:
                post?.user?.businessProfile?.hasWordPressIntegration(),
              wordpressId: post.wordpress_id,
            });
          }

          await postPublishingQueue.add(
            { postId: parseInt(postId, 10) },
            {
              jobId: `publish-post-${postId}`,
              attempts: 3,
              backoff: {
                type: "exponential",
                delay: 30000, // 30 seconds
              },
              removeOnComplete: true,
            }
          );
          logger.info(`Post publishing job queued for post ${postId}`);
        } catch (error: any) {
          if (error.message && error.message.includes("duplicate")) {
            logger.info(`Duplicate job detected for post ${postId}, skipping`);
          } else {
            logger.error(
              `Error queueing publishing job for post ${postId}:`,
              error
            );
          }
        }
      }

      // Clean up - remove the processed minute key
      await redisClient.del(cacheKey);
      logger.info(`Removed minute key ${cacheKey} after processing`);
    } catch (error: any) {
      if (error.name === "LockError") {
        // This is normal in distributed environments - another instance got the lock
        logger.info(`Another instance is processing the current minute`);
      } else {
        logger.error("Error checking and queueing posts:", error);
      }
    } finally {
      // Release the lock if it was acquired
      if (lock) {
        try {
          await lock.release();
          logger.info(`Released lock for minute ${minuteKey} (UTC)`);
        } catch (error: any) {
          logger.error("Error releasing minute publisher lock:", error);
        }
      }
    }
  }

  /**
   * Clean up resources
   */
  public async shutdown(): Promise<void> {
    // No additional cleanup needed here as we're using a shared Redis client
    logger.info("Post minute publisher shut down");
  }
}

// Create and export a singleton instance
const postMinutePublisher = new PostMinutePublisher();
export default postMinutePublisher;
