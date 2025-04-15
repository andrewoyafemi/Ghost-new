import { Request, Response, NextFunction } from "express";
import { StripeService } from "../services/stripe.service";
import { ApiError } from "../middlewares/error.middleware";
import { SuccessResponse } from "../utils/responses";
import logger from "../config/logger";
import { User, Subscription, BillingTransaction } from "../models";
import {
  SubscriptionStatus,
  PaymentStatus,
  BillingCycle,
} from "../models/subscription.model";
import Stripe from "stripe";
import sequelize from "../config/database";

// Define transaction type since it's missing in the model
enum TransactionType {
  PAYMENT = "payment",
  RENEWAL = "renewal",
  REFUND = "refund",
}

class StripeController {
  private stripeService: StripeService;
  private webhookSecret: string;

  constructor() {
    this.stripeService = new StripeService();
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
  }

  /**
   * Create a checkout session for subscription purchase
   */
  public createCheckoutSession = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        next(new ApiError(401, "Authentication required"));
        return;
      }

      const { plan } = req.body;

      if (!plan) {
        next(new ApiError(400, "Plan is required"));
        return;
      }

      const stripeSession = await this.stripeService.createCheckoutSession(
        req.user.email,
        plan
      );

      res.status(200).json(
        SuccessResponse(
          {
            sessionId: stripeSession.id,
            sessionUrl: stripeSession.url,
          },
          "Checkout session created successfully"
        )
      );
    } catch (error) {
      logger.error("Error creating checkout session:", error);
      next(error);
    }
  };

  /**
   * Verify a checkout session by ID
   */
  public verifySession = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { sessionId } = req.params;

      if (!sessionId) {
        next(new ApiError(400, "Session ID is required"));
        return;
      }

      // Retrieve the session
      const session = await this.stripeService.retrieveCheckoutSession(
        sessionId
      );

      // Check if this is for a new registration (temporary registration)
      const tempRegistration =
        (await sequelize.models.TemporaryRegistration.findOne({
          where: { stripe_session_id: sessionId },
        })) as any; // Cast to any to resolve typing issue

      res.status(200).json(
        SuccessResponse(
          {
            status: session.payment_status,
            customer: session.customer,
            isNewRegistration: !!tempRegistration,
            email: tempRegistration?.email || session.customer_email,
          },
          "Session verified successfully"
        )
      );
    } catch (error) {
      logger.error("Error verifying session:", error);
      next(error);
    }
  };

  /**
   * Handle Stripe webhook events
   */
  public handleWebhook = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    // Get the signature from the headers
    const signature = req.headers["stripe-signature"];

    if (!signature) {
      logger.error("Webhook signature missing from headers");
      res.status(400).json({
        success: false,
        error: "Webhook signature missing",
      });
      return;
    }

    let event: Stripe.Event;

    try {
      // Use the raw body for signature verification
      const rawBody = (req as any).rawBody;
      if (!rawBody) {
        logger.error("Raw body missing for webhook verification");
        res.status(400).json({
          success: false,
          error:
            "Raw request body is required for webhook signature verification",
        });
        return;
      }

      // Log payload size for debugging
      logger.debug(
        `Webhook payload size: ${
          Buffer.isBuffer(rawBody) ? rawBody.length : "unknown"
        } bytes`
      );

      // Construct the event with the raw body (we ensure this is a buffer in our middleware)
      event = this.stripeService.constructWebhookEvent(
        rawBody,
        Array.isArray(signature) ? signature[0] : signature
      );

      logger.info(
        `✅ Webhook verified successfully: ${event.type}, id: ${event.id}`
      );
    } catch (err: any) {
      logger.error(`❌ Webhook signature verification failed: ${err.message}`);
      res.status(400).json({
        success: false,
        error: `Webhook verification failed: ${err.message}`,
      });
      return;
    }

    // Handle the event based on its type
    try {
      switch (event.type) {
        case "checkout.session.completed":
          await this.handleCheckoutSessionCompleted(event);
          break;
        case "invoice.payment_succeeded":
          await this.handleInvoicePaymentSucceeded(event);
          break;
        case "invoice.payment_failed":
          await this.handleInvoicePaymentFailed(event);
          break;
        case "customer.subscription.updated":
          await this.handleSubscriptionUpdated(event);
          break;
        case "customer.subscription.deleted":
          await this.handleSubscriptionDeleted(event);
          break;
        default:
          logger.info(`Unhandled event type: ${event.type}`);
      }

      // Return a 200 response to acknowledge receipt of the event
      res.status(200).json({ received: true });
    } catch (error) {
      // Enhanced error logging
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const errorStack = error instanceof Error ? error.stack : "";

      logger.error(`Error processing webhook event ${event.type}:`, {
        error: errorMessage,
        stack: errorStack,
        eventId: event.id,
        eventType: event.type,
        timestamp: new Date().toISOString(),
      });

      // Log to monitoring service if available
      if (process.env.NODE_ENV === "production") {
        // TODO: Implement integration with monitoring service
        // e.g., Sentry, New Relic, etc.
        // monitoringService.captureException(error, {
        //   extra: { eventId: event.id, eventType: event.type }
        // });
      }

      // Still return 200 to acknowledge receipt (Stripe will retry if we return an error status)
      res.status(200).json({
        received: true,
        processed: false,
        error: "An error occurred while processing the webhook",
      });
    }
  };

  /**
   * Handle checkout.session.completed event
   */
  private handleCheckoutSessionCompleted = async (event: Stripe.Event) => {
    const session = event.data.object as Stripe.Checkout.Session;

    // First, check if this is for a new registration (temporary registration)
    const tempRegistration =
      await sequelize.models.TemporaryRegistration.findOne({
        where: { stripe_session_id: session.id },
      });

    if (tempRegistration) {
      // Process the new registration immediately after payment success
      logger.info(
        `Processing checkout session for new registration: ${session.id}`
      );

      // Only proceed if payment status is paid
      if (session.payment_status !== "paid") {
        logger.warn(
          `Payment status is ${session.payment_status}, not creating user account yet`
        );
        return;
      }

      // Start a transaction to ensure all database operations succeed or fail together
      const transaction = await sequelize.transaction();

      try {
        // Create the user account from temporary registration data
        const tempRegData = tempRegistration.get({ plain: true });

        const newUser = await User.create(
          {
            email: tempRegData.email,
            username: tempRegData.email.split("@")[0], // Default username from email
            password: tempRegData.password_hash, // Use password_hash as password (it's already hashed)
            plan: tempRegData.plan,
            email_verified: false, // Will be verified when user completes profile
            created_at: new Date(),
            updated_at: new Date(),
          },
          { transaction }
        );

        // Create subscription for the new user
        const subscription = await Subscription.create(
          {
            user_id: newUser.id,
            stripe_subscription_id: session.subscription as string,
            stripe_customer_id: session.customer as string,
            plan: tempRegData.plan,
            status: SubscriptionStatus.ACTIVE,
            billing_cycle: BillingCycle.MONTHLY, // Default billing cycle
            payment_status: PaymentStatus.PAID,
            current_period_start: new Date(),
            current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          },
          { transaction }
        );

        // Record billing transaction
        await BillingTransaction.create(
          {
            user_id: newUser.id,
            amount: session.amount_total ? session.amount_total / 100 : 0, // Convert from cents
            currency: session.currency || "usd",
            status: PaymentStatus.PAID,
            description: `Initial payment for ${tempRegData.plan} plan subscription`,
            transaction_date: new Date(),
            stripe_payment_intent_id: session.payment_intent as string,
          },
          { transaction }
        );

        // Mark the temporary registration as processed
        await sequelize.models.TemporaryRegistration.update(
          {
            completed: true,
            completed_at: new Date(),
          },
          {
            where: { id: tempRegistration.get("id") },
            transaction,
          }
        );

        // Commit the transaction
        await transaction.commit();

        logger.info(
          `Successfully created user account for email: ${tempRegData.email}`
        );

        // TODO: Send welcome email to user
        // This would call an email service to send welcome email

        return;
      } catch (error) {
        // Rollback transaction if there was an error
        await transaction.rollback();
        logger.error(
          "Error creating user account after payment success:",
          error
        );
        return;
      }
    }

    // Otherwise, this is for an existing user subscription
    if (!session.customer || !session.subscription) {
      logger.error(
        "Checkout session completed but missing customer or subscription ID"
      );
      return;
    }

    // Get customer email from session
    const customerEmail = session.customer_email || "";

    if (!customerEmail) {
      logger.error("Checkout session completed but missing customer email");
      return;
    }

    // Find user by email
    const user = await User.findOne({ where: { email: customerEmail } });

    if (!user) {
      logger.error(
        `User with email ${customerEmail} not found for checkout session ${session.id}`
      );
      return;
    }

    // Determine plan from metadata or line items
    // In a real app, you would get this from the product/price mapping
    const plan = "standard"; // This should be dynamically determined

    // Update or create subscription
    const subscription = await Subscription.findOne({
      where: { user_id: user.id },
    });

    const transaction = await sequelize.transaction();

    try {
      if (subscription) {
        // Update existing subscription
        subscription.stripe_subscription_id = session.subscription as string;
        subscription.stripe_customer_id = session.customer as string;
        subscription.plan = plan;
        subscription.status = SubscriptionStatus.ACTIVE;
        subscription.current_period_start = new Date();
        subscription.current_period_end = new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        ); // 30 days
        subscription.billing_cycle = BillingCycle.MONTHLY; // Default billing cycle
        subscription.payment_status = PaymentStatus.PAID;

        await subscription.save({ transaction });
      } else {
        // Create new subscription
        await Subscription.create(
          {
            user_id: user.id,
            stripe_subscription_id: session.subscription as string,
            stripe_customer_id: session.customer as string,
            plan: plan,
            status: SubscriptionStatus.ACTIVE,
            billing_cycle: BillingCycle.MONTHLY, // Default billing cycle
            payment_status: PaymentStatus.PAID,
            current_period_start: new Date(),
            current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          },
          { transaction }
        );
      }

      // Record a transaction
      await BillingTransaction.create(
        {
          user_id: user.id,
          amount: session.amount_total ? session.amount_total / 100 : 0, // Convert from cents
          currency: session.currency || "usd",
          status: PaymentStatus.PAID,
          description: `Payment for ${plan} plan subscription`,
          transaction_date: new Date(),
          stripe_payment_intent_id: session.payment_intent as string,
        },
        { transaction }
      );

      // Update user plan
      user.plan = plan;
      await user.save({ transaction });

      await transaction.commit();
      logger.info(`Subscription created/updated for user ${user.id}`);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  };

  /**
   * Handle invoice.payment_succeeded event
   */
  private handleInvoicePaymentSucceeded = async (event: Stripe.Event) => {
    const invoice = event.data.object as Stripe.Invoice;

    if (!invoice.subscription || !invoice.customer) {
      logger.error(
        "Invoice payment succeeded but missing subscription or customer ID"
      );
      return;
    }

    // Find subscription by Stripe subscription ID
    const subscription = await Subscription.findOne({
      where: { stripe_subscription_id: invoice.subscription as string },
    });

    if (!subscription) {
      logger.error(`Subscription not found for invoice ${invoice.id}`);
      return;
    }

    const transaction = await sequelize.transaction();

    try {
      // Update subscription dates
      subscription.current_period_start = new Date(invoice.period_start * 1000);
      subscription.current_period_end = new Date(invoice.period_end * 1000);
      subscription.status = SubscriptionStatus.ACTIVE;
      subscription.payment_status = PaymentStatus.PAID;

      await subscription.save({ transaction });

      // Record a transaction
      await BillingTransaction.create(
        {
          user_id: subscription.user_id,
          amount: invoice.amount_paid / 100, // Convert from cents
          currency: invoice.currency,
          status: PaymentStatus.PAID,
          description: `Renewal for ${subscription.plan} plan subscription`,
          transaction_date: new Date(),
          stripe_payment_intent_id: invoice.payment_intent as string,
          stripe_invoice_id: invoice.id,
        },
        { transaction }
      );

      await transaction.commit();
      logger.info(`Subscription renewed for user ${subscription.user_id}`);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  };

  /**
   * Handle invoice.payment_failed event
   */
  private handleInvoicePaymentFailed = async (event: Stripe.Event) => {
    const invoice = event.data.object as Stripe.Invoice;

    if (!invoice.subscription || !invoice.customer) {
      logger.error(
        "Invoice payment failed but missing subscription or customer ID"
      );
      return;
    }

    // Find subscription by Stripe subscription ID
    const subscription = await Subscription.findOne({
      where: { stripe_subscription_id: invoice.subscription as string },
    });

    if (!subscription) {
      logger.error(`Subscription not found for invoice ${invoice.id}`);
      return;
    }

    // Update subscription status
    subscription.status = SubscriptionStatus.PAST_DUE;
    subscription.payment_status = PaymentStatus.FAILED;
    await subscription.save();

    // Record a transaction
    await BillingTransaction.create({
      user_id: subscription.user_id,
      amount: invoice.amount_due / 100, // Convert from cents
      currency: invoice.currency,
      status: PaymentStatus.FAILED,
      description: `Failed payment for ${subscription.plan} plan subscription`,
      transaction_date: new Date(),
      stripe_invoice_id: invoice.id,
    });

    // You would typically notify the user here
    logger.info(
      `Payment failed for subscription of user ${subscription.user_id}`
    );
  };

  /**
   * Handle customer.subscription.updated event
   */
  private handleSubscriptionUpdated = async (event: Stripe.Event) => {
    const stripeSubscription = event.data.object as Stripe.Subscription;

    // Find subscription by Stripe subscription ID
    const subscription = await Subscription.findOne({
      where: { stripe_subscription_id: stripeSubscription.id as string },
    });

    if (!subscription) {
      logger.error(
        `Subscription not found for Stripe subscription ${stripeSubscription.id}`
      );
      return;
    }

    // Update subscription status based on Stripe status
    let status: SubscriptionStatus;
    switch (stripeSubscription.status) {
      case "active":
        status = SubscriptionStatus.ACTIVE;
        break;
      case "past_due":
        status = SubscriptionStatus.PAST_DUE;
        break;
      case "canceled":
        status = SubscriptionStatus.CANCELLED;
        break;
      default:
        status = SubscriptionStatus.EXPIRED; // Use EXPIRED instead of INACTIVE
    }

    // Update subscription
    subscription.status = status;
    subscription.cancel_at_period_end = stripeSubscription.cancel_at_period_end;

    // Update period dates if available
    if (stripeSubscription.current_period_start) {
      subscription.current_period_start = new Date(
        stripeSubscription.current_period_start * 1000
      );
    }

    if (stripeSubscription.current_period_end) {
      subscription.current_period_end = new Date(
        stripeSubscription.current_period_end * 1000
      );
    }

    await subscription.save();
    logger.info(
      `Subscription ${subscription.id} updated with status ${status}`
    );
  };

  /**
   * Handle customer.subscription.deleted event
   */
  private handleSubscriptionDeleted = async (event: Stripe.Event) => {
    const stripeSubscription = event.data.object as Stripe.Subscription;

    // Find subscription by Stripe subscription ID
    const subscription = await Subscription.findOne({
      where: { stripe_subscription_id: stripeSubscription.id as string },
    });

    if (!subscription) {
      logger.error(
        `Subscription not found for Stripe subscription ${stripeSubscription.id}`
      );
      return;
    }

    // Update subscription status
    subscription.status = SubscriptionStatus.CANCELLED;
    await subscription.save();

    // Update user to free plan
    const user = await User.findByPk(subscription.user_id);
    if (user) {
      user.plan = "free";
      await user.save();
    }

    logger.info(`Subscription canceled for user ${subscription.user_id}`);
  };
}

export default new StripeController();
