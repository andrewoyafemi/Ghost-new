import { Job } from "bull";
import logger from "../../config/logger";
import {
  Post,
  User,
  BusinessProfile,
  PostKeyword,
  Keyword,
} from "../../models";
import { PostStatus } from "../../models/post.model";
import WordPressService from "../../services/wordpress.service";
import JobTrackingService from "../../services/job-tracking.service";
import { JobType } from "../../models/job-history.model";

// Job data type
interface WordPressPublishJobData {
  postId: number;
  userId: number;
  wpPostId: number | null;
  updatePostStatus?: boolean; // Flag to update post status after successful publishing
  lastError?: string; // Add optional lastError property
}

/**
 * Process a WordPress publishing job
 */
export async function processWordPressPublish(
  job: Job<WordPressPublishJobData>
): Promise<void> {
  const { postId, userId, wpPostId, updatePostStatus } = job.data;

  // Validate required job data fields
  if (postId === undefined || userId === undefined) {
    logger.error(`Invalid WordPress publish job data:`, job.data);
    await JobTrackingService.trackJobFailed(
      job.id.toString(),
      new Error(`Invalid job data: postId or userId is undefined`),
      job.attemptsMade
    );
    throw new Error(`Invalid job data: postId or userId is undefined`);
  }

  logger.info(
    `Processing WordPress publishing job ${job.id} for post ${postId}`
  );

  // Start tracking the job
  await JobTrackingService.trackJobStart(
    job,
    JobType.WORDPRESS_PUBLISH,
    userId
  );

  try {
    // Get the post and business profile
    const post = await Post.findByPk(postId);
    const user = await User.findByPk(userId, {
      include: [{ model: BusinessProfile, as: "businessProfile" }],
    });

    if (!post) {
      throw new Error(`Post ${postId} not found`);
    }

    if (!user || !user.businessProfile) {
      throw new Error(`User ${userId} or business profile not found`);
    }

    // Create WordPress service
    const wpService = new WordPressService(user.businessProfile);

    // Get keywords for the post (if needed for WordPress publishing)
    // Fetch keywords manually instead of using getKeywords()
    const postKeywords = await PostKeyword.findAll({
      where: { post_id: postId },
      include: [{ model: Keyword, as: "keyword" }],
    });
    const keywords = postKeywords
      .map((pk) => pk.keyword?.word)
      .filter(Boolean) as string[];

    let result;

    try {
      // If post already has a WordPress ID, update it
      if (wpPostId) {
        logger.info(`Updating existing WordPress post ${wpPostId}`);

        result = await wpService.updatePost(
          wpPostId,
          post.title,
          post.content,
          "publish"
        );

        logger.info(`Successfully updated WordPress post ${wpPostId}`);
      }
      // Otherwise, create a new WordPress post
      else {
        logger.info(`Creating new WordPress post for post ${postId}`);

        result = await wpService.publishPost(
          post.title || "New Post",
          post.content || "",
          "publish",
          keywords
        );

        // Extract the data property from the Axios response if needed
        const wpResponse = result.data ? result.data : result;
        logger.info(`This is the wordpress success response: ${wpResponse}`);
        if (wpResponse && wpResponse.id) {
          // Update post with WordPress IDs
          await post.update({
            wordpress_id: wpResponse.id,
            wordpress_url: wpResponse.link || null,
          });

          logger.info(
            `Successfully published to WordPress as post ${wpResponse.id}`
          );
        } else {
          logger.error(`Invalid WordPress API response:`, result);
          throw new Error("WordPress API returned invalid response");
        }
      }

      // If updatePostStatus flag is set, update the post status to PUBLISHED
      if (updatePostStatus) {
        await post.update({
          status: PostStatus.PUBLISHED,
          published_at: new Date(),
        });
        logger.info(
          `Updated post ${postId} status to PUBLISHED after successful WordPress publishing`
        );
      }

      // Complete job tracking with result using correct data format
      const wpResponseData = result.data ? result.data : result;
      await JobTrackingService.trackJobComplete(job.id.toString(), {
        postId,
        wpPostId: wpResponseData?.id || wpPostId,
        wpUrl: wpResponseData?.link,
        statusUpdated: updatePostStatus,
      });

      return;
    } catch (wpError: any) {
      // Specific error handling for WordPress API issues
      logger.error(`WordPress API error for post ${postId}:`, wpError);

      // Add lastError to job data directly instead of updating the job
      const updatedJobData = {
        ...job.data,
        lastError: wpError.message,
      };

      // Track job failure (but don't mark as failed if we still have retries)
      await JobTrackingService.trackJobFailed(
        job.id.toString(),
        wpError instanceof Error ? wpError : new Error(String(wpError)),
        job.attemptsMade
      );

      throw wpError;
    }
  } catch (error) {
    logger.error(`Failed to publish post ${postId} to WordPress:`, error);

    // Track job failure for unhandled errors
    if (!job.data.lastError) {
      await JobTrackingService.trackJobFailed(
        job.id.toString(),
        error instanceof Error ? error : new Error(String(error)),
        job.attemptsMade
      );
    }

    throw error; // Rethrow to trigger Bull's retry mechanism
  }
}
