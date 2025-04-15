import { Job } from "bull";
import JobHistory, {
  JobStatus,
  JobType,
  JobHistoryCreationAttributes,
} from "../models/job-history.model";
import logger from "../config/logger";

/**
 * Service to track job execution and outcomes
 */
export class JobTrackingService {
  /**
   * Record a job starting execution
   */
  public async trackJobStart(
    job: Job,
    jobType: JobType,
    userId: number
  ): Promise<JobHistory> {
    try {
      const jobData: JobHistoryCreationAttributes = {
        job_id: job.id.toString(),
        job_type: jobType,
        user_id: userId,
        status: JobStatus.PROCESSING,
        data: job.data,
        started_at: new Date(),
        attempts: job.attemptsMade,
      };

      return await JobHistory.create(jobData);
    } catch (error) {
      logger.error(`Failed to track job start: ${error}`);
      // Return a minimal tracking record
      return {
        id: 0,
        job_id: job.id.toString(),
        job_type: jobType,
        user_id: userId,
        status: JobStatus.PROCESSING,
        data: job.data,
        result: null,
        error: null,
        attempts: job.attemptsMade,
        started_at: new Date(),
        completed_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      } as JobHistory;
    }
  }

  /**
   * Update a job tracking record with completion status and results
   */
  public async trackJobComplete(jobId: string, result: any): Promise<void> {
    try {
      const jobRecord = await JobHistory.findOne({
        where: { job_id: jobId },
        order: [["created_at", "DESC"]],
      });

      if (jobRecord) {
        await jobRecord.update({
          status: JobStatus.COMPLETED,
          result,
          completed_at: new Date(),
        });
      }
    } catch (error) {
      logger.error(`Failed to track job completion: ${error}`);
    }
  }

  /**
   * Update a job tracking record with failure status and error details
   */
  public async trackJobFailed(
    jobId: string,
    error: Error,
    attempts: number
  ): Promise<void> {
    try {
      const jobRecord = await JobHistory.findOne({
        where: { job_id: jobId },
        order: [["created_at", "DESC"]],
      });

      if (jobRecord) {
        await jobRecord.update({
          status: attempts < 3 ? JobStatus.RETRYING : JobStatus.FAILED,
          error: error.message,
          attempts,
          completed_at: new Date(),
        });
      }
    } catch (trackError) {
      logger.error(`Failed to track job failure: ${trackError}`);
    }
  }

  /**
   * Get job history for a specific user
   */
  public async getUserJobHistory(
    userId: number,
    limit: number = 100,
    offset: number = 0
  ): Promise<{ jobs: JobHistory[]; total: number }> {
    try {
      const { count, rows } = await JobHistory.findAndCountAll({
        where: { user_id: userId },
        order: [["created_at", "DESC"]],
        limit,
        offset,
      });

      return {
        jobs: rows,
        total: count,
      };
    } catch (error) {
      logger.error(`Failed to get user job history: ${error}`);
      return {
        jobs: [],
        total: 0,
      };
    }
  }
}

export default new JobTrackingService();
