import {
  postGenerationQueue,
  postPublishingQueue,
  wordpressPublishQueue,
} from "../config/queue";
import { processPostGeneration } from "./processors/post-generation.processor";
import { processPostPublishing } from "./processors/post-publishing.processor";
import { processWordPressPublish } from "./processors/wordpress-publish.processor";
import logger from "../config/logger";

/**
 * Initialize job queue workers
 */
export const initializeWorkers = (): void => {
  logger.info("Initializing job queue workers...");

  // Configure concurrency for each worker
  postGenerationQueue.process(3, processPostGeneration);
  postPublishingQueue.process(5, processPostPublishing);
  wordpressPublishQueue.process(2, processWordPressPublish);

  logger.info("Job queue workers initialized successfully");
};

/**
 * Graceful shutdown function for workers
 */
export const shutdownWorkers = async (): Promise<void> => {
  logger.info("Shutting down job queue workers...");

  // Close all queue connections
  await Promise.all([
    postGenerationQueue.close(),
    postPublishingQueue.close(),
    wordpressPublishQueue.close(),
  ]);

  logger.info("Job queue workers shut down successfully");
};

export default {
  initializeWorkers,
  shutdownWorkers,
};
