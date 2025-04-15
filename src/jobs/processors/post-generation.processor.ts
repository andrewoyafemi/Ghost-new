import { Job } from "bull";
import logger from "../../config/logger";
import PostGenerationService from "../../services/post-generation.service";
import { EmailService } from "../../services/email.service";
import { User, UserPreference } from "../../models";
import JobTrackingService from "../../services/job-tracking.service";
import { JobType } from "../../models/job-history.model";

// Job data type
interface PostGenerationJobData {
  userId: number;
  scheduleDate: string;
  generateSocialCaptions: boolean;
}

/**
 * Process a post generation job
 */
export async function processPostGeneration(
  job: Job<PostGenerationJobData>
): Promise<void> {
  const { userId, scheduleDate, generateSocialCaptions } = job.data;

  logger.info(`Processing post generation job ${job.id} for user ${userId}`);

  // Start tracking the job
  await JobTrackingService.trackJobStart(job, JobType.POST_GENERATION, userId);

  try {
    // Generate the post
    const post = await PostGenerationService.generatePost(userId, {
      schedule: new Date(scheduleDate),
      generateSocialCaptions,
    });

    // Send notification if user has enabled it
    const user = await User.findByPk(userId, {
      include: [{ model: UserPreference, as: "preferences" }],
    });

    if (user?.preferences?.scheduling_notifications) {
      try {
        const emailService = new EmailService();
        await emailService.sendPostScheduledConfirmation(
          user,
          post.title || "New Post",
          new Date(scheduleDate)
        );
        logger.info(`Notification sent to ${user.email} for scheduled post`);
      } catch (emailError: unknown) {
        // Log the error but don't let it stop the process
        if (emailError instanceof Error) {
          logger.error(
            `Failed to send email notification: ${emailError.message}`
          );
        } else {
          logger.error(
            `Failed to send email notification: ${String(emailError)}`
          );
        }
        // Continue with post generation - don't throw this error
      }
    }

    logger.info(`Successfully generated post ${post.id} for user ${userId}`);

    // Complete job tracking with result
    await JobTrackingService.trackJobComplete(job.id.toString(), {
      postId: post.id,
      postTitle: post.title,
    });

    return;
  } catch (error) {
    logger.error(`Failed to generate post for user ${userId}:`, error);

    // Track job failure
    await JobTrackingService.trackJobFailed(
      job.id.toString(),
      error instanceof Error ? error : new Error(String(error)),
      job.attemptsMade
    );

    throw error; // Rethrow to trigger Bull's retry mechanism
  }
}
