import logger from "../config/logger";
import PostScheduler from "./post-scheduler.job";
import HourlyPostGenerator from "./daily-post-generator.job";
import { initializeWorkers, shutdownWorkers } from "./workers";
import PostCacheRefresher from "./post-cache-refresher.job";
import PostMinutePublisher from "./post-minute-publisher.job";
import "../listeners/post-event-listener"; // Import to ensure it's initialized

/**
 * Initialize all background jobs
 */
export const initializeJobs = (): void => {
  try {
    // Start post cache refresher to maintain the Redis cache
    PostCacheRefresher.start();

    // Start post minute publisher to check Redis for posts to publish each minute
    PostMinutePublisher.start();

    // Start hourly post generator to run at 10 minutes past every hour
    HourlyPostGenerator.start();

    // Initialize job workers to process queued jobs
    initializeWorkers();

    logger.info("Background jobs initialized successfully");
  } catch (error) {
    logger.error("Failed to initialize background jobs:", error);
  }
};

/**
 * Shutdown all jobs gracefully
 */
export const shutdownJobs = async (): Promise<void> => {
  try {
    // Shutdown workers first
    await shutdownWorkers();

    // Then shutdown the jobs
    await PostScheduler.shutdown();
    await PostCacheRefresher.shutdown();
    await PostMinutePublisher.shutdown();

    // No shutdown needed for HourlyPostGenerator as it uses the same Redis client
    // If needed, we could add a shutdown method later

    logger.info("Background jobs shut down successfully");
  } catch (error) {
    logger.error("Error shutting down background jobs:", error);
  }
};

export default {
  PostScheduler,
  HourlyPostGenerator,
  PostCacheRefresher,
  PostMinutePublisher,
  initializeJobs,
  shutdownJobs,
};
