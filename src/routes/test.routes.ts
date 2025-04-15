import express from "express";
import { StripeService } from "../services/stripe.service";
import { Request, Response, NextFunction } from "express";

const router = express.Router();

/**
 * Test route for creating a Stripe checkout session
 * GET /api/v1/test/stripe-checkout
 */
router.get(
  "/stripe-checkout",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stripeService = new StripeService();
      const email = "test@example.com";
      const plan = "basic";

      const session = await stripeService.createCheckoutSession(email, plan);

      res.status(200).json({
        success: true,
        data: {
          sessionId: session.id,
          sessionUrl: session.url,
        },
        message: "Stripe checkout session created successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Test route for verifying a Stripe payment
 * GET /api/v1/test/verify-payment/:sessionId
 */
router.get(
  "/verify-payment/:sessionId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;
      const stripeService = new StripeService();

      const isPaymentComplete = await stripeService.verifyPayment(sessionId);
      const session = await stripeService.retrieveCheckoutSession(sessionId);

      res.status(200).json({
        success: true,
        data: {
          isPaymentComplete,
          sessionStatus: session.status,
          paymentStatus: session.payment_status,
        },
        message: isPaymentComplete
          ? "Payment has been completed successfully"
          : "Payment has not been completed yet",
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
