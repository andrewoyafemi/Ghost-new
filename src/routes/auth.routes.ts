import express from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validation.middleware";
import {
  login,
  register,
  logout,
  refreshToken,
  forgotPassword,
  resetPassword,
  completeProfile,
  completeRegistration,
  checkEmailExists,
  completeProfileAfterRegistration,
} from "../controllers/auth.controller";
import {
  loginSchema,
  registerSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  completeProfileSchema,
  completeRegistrationSchema,
  completeProfileAfterRegistrationSchema,
} from "../validators/auth.validator";

const router = express.Router();

// Authentication routes
router.post("/login", validate(loginSchema), login);
router.post("/register", validate(registerSchema), register);
router.post(
  "/complete-registration",
  validate(completeRegistrationSchema),
  completeRegistration
);
router.post("/logout", logout);
router.post("/refresh-token", validate(refreshTokenSchema), refreshToken);
router.post("/forgot-password", validate(forgotPasswordSchema), forgotPassword);
router.post("/reset-password", validate(resetPasswordSchema), resetPassword);
router.post(
  "/complete-profile",
  authenticate,
  validate(completeProfileSchema),
  completeProfile
);

// Add the route for checking if email exists
router.post("/check-email-exists", checkEmailExists);

// Add the route for completing profile after registration (no auth required)
router.post(
  "/complete-profile-after-registration",
  validate(completeProfileAfterRegistrationSchema),
  completeProfileAfterRegistration
);

export default router;
