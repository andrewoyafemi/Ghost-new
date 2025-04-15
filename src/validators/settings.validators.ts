import { body } from "express-validator";

/**
 * Validation rules for updating post settings
 */
export const updatePostSettingsValidation = [
  body("default_keywords")
    .optional()
    .isArray()
    .withMessage("Default keywords must be an array"),

  body("scheduling.enabled")
    .optional()
    .isBoolean()
    .withMessage("Scheduling enabled flag must be a boolean"),

  body("scheduling.max_days")
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage("Max schedule days must be between 1 and 365"),

  body("scheduling.max_times_per_day")
    .optional()
    .isInt({ min: 1, max: 24 })
    .withMessage("Max times per day must be between 1 and 24"),

  body("scheduling.scheduled_times")
    .optional()
    .isObject()
    .withMessage("Scheduled times must be an object"),

  body("content.selected_tones")
    .optional()
    .isArray()
    .withMessage("Selected tones must be an array"),

  body("notifications.email")
    .optional()
    .isBoolean()
    .withMessage("Email notifications flag must be a boolean"),

  body("notifications.desktop")
    .optional()
    .isBoolean()
    .withMessage("Desktop notifications flag must be a boolean"),

  body("notifications.scheduling")
    .optional()
    .isBoolean()
    .withMessage("Scheduling notifications flag must be a boolean"),
];
