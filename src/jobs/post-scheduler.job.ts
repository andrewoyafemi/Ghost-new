import cron from "node-cron";
import { Op } from "sequelize";
import logger from "../config/logger";
import { Post } from "../models";
import { PostStatus } from "../models/post.model";
import { postPublishingQueue } from "../config/queue";
import Redlock from "redlock";
import dotenv from "dotenv";
import Redis from "ioredis";

dotenv.config();

export class PostScheduler {
  private redisClient: Redis;
  private redlock: Redlock;

  constructor() {
    // Setup Redis client for distributed locking using the same URL config approach
    this.redisClient = new Redis(
      process.env.REDIS_URL || "redis://red-cvv7ccidbo4c73fhcd30:6379"
    );

    // Setup Redlock with the Redis client
    this.redlock = new Redlock([this.redisClient], {
      // The expected clock drift; for more details see:
      // http://redis.io/topics/distlock
      driftFactor: 0.01, // time in ms

      // The max number of times Redlock will attempt to lock a resource
      // before erroring
      retryCount: 3,

      // The time in ms between attempts
      retryDelay: 200, // time in ms

      // The max time in ms randomly added to retries
      // to improve performance under high contention
      retryJitter: 200, // time in ms
    });
  }

  /**
   * Start the scheduler
   */
  public start(): void {
    // Run every minute to check for posts that need to be published
    cron.schedule("* * * * *", () => {
      this.checkAndPublishScheduledPosts().catch((error) => {
        logger.error("Error in scheduled post publishing:", error);
      });
    });

    logger.info("Post publisher scheduler started");
  }

  /**
   * Check for scheduled posts that need to be published
   */
  private async checkAndPublishScheduledPosts(): Promise<void> {
    // Use distributed locking to ensure only one instance runs this job
    let lock = null;

    try {
      // Try to acquire a lock with a 30-second TTL
      lock = await this.redlock.acquire(
        ["locks:post-publishing-check"],
        30 * 1000
      );

      // Find scheduled posts where the scheduled time has arrived or passed
      const scheduledPosts = await Post.findAll({
        where: {
          status: PostStatus.SCHEDULED,
          scheduled_for: {
            [Op.lte]: new Date(),
          },
        },
      });

      if (scheduledPosts.length === 0) {
        return;
      }

      logger.info(`Found ${scheduledPosts.length} posts to publish`);

      // Queue each post for publishing
      for (const post of scheduledPosts) {
        try {
          await postPublishingQueue.add(
            {
              postId: post.id,
            },
            {
              jobId: `publish-post-${post.id}`,
              attempts: 3,
              backoff: {
                type: "exponential",
                delay: 30000, // 30 seconds
              },
              removeOnComplete: true,
            }
          );

          logger.info(`Post publishing job queued for post ${post.id}`);
        } catch (error) {
          logger.error(
            `Error queueing publishing job for post ${post.id}: ${error}`
          );
        }
      }
    } catch (error) {
      logger.error("Error publishing scheduled posts:", error);
    } finally {
      // Release the lock if it was acquired
      if (lock) {
        try {
          await lock.release();
        } catch (error) {
          logger.error("Error releasing post publishing lock:", error);
        }
      }
    }
  }

  /**
   * Clean up resources
   */
  public async shutdown(): Promise<void> {
    try {
      // Disconnect Redis client
      await this.redisClient.quit();
    } catch (error) {
      logger.error("Error shutting down post scheduler:", error);
    }
  }
}

// Create and export a singleton instance
const postScheduler = new PostScheduler();
export default postScheduler;
