import cron from "node-cron";
import { Op } from "sequelize";
import { format } from "date-fns";
import { addDays, setHours, setMinutes, addHours } from "date-fns";
import logger from "../config/logger";
import {
  User,
  UserPreference,
  BusinessProfile,
  Post,
  Subscription,
} from "../models";
import { PostStatus } from "../models/post.model";
import { SubscriptionStatus } from "../models/subscription.model";
import { postGenerationQueue } from "../config/queue";

// Import Redlock for distributed locking
import Redlock from "redlock";
import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

export class HourlyPostGenerator {
  private redisClient: Redis;
  private redlock: Redlock;

  constructor() {
    // Setup Redis client for distributed locking using the same URL config approach
    this.redisClient = new Redis(
      process.env.REDIS_URL || "redis://red-cvv7ccidbo4c73fhcd30:6379"
    );

    // Setup Redlock with the Redis client
    this.redlock = new Redlock([this.redisClient], {
      driftFactor: 0.01,
      retryCount: 3,
      retryDelay: 200,
      retryJitter: 200,
    });
  }

  /**
   * Start the hourly post generator
   */
  public start(): void {
    // Run at 5 minutes past every hour
    const cronExpression = "15 * * * *";

    logger.info(
      `Hourly post generator scheduled to run at 10 minutes past every hour (UTC)`
    );

    // Run hourly at 10 minutes past to generate posts for the current hour
    cron.schedule(cronExpression, () => {
      this.generateHourlyPosts().catch((error: unknown) => {
        logger.error("Error in hourly post generation:", error);
      });
    });

    logger.info("Hourly post generator started");
  }

  /**
   * Generate posts for the current hour
   */
  private async generateHourlyPosts(): Promise<void> {
    // Use distributed locking to ensure only one instance runs this job
    let lock = null;

    try {
      // Current time in UTC
      const now = new Date();
      const currentHour = now.getHours();

      // Get a lock key specific to this hour
      const lockKey = `locks:hourly-post-generation-${format(
        now,
        "yyyy-MM-dd-HH"
      )}`;

      // Try to acquire a lock with a 10-minute TTL
      lock = await this.redlock.acquire([lockKey], 10 * 60 * 1000);

      logger.info(`Starting post generation for hour ${currentHour} (UTC)...`);

      // Get current day of week
      const currentDayName = this.getDayName(now.getDay());

      // Find all users with active scheduling for today
      const users = await User.findAll({
        include: [
          {
            model: UserPreference,
            where: {
              enable_scheduling: true,
              // Only include users with today's day in their schedule
              scheduled_times: {
                [Op.like]: `%${currentDayName}%`,
              },
            },
            required: true,
            as: "preferences",
          },
          {
            model: BusinessProfile,
            required: true,
            as: "businessProfile",
          },
          {
            model: Subscription,
            where: { status: SubscriptionStatus.ACTIVE },
            required: true,
            as: "subscription",
          },
        ],
      });

      if (users.length === 0) {
        logger.info(
          `No users with active scheduling found for ${currentDayName}`
        );
        return;
      }

      logger.info(
        `Found ${users.length} users with scheduled posts for ${currentDayName}`
      );

      // Process each user
      for (const user of users) {
        await this.processUserScheduleForCurrentHour(user, now, currentHour);
      }

      logger.info(
        `Hourly post generation completed for hour ${currentHour} (UTC)`
      );
    } catch (error) {
      logger.error("Error in hourly post generation:", error);
    } finally {
      // Release the lock if it was acquired
      if (lock) {
        try {
          await lock.release();
        } catch (error) {
          logger.error("Error releasing hourly post generation lock:", error);
        }
      }
    }
  }

  /**
   * Process each user's schedule for the current hour only
   */
  private async processUserScheduleForCurrentHour(
    user: User,
    now: Date,
    currentHour: number
  ): Promise<void> {
    try {
      if (!user.preferences || !user.businessProfile) {
        return;
      }

      const preference = user.preferences;

      // Parse scheduled times
      let scheduledTimes: Record<string, string[]>;
      try {
        scheduledTimes = JSON.parse(preference.scheduled_times || "{}");
      } catch (error: unknown) {
        logger.error(
          `Invalid scheduled times format for user ${user.id}:`,
          error
        );
        return;
      }

      // Get current day of week
      const currentDay = this.getDayName(now.getDay());

      // Check if user has scheduled times for today
      if (!scheduledTimes[currentDay] || !scheduledTimes[currentDay].length) {
        return;
      }

      // Get the date string in UTC for display logging
      const dateStr = format(now, "yyyy-MM-dd");

      // Filter scheduled times to only include those within the current hour
      const scheduledTimesInCurrentHour = scheduledTimes[currentDay].filter(
        (time) => {
          const [hours, minutes] = time.split(":").map(Number);
          return hours === currentHour;
        }
      );

      if (scheduledTimesInCurrentHour.length === 0) {
        return; // No times scheduled for the current hour
      }

      logger.info(
        `Processing ${scheduledTimesInCurrentHour.length} scheduled posts for user ${user.id} on ${dateStr} in hour ${currentHour} (UTC)`
      );

      // For each scheduled time in the current hour, create a job
      for (const scheduledTime of scheduledTimesInCurrentHour) {
        // Parse hours and minutes
        const [hours, minutes] = scheduledTime.split(":").map(Number);

        // Create a date object for the scheduled time
        // Use the user's selected time directly without UTC conversion
        const scheduledDate = new Date(now);
        scheduledDate.setHours(hours, minutes, 0, 0);

        // Check if we've already generated a post for this time
        const existingPost = await Post.findOne({
          where: {
            user_id: user.id,
            status: PostStatus.SCHEDULED,
            scheduled_for: scheduledDate,
          },
        });

        if (existingPost) {
          logger.info(
            `Post already exists for user ${user.id} at time ${scheduledTime} on ${dateStr}`
          );
          continue;
        }

        // Queue the job with a unique ID based on user ID, date, and time
        const jobId = `generate-post-${user.id}-${dateStr}-${scheduledTime}`;

        logger.info(
          `Queuing post generation for user ${user.id} at ${scheduledTime} on ${dateStr} (Job ID: ${jobId})`
        );

        try {
          await postGenerationQueue.add(
            {
              userId: user.id,
              scheduleDate: scheduledDate.toISOString(), // Pass the exact scheduled time
              generateSocialCaptions: true,
            },
            {
              jobId: jobId,
              // Reduced delay for hourly processing (0-2 minutes)
              delay: Math.floor(Math.random() * 120) * 1000,
              attempts: 3,
              backoff: {
                type: "exponential",
                delay: 60000, // 1 minute
              },
              removeOnComplete: true,
            }
          );

          logger.info(`Post generation job queued successfully: ${jobId}`);
        } catch (error: any) {
          if (error.message && error.message.includes("duplicate")) {
            logger.info(`Duplicate job detected for ${jobId}, skipping`);
          } else {
            logger.error(
              `Error queueing generation job for user ${user.id}: ${error}`
            );
          }
        }
      }
    } catch (error: unknown) {
      logger.error(`Error processing schedule for user ${user.id}:`, error);
    }
  }

  /**
   * Get the day name in lowercase
   */
  private getDayName(dayIndex: number): string {
    const days = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    return days[dayIndex];
  }
}

// Create and export a singleton instance
const hourlyPostGenerator = new HourlyPostGenerator();
export default hourlyPostGenerator;
