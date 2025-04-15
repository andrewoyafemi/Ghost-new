import sgMail from "@sendgrid/mail";
import { User } from "../models";
import logger from "../config/logger";
import { emailTemplates, EmailTemplate } from "../config/email-templates";

// Email template IDs - these should be created in SendGrid dashboard
// We now import this from email-templates.ts instead of defining it here
// export enum EmailTemplate {
//   WELCOME = "WELCOME",
//   PASSWORD_RESET = "PASSWORD_RESET",
//   EMAIL_VERIFICATION = "EMAIL_VERIFICATION",
//   SUBSCRIPTION_CONFIRMATION = "SUBSCRIPTION_CONFIRMATION",
//   SUBSCRIPTION_CANCELLED = "SUBSCRIPTION_CANCELLED",
//   POST_SCHEDULED = "POST_SCHEDULED",
//   POST_PUBLISHED = "POST_PUBLISHED",
//   TRIAL_ENDING = "TRIAL_ENDING",
//   PAYMENT_FAILED = "PAYMENT_FAILED",
//   MONTHLY_REPORT = "MONTHLY_REPORT",
// }

// Re-export the enum for backward compatibility
export { EmailTemplate } from "../config/email-templates";

interface EmailData {
  to: string;
  templateId: string;
  dynamicTemplateData: Record<string, any>;
}

export class EmailService {
  private emailEnabled: boolean = false;

  constructor() {
    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) {
      logger.warn(
        "SendGrid API key is not configured - Email functionality will be disabled"
      );
      this.emailEnabled = false;
      return;
    }

    try {
      sgMail.setApiKey(apiKey);
      this.emailEnabled = true;
      logger.info("Email service initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize SendGrid:", error);
      this.emailEnabled = false;
    }
  }

  private async sendEmail(
    to: string,
    templateType: EmailTemplate,
    data: Record<string, any>
  ) {
    // If email is disabled, log the attempt but don't try to send
    if (!this.emailEnabled) {
      logger.info(
        `Email sending skipped (disabled) - Template: ${templateType}, To: ${to}`
      );
      return;
    }

    try {
      const template = emailTemplates[templateType];
      if (!template) {
        throw new Error(`Email template ${templateType} not found`);
      }

      // Add common template variables
      const templateData = {
        ...data,
        year: new Date().getFullYear(),
        dashboardUrl: process.env.DASHBOARD_URL || "https://app.ghostryt.com",
      };

      // Replace template variables
      let html = template.html;
      let subject = template.subject;

      Object.entries(templateData).forEach(([key, value]) => {
        const regex = new RegExp(`{{${key}}}`, "g");
        html = html.replace(regex, String(value));
        subject = subject.replace(regex, String(value));
      });

      const msg = {
        to,
        from: process.env.SENDGRID_FROM_EMAIL || "noreply@ghostryt.com",
        subject,
        html,
      };

      await sgMail.send(msg);
      logger.info(
        `Email sent successfully to ${to} - Template: ${templateType}`
      );
    } catch (error) {
      logger.error(`Error sending email to ${to}:`, error);
      throw error;
    }
  }

  /**
   * Send welcome email to new user
   */
  public async sendWelcomeEmail(user: User): Promise<void> {
    await this.sendEmail(user.email, EmailTemplate.WELCOME, {
      name: user.username,
    });
  }

  /**
   * Send password reset email
   */
  public async sendPasswordResetEmail(
    user: User,
    resetToken: string
  ): Promise<void> {
    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;
    const expiryTime = process.env.PASSWORD_RESET_EXPIRY || "10";

    await this.sendEmail(user.email, EmailTemplate.PASSWORD_RESET, {
      name: user.username,
      resetUrl,
      expiryTime,
    });
  }

  /**
   * Send email verification
   */
  public async sendVerificationEmail(
    user: User,
    verificationToken: string
  ): Promise<void> {
    const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`;
    const expiryTime = process.env.EMAIL_VERIFICATION_EXPIRY || "24";

    await this.sendEmail(user.email, EmailTemplate.EMAIL_VERIFICATION, {
      name: user.username,
      verificationUrl,
      expiryTime,
    });
  }

  /**
   * Send subscription confirmation
   */
  public async sendSubscriptionConfirmation(
    user: User,
    plan: string
  ): Promise<void> {
    if (plan === "cancelled") {
      await this.sendEmail(user.email, EmailTemplate.SUBSCRIPTION_CANCELLED, {
        name: user.username,
        endDate: user.subscription?.current_period_end,
        reactivateUrl: `${process.env.CLIENT_URL}/settings/billing`,
      });
    } else {
      await this.sendEmail(
        user.email,
        EmailTemplate.SUBSCRIPTION_CONFIRMATION,
        {
          name: user.username,
          planName: plan.charAt(0).toUpperCase() + plan.slice(1),
          billingCycle: user.subscription?.billing_cycle,
          nextBillingDate: user.subscription?.current_period_end,
        }
      );
    }
  }

  /**
   * Send trial ending notification
   */
  public async sendTrialEndingNotification(
    user: User,
    daysLeft: number
  ): Promise<void> {
    await this.sendEmail(user.email, EmailTemplate.TRIAL_ENDING, {
      name: user.username,
      daysLeft,
      upgradeUrl: `${process.env.CLIENT_URL}/settings/billing`,
    });
  }

  /**
   * Send payment failed notification
   */
  public async sendPaymentFailedNotification(user: User): Promise<void> {
    await this.sendEmail(user.email, EmailTemplate.PAYMENT_FAILED, {
      name: user.username,
      updatePaymentUrl: `${process.env.CLIENT_URL}/settings/billing`,
    });
  }

  /**
   * Send post scheduled confirmation
   */
  public async sendPostScheduledConfirmation(
    user: User,
    postTitle: string,
    scheduledDate: Date
  ): Promise<void> {
    await this.sendEmail(user.email, EmailTemplate.POST_SCHEDULED, {
      name: user.username,
      postTitle,
      scheduledDate: scheduledDate.toLocaleString(),
      platform: "WordPress", // Add more platforms as needed
      postUrl: `${process.env.CLIENT_URL}/posts`,
    });
  }

  /**
   * Send post published confirmation
   */
  public async sendPostPublishedConfirmation(
    user: User,
    postTitle: string,
    postUrl: string
  ): Promise<void> {
    await this.sendEmail(user.email, EmailTemplate.POST_PUBLISHED, {
      name: user.username,
      postTitle,
      publishDate: new Date().toLocaleString(),
      platform: "WordPress", // Add more platforms as needed
      postUrl,
    });
  }

  /**
   * Send monthly activity report
   */
  public async sendMonthlyReport(
    user: User,
    stats: {
      postsPublished: number;
      totalWordCount: number;
      engagement: number;
      topKeywords: string;
    }
  ): Promise<void> {
    const date = new Date();
    const month = date.toLocaleString("default", { month: "long" });
    const year = date.getFullYear();

    await this.sendEmail(user.email, EmailTemplate.MONTHLY_REPORT, {
      name: user.username,
      month,
      year,
      ...stats,
    });
  }
}
