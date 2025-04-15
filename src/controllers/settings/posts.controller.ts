import { Response } from "express";
import { User, UserPreference } from "../../models";
import { AuthRequest } from "../../types/auth.types";
import { ErrorResponse } from "../../utils/responses";
import logger from "../../config/logger";

/**
 * Get the user's post settings
 */
export const getPostSettings = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json(ErrorResponse("User not authenticated"));
    }

    const user = await User.findByPk(userId, {
      include: [
        {
          model: UserPreference,
          as: "preferences",
          attributes: [
            "default_keywords",
            "enable_scheduling",
            "max_schedule_days",
            "max_times_per_day",
            "selected_tones",
            "scheduled_times",
            "email_notifications",
            "desktop_notifications",
            "scheduling_notifications",
          ],
        },
      ],
    });

    if (!user) {
      return res.status(404).json(ErrorResponse("User not found"));
    }

    // Format data before sending
    let postSettings = {};

    if (user.preferences) {
      // Safely parse default_keywords
      let defaultKeywords = [];
      try {
        const rawKeywords = user.preferences.default_keywords;
        defaultKeywords =
          typeof rawKeywords === "string"
            ? JSON.parse(rawKeywords)
            : rawKeywords || [];
      } catch (e) {
        logger.warn(`Failed to parse default_keywords for user ${userId}`);
      }

      // Safely parse selected_tones
      let selectedTones = [];
      try {
        const rawTones = user.preferences.selected_tones;
        selectedTones =
          typeof rawTones === "string" ? JSON.parse(rawTones) : rawTones || [];
      } catch (e) {
        logger.warn(`Failed to parse selected_tones for user ${userId}`);
      }

      postSettings = {
        defaultKeywords,
        selectedTones,
        scheduling: {
          enabled: user.preferences.enable_scheduling,
          maxDays: user.preferences.max_schedule_days,
          maxTimesPerDay: user.preferences.max_times_per_day,
          scheduledTimes: user.preferences.scheduled_times || "{}",
        },
        notifications: {
          email: user.preferences.email_notifications,
          desktop: user.preferences.desktop_notifications,
          scheduling: user.preferences.scheduling_notifications,
        },
      };
    }

    res.json({
      success: true,
      data: postSettings,
    });
  } catch (error) {
    logger.error("Error retrieving post settings:", error);
    res
      .status(500)
      .json(ErrorResponse("Server error retrieving post settings"));
  }
};

/**
 * Update the user's post settings
 */
export const updatePostSettings = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json(ErrorResponse("User not authenticated"));
    }

    const { default_keywords, scheduling, content, notifications } = req.body;

    const user = await User.findByPk(userId, {
      include: [
        {
          model: UserPreference,
          as: "preferences",
        },
      ],
    });

    if (!user) {
      return res.status(404).json(ErrorResponse("User not found"));
    }

    // Update or create user preferences
    let preferences = user.preferences;

    // Create preferences if they don't exist
    if (!preferences) {
      preferences = await UserPreference.create({
        user_id: userId,
      });
    }

    // Update default keywords if provided
    if (default_keywords) {
      preferences.default_keywords = Array.isArray(default_keywords)
        ? JSON.stringify(default_keywords)
        : default_keywords;
    }

    // Update scheduling preferences if provided
    if (scheduling) {
      if (scheduling.enabled !== undefined) {
        preferences.enable_scheduling = scheduling.enabled;
      }

      if (scheduling.max_days) {
        preferences.max_schedule_days = scheduling.max_days;
      }

      if (scheduling.max_times_per_day) {
        preferences.max_times_per_day = scheduling.max_times_per_day;
      }

      if (scheduling.scheduled_times) {
        preferences.setScheduledTimes(scheduling.scheduled_times);
      }
    }

    // Update content preferences if provided
    if (content && content.selected_tones) {
      preferences.selected_tones = Array.isArray(content.selected_tones)
        ? JSON.stringify(content.selected_tones)
        : content.selected_tones;
    }

    // Update notification preferences if provided
    if (notifications) {
      if (notifications.email !== undefined) {
        preferences.email_notifications = notifications.email;
      }

      if (notifications.desktop !== undefined) {
        preferences.desktop_notifications = notifications.desktop;
      }

      if (notifications.scheduling !== undefined) {
        preferences.scheduling_notifications = notifications.scheduling;
      }
    }

    // Save preferences
    await preferences.save();

    // Return success
    res.json({
      success: true,
      message: "Post settings updated successfully",
    });
  } catch (error) {
    logger.error("Error updating post settings:", error);
    res.status(500).json(ErrorResponse("Server error updating post settings"));
  }
};
