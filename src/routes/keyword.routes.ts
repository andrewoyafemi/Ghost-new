import express from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validation.middleware";
import {
  generateKeywords,
  getKeywords,
  getKeywordById,
  updateKeyword,
  deleteKeyword,
  bulkKeywordOperation,
  getKeywordSuggestions,
  getTrendingKeywords,
  getFrequentKeywords,
} from "../controllers/keyword.controller";
import {
  generateKeywordsValidation,
  updateKeywordValidation,
  bulkOperationValidation,
  keywordSearchValidation,
  keywordSuggestionsValidation,
} from "../validators/keyword.validators";

const router = express.Router();

// All keyword routes require authentication
router.use(authenticate);

// Generate keywords from content
router.post(
  "/generate",
  validate(generateKeywordsValidation),
  generateKeywords as unknown as express.RequestHandler
);

// Get keyword suggestions based on content
router.post(
  "/suggestions",
  validate(keywordSuggestionsValidation),
  getKeywordSuggestions as unknown as express.RequestHandler
);

// Get trending keywords across the platform
router.get(
  "/trending",
  getTrendingKeywords as unknown as express.RequestHandler
);

// Get frequently used keywords for a user
router.get(
  "/frequent",
  getFrequentKeywords as unknown as express.RequestHandler
);

// Get all keywords with filtering and pagination
router.get(
  "/",
  validate(keywordSearchValidation),
  getKeywords as unknown as express.RequestHandler
);

// Get keyword by ID
router.get("/:id", getKeywordById as unknown as express.RequestHandler);

// Update keyword
router.put(
  "/:id",
  validate(updateKeywordValidation),
  updateKeyword as unknown as express.RequestHandler
);

// Delete keyword
router.delete("/:id", deleteKeyword as unknown as express.RequestHandler);

// Bulk operations on keywords
router.post(
  "/bulk",
  validate(bulkOperationValidation),
  bulkKeywordOperation as unknown as express.RequestHandler
);

export default router;
