import { Response } from "express";
import { User, Subscription, BillingTransaction } from "../../models";
import { AuthRequest } from "../../types/auth.types";
import { ErrorResponse } from "../../utils/responses";
import logger from "../../config/logger";
import { Op } from "sequelize";
import {
  BillingCycle,
  SubscriptionStatus,
  PaymentStatus,
} from "../../models/subscription.model";
import { StripeService } from "../../services/stripe.service";
import { EmailService } from "../../services/email.service";
import { SuccessResponse } from "../../utils/responses";

const emailService = new EmailService();

/**
 * Get the user's current subscription plan details
 */
export const getPlanDetails = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json(ErrorResponse("User not authenticated"));
    }

    const user = await User.findByPk(userId, {
      include: [
        {
          model: Subscription,
          as: "subscription",
          attributes: [
            "id",
            "plan",
            "billing_cycle",
            "status",
            "auto_renew",
            "current_period_start",
            "current_period_end",
            "created_at",
          ],
        },
      ],
    });

    if (!user) {
      return res.status(404).json(ErrorResponse("User not found"));
    }

    // Format data before sending
    let planDetails = {};

    if (user.subscription) {
      const sub = user.subscription;

      planDetails = {
        plan: sub.plan,
        status: sub.status,
        billing_cycle: sub.billing_cycle,
        cancel_at_period_end: sub.cancel_at_period_end,
        current_period: {
          start: sub.current_period_start,
          end: sub.current_period_end,
        },
        is_active: sub.isActive,
        will_renew: sub.willRenew,
        days_until_renewal: sub.daysUntilRenewal(),
        subscription_date: sub.created_at,
      };
    } else {
      // Provide default "free" plan details if no subscription exists
      const now = new Date();
      planDetails = {
        plan: "free",
        status: SubscriptionStatus.ACTIVE,
        billing_cycle: null,
        auto_renew: false,
        current_period: {
          start: now,
          end: null,
        },
        is_active: true,
        will_renew: false,
        days_until_renewal: null,
        subscription_date: now,
      };
    }

    return res.status(200).json({
      success: true,
      data: planDetails,
    });
  } catch (error) {
    logger.error("Error getting plan details:", error);
    return res.status(500).json(ErrorResponse("Error retrieving plan details"));
  }
};

/**
 * Update the user's subscription plan
 */
export const updatePlan = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json(ErrorResponse("Authentication required"));
    }

    const {
      plan,
      billing_cycle = BillingCycle.MONTHLY,
      payment_method_id,
      is_trial = false,
    } = req.body;

    // Initialize Stripe service
    const stripeService = new StripeService();

    // Validate required fields
    if (!plan) {
      return res.status(400).json(ErrorResponse("Plan is required"));
    }

    if (plan !== "free" && !payment_method_id) {
      return res
        .status(400)
        .json(ErrorResponse("Payment method is required for paid plans"));
    }

    const user = await User.findByPk(userId, {
      include: [
        {
          model: Subscription,
          as: "subscription",
        },
      ],
    });

    if (!user) {
      return res.status(404).json(ErrorResponse("User not found"));
    }

    // For demo purposes, simulate Stripe integration
    // In production, you would integrate with Stripe API here
    const stripeCustomerId =
      "cus_" + Math.random().toString(36).substring(2, 15);
    const stripeSubscriptionId =
      plan !== "free"
        ? "sub_" + Math.random().toString(36).substring(2, 15)
        : null;
    const stripePaymentMethodId = payment_method_id || null;

    // Calculate subscription periods
    const now = new Date();
    const periodEnd = new Date();
    if (billing_cycle === BillingCycle.MONTHLY) {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    }

    // Update or create subscription
    let subscription = user.subscription;

    if (!subscription) {
      // Create new subscription
      subscription = await Subscription.create({
        user_id: userId,
        plan,
        billing_cycle,
        status: is_trial
          ? SubscriptionStatus.TRIALING
          : SubscriptionStatus.ACTIVE,
        current_period_start: now,
        current_period_end: periodEnd,
        stripe_customer_id: stripeCustomerId,
        payment_status: PaymentStatus.PAID,
      });
    } else {
      // Handle plan downgrade/upgrade logic
      const isDowngrade =
        (subscription.plan === "premium" && plan === "basic") ||
        (subscription.plan !== "free" && plan === "free");

      const isUpgrade =
        (subscription.plan === "free" && plan !== "free") ||
        (subscription.plan === "basic" && plan === "premium");

      // Update subscription fields
      subscription.plan = plan;

      if (billing_cycle) {
        subscription.billing_cycle = billing_cycle;
      }

      if (isUpgrade || subscription.status !== SubscriptionStatus.ACTIVE) {
        subscription.status = SubscriptionStatus.ACTIVE;
        subscription.current_period_start = now;
        subscription.current_period_end = periodEnd;
      }

      if (payment_method_id) {
        // Store payment method ID in Stripe customer metadata
        // This is just a placeholder - in production, use proper Stripe API calls
        await stripeService.updateCustomerPaymentMethod(
          subscription.stripe_customer_id,
          payment_method_id
        );
      }

      if (!subscription.stripe_customer_id) {
        subscription.stripe_customer_id = stripeCustomerId;
      }

      if (plan !== "free" && !subscription.stripe_subscription_id) {
        subscription.stripe_subscription_id = stripeSubscriptionId;
      }

      await subscription.save();

      // Create a billing transaction record if upgrading to paid plan
      if (isUpgrade && plan !== "free") {
        const amount = plan === "premium" ? 1999 : 999; // $19.99 or $9.99

        await BillingTransaction.create({
          user_id: userId,
          amount,
          currency: "usd",
          status: PaymentStatus.PAID,
          description: `Subscription upgrade to ${plan} plan`,
          transaction_date: new Date(),
        });
      }
    }

    // Send subscription confirmation email
    await emailService.sendSubscriptionConfirmation(user, plan);

    return res
      .status(200)
      .json(
        SuccessResponse(
          { subscription: subscription },
          "Plan updated successfully"
        )
      );
  } catch (error) {
    logger.error("Error updating plan:", error);
    throw error;
  }
};

/**
 * Get the user's billing history
 */
export const getBillingHistory = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json(ErrorResponse("User not authenticated"));
    }

    // Parse pagination params
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    // Get transaction history with pagination
    const { count, rows } = await BillingTransaction.findAndCountAll({
      where: { user_id: userId },
      order: [["transaction_date", "DESC"]],
      limit,
      offset,
    });

    // Format transactions
    const transactions = rows.map((transaction) => ({
      id: transaction.id,
      amount: transaction.getFormattedAmount(),
      currency: transaction.currency,
      status: transaction.status,
      description: transaction.description,
      date: transaction.transaction_date,
    }));

    return res.status(200).json({
      success: true,
      data: {
        transactions,
        pagination: {
          total: count,
          page,
          limit,
          pages: Math.ceil(count / limit),
        },
      },
    });
  } catch (error) {
    logger.error("Error getting billing history:", error);
    return res
      .status(500)
      .json(ErrorResponse("Error retrieving billing history"));
  }
};

/**
 * Update payment method
 */
export const updatePaymentMethod = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json(ErrorResponse("Authentication required"));
    }

    const { payment_method_id } = req.body;

    if (!payment_method_id) {
      return res
        .status(400)
        .json(ErrorResponse("Payment method ID is required"));
    }

    // Initialize Stripe service
    const stripeService = new StripeService();

    const user = await User.findByPk(userId, {
      include: [
        {
          model: Subscription,
          as: "subscription",
        },
      ],
    });

    if (!user) {
      return res.status(404).json(ErrorResponse("User not found"));
    }

    if (!user.subscription) {
      return res.status(404).json(ErrorResponse("No subscription found"));
    }

    // In production, you would validate the payment method with Stripe
    // and attach it to the customer

    // Update payment method
    // In production, update the payment method in Stripe
    await stripeService.updateCustomerPaymentMethod(
      user.subscription.stripe_customer_id,
      payment_method_id
    );

    // If payment was previously failed, send confirmation
    if (user.subscription?.payment_status === PaymentStatus.FAILED) {
      await emailService.sendSubscriptionConfirmation(user, user.plan);
    }

    return res
      .status(200)
      .json(SuccessResponse(null, "Payment method updated successfully"));
  } catch (error) {
    logger.error("Error updating payment method:", error);
    throw error;
  }
};

/**
 * Cancel subscription
 */
export const cancelSubscription = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req;
    if (!userId) {
      return res.status(401).json(ErrorResponse("Authentication required"));
    }

    const user = await User.findByPk(userId, {
      include: [{ model: Subscription, as: "subscription" }],
    });

    if (!user || !user.subscription) {
      return res.status(404).json(ErrorResponse("Subscription not found"));
    }

    // Cancel subscription logic here
    const stripeService = new StripeService();
    await stripeService.cancelSubscription(
      user.subscription.stripe_subscription_id
    );

    // Update subscription status
    await user.subscription.update({
      status: SubscriptionStatus.CANCELLED,
      cancel_at_period_end: true,
    });

    // Send cancellation email
    await emailService.sendSubscriptionConfirmation(user, "cancelled");

    return res
      .status(200)
      .json(SuccessResponse(null, "Subscription cancelled successfully"));
  } catch (error) {
    logger.error("Error cancelling subscription:", error);
    throw error;
  }
};

// Add webhook handler for failed payments
export const handleFailedPayment = async (event: any) => {
  try {
    const subscription = await Subscription.findOne({
      where: { stripe_subscription_id: event.data.object.subscription },
      include: [{ model: User }],
    });

    const user = await User.findByPk(subscription?.user_id);

    if (subscription && user) {
      await emailService.sendPaymentFailedNotification(user);

      // Update subscription status
      await subscription.update({
        payment_status: PaymentStatus.FAILED,
        status: SubscriptionStatus.PAST_DUE,
      });
    }
  } catch (error) {
    logger.error("Error handling failed payment:", error);
    throw error;
  }
};
