import {
  Router,
  Request,
  Response,
  NextFunction,
  RequestHandler,
} from "express";
import { PostController } from "../controllers/post.controller";
import { authenticate, authenticateJWT } from "../middlewares/auth.middleware";
import {
  checkFeatureAccess,
  checkPostAvailability,
  checkWordCountLimit,
} from "../middlewares/feature-flag.middleware";
import { validate } from "../middlewares/validation.middleware";
import {
  createPostValidation,
  updatePostValidation,
  generatePostValidation,
  schedulePostValidation,
} from "../utils/validation.utils";

const router = Router();
const postController = new PostController();

// Bind controller methods to preserve 'this' context
const boundController = {
  createPost: postController.createPost.bind(postController),
  updatePost: postController.updatePost.bind(postController),
  getPosts: postController.getPosts.bind(postController),
  generatePost: postController.generatePost.bind(postController),
  schedulePostGeneration:
    postController.schedulePostGeneration.bind(postController),
  testWordPressConnection:
    postController.testWordPressConnection.bind(postController),
};

// All routes require authentication
// router.use(authenticateJWT);

// Create post route with validation and feature checks
router.post(
  "/",
  validate(createPostValidation),
  checkWordCountLimit(),
  checkPostAvailability(),
  boundController.createPost as RequestHandler
);

// Update post route with validation and feature checks
router.put(
  "/:id",
  validate(updatePostValidation),
  checkWordCountLimit(),
  boundController.updatePost as RequestHandler
);

// Get a single post
// router.get("/:id", boundController.getPost as RequestHandler);

// Get all posts with optional filtering
router.get("/", authenticate, boundController.getPosts as RequestHandler);

// Delete a post
// router.delete("/:id", boundController.deletePost as RequestHandler);

// AI-based post generation
router.post(
  "/generate",
  authenticate,
  validate(generatePostValidation),
  // checkFeatureAccess("content.aiGeneration"),
  boundController.generatePost as RequestHandler
);

// Schedule post generation
router.post(
  "/schedule",
  validate(schedulePostValidation),
  checkFeatureAccess("content.scheduling"),
  boundController.schedulePostGeneration as RequestHandler
);

// Test WordPress connection
router.post(
  "/test-wordpress-connection",
  boundController.testWordPressConnection as RequestHandler
);

export default router;
