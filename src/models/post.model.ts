import {
  Model,
  DataTypes,
  Optional,
  HasManyGetAssociationsMixin,
  BelongsToGetAssociationMixin,
} from "sequelize";
import sequelize from "../config/database";
import PostKeyword from "./post-keyword.model";
import SocialMediaCaption from "./social-media-caption.model";
import User from "./user.model";

// Post status enum
export enum PostStatus {
  DRAFT = "draft",
  SCHEDULED = "scheduled",
  PUBLISHED = "published",
}

// Attributes interface
export interface PostAttributes {
  id: number;
  user_id: number;
  title: string;
  content: string;
  status: PostStatus;
  word_count: number | null;
  scheduled_for: Date | null;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
  last_autosaved_at: Date | null;
  wordpress_id: number | null; // WordPress post ID
  wordpress_url: string | null; // WordPress post URL
}

// Creation attributes
export interface PostCreationAttributes
  extends Optional<
    PostAttributes,
    | "id"
    | "created_at"
    | "updated_at"
    | "status"
    | "word_count"
    | "scheduled_for"
    | "published_at"
    | "last_autosaved_at"
    | "wordpress_id"
    | "wordpress_url"
  > {}

// Model class
class Post
  extends Model<PostAttributes, PostCreationAttributes>
  implements PostAttributes
{
  public id!: number;
  public user_id!: number;
  public title!: string;
  public content!: string;
  public status!: PostStatus;
  public word_count!: number | null;
  public scheduled_for!: Date | null;
  public published_at!: Date | null;
  public created_at!: Date;
  public updated_at!: Date;
  public last_autosaved_at!: Date | null;
  public wordpress_id!: number | null; // WordPress post ID
  public wordpress_url!: string | null; // WordPress post URL

  // Association getters
  public getUser!: BelongsToGetAssociationMixin<User>;
  public getPostKeywords!: HasManyGetAssociationsMixin<PostKeyword>;
  public getSocialMediaCaptions!: HasManyGetAssociationsMixin<SocialMediaCaption>;

  // Calculate word count
  public calculateWordCount(): number {
    const wordCount = this.content.split(/\s+/).filter(Boolean).length;
    return wordCount;
  }

  // Check if post is ready to be published (scheduled time reached)
  public isReadyToPublish(): boolean {
    if (this.status !== PostStatus.SCHEDULED) return false;
    if (!this.scheduled_for) return false;

    return new Date() >= this.scheduled_for;
  }
}

// Initialize model
Post.init(
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
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(PostStatus)),
      allowNull: false,
      defaultValue: PostStatus.DRAFT,
    },
    word_count: {
      type: DataTypes.INTEGER,
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
    last_autosaved_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    wordpress_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    wordpress_url: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "posts",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    hooks: {
      beforeCreate: (post: Post) => {
        // Calculate word count if not provided
        if (!post.word_count) {
          post.word_count = post.calculateWordCount();
        }

        // Set published_at if status is published
        if (post.status === PostStatus.PUBLISHED && !post.published_at) {
          post.published_at = new Date();
        }
      },
      beforeUpdate: (post: Post) => {
        // Calculate word count if content changed
        if (post.changed("content")) {
          post.word_count = post.calculateWordCount();
        }

        // Set published_at if status changed to published
        if (
          post.changed("status") &&
          post.status === PostStatus.PUBLISHED &&
          !post.published_at
        ) {
          post.published_at = new Date();
        }
      },
    },
  }
);

export default Post;
