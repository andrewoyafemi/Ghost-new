import { Post } from "../models";
import { PostStatus } from "../models/post.model";
import logger from "../config/logger";
import { postEventEmitter, PostEventType } from "../events/post-events";
import postCacheRefresher from "../jobs/post-cache-refresher.job";

export class PostEventListener {
  constructor() {
    this.setupListeners();
    logger.info("Post event listener initialized");
  }

  /**
   * Set up event listeners for post events
   */
  private setupListeners(): void {
    // Listen for post scheduled events
    postEventEmitter.on(PostEventType.SCHEDULED, ({ post }) => {
      this.handlePostScheduled(post).catch((error) => {
        logger.error(
          `Error handling post scheduled event for post ${post.id}:`,
          error
        );
      });
    });

    // Listen for post update events
    postEventEmitter.on(PostEventType.UPDATED, ({ post }) => {
      this.handlePostUpdated(post).catch((error) => {
        logger.error(
          `Error handling post updated event for post ${post.id}:`,
          error
        );
      });
    });
  }

  /**
   * Handle a post being scheduled
   */
  private async handlePostScheduled(post: Post): Promise<void> {
    try {
      if (post.status === PostStatus.SCHEDULED && post.scheduled_for) {
        // Add to cache if it's in the next hour
        await postCacheRefresher.addPostToCache(post);
        logger.info(`Post ${post.id} scheduled event processed`);
      }
    } catch (error) {
      logger.error(`Error handling scheduled post ${post.id}:`, error);
    }
  }

  /**
   * Handle a post being updated
   */
  private async handlePostUpdated(post: Post): Promise<void> {
    try {
      if (post.status === PostStatus.SCHEDULED && post.scheduled_for) {
        // Update cache
        await postCacheRefresher.addPostToCache(post);
        logger.info(`Post ${post.id} update event processed`);
      }
    } catch (error) {
      logger.error(`Error handling updated post ${post.id}:`, error);
    }
  }
}

// Create and export a singleton instance
const postEventListener = new PostEventListener();
export default postEventListener;
