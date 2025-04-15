import { Router } from "express";
import { authenticateJWT } from "../middlewares/auth.middleware";
import { checkFeatureAccess } from "../middlewares/feature-flag.middleware";
import wordpressController from "../controllers/wordpress.controller";

const router = Router();

// All routes require authentication
router.use(authenticateJWT);

// Test WordPress connection
// router.get("/test-connection", wordpressController.testConnection);

// // Publish post to WordPress - restricted by feature flag
// router.post(
//   "/publish/:postId",
//   checkFeatureAccess("content.autoPublish"),
//   wordpressController.publishToWordPress
// );

// // Update post on WordPress - restricted by feature flag
// router.put(
//   "/update/:postId",
//   checkFeatureAccess("content.autoPublish"),
//   wordpressController.updateWordPressPost
// );

export default router;
