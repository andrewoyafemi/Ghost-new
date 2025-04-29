import logger from "../config/logger";
import PostCacheRefresher from "./post-cache-refresher.job";
import HourlyGeneratePublishJob from "./hourly-generate-publish.job";
import "../listeners/post-event-listener"; // Import to ensure it's initialized

// Instantiate the new job
const hourlyGeneratePublishJob = new HourlyGeneratePublishJob();

/**
 * Initialize all background jobs
 */
export const initializeJobs = (): void => {
  try {
    // Start post cache refresher to maintain the Redis cache
    PostCacheRefresher.start();

    // Start the new hourly generate & publish job
    hourlyGeneratePublishJob.start();

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
    // Shutdown the new job
    await hourlyGeneratePublishJob.shutdown();

    // Shutdown PostCacheRefresher (keep for now)
    await PostCacheRefresher.shutdown();

    // No shutdown needed for HourlyPostGenerator as it uses the same Redis client
    // If needed, we could add a shutdown method later

    logger.info("Background jobs shut down successfully");
  } catch (error) {
    logger.error("Error shutting down background jobs:", error);
  }
};

export default {
  PostCacheRefresher,
  hourlyGeneratePublishJob,
  initializeJobs,
  shutdownJobs,
};
