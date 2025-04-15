import {
  Model,
  DataTypes,
  Optional,
  BelongsToGetAssociationMixin,
} from "sequelize";
import sequelize from "../config/database";
import Post from "./post.model";
import Keyword from "./keyword.model";

// Attributes interface
export interface PostKeywordAttributes {
  id: number;
  post_id: number;
  keyword_id: number;
  relevance: number | null;
  created_at: Date;

  // Associations
  keyword?: Keyword; // Add associated Keyword model
  post?: Post; // Add associated Post model
}

// Creation attributes
export interface PostKeywordCreationAttributes
  extends Optional<
    PostKeywordAttributes,
    "id" | "created_at" | "relevance" | "keyword" | "post"
  > {}

// Model class
class PostKeyword
  extends Model<PostKeywordAttributes, PostKeywordCreationAttributes>
  implements PostKeywordAttributes
{
  public id!: number;
  public post_id!: number;
  public keyword_id!: number;
  public relevance!: number | null;
  public created_at!: Date;

  // Associations
  public keyword?: Keyword; // Add property for associated Keyword
  public post?: Post; // Add property for associated Post

  // Association getters
  public getPost!: BelongsToGetAssociationMixin<Post>;
  public getKeyword!: BelongsToGetAssociationMixin<Keyword>;
}

// Initialize model
PostKeyword.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    post_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "posts",
        key: "id",
      },
    },
    keyword_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "keywords",
        key: "id",
      },
    },
    relevance: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: "post_keywords",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false, // No updated_at column
    indexes: [
      {
        unique: true,
        fields: ["post_id", "keyword_id"], // Each keyword can be assigned once per post
      },
    ],
  }
);

export default PostKeyword;
