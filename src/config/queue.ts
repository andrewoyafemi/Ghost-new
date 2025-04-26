import Queue from "bull";
import logger from "./logger";
import dotenv from "dotenv";

dotenv.config();

// Updated Redis connection configuration to match the approach in redis.ts
const redisUrl =
  process.env.REDIS_URL || "redis://red-cvv7ccidbo4c73fhcd30:6379";

// Default queue options
const defaultJobOptions = {
  attempts: 3, // Retry failed jobs up to 3 times
  backoff: {
    // Exponential backoff for retries
    type: "exponential",
    delay: 5000, // Initial delay of 5 seconds
  },
  removeOnComplete: 100, // Keep the last 100 completed jobs
  removeOnFail: 200, // Keep the last 200 failed jobs
};

// Create queues using the Redis URL
export const postGenerationQueue = new Queue("post-generation", {
  redis: redisUrl,
  defaultJobOptions,
});

export const postPublishingQueue = new Queue("post-publishing", {
  redis: redisUrl,
  defaultJobOptions,
});

export const wordpressPublishQueue = new Queue("wordpress-publish", {
  redis: redisUrl,
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 5, // More retries for external service calls
  },
});

// Set up queue event listeners
const setupQueueEvents = (queue: Queue.Queue) => {
  queue.on("error", (error) => {
    logger.error(`Queue ${queue.name} error:`, error);
  });

  queue.on("failed", (job, error) => {
    logger.error(`Job ${job.id} in queue ${queue.name} failed:`, error);
  });

  queue.on("completed", (job) => {
    logger.info(`Job ${job.id} in queue ${queue.name} completed`);
  });
};

// Set up event listeners for all queues
setupQueueEvents(postGenerationQueue);
setupQueueEvents(postPublishingQueue);
setupQueueEvents(wordpressPublishQueue);

// Export the job queue manager
export default {
  postGenerationQueue,
  postPublishingQueue,
  wordpressPublishQueue,
};
