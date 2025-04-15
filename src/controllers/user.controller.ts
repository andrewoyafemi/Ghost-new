// import JobTrackingService from '../services/job-tracking.service';

// /**
//  * Get current user's job history
//  */
// public async getJobHistory(req: RequestWithUser, res: Response, next: NextFunction): Promise<void> {
//   try {
//     const limit = parseInt(req.query.limit as string) || 100;
//     const offset = parseInt(req.query.offset as string) || 0;
    
//     const result = await JobTrackingService.getUserJobHistory(req.user!.id, limit, offset);
    
//     res.json({
//       status: 'success',
//       data: result,
//     });
//   } catch (error) {
//     next(error);
//   }
// } 