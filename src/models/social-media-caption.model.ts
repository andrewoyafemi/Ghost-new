import {
  Model,
  DataTypes,
  Optional,
  BelongsToGetAssociationMixin,
} from "sequelize";
import sequelize from "../config/database";
import User from "./user.model";
import Post from "./post.model";

// Caption status enum
export enum CaptionStatus {
  DRAFT = "draft",
  SCHEDULED = "scheduled",
  PUBLISHED = "published",
}

// Social media platform enum
export enum SocialMediaPlatform {
  FACEBOOK = "facebook",
  INSTAGRAM = "instagram",
  TWITTER = "twitter",
  LINKEDIN = "linkedin",
  PINTEREST = "pinterest",
}

// Attributes interface
export interface SocialMediaCaptionAttributes {
  id: number;
  user_id: number;
  post_id: number | null;
  platform: SocialMediaPlatform;
  caption_text: string;
  status: CaptionStatus;
  platform_post_id: string | null;
  platform_post_url: string | null;
  scheduled_for: Date | null;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

// Creation attributes
export interface SocialMediaCaptionCreationAttributes
  extends Optional<
    SocialMediaCaptionAttributes,
    | "id"
    | "created_at"
    | "updated_at"
    | "status"
    | "platform_post_id"
    | "platform_post_url"
    | "scheduled_for"
    | "published_at"
  > {}

// Model class
class SocialMediaCaption
  extends Model<
    SocialMediaCaptionAttributes,
    SocialMediaCaptionCreationAttributes
  >
  implements SocialMediaCaptionAttributes
{
  public id!: number;
  public user_id!: number;
  public post_id!: number | null;
  public platform!: SocialMediaPlatform;
  public caption_text!: string;
  public status!: CaptionStatus;
  public platform_post_id!: string | null;
  public platform_post_url!: string | null;
  public scheduled_for!: Date | null;
  public published_at!: Date | null;
  public created_at!: Date;
  public updated_at!: Date;

  // Association getters
  public getUser!: BelongsToGetAssociationMixin<User>;
  public getPost!: BelongsToGetAssociationMixin<Post>;

  // Check if caption is ready to be published (scheduled time reached)
  public isReadyToPublish(): boolean {
    if (this.status !== CaptionStatus.SCHEDULED) return false;
    if (!this.scheduled_for) return false;

    return new Date() >= this.scheduled_for;
  }
}

// Initialize model
SocialMediaCaption.init(
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
    post_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "posts",
        key: "id",
      },
    },
    platform: {
      type: DataTypes.ENUM(...Object.values(SocialMediaPlatform)),
      allowNull: false,
    },
    caption_text: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(CaptionStatus)),
      allowNull: false,
      defaultValue: CaptionStatus.DRAFT,
    },
    platform_post_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    platform_post_url: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    scheduled_for: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    published_at: {
      type: DataTypes.DATE,
      allowNull: true,
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
    tableName: "social_media_captions",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    hooks: {
      beforeUpdate: (caption: SocialMediaCaption) => {
        // Set published_at if status changed to published
        if (
          caption.changed("status") &&
          caption.status === CaptionStatus.PUBLISHED &&
          !caption.published_at
        ) {
          caption.published_at = new Date();
        }
      },
    },
  }
);

export default SocialMediaCaption;
