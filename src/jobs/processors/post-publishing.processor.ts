import { Job } from "bull";
import { Post, User, BusinessProfile } from "../../models";
import { PostStatus } from "../../models/post.model";
import logger from "../../config/logger";
import { WordPressService } from "../../services/wordpress.service";

// Type for Post with includes
interface PostWithIncludes extends Post {
  user?: User & {
    businessProfile?: BusinessProfile;
  };
}

/**
 * Process a post publishing job
 */
export async function processPostPublishing(
  job: Job<{ postId: number }>
): Promise<void> {
  const { postId } = job.data;
  logger.info(`Starting post publishing process for post ${postId}`);

  try {
    // Get post with all necessary relations
    const post = (await Post.findByPk(postId, {
      include: [
        {
          model: User,
          as: "user",
          include: [
            {
              model: BusinessProfile,
              as: "businessProfile",
            },
          ],
        },
      ],
    })) as PostWithIncludes;

    if (!post) {
      logger.error(`Post ${postId} not found`);
      throw new Error(`Post ${postId} not found`);
    }

    logger.info(`Found post ${postId}:`, {
      title: post.title,
      status: post.status,
      scheduledFor: post.scheduled_for?.toISOString(),
      hasWordPressIntegration:
        post.user?.businessProfile?.hasWordPressIntegration(),
      wordpressId: post.wordpress_id,
    });

    // Check if post is already published
    if (post.status === PostStatus.PUBLISHED) {
      logger.info(`Post ${postId} is already published, skipping`);
      return;
    }

    // Check if post is scheduled for future (using UTC comparison)
    if (post.scheduled_for && new Date(post.scheduled_for) > new Date()) {
      logger.info(
        `Post ${postId} is scheduled for future (${post.scheduled_for.toISOString()}), skipping`
      );
      return;
    }

    // Check WordPress integration
    const businessProfile = post.user?.businessProfile;
    if (!businessProfile?.hasWordPressIntegration()) {
      logger.info(`Post ${postId} has no WordPress integration, skipping`);
      return;
    }

    // Create WordPress service
    const wpService = new WordPressService(businessProfile);

    logger.info(`WordPress integration found for post ${postId}:`, {
      siteUrl: businessProfile.wordpress_site_url,
      hasValidToken: !!businessProfile.wordpress_api_key,
    });

    // Get post keywords
    const postKeywords = await post.getPostKeywords();
    const keywords = postKeywords
      .map((pk) => pk.keyword?.word)
      .filter(Boolean) as string[];

    // Prepare post data for WordPress
    const postData = {
      title: post.title,
      content: post.content,
      status: "publish" as const,
      date: post.scheduled_for?.toISOString() || new Date().toISOString(),
    };

    logger.info(`Publishing post ${postId} to WordPress:`, postData);

    // Publish to WordPress
    const wpResponse = await wpService.publishPost(
      postData.title,
      postData.content,
      postData.status,
      keywords
    );

    // Extract response data - the executeWithRetry function returns an axios response
    // The actual WordPress post data is in the 'data' property of the axios response
    const result = wpResponse?.data;

    logger.info(`WordPress response for post ${postId}:`, {
      responseStatus: wpResponse?.status,
      responseId: result?.id,
      responseLink: result?.link,
      fullResponse: JSON.stringify(result),
    });

    if (result && result.id) {
      // Update post status with WordPress data from response
      await post.update({
        status: PostStatus.PUBLISHED,
        published_at: new Date(),
        wordpress_id: result.id,
        wordpress_url: result.link,
      });

      logger.info(
        `Post ${postId} published successfully to WordPress with ID ${result.id}`
      );
    } else {
      throw new Error("Failed to get valid WordPress post ID from response");
    }
  } catch (error) {
    logger.error(`Error publishing post ${postId}:`, {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      response:
        error instanceof Error && "response" in error
          ? (error as any).response?.data
          : undefined,
    });
    throw error;
  }
}
