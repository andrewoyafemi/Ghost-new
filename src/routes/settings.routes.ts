import express, { Response, RequestHandler } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validation.middleware";
import { AuthRequest } from "../types/auth.types";

// Import setting controllers
import {
  getProfileSettings,
  updateProfileSettings,
  updatePassword,
} from "../controllers/settings/profile.controller";

import {
  getPostSettings,
  updatePostSettings,
} from "../controllers/settings/posts.controller";

import {
  getPlanDetails,
  updatePlan,
  getBillingHistory,
  updatePaymentMethod,
  cancelSubscription,
} from "../controllers/settings/billing.controller";

// Import validators
import { updatePasswordValidation } from "../validators/profile.validators";

import { updatePostSettingsValidation } from "../validators/settings.validators";

import {
  updatePlanValidation,
  updatePaymentMethodValidation,
} from "../validators/billing.validators";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Profile settings routes
router.get("/profile", getProfileSettings as unknown as RequestHandler);
router.put("/profile", updateProfileSettings as unknown as RequestHandler);
router.put(
  "/profile/password",
  validate(updatePasswordValidation),
  updatePassword as unknown as RequestHandler
);

// Post settings routes
router.get("/posts", getPostSettings as unknown as RequestHandler);
router.put(
  "/posts",
  validate(updatePostSettingsValidation),
  updatePostSettings as unknown as RequestHandler
);

// Billing and plan routes
router.get("/plan", getPlanDetails as unknown as RequestHandler);
router.put(
  "/plan",
  validate(updatePlanValidation),
  updatePlan as unknown as RequestHandler
);
router.get("/billing/history", getBillingHistory as unknown as RequestHandler);
router.put(
  "/billing/payment-method",
  validate(updatePaymentMethodValidation),
  updatePaymentMethod as unknown as RequestHandler
);
router.post("/billing/cancel", cancelSubscription as unknown as RequestHandler);

export default router;
