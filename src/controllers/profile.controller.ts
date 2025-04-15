import { Request, Response, NextFunction } from "express";
import { User, BusinessProfile, UserPreference } from "../models";
import {
  ValidationError,
  NotFoundError,
  AuthorizationError,
} from "../middlewares/error.middleware";
import logger from "../config/logger";
import bcrypt from "bcrypt";

/**
 * Get user profile
 * GET /api/v1/profile
 */
export const getProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      throw new AuthorizationError("Not authenticated");
    }

    // Get user with business profile
    const user = await User.findByPk(userId, {
      include: [{ model: BusinessProfile, as: "businessProfile" }],
      attributes: { exclude: ["password_hash"] }, // Exclude sensitive data
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    // Format response
    const response = {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        plan: user.plan,
        lastLogin: user.last_login,
      },
      businessProfile: user.businessProfile
        ? {
            businessName: user.businessProfile.business_name,
            idealClient: user.businessProfile.ideal_client,
            clientPromises: user.businessProfile.client_promises,
            clientExpectations: user.businessProfile.client_expectations,
            wordpressIntegration:
              user.businessProfile.hasWordPressIntegration(),
            wordpressSiteUrl: user.businessProfile.wordpress_site_url,
            wordpressUsername: user.businessProfile.wordpress_username,
            wordpressApiKey: user.businessProfile.wordpress_api_key,
          }
        : null,
    };

    res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user profile
 * PUT /api/v1/profile
 */
export const updateProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId;
    const { username, email } = req.body;

    if (!userId) {
      throw new AuthorizationError("Not authenticated");
    }

    // Find user
    const user = await User.findByPk(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    // Check for email uniqueness if it's being updated
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        throw new ValidationError("Email already in use");
      }
    }

    // Update user
    if (username) user.username = username;
    if (email) user.email = email;
    await user.save();

    // Get updated user
    const updatedUser = await User.findByPk(userId, {
      include: [{ model: BusinessProfile, as: "businessProfile" }],
      attributes: { exclude: ["password_hash"] },
    });

    // Format response
    const response = {
      user: {
        id: updatedUser?.id,
        email: updatedUser?.email,
        username: updatedUser?.username,
        plan: updatedUser?.plan,
        lastLogin: updatedUser?.last_login,
      },
      businessProfile: updatedUser?.businessProfile
        ? {
            businessName: updatedUser.businessProfile.business_name,
            idealClient: updatedUser.businessProfile.ideal_client,
            clientPromises: updatedUser.businessProfile.client_promises,
            clientExpectations: updatedUser.businessProfile.client_expectations,
            wordpressIntegration:
              updatedUser.businessProfile.hasWordPressIntegration(),
          }
        : null,
    };

    res.status(200).json({
      success: true,
      data: response,
      message: "Profile updated successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update business profile
 * PUT /api/v1/profile/business
 */
export const updateBusinessProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId;
    const {
      businessName,
      idealClient,
      clientPromises,
      clientExpectations,
      wordpressSiteUrl,
      wordpressUsername,
      wordpressApiKey,
    } = req.body;

    if (!userId) {
      throw new AuthorizationError("Not authenticated");
    }

    // Validate required fields
    if (
      !businessName ||
      !idealClient ||
      !clientPromises ||
      !clientExpectations ||
      !wordpressSiteUrl ||
      !wordpressUsername ||
      !wordpressApiKey
    ) {
      throw new ValidationError(
        "All business profile fields and WordPress integration settings are required"
      );
    }

    // Process clientPromises and clientExpectations - convert strings to arrays if needed
    const processedClientPromises = Array.isArray(clientPromises)
      ? clientPromises
      : clientPromises
          .split("\n\n")
          .map((item: string) => item.trim())
          .filter(Boolean);

    const processedClientExpectations = Array.isArray(clientExpectations)
      ? clientExpectations
      : clientExpectations
          .split("\n\n")
          .map((item: string) => item.trim())
          .filter(Boolean);

    // Check if profile exists
    let profile = await BusinessProfile.findOne({ where: { user_id: userId } });

    if (profile) {
      // Update existing profile with all fields including WordPress
      profile = await profile.update({
        business_name: businessName,
        ideal_client: idealClient,
        client_promises: processedClientPromises,
        client_expectations: processedClientExpectations,
        wordpress_site_url: wordpressSiteUrl,
        wordpress_username: wordpressUsername,
        wordpress_api_key: wordpressApiKey,
      });
    } else {
      // Create new profile with all fields including WordPress
      profile = await BusinessProfile.create({
        user_id: userId,
        business_name: businessName,
        ideal_client: idealClient,
        client_promises: processedClientPromises,
        client_expectations: processedClientExpectations,
        wordpress_site_url: wordpressSiteUrl,
        wordpress_username: wordpressUsername,
        wordpress_api_key: wordpressApiKey,
      });
    }

    // Format response
    const response = {
      businessProfile: {
        businessName: profile.business_name,
        idealClient: profile.ideal_client,
        clientPromises: profile.client_promises,
        clientExpectations: profile.client_expectations,
        wordpressIntegration: profile.hasWordPressIntegration(),
        wordpressSiteUrl: profile.wordpress_site_url,
        wordpressUsername: profile.wordpress_username,
        wordpressApiKey: profile.wordpress_api_key,
      },
    };

    res.status(200).json({
      success: true,
      data: response,
      message: "Business profile updated successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get WordPress settings
 * GET /api/v1/profile/wordpress
 */
export const getWordPressSettings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      throw new AuthorizationError("Not authenticated");
    }

    // Get business profile
    const profile = await BusinessProfile.findOne({
      where: { user_id: userId },
    });

    if (!profile) {
      throw new NotFoundError("Business profile not found");
    }

    // Format response
    const response = {
      wordpressSettings: {
        enabled: profile.hasWordPressIntegration(),
        siteUrl: profile.wordpress_site_url,
        username: profile.wordpress_username,
        // Don't return the API key for security reasons
        apiKeyConfigured: !!profile.wordpress_api_key,
      },
    };

    res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update WordPress settings
 * PUT /api/v1/profile/wordpress
 */
export const updateWordPressSettings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId;
    const { siteUrl, username, apiKey } = req.body;

    if (!userId) {
      throw new AuthorizationError("Not authenticated");
    }

    // Check if profile exists
    let profile = await BusinessProfile.findOne({ where: { user_id: userId } });

    if (!profile) {
      throw new NotFoundError("Business profile must be created first");
    }

    // Update WordPress settings
    profile = await profile.update({
      wordpress_site_url: siteUrl,
      wordpress_username: username,
      // Only update API key if provided
      ...(apiKey && { wordpress_api_key: apiKey }),
    });

    // TODO: In a real implementation, verify the WordPress credentials
    // by making a test connection to the WordPress API

    // Format response
    const response = {
      wordpressSettings: {
        enabled: profile.hasWordPressIntegration(),
        siteUrl: profile.wordpress_site_url,
        username: profile.wordpress_username,
        apiKeyConfigured: !!profile.wordpress_api_key,
      },
    };

    res.status(200).json({
      success: true,
      data: response,
      message: "WordPress settings updated successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete WordPress integration
 * DELETE /api/v1/profile/wordpress
 */
export const deleteWordPressSettings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      throw new AuthorizationError("Not authenticated");
    }

    // Get business profile
    const profile = await BusinessProfile.findOne({
      where: { user_id: userId },
    });

    if (!profile) {
      throw new NotFoundError("Business profile not found");
    }

    // Clear WordPress settings
    await profile.update({
      wordpress_site_url: null,
      wordpress_username: null,
      wordpress_api_key: null,
    });

    res.status(200).json({
      success: true,
      message: "WordPress integration removed successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user password
 * PUT /api/v1/profile/password
 */
export const updatePassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId;
    const { currentPassword, newPassword } = req.body;

    if (!userId) {
      throw new AuthorizationError("Not authenticated");
    }

    // Validate inputs
    if (!currentPassword || !newPassword) {
      throw new ValidationError(
        "Current password and new password are required"
      );
    }

    // Find user
    const user = await User.findByPk(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    // Verify current password
    const isPasswordValid = await user.validatePassword(currentPassword);
    if (!isPasswordValid) {
      throw new ValidationError("Current password is incorrect");
    }

    // Check if new password is the same as the current one
    const isSamePassword = await user.validatePassword(newPassword);
    if (isSamePassword) {
      throw new ValidationError(
        "New password must be different from the current one"
      );
    }

    // Update password
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || "10", 10);
    user.password = await bcrypt.hash(newPassword, saltRounds);
    await user.save();

    // In a real implementation, you might want to:
    // 1. Log the password change
    // 2. Add the old password to a password history table
    // 3. Send an email notification
    // 4. Optionally invalidate existing sessions

    res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user preferences
 * GET /api/v1/profile/preferences
 */
export const getPreferences = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      throw new AuthorizationError("Not authenticated");
    }

    // Get user preferences
    const preferences = await UserPreference.findOne({
      where: { user_id: userId },
    });

    if (!preferences) {
      throw new NotFoundError("User preferences not found");
    }

    // Format response
    const response = {
      preferences: {
        defaultKeywords: preferences.default_keywords || [],
        selectedTones: preferences.selected_tones || [],
        scheduledTimes: preferences.scheduled_times || {},
      },
    };

    res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user preferences
 * PUT /api/v1/profile/preferences
 */
export const updatePreferences = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId;
    const { defaultKeywords, selectedTones, scheduledTimes } = req.body;

    if (!userId) {
      throw new AuthorizationError("Not authenticated");
    }

    // Find or create user preferences
    let preferences = await UserPreference.findOne({
      where: { user_id: userId },
    });

    if (preferences) {
      // Update existing preferences
      preferences = await preferences.update({
        default_keywords: defaultKeywords,
        selected_tones: selectedTones,
        scheduled_times: JSON.stringify(scheduledTimes),
      });
    } else {
      // Create new preferences
      preferences = await UserPreference.create({
        user_id: userId,
        default_keywords: defaultKeywords,
        selected_tones: selectedTones,
        scheduled_times: scheduledTimes,
      });
    }

    // Format response
    const response = {
      preferences: {
        defaultKeywords: preferences.default_keywords,
        selectedTones: preferences.selected_tones,
        scheduledTimes: preferences.scheduled_times,
      },
    };

    res.status(200).json({
      success: true,
      data: response,
      message: "Preferences updated successfully",
    });
  } catch (error) {
    next(error);
  }
};
