import Queue from "bull";
import logger from "./logger";

// Redis connection configuration
const redisConfig = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD || undefined,
};

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

// Create queues
export const postGenerationQueue = new Queue("post-generation", {
  redis: redisConfig,
  defaultJobOptions,
});

export const postPublishingQueue = new Queue("post-publishing", {
  redis: redisConfig,
  defaultJobOptions,
});

export const wordpressPublishQueue = new Queue("wordpress-publish", {
  redis: redisConfig,
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
