import { body } from "express-validator";

/**
 * Validation rules for updating user profile
 */
export const updateProfileValidation = [
  body("username")
    .optional()
    .isLength({ min: 3, max: 50 })
    .withMessage("Username must be between 3 and 50 characters")
    .trim(),
  body("email")
    .optional()
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail()
    .trim(),
];

/**
 * Validation rules for updating business profile
 */
export const updateBusinessProfileValidation = [
  body("businessName")
    .notEmpty()
    .withMessage("Business name is required")
    .isLength({ max: 255 })
    .withMessage("Business name must be less than 255 characters")
    .trim(),
  body("idealClient")
    .notEmpty()
    .withMessage("Ideal client description is required")
    .trim(),
  body("clientPromises")
    .notEmpty()
    .withMessage("Client promises are required")
    .isArray({ min: 1 })
    .withMessage("Client promises must be an array with at least one item"),
  body("clientExpectations")
    .notEmpty()
    .withMessage("Client expectations are required")
    .isArray({ min: 1 })
    .withMessage("Client expectations must be an array with at least one item"),
];

/**
 * Validation rules for updating WordPress settings
 */
export const updateWordPressValidation = [
  body("siteUrl")
    .optional({ nullable: true })
    .isURL()
    .withMessage("WordPress site URL must be a valid URL")
    .trim(),
  body("username")
    .optional({ nullable: true })
    .isLength({ min: 1, max: 255 })
    .withMessage("WordPress username must be between 1 and 255 characters")
    .trim(),
  body("apiKey")
    .optional({ nullable: true })
    .isLength({ min: 1, max: 255 })
    .withMessage("WordPress API key must be between 1 and 255 characters")
    .trim(),
];

/**
 * Validation rules for updating password
 */
export const updatePasswordValidation = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required"),
  body("newPassword")
    .notEmpty()
    .withMessage("New password is required")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/[a-z]/)
    .withMessage("Password must contain at least one lowercase letter")
    .matches(/[A-Z]/)
    .withMessage("Password must contain at least one uppercase letter")
    .matches(/[0-9]/)
    .withMessage("Password must contain at least one number")
    .matches(/[!@#$%^&*]/)
    .withMessage(
      "Password must contain at least one special character (!@#$%^&*)"
    ),
];
