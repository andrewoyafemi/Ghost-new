import { Model, DataTypes, Optional } from "sequelize";
import sequelize from "../config/database";

// Attributes interface
export interface UserPreferenceAttributes {
  id: number;
  user_id: number;
  default_keywords: string[] | string;
  enable_scheduling: boolean;
  max_schedule_days: number;
  max_times_per_day: number;
  selected_tones: string[] | string;
  scheduled_times: string;
  email_notifications: boolean;
  desktop_notifications: boolean;
  scheduling_notifications: boolean;
  created_at: Date;
  updated_at: Date;
}

// Creation attributes
export interface UserPreferenceCreationAttributes
  extends Optional<
    UserPreferenceAttributes,
    | "id"
    | "default_keywords"
    | "enable_scheduling"
    | "max_schedule_days"
    | "max_times_per_day"
    | "selected_tones"
    | "scheduled_times"
    | "email_notifications"
    | "desktop_notifications"
    | "scheduling_notifications"
    | "created_at"
    | "updated_at"
  > {}

// Model class
class UserPreference
  extends Model<UserPreferenceAttributes, UserPreferenceCreationAttributes>
  implements UserPreferenceAttributes
{
  public id!: number;
  public user_id!: number;
  public default_keywords!: string[] | string;
  public enable_scheduling!: boolean;
  public max_schedule_days!: number;
  public max_times_per_day!: number;
  public selected_tones!: string[] | string;
  public scheduled_times!: string;
  public email_notifications!: boolean;
  public desktop_notifications!: boolean;
  public scheduling_notifications!: boolean;
  public created_at!: Date;
  public updated_at!: Date;

  // Get scheduled times as object (days of week with times)
  public getScheduledTimes(): Record<string, string[]> {
    if (!this.scheduled_times) {
      return {};
    }

    try {
      return JSON.parse(this.scheduled_times);
    } catch (error) {
      return {};
    }
  }

  // Set scheduled times (store as JSON string)
  public setScheduledTimes(scheduledTimes: Record<string, string[]>) {
    this.scheduled_times = JSON.stringify(scheduledTimes);
  }
}

// Initialize model
UserPreference.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    default_keywords: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const value = this.getDataValue("default_keywords");
        if (!value) return [];
        try {
          return JSON.parse(value as string);
        } catch (error) {
          return [];
        }
      },
      set(value: string[] | string) {
        if (Array.isArray(value)) {
          this.setDataValue("default_keywords", JSON.stringify(value));
        } else {
          this.setDataValue("default_keywords", value);
        }
      },
    },
    enable_scheduling: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    max_schedule_days: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 7,
    },
    max_times_per_day: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 3,
    },
    selected_tones: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const value = this.getDataValue("selected_tones");
        if (!value) return [];
        try {
          return JSON.parse(value as string);
        } catch (error) {
          return [];
        }
      },
      set(value: string[] | string) {
        if (Array.isArray(value)) {
          this.setDataValue("selected_tones", JSON.stringify(value));
        } else {
          this.setDataValue("selected_tones", value);
        }
      },
    },
    scheduled_times: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: "{}",
    },
    email_notifications: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    desktop_notifications: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    scheduling_notifications: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: "user_preferences",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

// Export model
export default UserPreference;
