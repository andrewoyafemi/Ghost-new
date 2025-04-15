import { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import {
  ValidationError,
  NotFoundError,
} from "../middlewares/error.middleware";
import {
  User,
  Session,
  BusinessProfile,
  TemporaryRegistration,
  Subscription,
} from "../models";
import { createTokens } from "../utils/jwt.utils";
import logger from "../config/logger";
import { UserStatus, UserRole } from "../models/user.model";
import { AuthRequest } from "../types/auth.types";
import { StripeService } from "../services/stripe.service";
import { EmailService } from "../services/email.service";
import { SuccessResponse, ErrorResponse } from "../utils/responses";
import { ApiError } from "../middlewares/error.middleware";
import {
  BillingCycle,
  PaymentStatus,
  SubscriptionStatus,
} from "../models/subscription.model";

const emailService = new EmailService();

/**
 * Login user and return JWT token
 * POST /api/v1/auth/login
 */
export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Validate inputs
    if (!email || !password) {
      throw new ValidationError("Email and password are required");
    }

    // Find user by email
    const user = await User.findOne({ where: { email } });

    // Check if user exists
    if (!user) {
      throw new ValidationError("Invalid email or password");
    }

    // Check if account is locked
    if (user.locked_until && new Date() < user.locked_until) {
      throw new ValidationError(
        "Account is locked. Please try again later or reset your password"
      );
    }

    // Check if user is suspended
    if (user.status === UserStatus.SUSPENDED) {
      throw new ValidationError("Your account has been suspended");
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);

    // Handle failed login attempt
    if (!isPasswordValid) {
      // Increment failed attempts
      user.failed_attempts += 1;

      // Check if account should be locked
      const maxAttempts = parseInt(
        process.env.LOCK_ACCOUNT_AFTER_ATTEMPTS || "5",
        10
      );
      const lockDuration = parseInt(
        process.env.LOCK_DURATION_MINUTES || "30",
        10
      );

      if (user.failed_attempts >= maxAttempts) {
        const lockUntil = new Date();
        lockUntil.setMinutes(lockUntil.getMinutes() + lockDuration);
        user.locked_until = lockUntil;
        logger.info(`Account locked for user ${user.email}`);
      }

      await user.save();

      throw new ValidationError("Invalid email or password");
    }

    // Reset failed attempts and locked_until
    user.failed_attempts = 0;
    user.locked_until = null;

    // Update last login
    user.last_login = new Date();
    await user.save();

    // Generate JWT token
    const { accessToken, refreshToken } = createTokens(user);

    // Return success response
    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
          plan: user.plan,
        },
        tokens: {
          accessToken,
          refreshToken,
        },
      },
      message: "Login successful",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Register a new user (create temporary registration)
 * POST /api/v1/auth/register
 */
export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password, plan } = req.body;

    // Validate inputs
    if (!email || !password) {
      throw new ValidationError("Email and password are required");
    }

    // Check if plan is valid
    const validPlans = ["basic", "standard", "premium"];
    if (!validPlans.includes(plan)) {
      throw new ValidationError(
        `Invalid plan. Must be one of: ${validPlans.join(", ")}`
      );
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ValidationError("Email is already in use");
    }

    // Check if there's an existing temporary registration
    const existingTemp = await TemporaryRegistration.findOne({
      where: { email },
    });

    if (existingTemp) {
      // If it's expired, delete it, otherwise return error
      if (existingTemp.isExpired()) {
        await existingTemp.destroy();
      } else {
        throw new ValidationError(
          "You have a pending registration. Please complete it or wait for it to expire."
        );
      }
    }

    // Generate a unique registration token
    const registrationToken = crypto.randomBytes(32).toString("hex");

    // Hash password
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || "10", 10);
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Set expiration time for registration
    const expiryMinutes = parseInt(
      process.env.REGISTRATION_EXPIRY_MINUTES || "30",
      10
    );
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + expiryMinutes);

    // Initialize Stripe service
    const stripeService = new StripeService();

    // Skip Stripe for free plan
    let stripeSession = null;
    if (plan !== "free") {
      // Create Stripe checkout session
      try {
        stripeSession = await stripeService.createCheckoutSession(email, plan);
        console.log("Stripe session created:", stripeSession);
      } catch (stripeError) {
        logger.error("Stripe checkout creation failed:", stripeError);
        throw new Error(
          "Failed to create payment session. Please try again later."
        );
      }
    }

    // Create temporary registration
    const tempRegistration = await TemporaryRegistration.create({
      email,
      password_hash: passwordHash,
      plan,
      registration_token: registrationToken,
      stripe_session_id: stripeSession?.id || null,
      expires_at: expiresAt,
    });

    // Return success response with token and Stripe URL
    res.status(201).json(
      SuccessResponse(
        {
          token: registrationToken,
          stripeUrl: stripeSession?.url || null,
          expiresIn: expiryMinutes, // minutes
        },
        "Registration initiated successfully"
      )
    );
  } catch (error) {
    logger.error("Registration error:", error);
    next(error);
  }
};

/**
 * Complete registration after payment
 * POST /api/v1/auth/complete-registration
 * (This verifies the Stripe payment and creates the user account)
 */
export const completeRegistration = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { registrationToken } = req.body;

    // Validate inputs
    if (!registrationToken) {
      throw new ValidationError("Registration token is required");
    }

    // Find the temporary registration by token
    const tempRegistration = await TemporaryRegistration.findOne({
      where: { registration_token: registrationToken },
    });

    if (!tempRegistration) {
      throw new NotFoundError("Registration not found");
    }

    // Check if registration has expired
    if (tempRegistration.isExpired()) {
      await tempRegistration.destroy();
      throw new ValidationError(
        "Registration has expired. Please register again."
      );
    }

    // Check if an account already exists for this email (might have been created by webhook)
    const existingUser = await User.findOne({
      where: { email: tempRegistration.email },
    });

    if (existingUser) {
      // Account already exists, return success with a message
      await tempRegistration.destroy(); // Clean up the temporary registration

      res.status(200).json(
        SuccessResponse(
          {
            accountExists: true,
            email: existingUser.email,
          },
          "Account already exists for this email. Please log in."
        )
      );
      return;
    }

    // If plan requires payment, verify Stripe payment
    if (
      tempRegistration.plan !== "free" &&
      tempRegistration.stripe_session_id
    ) {
      const stripeService = new StripeService();
      const isPaymentComplete = await stripeService.verifyPayment(
        tempRegistration.stripe_session_id
      );

      if (!isPaymentComplete) {
        throw new ValidationError(
          "Payment not completed. Please complete payment process."
        );
      }
    }

    // Create the user account
    const user = await User.create({
      username: tempRegistration.email.split("@")[0], // Default username from email
      email: tempRegistration.email,
      password: tempRegistration.password_hash,
      password_hash: tempRegistration.password_hash,
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      email_verified: false, // Will be verified later
      plan: tempRegistration.plan,
    });

    // Generate tokens for the new user
    const { accessToken, refreshToken } = createTokens(user);

    // Delete the temporary registration
    await tempRegistration.destroy();

    // Send welcome email and subscription confirmation if applicable
    await emailService.sendWelcomeEmail(user);
    if (user.plan !== "free") {
      await emailService.sendSubscriptionConfirmation(user, user.plan);
    }

    // Return success response
    res.status(200).json(
      SuccessResponse(
        {
          accountExists: false,
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            plan: user.plan,
          },
          tokens: {
            accessToken,
            refreshToken,
          },
        },
        "Registration completed successfully"
      )
    );
  } catch (error) {
    logger.error("Registration completion error:", error);
    next(error);
  }
};

/**
 * Request password reset
 * POST /api/v1/auth/forgot-password
 */
export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email } = req.body;

    // Validate inputs
    if (!email) {
      throw new ValidationError("Email is required");
    }

    // Find user by email
    const user = await User.findOne({
      where: { email },
    });

    // Don't reveal if user exists or not for security
    if (!user) {
      // Still return success to prevent email enumeration
      res
        .status(200)
        .json(
          SuccessResponse(
            null,
            "If an account exists with this email, a password reset link has been sent"
          )
        );
      return;
    }

    // Generate a reset token that expires in a short time
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date();
    resetTokenExpiry.setMinutes(
      resetTokenExpiry.getMinutes() +
        parseInt(process.env.PASSWORD_RESET_EXPIRY || "10", 10)
    );

    // TODO: In a real implementation, store the reset token in the database
    // and send a reset email
    // For now, just log it for demonstration

    logger.info(`Reset token for ${email}: ${resetToken}`);

    // Send password reset email
    await emailService.sendPasswordResetEmail(user, resetToken);

    res
      .status(200)
      .json(
        SuccessResponse(
          null,
          "Password reset instructions have been sent to your email"
        )
      );
  } catch (error) {
    logger.error("Password reset error:", error);
    next(error);
  }
};

/**
 * Reset password with token
 * POST /api/v1/auth/reset-password
 */
export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { token, password } = req.body;

    // Validate inputs
    if (!token || !password) {
      throw new ValidationError("Token and password are required");
    }

    // TODO: In a real implementation, find the user by reset token,
    // verify that the token is not expired, and reset the password
    // For now, just return a response for demonstration

    res.status(200).json({
      success: true,
      message: "Password has been reset successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Complete profile after registration using registration token
 * POST /api/v1/auth/complete-profile-after-registration
 */
export const completeProfileAfterRegistration = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      registrationToken,
      businessName,
      idealClient,
      clientPromises,
      clientExpectations,
      wordpressSiteUrl,
      wordpressUsername,
      wordpressApiKey,
    } = req.body;

    // Validate inputs
    if (!registrationToken) {
      throw new ValidationError("Registration token is required");
    }

    if (!businessName || !idealClient) {
      throw new ValidationError("Business name and ideal client are required");
    }

    if (!wordpressSiteUrl || !wordpressUsername || !wordpressApiKey) {
      throw new ValidationError("WordPress integration details are required");
    }

    // Find the temporary registration by token
    const tempRegistration = await TemporaryRegistration.findOne({
      where: { registration_token: registrationToken },
    });

    if (!tempRegistration) {
      throw new NotFoundError("Registration not found");
    }

    // Check if registration has expired
    if (tempRegistration.isExpired()) {
      await tempRegistration.destroy();
      throw new ValidationError(
        "Registration has expired. Please register again."
      );
    }

    // Check if an account already exists for this email (might have been created by webhook)
    const existingUser = await User.findOne({
      where: { email: tempRegistration.email },
    });

    let user;
    if (existingUser) {
      // Use existing user
      user = existingUser;
    } else {
      // Create the user account if it doesn't exist yet
      user = await User.create({
        username: tempRegistration.email.split("@")[0], // Default username from email
        email: tempRegistration.email,
        password: tempRegistration.password_hash,
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        email_verified: false, // Will be verified later
        plan: tempRegistration.plan,
      });

      // Create default subscription if needed
      if (tempRegistration.stripe_session_id) {
        // Check if payment was completed
        const stripeService = new StripeService();
        const isPaymentComplete = await stripeService.verifyPayment(
          tempRegistration.stripe_session_id
        );

        if (!isPaymentComplete) {
          throw new ValidationError(
            "Payment not completed. Please complete payment process."
          );
        }

        // Retrieve the checkout session to get Stripe IDs
        const session = await stripeService.retrieveCheckoutSession(
          tempRegistration.stripe_session_id
        );

        // Create subscription
        await Subscription.create({
          user_id: user.id,
          stripe_subscription_id: session.subscription as string,
          stripe_customer_id: session.customer as string,
          plan: tempRegistration.plan,
          status: SubscriptionStatus.ACTIVE,
          billing_cycle: BillingCycle.MONTHLY,
          payment_status: PaymentStatus.PAID,
          current_period_start: new Date(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        });
      }
    }

    // Create or update business profile
    const formattedClientPromises = Array.isArray(clientPromises)
      ? clientPromises
      : [clientPromises];

    const formattedClientExpectations = Array.isArray(clientExpectations)
      ? clientExpectations
      : [clientExpectations];

    const businessProfile = await BusinessProfile.findOne({
      where: { user_id: user.id },
    });

    if (businessProfile) {
      // Update existing profile
      businessProfile.business_name = businessName;
      businessProfile.ideal_client = idealClient;
      businessProfile.client_promises = formattedClientPromises;
      businessProfile.client_expectations = formattedClientExpectations;
      businessProfile.wordpress_site_url = wordpressSiteUrl;
      businessProfile.wordpress_username = wordpressUsername;
      businessProfile.wordpress_api_key = wordpressApiKey;
      await businessProfile.save();
    } else {
      // Create new profile
      await BusinessProfile.create({
        user_id: user.id,
        business_name: businessName,
        ideal_client: idealClient,
        client_promises: formattedClientPromises,
        client_expectations: formattedClientExpectations,
        wordpress_site_url: wordpressSiteUrl,
        wordpress_username: wordpressUsername,
        wordpress_api_key: wordpressApiKey,
      });
    }

    // Delete the temporary registration
    await tempRegistration.destroy();

    // Generate tokens for the user
    const { accessToken, refreshToken } = createTokens(user);

    // Send welcome email if this is a new account
    // if (!existingUser) {
    //   await emailService.sendWelcomeEmail(user);
    //   if (user.plan !== "free") {
    //     await emailService.sendSubscriptionConfirmation(user, user.plan);
    //   }
    // }

    // Return success response
    res.status(200).json(
      SuccessResponse(
        {
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            plan: user.plan,
          },
          tokens: {
            accessToken,
            refreshToken,
          },
        },
        "Profile completed successfully"
      )
    );
  } catch (error) {
    logger.error("Profile completion error:", error);
    next(error);
  }
};

/**
 * Complete user profile
 * POST /api/v1/auth/complete-profile
 */
export const completeProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as AuthRequest).userId;

    if (!userId) {
      throw new ValidationError("User not authenticated");
    }

    const {
      businessName,
      idealClient,
      clientPromises,
      clientExpectations,
      wordpressDetails,
    } = req.body;

    // Validate inputs
    if (!businessName || !idealClient) {
      throw new ValidationError("Business name and ideal client are required");
    }

    if (!clientPromises || !Array.isArray(clientPromises)) {
      throw new ValidationError("Client promises must be an array");
    }

    if (!clientExpectations || !Array.isArray(clientExpectations)) {
      throw new ValidationError("Client expectations must be an array");
    }

    // Find user
    const user = await User.findByPk(userId);

    if (!user) {
      throw new NotFoundError("User not found");
    }

    // Create or update business profile
    const businessProfile = await BusinessProfile.findOne({
      where: { user_id: userId },
    });

    if (businessProfile) {
      // Update existing profile
      businessProfile.business_name = businessName;
      businessProfile.ideal_client = idealClient;
      businessProfile.client_promises = clientPromises;
      businessProfile.client_expectations = clientExpectations;

      // Update WordPress details if provided
      if (wordpressDetails) {
        businessProfile.wordpress_api_key = wordpressDetails.apiKey || null;
        businessProfile.wordpress_site_url = wordpressDetails.siteUrl || null;
        businessProfile.wordpress_username = wordpressDetails.username || null;
      }

      await businessProfile.save();
    } else {
      // Create new profile
      await BusinessProfile.create({
        user_id: userId,
        business_name: businessName,
        ideal_client: idealClient,
        client_promises: clientPromises,
        client_expectations: clientExpectations,
        wordpress_api_key: wordpressDetails?.apiKey || null,
        wordpress_site_url: wordpressDetails?.siteUrl || null,
        wordpress_username: wordpressDetails?.username || null,
      });
    }

    // Return success response
    res.status(200).json({
      success: true,
      message: "Profile completed successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Refresh access token using a refresh token
 * POST /api/v1/auth/refresh-token
 */
export const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    // Validate inputs
    if (!refreshToken) {
      throw new ValidationError("Refresh token is required");
    }

    // TODO: In a real implementation, validate the refresh token,
    // check if it's expired, and generate a new access token
    // For now, just return a response for demonstration

    // In a production system:
    // 1. Decode the refresh token to get userId
    // 2. Find the session in the database
    // 3. Check if the session is valid and not expired
    // 4. Generate new access and refresh tokens
    // 5. Update the session with the new refresh token
    // 6. Return the new tokens

    const dummyUserId = 1; // This would come from decoding the token
    const user = await User.findByPk(dummyUserId);

    if (!user) {
      throw new ValidationError("Invalid refresh token");
    }

    // Generate new tokens
    const newTokens = createTokens(user);

    res.status(200).json({
      success: true,
      data: {
        tokens: newTokens,
      },
      message: "Token refreshed successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout user
 * POST /api/v1/auth/logout
 */
export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { refreshToken, allDevices } = req.body;
    const userId = (req as AuthRequest).userId;

    // If no userId provided, just show success (likely already logged out)
    if (!userId) {
      res.status(200).json({
        success: true,
        message: "Logged out successfully",
      });
      return;
    }

    // TODO: In a real implementation, invalidate the refresh token
    // and/or all tokens for the user if allDevices is true
    // For now, just return a response for demonstration

    if (allDevices) {
      // Delete all sessions for user
      logger.info(`Logging out all devices for user ${userId}`);
    } else {
      // Delete specific session
      logger.info(`Logging out specific device for user ${userId}`);
    }

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Check if an email already exists in the user table
 * Used during registration flow to handle cases where webhooks may have already created the account
 */
export const checkEmailExists = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      next(new ApiError(400, "Email is required"));
      return;
    }

    const user = await User.findOne({ where: { email } });

    res
      .status(200)
      .json(
        SuccessResponse(
          { exists: user ? true : false },
          "Email existence check completed"
        )
      );
  } catch (error) {
    logger.error("Error checking email existence:", error);
    next(error);
  }
};
