import { wordpressPublishQueue } from "../config/queue";
import logger from "../config/logger";

async function cleanWordPressQueue() {
  try {
    logger.info("Starting WordPress queue cleanup...");

    // Get all waiting jobs
    const waitingJobs = await wordpressPublishQueue.getWaiting();

    // Track jobs that need to be removed
    let invalidJobsCount = 0;

    for (const job of waitingJobs) {
      // Check if job data is invalid
      if (
        !job.data ||
        job.data.postId === undefined ||
        job.data.userId === undefined
      ) {
        logger.warn(
          `Found invalid WordPress job ${job.id} with data:`,
          job.data
        );
        await job.remove();
        invalidJobsCount++;
      }
    }

    // Also check delayed jobs
    const delayedJobs = await wordpressPublishQueue.getDelayed();

    for (const job of delayedJobs) {
      // Check if job data is invalid
      if (
        !job.data ||
        job.data.postId === undefined ||
        job.data.userId === undefined
      ) {
        logger.warn(
          `Found invalid delayed WordPress job ${job.id} with data:`,
          job.data
        );
        await job.remove();
        invalidJobsCount++;
      }
    }

    logger.info(
      `Queue cleanup complete. Removed ${invalidJobsCount} invalid jobs.`
    );
  } catch (error) {
    logger.error("Error cleaning WordPress queue:", error);
  }
}

// Run the cleanup
cleanWordPressQueue()
  .then(() => {
    logger.info("Queue cleanup script completed");
    process.exit(0);
  })
  .catch((error) => {
    logger.error("Error in queue cleanup script:", error);
    process.exit(1);
  });
