import { body } from "express-validator";
import { PostStatus } from "../models/post.model";

/**
 * Validation schema for post creation
 */
export const createPostValidation = [
  body("title")
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ min: 3, max: 255 })
    .withMessage("Title must be between 3 and 255 characters")
    .trim(),

  body("content")
    .notEmpty()
    .withMessage("Content is required")
    .isLength({ min: 10 })
    .withMessage("Content must be at least 10 characters")
    .trim(),

  body("status")
    .optional()
    .isIn(Object.values(PostStatus))
    .withMessage(
      `Status must be one of: ${Object.values(PostStatus).join(", ")}`
    )
    .trim(),

  body("scheduled_for")
    .optional({ nullable: true })
    .isISO8601()
    .withMessage("Scheduled date must be a valid ISO 8601 date")
    .custom((value, { req }) => {
      if (req.body.status === PostStatus.SCHEDULED && !value) {
        throw new Error("Scheduled date is required when status is scheduled");
      }

      if (value && new Date(value) < new Date()) {
        throw new Error("Scheduled date must be in the future");
      }

      return true;
    }),

  body("keywords")
    .optional()
    .isArray()
    .withMessage("Keywords must be an array"),

  body("keywords.*")
    .optional()
    .isString()
    .withMessage("Each keyword must be a string")
    .trim(),
];

/**
 * Validation schema for post update
 */
export const updatePostValidation = [
  body("title")
    .optional()
    .isLength({ min: 3, max: 255 })
    .withMessage("Title must be between 3 and 255 characters")
    .trim(),

  body("content")
    .optional()
    .isLength({ min: 10 })
    .withMessage("Content must be at least 10 characters")
    .trim(),

  body("status")
    .optional()
    .isIn(Object.values(PostStatus))
    .withMessage(
      `Status must be one of: ${Object.values(PostStatus).join(", ")}`
    )
    .trim(),

  body("scheduled_for")
    .optional({ nullable: true })
    .isISO8601()
    .withMessage("Scheduled date must be a valid ISO 8601 date")
    .custom((value, { req }) => {
      if (req.body.status === PostStatus.SCHEDULED && !value) {
        throw new Error("Scheduled date is required when status is scheduled");
      }

      if (value && new Date(value) < new Date()) {
        throw new Error("Scheduled date must be in the future");
      }

      return true;
    }),

  body("keywords")
    .optional()
    .isArray()
    .withMessage("Keywords must be an array"),

  body("keywords.*")
    .optional()
    .isString()
    .withMessage("Each keyword must be a string")
    .trim(),
];

/**
 * Validation schema for AI post generation
 */
export const generatePostValidation = [
  body("keywords")
    .optional()
    .isArray()
    .withMessage("Keywords must be an array")
    .custom((value) => {
      if (value && value.length > 10) {
        throw new Error("Maximum 10 keywords allowed");
      }
      return true;
    }),

  body("saveAsDraft")
    .optional()
    .isBoolean()
    .withMessage("saveAsDraft must be a boolean"),

  body("scheduledFor")
    .optional()
    .isISO8601()
    .withMessage("scheduledFor must be a valid ISO 8601 date")
    .custom((value) => {
      if (value && new Date(value) < new Date()) {
        throw new Error("Scheduled date must be in the future");
      }
      return true;
    }),

  body("generateSocialCaptions")
    .optional()
    .isBoolean()
    .withMessage("generateSocialCaptions must be a boolean"),
];

/**
 * Validation schema for scheduling post generation
 */
export const schedulePostValidation = [
  body("scheduledTimes")
    .isObject()
    .withMessage("scheduledTimes must be an object")
    .custom((value) => {
      const daysOfWeek = [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ];

      // Check if all keys are valid days of week
      const invalidDays = Object.keys(value).filter(
        (day) => !daysOfWeek.includes(day.toLowerCase())
      );

      if (invalidDays.length > 0) {
        throw new Error(
          `Invalid days in scheduledTimes: ${invalidDays.join(", ")}`
        );
      }

      // Check if values are arrays of time strings in HH:MM format
      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
      for (const [day, times] of Object.entries(value)) {
        if (!Array.isArray(times)) {
          throw new Error(`Times for ${day} must be an array`);
        }

        const invalidTimes = times.filter(
          (time) => typeof time !== "string" || !timeRegex.test(time)
        );

        if (invalidTimes.length > 0) {
          throw new Error(
            `Invalid times for ${day}: ${invalidTimes.join(
              ", "
            )}. Format should be HH:MM`
          );
        }
      }

      return true;
    }),
];
