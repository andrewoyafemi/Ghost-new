import Stripe from "stripe";
import dotenv from "dotenv";
import logger from "../config/logger";

dotenv.config();

export class StripeService {
  private stripe: Stripe;

  constructor() {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      throw new Error("Stripe secret key is not configured");
    }
    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2025-02-24.acacia",
    });
  }

  /**
   * Create a checkout session for registration
   * @param email User email
   * @param plan Plan name (basic, standard, premium)
   * @returns Stripe checkout session
   */
  async createCheckoutSession(
    email: string,
    plan: string
  ): Promise<Stripe.Checkout.Session> {
    try {
      const priceId = this.getPriceId(plan);

      if (!priceId) {
        throw new Error(`Invalid plan: ${plan}`);
      }

      const baseSuccessUrl = "https://www.ghostryt.net/registration/success";
      // const baseSuccessUrl = "http://localhost:5173/registration/success";
      const cancelUrl = "https://www.ghostryt.net/registration/cancel";

      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: "subscription",
        success_url: `${baseSuccessUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl,
        customer_email: email,
      });

      return session;
    } catch (error) {
      logger.error("Error creating Stripe checkout session:", error);
      throw error;
    }
  }

  /**
   * Retrieve a checkout session
   * @param sessionId Stripe session ID
   * @returns Stripe checkout session
   */
  async retrieveCheckoutSession(
    sessionId: string
  ): Promise<Stripe.Checkout.Session> {
    try {
      return await this.stripe.checkout.sessions.retrieve(sessionId);
    } catch (error) {
      logger.error(
        `Error retrieving Stripe checkout session ${sessionId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Verify if payment was completed
   * @param sessionId Stripe session ID
   * @returns True if payment is completed
   */
  async verifyPayment(sessionId: string): Promise<boolean> {
    try {
      const session = await this.retrieveCheckoutSession(sessionId);
      return session.payment_status === "paid";
    } catch (error) {
      logger.error(`Error verifying payment for session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Get Stripe price ID for a plan
   * @param plan Plan name
   * @returns Stripe price ID
   */
  private getPriceId(plan: string): string | null {
    switch (plan.toLowerCase()) {
      case "basic":
        return process.env.STRIPE_PRICE_BASIC || null;
      case "standard":
        return process.env.STRIPE_PRICE_STANDARD || null;
      case "premium":
        return process.env.STRIPE_PRICE_PREMIUM || null;
      default:
        return null;
    }
  }

  /**
   * Update customer's payment method
   * @param customerId Stripe customer ID
   * @param paymentMethodId New payment method ID
   */
  async updateCustomerPaymentMethod(
    customerId: string | null,
    paymentMethodId: string
  ): Promise<void> {
    try {
      if (!customerId) {
        throw new Error("Customer ID is required");
      }

      // Attach payment method to customer
      await this.stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });

      // Set as default payment method
      await this.stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      logger.info(`Updated payment method for customer ${customerId}`);
    } catch (error) {
      logger.error("Error updating customer payment method:", error);
      throw new Error("Failed to update payment method");
    }
  }

  /**
   * Cancel a subscription in Stripe
   */
  async cancelSubscription(subscriptionId: string | null): Promise<void> {
    if (!subscriptionId) {
      throw new Error("Subscription ID is required");
    }

    try {
      await this.stripe.subscriptions.cancel(subscriptionId);
      logger.info(`Subscription ${subscriptionId} cancelled successfully`);
    } catch (error) {
      logger.error(`Error cancelling subscription ${subscriptionId}:`, error);
      throw error;
    }
  }

  /**
   * Construct and verify a Stripe webhook event
   * @param payload Raw request body (Buffer or string)
   * @param signature Stripe signature from headers
   * @returns Verified Stripe event
   */
  constructWebhookEvent(
    payload: string | Buffer,
    signature: string
  ): Stripe.Event {
    try {
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!webhookSecret) {
        throw new Error("Stripe webhook secret is not configured");
      }

      // Use payload directly - Stripe's SDK can handle both string and Buffer
      return this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret
      );
    } catch (error) {
      logger.error("Error constructing webhook event:", error);
      throw error;
    }
  }

  /**
   * Retrieve a subscription from Stripe
   * @param subscriptionId Stripe subscription ID
   * @returns Stripe subscription details
   */
  async retrieveSubscription(
    subscriptionId: string
  ): Promise<Stripe.Subscription> {
    try {
      return await this.stripe.subscriptions.retrieve(subscriptionId);
    } catch (error) {
      logger.error(`Error retrieving subscription ${subscriptionId}:`, error);
      throw error;
    }
  }

  /**
   * Retrieve an invoice from Stripe
   * @param invoiceId Stripe invoice ID
   * @returns Stripe invoice details
   */
  async retrieveInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    try {
      return await this.stripe.invoices.retrieve(invoiceId);
    } catch (error) {
      logger.error(`Error retrieving invoice ${invoiceId}:`, error);
      throw error;
    }
  }
}
