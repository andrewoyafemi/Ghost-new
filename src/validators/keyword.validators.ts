import { body, query, param } from "express-validator";

/**
 * Validation for generating keywords
 */
export const generateKeywordsValidation = [
  body("content")
    .notEmpty()
    .withMessage("Content is required")
    .isLength({ min: 10 })
    .withMessage("Content must be at least 10 characters long"),
  body("focusWords")
    .optional()
    .isArray()
    .withMessage("Focus words must be an array"),
  body("maxKeywords")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Max keywords must be between 1 and 50"),
  body("useAI")
    .optional()
    .isBoolean()
    .withMessage("useAI must be a boolean value"),
];

/**
 * Validation for getting keyword suggestions
 */
export const keywordSuggestionsValidation = [
  body("content")
    .notEmpty()
    .withMessage("Content is required")
    .isLength({ min: 10 })
    .withMessage("Content must be at least 10 characters long"),
  body("limit")
    .optional()
    .isInt({ min: 1, max: 30 })
    .withMessage("Limit must be between 1 and 30"),
];

/**
 * Validation for updating a keyword
 */
export const updateKeywordValidation = [
  param("id").isInt().withMessage("Invalid keyword ID"),
  body("word").optional().isString().withMessage("Word must be a string"),
  body("relevance")
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage("Relevance must be a number between 0 and 1"),
];

/**
 * Validation for bulk operations
 */
export const bulkOperationValidation = [
  body("operation")
    .notEmpty()
    .withMessage("Operation is required")
    .isIn(["delete", "update", "tag", "untag"])
    .withMessage("Operation must be one of: delete, update, tag, untag"),
  body("keywordIds")
    .notEmpty()
    .withMessage("Keyword IDs are required")
    .isArray({ min: 1 })
    .withMessage("At least one keyword ID is required"),
  body("data")
    .optional()
    .custom((value, { req }) => {
      const operation = req.body.operation;

      if (operation === "update" && (!value || value.relevance === undefined)) {
        throw new Error("Relevance is required for update operation");
      }

      if (operation === "tag" && (!value || !value.tagId)) {
        throw new Error("Tag ID is required for tag operation");
      }

      return true;
    }),
];

/**
 * Validation for keyword search
 */
export const keywordSearchValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  query("search").optional().isString().withMessage("Search must be a string"),
  query("sortBy")
    .optional()
    .isIn(["word", "relevance", "usage_count", "created_at"])
    .withMessage(
      "Sort by must be one of: word, relevance, usage_count, created_at"
    ),
  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Sort order must be either asc or desc"),
];
