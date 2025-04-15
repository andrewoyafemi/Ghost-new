import { body } from "express-validator";
import { BillingCycle } from "../models/subscription.model";

/**
 * Validation rules for updating subscription plan
 */
export const updatePlanValidation = [
  body("plan")
    .notEmpty()
    .withMessage("Plan is required")
    .isIn(["free", "basic", "premium"])
    .withMessage("Plan must be one of: free, basic, premium"),

  body("billing_cycle")
    .optional()
    .isIn(Object.values(BillingCycle))
    .withMessage(
      `Billing cycle must be one of: ${Object.values(BillingCycle).join(", ")}`
    ),

  body("payment_method_id")
    .if(body("plan").not().equals("free"))
    .notEmpty()
    .withMessage("Payment method is required for paid plans")
    .isString()
    .withMessage("Payment method ID must be a string"),

  body("auto_renew")
    .optional()
    .isBoolean()
    .withMessage("Auto renew flag must be a boolean"),
];

/**
 * Validation rules for updating payment method
 */
export const updatePaymentMethodValidation = [
  body("payment_method_id")
    .notEmpty()
    .withMessage("Payment method ID is required")
    .isString()
    .withMessage("Payment method ID must be a string"),
];
