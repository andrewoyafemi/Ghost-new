import { body } from "express-validator";

/**
 * Login validation schema
 */
export const loginSchema = [
  body("email")
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Invalid email format"),
  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long"),
];

/**
 * Registration validation schema
 */
export const registerSchema = [
  body("email")
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Invalid email format"),
  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[a-zA-Z]).{8,}$/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),
  body("plan")
    .notEmpty()
    .withMessage("Plan is required")
    .isIn(["free", "basic", "standard", "premium"])
    .withMessage(
      "Invalid plan. Must be one of: free, basic, standard, premium"
    ),
];

/**
 * Complete registration validation schema
 */
export const completeRegistrationSchema = [
  body("registrationToken")
    .notEmpty()
    .withMessage("Registration token is required"),
];

/**
 * Refresh token validation schema
 */
export const refreshTokenSchema = [
  body("refreshToken").notEmpty().withMessage("Refresh token is required"),
];

/**
 * Forgot password validation schema
 */
export const forgotPasswordSchema = [
  body("email")
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Invalid email format"),
];

/**
 * Reset password validation schema
 */
export const resetPasswordSchema = [
  body("token").notEmpty().withMessage("Reset token is required"),
  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[a-zA-Z]).{8,}$/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),
];

/**
 * Complete profile validation schema
 */
export const completeProfileSchema = [
  body("businessName").notEmpty().withMessage("Business name is required"),
  body("idealClient")
    .notEmpty()
    .withMessage("Ideal client description is required"),
  body("clientPromises")
    .isArray()
    .withMessage("Client promises must be an array"),
  body("clientExpectations")
    .isArray()
    .withMessage("Client expectations must be an array"),
  body("wordpressDetails.apiKey")
    .optional()
    .isString()
    .withMessage("WordPress API key must be a string"),
  body("wordpressDetails.siteUrl")
    .optional()
    .isURL()
    .withMessage("WordPress site URL must be a valid URL"),
  body("wordpressDetails.username")
    .optional()
    .isString()
    .withMessage("WordPress username must be a string"),
];

/**
 * Complete profile after registration validation schema
 */
export const completeProfileAfterRegistrationSchema = [
  body("registrationToken")
    .notEmpty()
    .withMessage("Registration token is required"),
  body("businessName").notEmpty().withMessage("Business name is required"),
  body("idealClient")
    .notEmpty()
    .withMessage("Ideal client description is required"),
  body("clientPromises").notEmpty().withMessage("Client promises are required"),
  body("clientExpectations")
    .notEmpty()
    .withMessage("Client expectations are required"),
  body("wordpressSiteUrl")
    .notEmpty()
    .withMessage("WordPress site URL is required")
    .isURL()
    .withMessage("WordPress site URL must be a valid URL"),
  body("wordpressUsername")
    .notEmpty()
    .withMessage("WordPress username is required"),
  body("wordpressApiKey")
    .notEmpty()
    .withMessage("WordPress API key is required"),
];
