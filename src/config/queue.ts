import Queue from "bull";
import logger from "./logger";
import dotenv from "dotenv";

dotenv.config();

// // Updated Redis connection configuration to match the approach in redis.ts

// For production
// const redisUrl =
//   process.env.REDIS_URL || "redis://red-cvv7ccidbo4c73fhcd30:6379";

// For Development
const redisUrl = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD || undefined,
};

// Default queue options (can keep if other queues might exist later)
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
// Removed: postGenerationQueue
// Removed: postPublishingQueue
// Removed: wordpressPublishQueue

// Set up queue event listeners (can keep the function if other queues added later)
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
// Removed listeners for old queues

// Export the job queue manager
// Export an empty object or remove default export if no queues remain
export default {};
