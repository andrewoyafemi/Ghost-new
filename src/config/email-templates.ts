// Create our own enum instead of importing it
// import { EmailTemplate } from "../services/email.service";

// Define the EmailTemplate enum here to avoid circular dependency
export enum EmailTemplate {
  WELCOME = "WELCOME",
  PASSWORD_RESET = "PASSWORD_RESET",
  EMAIL_VERIFICATION = "EMAIL_VERIFICATION",
  SUBSCRIPTION_CONFIRMATION = "SUBSCRIPTION_CONFIRMATION",
  SUBSCRIPTION_CANCELLED = "SUBSCRIPTION_CANCELLED",
  POST_SCHEDULED = "POST_SCHEDULED",
  POST_PUBLISHED = "POST_PUBLISHED",
  TRIAL_ENDING = "TRIAL_ENDING",
  PAYMENT_FAILED = "PAYMENT_FAILED",
  MONTHLY_REPORT = "MONTHLY_REPORT",
}

interface TemplateData {
  subject: string;
  html: string;
}

// Common styles for all templates
const styles = {
  container: `
    font-family: 'Arial', sans-serif;
    max-width: 600px;
    margin: 0 auto;
    padding: 20px;
    background-color: #ffffff;
  `,
  header: `
    background-color: #FF4C00;
    color: white;
    padding: 20px;
    text-align: center;
    border-radius: 8px 8px 0 0;
  `,
  content: `
    padding: 30px;
    background-color: #f9f9f9;
    border-radius: 0 0 8px 8px;
  `,
  button: `
    display: inline-block;
    padding: 12px 24px;
    background-color: #FF4C00;
    color: white;
    text-decoration: none;
    border-radius: 4px;
    margin: 20px 0;
  `,
  footer: `
    text-align: center;
    padding: 20px;
    color: #666;
    font-size: 12px;
  `,
};

// Template examples for each email type
export const emailTemplates: Record<EmailTemplate, TemplateData> = {
  [EmailTemplate.WELCOME]: {
    subject: "Welcome to GhostRyt! 🚀",
    html: `
      <div style="${styles.container}">
        <div style="${styles.header}">
          <h1>Welcome to GhostRyt!</h1>
        </div>
        <div style="${styles.content}">
          <h2>Hi {{name}},</h2>
          <p>Welcome to GhostRyt! We're excited to have you on board. You've taken the first step towards revolutionizing your content creation process.</p>
          <p>Here's what you can do next:</p>
          <ul>
            <li>Complete your business profile</li>
            <li>Set up your WordPress integration</li>
            <li>Create your first AI-powered post</li>
          </ul>
          <a href="{{dashboardUrl}}" style="${styles.button}">Get Started</a>
          <p>Need help? Our support team is here for you!</p>
        </div>
        <div style="${styles.footer}">
          <p>© {{year}} GhostRyt. All rights reserved.</p>
        </div>
      </div>
    `,
  },

  [EmailTemplate.PASSWORD_RESET]: {
    subject: "Reset Your GhostRyt Password",
    html: `
      <div style="${styles.container}">
        <div style="${styles.header}">
          <h1>Password Reset Request</h1>
        </div>
        <div style="${styles.content}">
          <h2>Hi {{name}},</h2>
          <p>We received a request to reset your password. If you didn't make this request, you can safely ignore this email.</p>
          <p>To reset your password, click the button below. This link will expire in {{expiryTime}} minutes.</p>
          <a href="{{resetUrl}}" style="${styles.button}">Reset Password</a>
          <p>If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="word-break: break-all;">{{resetUrl}}</p>
        </div>
        <div style="${styles.footer}">
          <p>© {{year}} GhostRyt. All rights reserved.</p>
        </div>
      </div>
    `,
  },

  [EmailTemplate.EMAIL_VERIFICATION]: {
    subject: "Verify Your GhostRyt Email",
    html: `
      <div style="${styles.container}">
        <div style="${styles.header}">
          <h1>Verify Your Email</h1>
        </div>
        <div style="${styles.content}">
          <h2>Hi {{name}},</h2>
          <p>Thanks for signing up! Please verify your email address to access all GhostRyt features.</p>
          <p>Click the button below to verify your email:</p>
          <a href="{{verificationUrl}}" style="${styles.button}">Verify Email</a>
          <p>This link will expire in {{expiryTime}} minutes.</p>
        </div>
        <div style="${styles.footer}">
          <p>© {{year}} GhostRyt. All rights reserved.</p>
        </div>
      </div>
    `,
  },

  [EmailTemplate.SUBSCRIPTION_CONFIRMATION]: {
    subject: "Welcome to GhostRyt {{planName}}! 🎉",
    html: `
      <div style="${styles.container}">
        <div style="${styles.header}">
          <h1>Subscription Confirmed!</h1>
        </div>
        <div style="${styles.content}">
          <h2>Hi {{name}},</h2>
          <p>Thank you for subscribing to GhostRyt {{planName}}! Your subscription is now active.</p>
          <h3>Your Plan Details:</h3>
          <ul>
            <li>Plan: {{planName}}</li>
            <li>Billing Cycle: {{billingCycle}}</li>
            <li>Next Billing Date: {{nextBillingDate}}</li>
          </ul>
          <p>Start exploring your new features:</p>
          <a href="{{dashboardUrl}}" style="${styles.button}">Go to Dashboard</a>
        </div>
        <div style="${styles.footer}">
          <p>© {{year}} GhostRyt. All rights reserved.</p>
        </div>
      </div>
    `,
  },

  [EmailTemplate.SUBSCRIPTION_CANCELLED]: {
    subject: "GhostRyt Subscription Cancelled",
    html: `
      <div style="${styles.container}">
        <div style="${styles.header}">
          <h1>Subscription Cancelled</h1>
        </div>
        <div style="${styles.content}">
          <h2>Hi {{name}},</h2>
          <p>We're sorry to see you go. Your subscription has been cancelled and will remain active until {{endDate}}.</p>
          <p>Until then, you'll continue to have access to all your current features.</p>
          <p>If you change your mind, you can reactivate your subscription anytime:</p>
          <a href="{{reactivateUrl}}" style="${styles.button}">Reactivate Subscription</a>
          <p>We'd love to hear your feedback on how we can improve!</p>
        </div>
        <div style="${styles.footer}">
          <p>© {{year}} GhostRyt. All rights reserved.</p>
        </div>
      </div>
    `,
  },

  [EmailTemplate.POST_SCHEDULED]: {
    subject: "Post Scheduled: {{postTitle}}",
    html: `
      <div style="${styles.container}">
        <div style="${styles.header}">
          <h1>Post Scheduled Successfully</h1>
        </div>
        <div style="${styles.content}">
          <h2>Hi {{name}},</h2>
          <p>Your post has been scheduled successfully!</p>
          <h3>Post Details:</h3>
          <ul>
            <li>Title: {{postTitle}}</li>
            <li>Scheduled for: {{scheduledDate}}</li>
            <li>Platform: {{platform}}</li>
          </ul>
          <a href="{{postUrl}}" style="${styles.button}">View Post</a>
          <p>You'll receive a confirmation email once the post is published.</p>
        </div>
        <div style="${styles.footer}">
          <p>© {{year}} GhostRyt. All rights reserved.</p>
        </div>
      </div>
    `,
  },

  [EmailTemplate.POST_PUBLISHED]: {
    subject: "Post Published: {{postTitle}}",
    html: `
      <div style="${styles.container}">
        <div style="${styles.header}">
          <h1>Post Published Successfully</h1>
        </div>
        <div style="${styles.content}">
          <h2>Hi {{name}},</h2>
          <p>Your post has been published successfully!</p>
          <h3>Post Details:</h3>
          <ul>
            <li>Title: {{postTitle}}</li>
            <li>Published on: {{publishDate}}</li>
            <li>Platform: {{platform}}</li>
          </ul>
          <a href="{{postUrl}}" style="${styles.button}">View Post</a>
          <p>Share your content on social media to increase engagement!</p>
        </div>
        <div style="${styles.footer}">
          <p>© {{year}} GhostRyt. All rights reserved.</p>
        </div>
      </div>
    `,
  },

  [EmailTemplate.TRIAL_ENDING]: {
    subject: "Your GhostRyt Trial Ends Soon!",
    html: `
      <div style="${styles.container}">
        <div style="${styles.header}">
          <h1>Trial Ending Soon</h1>
        </div>
        <div style="${styles.content}">
          <h2>Hi {{name}},</h2>
          <p>Your GhostRyt trial will end in {{daysLeft}} days.</p>
          <p>Don't lose access to these amazing features:</p>
          <ul>
            <li>AI-powered content generation</li>
            <li>SEO optimization</li>
            <li>Social media integration</li>
            <li>Analytics and insights</li>
          </ul>
          <p>Upgrade now to keep your content creation momentum going!</p>
          <a href="{{upgradeUrl}}" style="${styles.button}">Upgrade Now</a>
        </div>
        <div style="${styles.footer}">
          <p>© {{year}} GhostRyt. All rights reserved.</p>
        </div>
      </div>
    `,
  },

  [EmailTemplate.PAYMENT_FAILED]: {
    subject: "Action Required: Payment Failed",
    html: `
      <div style="${styles.container}">
        <div style="${styles.header}">
          <h1>Payment Failed</h1>
        </div>
        <div style="${styles.content}">
          <h2>Hi {{name}},</h2>
          <p>We were unable to process your payment for your GhostRyt subscription.</p>
          <p>To avoid any interruption in service, please update your payment information:</p>
          <a href="{{updatePaymentUrl}}" style="${styles.button}">Update Payment Method</a>
          <p>If you need assistance, our support team is here to help!</p>
        </div>
        <div style="${styles.footer}">
          <p>© {{year}} GhostRyt. All rights reserved.</p>
        </div>
      </div>
    `,
  },

  [EmailTemplate.MONTHLY_REPORT]: {
    subject: "Your GhostRyt Monthly Report - {{month}} {{year}}",
    html: `
      <div style="${styles.container}">
        <div style="${styles.header}">
          <h1>Monthly Performance Report</h1>
        </div>
        <div style="${styles.content}">
          <h2>Hi {{name}},</h2>
          <p>Here's your content performance summary for {{month}} {{year}}:</p>
          <div style="background: #fff; padding: 20px; border-radius: 4px; margin: 20px 0;">
            <h3>Content Stats:</h3>
            <ul>
              <li>Posts Published: {{postsPublished}}</li>
              <li>Total Word Count: {{totalWordCount}}</li>
              <li>Average Engagement: {{engagement}}%</li>
            </ul>
            <h3>Top Performing Keywords:</h3>
            <p>{{topKeywords}}</p>
          </div>
          <a href="{{dashboardUrl}}" style="${styles.button}">View Full Report</a>
        </div>
        <div style="${styles.footer}">
          <p>© {{year}} GhostRyt. All rights reserved.</p>
        </div>
      </div>
    `,
  },
};
