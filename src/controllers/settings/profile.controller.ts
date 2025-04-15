import { Request, Response } from "express";
import { User, BusinessProfile } from "../../models";
import { AuthRequest } from "../../types/auth.types";
import { ErrorResponse } from "../../utils/responses";
import logger from "../../config/logger";

/**
 * Get the user's profile settings
 */
export const getProfileSettings = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json(ErrorResponse("User not authenticated"));
    }

    const user = await User.findByPk(userId, {
      attributes: [
        "id",
        "username",
        "email",
        "email_verified",
        "role",
        "status",
        "created_at",
      ],
      include: [
        {
          model: BusinessProfile,
          as: "businessProfile",
          attributes: [
            "business_name",
            "ideal_client",
            "client_promises",
            "client_expectations",
            "wordpress_site_url",
            "wordpress_username",
            "hasWordPressIntegration",
          ],
        },
      ],
    });

    if (!user) {
      return res.status(404).json(ErrorResponse("User not found"));
    }

    // Format data before sending
    const profileSettings = {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        email_verified: user.email_verified,
        role: user.role,
        status: user.status,
        created_at: user.created_at,
      },
      business: user.businessProfile
        ? {
            business_name: user.businessProfile.business_name,
            ideal_client: user.businessProfile.ideal_client,
            client_promises:
              typeof user.businessProfile.client_promises === "string"
                ? JSON.parse(user.businessProfile.client_promises as string)
                : user.businessProfile.client_promises,
            client_expectations:
              typeof user.businessProfile.client_expectations === "string"
                ? JSON.parse(user.businessProfile.client_expectations as string)
                : user.businessProfile.client_expectations,
            wordpress_integration: {
              enabled: user.businessProfile.hasWordPressIntegration(),
              website_url: user.businessProfile.wordpress_site_url,
              username: user.businessProfile.wordpress_username,
            },
          }
        : null,
    };

    return res.status(200).json({
      success: true,
      data: profileSettings,
    });
  } catch (error) {
    logger.error("Error getting profile settings:", error);
    return res
      .status(500)
      .json(ErrorResponse("Error retrieving profile settings"));
  }
};

/**
 * Update the user's profile settings
 */
export const updateProfileSettings = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json(ErrorResponse("User not authenticated"));
    }

    const {
      username,
      email,
      business_name,
      ideal_client,
      client_promises,
      client_expectations,
      wordpress_integration,
    } = req.body;

    const user = await User.findByPk(userId, {
      include: [
        {
          model: BusinessProfile,
          as: "businessProfile",
        },
      ],
    });

    if (!user) {
      return res.status(404).json(ErrorResponse("User not found"));
    }

    // Update user details if provided
    if (username) user.username = username;
    if (email) user.email = email;
    await user.save();

    // Update or create business profile if data provided
    if (
      business_name ||
      ideal_client ||
      client_promises ||
      client_expectations ||
      wordpress_integration
    ) {
      let businessProfile = user.businessProfile;

      // Create business profile if it doesn't exist
      if (!businessProfile) {
        businessProfile = await BusinessProfile.create({
          user_id: userId,
          business_name: "Default Business",
          ideal_client: "",
          client_promises: [],
          client_expectations: [],
        });
      }

      // Update business profile fields if provided
      if (business_name) businessProfile.business_name = business_name;
      if (ideal_client) businessProfile.ideal_client = ideal_client;
      if (client_promises) {
        businessProfile.client_promises =
          typeof client_promises === "string"
            ? client_promises
            : JSON.stringify(client_promises);
      }
      if (client_expectations) {
        businessProfile.client_expectations =
          typeof client_expectations === "string"
            ? client_expectations
            : JSON.stringify(client_expectations);
      }

      // Update WordPress integration if provided
      if (wordpress_integration) {
        if (wordpress_integration.enabled) {
          businessProfile.wordpress_site_url =
            wordpress_integration.website_url || null;
          businessProfile.wordpress_username =
            wordpress_integration.username || null;
          businessProfile.wordpress_api_key =
            wordpress_integration.application_password || null;
        } else {
          // Clear WordPress integration if disabled
          businessProfile.wordpress_site_url = null;
          businessProfile.wordpress_username = null;
          businessProfile.wordpress_api_key = null;
        }
      }

      await businessProfile.save();
    }

    return res.status(200).json({
      success: true,
      message: "Profile settings updated successfully",
    });
  } catch (error) {
    logger.error("Error updating profile settings:", error);
    return res
      .status(500)
      .json(ErrorResponse("Error updating profile settings"));
  }
};

/**
 * Update the user's password
 */
export const updatePassword = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json(ErrorResponse("User not authenticated"));
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json(ErrorResponse("Current password and new password are required"));
    }

    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json(ErrorResponse("User not found"));
    }

    // Verify current password
    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      return res
        .status(401)
        .json(ErrorResponse("Current password is incorrect"));
    }

    // Ensure new password is different from current password
    if (currentPassword === newPassword) {
      return res
        .status(400)
        .json(
          ErrorResponse("New password must be different from current password")
        );
    }

    // Update password
    user.password = newPassword;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    logger.error("Error updating password:", error);
    return res.status(500).json(ErrorResponse("Error updating password"));
  }
};
