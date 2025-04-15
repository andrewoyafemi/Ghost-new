import dotenv from "dotenv";
import logger from "./logger";

dotenv.config();

// Email configuration
export const emailConfig = {
  // SendGrid configuration
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY,
    enabled:
      process.env.SENDGRID_API_KEY &&
      process.env.SENDGRID_API_KEY !== "your-sendgrid-api-key",
  },

  // Email settings
  from: process.env.EMAIL_FROM || "noreply@ghostryt.com",
  replyTo: process.env.EMAIL_REPLY_TO || "support@ghostryt.com",

  // Template IDs (to be created in SendGrid)
  templates: {
    welcome: process.env.SENDGRID_TEMPLATE_WELCOME,
    passwordReset: process.env.SENDGRID_TEMPLATE_PASSWORD_RESET,
    emailVerification: process.env.SENDGRID_TEMPLATE_EMAIL_VERIFICATION,
    subscriptionConfirmation:
      process.env.SENDGRID_TEMPLATE_SUBSCRIPTION_CONFIRMATION,
    subscriptionCancelled: process.env.SENDGRID_TEMPLATE_SUBSCRIPTION_CANCELLED,
    postScheduled: process.env.SENDGRID_TEMPLATE_POST_SCHEDULED,
    postPublished: process.env.SENDGRID_TEMPLATE_POST_PUBLISHED,
    trialEnding: process.env.SENDGRID_TEMPLATE_TRIAL_ENDING,
    paymentFailed: process.env.SENDGRID_TEMPLATE_PAYMENT_FAILED,
    monthlyReport: process.env.SENDGRID_TEMPLATE_MONTHLY_REPORT,
  },
};

// Validate required configuration
if (!emailConfig.sendgrid.apiKey) {
  logger.warn(
    "SendGrid API key not configured. Email functionality will be disabled."
  );
}

// Validate template IDs
Object.entries(emailConfig.templates).forEach(([name, id]) => {
  if (!id) {
    logger.warn(`SendGrid template ID for ${name} not configured.`);
  }
});

export default emailConfig;
