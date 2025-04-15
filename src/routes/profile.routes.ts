import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validation.middleware";
import {
  getProfile,
  updateProfile,
  updateBusinessProfile,
  getWordPressSettings,
  updateWordPressSettings,
  deleteWordPressSettings,
  updatePassword,
  getPreferences,
  updatePreferences,
} from "../controllers/profile.controller";
import {
  updateProfileValidation,
  updateBusinessProfileValidation,
  updateWordPressValidation,
  updatePasswordValidation,
} from "../validators/profile.validators";

const router = Router();

// All profile routes require authentication
router.use(authenticate);

// User profile routes
router.get("/", getProfile);
router.put("/update", validate(updateProfileValidation), updateProfile);
router.put("/password", validate(updatePasswordValidation), updatePassword);

// Business profile routes
router.put(
  "/business",
  validate(updateBusinessProfileValidation),
  updateBusinessProfile
);

// WordPress integration routes
router.get("/wordpress", getWordPressSettings);
router.put(
  "/wordpress",
  validate(updateWordPressValidation),
  updateWordPressSettings
);
router.delete("/wordpress", deleteWordPressSettings);

// User preferences routes
router.get("/preferences", getPreferences);
router.put("/preferences", updatePreferences);

export default router;
