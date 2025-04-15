import { Router } from "express";
import stripeController from "../controllers/stripe.controller";
import { authenticateJWT } from "../middlewares/auth.middleware";

const router = Router();

// Routes that require authentication
router.post(
  "/create-checkout-session",
  authenticateJWT,
  stripeController.createCheckoutSession
);

// Public routes (no authentication required)
router.get("/verify-session/:sessionId", stripeController.verifySession);

// Webhook doesn't need authentication - it's called by Stripe
router.post("/webhook", stripeController.handleWebhook);

export default router;
