import { Model, DataTypes, Optional } from "sequelize";
import sequelize from "../config/database";

// Attributes interface
export interface KeywordAttributes {
  id: number;
  user_id: number;
  word: string;
  relevance: number | null;
  usage_count: number;
  created_at: Date;
  updated_at: Date;
}

// Creation attributes
export interface KeywordCreationAttributes
  extends Optional<
    KeywordAttributes,
    "id" | "created_at" | "updated_at" | "relevance" | "usage_count"
  > {}

// Model class
class Keyword
  extends Model<KeywordAttributes, KeywordCreationAttributes>
  implements KeywordAttributes
{
  public id!: number;
  public user_id!: number;
  public word!: string;
  public relevance!: number | null;
  public usage_count!: number;
  public created_at!: Date;
  public updated_at!: Date;

  // Increment usage count
  public async incrementUsage(): Promise<void> {
    this.usage_count += 1;
    await this.save();
  }
}

// Initialize model
Keyword.init(
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
    word: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    relevance: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    usage_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
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
    tableName: "keywords",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        unique: true,
        fields: ["user_id", "word"], // Each user can have unique keywords
      },
    ],
  }
);

export default Keyword;
