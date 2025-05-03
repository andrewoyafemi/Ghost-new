import cron from "node-cron";
import { Op } from "sequelize";
import { format, getDay } from "date-fns";
import logger from "../config/logger";
import {
  User,
  UserPreference,
  BusinessProfile,
  Post,
  Subscription,
  Keyword,
} from "../models";
import { PostStatus } from "../models/post.model";
import { SubscriptionStatus } from "../models/subscription.model";
import Redlock from "redlock";
import Redis from "ioredis";
import dotenv from "dotenv";
// Removed: Placeholder comments for imports
import { PostGenerationService } from "../services/post-generation.service";
import { WordPressService } from "../services/wordpress.service";
import { EmailService } from "../services/email.service";
import { PlanType } from "../utils/plan-config";
// TODO: import UserScheduleCacheService from '../services/user-schedule-cache.service';

dotenv.config();

// Define day names mapping (consistent with previous implementation)
const dayNames = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

// Define types for clarity
interface ScheduledTime {
  day: string;
  time: string; // HH:mm format
}

interface UserScheduleData {
  userId: number;
  preferences: UserPreference; // Contains scheduled_times JSON
  businessProfile: BusinessProfile | null; // Contains WP credentials
  subscription: Subscription | null; // Contains status
  user: User; // Add User object itself for email service
}

export class HourlyGeneratePublishJob {
  private redisClient: Redis;
  private redlock: Redlock;
  // Actual services
  private generationService: PostGenerationService;
  private emailService: EmailService;
  // TODO: private cacheService: UserScheduleCacheService;

  constructor() {
    // Configure Redis Client (Use existing config pattern)

    // For Production
    this.redisClient = new Redis(
      process.env.REDIS_URL || "redis://red-cvv7ccidbo4c73fhcd30:6379"
    );
    // For Development
    // this.redisClient = new Redis({
    //   host: process.env.REDIS_HOST || "localhost",
    //   port: parseInt(process.env.REDIS_PORT || "6379"),
    //   password: process.env.REDIS_PASSWORD,
    //   // Add other options like TLS if needed
    // });

    this.redlock = new Redlock([this.redisClient], {
      driftFactor: 0.01,
      retryCount: 3,
      retryDelay: 200,
      retryJitter: 200,
    });

    // Instantiate services
    // TODO: this.cacheService = new UserScheduleCacheService(this.redisClient);
    this.generationService = new PostGenerationService();
    this.emailService = new EmailService();

    logger.info("HourlyGeneratePublishJob initialized");
  }

  public start(): void {
    // Run at the beginning of every hour
    // const cronExpression = "20 * * * *";
    const cronExpression = "*/5 * * * *";

    logger.info(
      `Hourly Generate & Publish job scheduled with cron: "${cronExpression}" (UTC)`
    );

    cron.schedule(cronExpression, () => {
      this.runHourlyTask().catch((error) => {
        logger.error("Unhandled error in runHourlyTask:", error);
      });
    });
  }

  private async runHourlyTask(): Promise<void> {
    const now = new Date();
    const currentHour = now.getUTCHours(); // Use UTC hours
    const currentDayIndex = now.getUTCDay(); // Use UTC day
    const currentDayName = dayNames[currentDayIndex];
    const lockKey = `locks:hourly-generate-publish-${format(
      now,
      "yyyy-MM-dd-HH"
    )}`;
    const lockTTL = 55 * 60 * 1000; // 55 minutes TTL for the lock

    let lock = null;
    logger.info(
      `Starting hourly task for ${currentDayName} hour ${currentHour} (UTC)`
    );

    try {
      lock = await this.redlock.acquire([lockKey], lockTTL);
      logger.info(`Acquired lock: ${lockKey}`);

      // --- 1. Fetch User Schedules (TODO: Replace with cache call) ---
      const activeUsersSchedules = await this.fetchActiveUserSchedules();

      // --- 2. Identify Users for Current Hour ---
      const usersToProcess = this.filterUsersForCurrentHour(
        activeUsersSchedules,
        currentDayName,
        currentHour
      );

      if (usersToProcess.length === 0) {
        logger.info(
          `No users scheduled for ${currentDayName} at hour ${currentHour}.`
        );
        // Release lock early if no work
        if (lock)
          await lock
            .release()
            .catch((e) =>
              logger.error(`Minor error releasing lock early: ${e.message}`)
            );
        lock = null; // Prevent double release in finally
        return;
      }

      logger.info(
        `Found ${usersToProcess.length} user/time slots to process for ${currentDayName} hour ${currentHour}.`
      );

      // --- 3. Process Each User/Time Slot ---
      for (const { user, scheduledTime } of usersToProcess) {
        // Add a small delay between processing each user schedule slot to avoid overwhelming downstream services.
        await new Promise((resolve) => setTimeout(resolve, 500)); // 500ms delay

        // Wrap processing in a try/catch to prevent one user failure from stopping others
        try {
          await this.processUserSchedule(user, scheduledTime, now);
        } catch (userError) {
          logger.error(
            `Failed to process schedule for user ${user.userId} at ${scheduledTime.time}:`,
            userError
          );
          // Continue to the next user/slot
        }
      }

      logger.info(`Hourly task completed for hour ${currentHour} (UTC)`);
    } catch (error: any) {
      if (error.name === "LockError") {
        logger.warn(
          `Could not acquire lock ${lockKey}, another instance is likely running.`
        );
      } else {
        logger.error(
          `Error during hourly task execution for hour ${currentHour}:`,
          error
        );
      }
    } finally {
      if (lock) {
        try {
          await lock.release();
          logger.info(`Released lock: ${lockKey}`);
        } catch (releaseError) {
          logger.error(`Error releasing lock ${lockKey}:`, releaseError);
        }
      }
    }
  }

  // TODO: Replace with cache logic later
  private async fetchActiveUserSchedules(): Promise<UserScheduleData[]> {
    logger.debug(
      "Fetching active user schedules directly from DB (Placeholder for Cache)"
    );
    const users = await User.findAll({
      include: [
        {
          model: UserPreference,
          as: "preferences",
          where: { enable_scheduling: true },
          required: true,
        },
        {
          model: BusinessProfile,
          as: "businessProfile",
          required: true, // Assuming business profile is required for WP publishing
        },
        {
          model: Subscription,
          as: "subscription",
          where: { status: SubscriptionStatus.ACTIVE },
          required: true, // Only process users with active subscriptions
        },
      ],
    });

    return users.map((u) => ({
      userId: u.id,
      // We know these are defined due to 'required: true' and findAll structure
      preferences: u.preferences!,
      businessProfile: u.businessProfile!,
      subscription: u.subscription!,
      user: u, // Pass the full user object
    }));
  }

  private filterUsersForCurrentHour(
    schedules: UserScheduleData[],
    currentDayName: string,
    currentHour: number
  ): { user: UserScheduleData; scheduledTime: ScheduledTime }[] {
    const usersForHour: {
      user: UserScheduleData;
      scheduledTime: ScheduledTime;
    }[] = [];

    for (const userSchedule of schedules) {
      try {
        const times = JSON.parse(
          userSchedule.preferences.scheduled_times || "{}"
        );
        const daySchedule = times[currentDayName] as string[] | undefined;

        if (daySchedule && Array.isArray(daySchedule)) {
          for (const timeStr of daySchedule) {
            const [hoursStr] = timeStr.split(":");
            const scheduleHour = parseInt(hoursStr, 10);
            if (!isNaN(scheduleHour) && scheduleHour === currentHour) {
              usersForHour.push({
                user: userSchedule,
                scheduledTime: { day: currentDayName, time: timeStr },
              });
            }
          }
        }
      } catch (parseError) {
        logger.error(
          `Invalid JSON in scheduled_times for user ${userSchedule.userId}: ${userSchedule.preferences.scheduled_times}`,
          parseError
        );
      }
    }
    return usersForHour;
  }

  private async processUserSchedule(
    userData: UserScheduleData,
    scheduledTime: ScheduledTime,
    now: Date
  ): Promise<void> {
    const { userId, businessProfile, preferences, subscription } = userData; // user object is in userData.user
    const [hours, minutes] = scheduledTime.time.split(":").map(Number);

    const scheduledFor = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        hours,
        minutes,
        0,
        0
      )
    );

    const logPrefix = `User ${userId} | Slot ${scheduledTime.day}@${
      scheduledTime.time
    } | Target: ${scheduledFor.toISOString()}:`;
    logger.info(`${logPrefix} Processing schedule.`);

    // --- Check if Already Published ---
    const publishedPost = await Post.findOne({
      where: {
        user_id: userId,
        scheduled_for: scheduledFor,
        status: PostStatus.PUBLISHED,
      },
      attributes: ["id"],
    });

    if (publishedPost) {
      logger.info(
        `${logPrefix} Post already published (ID: ${publishedPost.id}). Skipping.`
      );
      return;
    }

    // --- Check for Existing Scheduled Post ---
    let existingPost = await Post.findOne({
      where: {
        user_id: userId,
        scheduled_for: scheduledFor,
        status: PostStatus.SCHEDULED,
      },
    });

    let postTitle: string = "";
    let postContent: string = "";
    let generatedKeywords: string[] = [];
    const userPlan = subscription?.plan || PlanType.LONE_RANGER; // Get user plan

    // --- Generate Content (if needed) ---
    if (!existingPost) {
      logger.info(
        `${logPrefix} No existing scheduled post found. Generating content...`
      );
      try {
        // Fetch default keywords from preferences
        const defaultKeywords =
          (typeof preferences.default_keywords === "string"
            ? JSON.parse(preferences.default_keywords)
            : preferences.default_keywords) || [];

        // Get previous posts for context (needed by generatePostContent)
        const previousPosts = await Post.findAndCountAll({
          where: {
            user_id: userId,
            status: PostStatus.PUBLISHED,
          },
          order: [["published_at", "DESC"]],
          limit: 3, // Match limit used in service
        });

        // Call actual generation methods
        postContent = await this.generationService.generatePostContent(
          businessProfile!,
          userPlan,
          defaultKeywords,
          previousPosts.rows,
          previousPosts.count
        );

        postTitle = await this.generationService.generatePostTitle(
          postContent,
          userPlan
        );

        generatedKeywords = defaultKeywords; // Use the keywords used for generation

        logger.info(`${logPrefix} Content generated successfully.`);
      } catch (genError) {
        logger.error(`${logPrefix} Content generation failed:`, genError);
        return;
      }
    } else {
      logger.info(
        `${logPrefix} Using existing scheduled post (ID: ${existingPost.id}).`
      );
      postTitle = existingPost.title;
      postContent = existingPost.content;
      // Fetch existing keywords
      const postKeywords = await existingPost.getPostKeywords({
        include: [Keyword],
      });
      generatedKeywords = postKeywords
        .map((pk) => pk.keyword?.word)
        .filter(Boolean) as string[];
    }

    // --- Publish to WordPress ---
    if (!businessProfile || !businessProfile.hasWordPressIntegration()) {
      logger.warn(
        `${logPrefix} WordPress integration not configured or incomplete. Skipping publish.`
      );
      if (!existingPost) {
        await this.savePostAsDraft(
          userId,
          postTitle,
          postContent,
          generatedKeywords,
          scheduledFor
        );
      }
      return;
    }

    const wpService = new WordPressService(businessProfile);
    let savedPost: Post | null = existingPost; // Track the post record

    try {
      logger.info(`${logPrefix} Attempting to publish to WordPress...`);

      // Use the actual service call
      // Note: WordPressService handles retries internally
      const wpResult = await wpService.publishPost(
        postTitle,
        postContent,
        "publish",
        generatedKeywords
      );

      // Extract response data - might be nested in `data` from Axios
      const resultData = wpResult?.data ? wpResult.data : wpResult;

      if (!resultData || !resultData.id) {
        throw new Error("WordPress API returned invalid response structure.");
      }

      const wpPostId = resultData.id;
      const wpUrl = resultData.link;

      logger.info(
        `${logPrefix} Successfully published to WordPress. WP ID: ${wpPostId}`
      );

      // Save/Update Post as Published
      const postDataToSave = {
        status: PostStatus.PUBLISHED,
        published_at: new Date(),
        wordpress_id: wpPostId,
        wordpress_url: wpUrl,
        title: postTitle, // Ensure title/content are current
        content: postContent,
        scheduled_for: scheduledFor, // Store the intended schedule time
        user_id: userId,
      };

      if (existingPost) {
        await existingPost.update(postDataToSave);
        savedPost = existingPost;
        logger.info(
          `${logPrefix} Updated existing Post ${existingPost.id} to PUBLISHED.`
        );
      } else {
        // Use spread syntax for clarity
        savedPost = await Post.create({ ...postDataToSave });
        logger.info(
          `${logPrefix} Created new Post ${savedPost.id} and marked as PUBLISHED.`
        );
      }

      // Attach keywords only after the post is successfully saved/updated
      if (savedPost && generatedKeywords.length > 0) {
        await this.generationService.attachKeywordsToPost(
          savedPost.id,
          userId,
          generatedKeywords,
          null
        ); // No transaction needed here usually
        logger.info(`${logPrefix} Attached keywords to post ${savedPost.id}.`);
      }
    } catch (publishError: any) {
      // Log the raw error for detailed debugging
      logger.error(`${logPrefix} Raw WordPress publish error:`, publishError);

      // Attempt to extract meaningful info from potential Axios error structure
      const errorMessage =
        publishError.response?.data?.message ||
        publishError.message ||
        "Unknown WordPress publishing error";
      const errorStatus = publishError.response?.status;

      logger.error(
        `${logPrefix} Failed to publish to WordPress. Status: ${
          errorStatus || "N/A"
        }, Message: ${errorMessage}`
      );

      // Analyze error for credentials
      const isCredentialError =
        errorStatus === 401 ||
        errorStatus === 403 ||
        (typeof errorMessage === "string" &&
          errorMessage.toLowerCase().includes("authentication failed")) ||
        (typeof errorMessage === "string" &&
          errorMessage.toLowerCase().includes("invalid api key"));

      if (isCredentialError) {
        logger.warn(
          `${logPrefix} Detected WordPress credential error for user ${userId}.`
        );
        try {
          // Use the actual email service
          await this.emailService.sendWordPressCredentialError(userData.user);
          logger.info(`${logPrefix} Credential error email notification sent.`);
        } catch (emailError) {
          logger.error(
            `${logPrefix} Failed to send credential error email notification:`,
            emailError
          );
        }
      }

      // Save as draft/failed if publishing failed
      if (!existingPost) {
        await this.savePostAsDraft(
          userId,
          postTitle,
          postContent,
          generatedKeywords,
          scheduledFor,
          `publish_failed: ${errorMessage}` // Include error message
        );
      } else {
        logger.warn(
          `${logPrefix} Existing post ${existingPost.id} failed to publish. Status remains SCHEDULED.`
        );
        // Optionally update status to a 'failed' state if desired
        // await existingPost.update({ status: PostStatus.FAILED }); // Requires adding FAILED status
      }
    }
  }

  // Helper to save post as draft
  private async savePostAsDraft(
    userId: number,
    title: string,
    content: string,
    keywords: string[],
    scheduledFor: Date,
    failedReason?: string
  ): Promise<void> {
    const logPrefix = `User ${userId} | Slot target: ${scheduledFor.toISOString()}:`;
    try {
      const existingDraft = await Post.findOne({
        where: {
          user_id: userId,
          scheduled_for: scheduledFor,
          status: { [Op.ne]: PostStatus.PUBLISHED },
        },
        attributes: ["id"],
      });

      if (existingDraft) {
        logger.info(
          `${logPrefix} Draft/Failed post already exists (ID: ${existingDraft.id}). Not creating duplicate.`
        );
        return;
      }

      // Use DRAFT status. Add a specific FAILED status later if needed.
      const post = await Post.create({
        user_id: userId,
        title,
        content,
        status: PostStatus.DRAFT,
        scheduled_for: scheduledFor,
        // Add a 'notes' or 'last_error' field to Post model to store failedReason?
      });
      logger.info(
        `${logPrefix} Saved post ${post.id} as DRAFT.` +
          (failedReason ? ` Reason: ${failedReason}` : "")
      );

      // Attach keywords to the draft post
      if (keywords.length > 0) {
        await this.generationService.attachKeywordsToPost(
          post.id,
          userId,
          keywords,
          null
        ); // No transaction
        logger.info(`${logPrefix} Attached keywords to draft post ${post.id}.`);
      }
    } catch (error) {
      logger.error(`${logPrefix} Failed to save post as draft:`, error);
    }
  }

  public async shutdown(): Promise<void> {
    logger.info("Shutting down HourlyGeneratePublishJob...");
    await this.redisClient.quit();
    logger.info("HourlyGeneratePublishJob shut down complete.");
  }
}

export default HourlyGeneratePublishJob;
