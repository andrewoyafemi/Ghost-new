import { Model, DataTypes, Optional } from "sequelize";
import sequelize from "../config/database";

// Attributes interface
export interface SessionAttributes {
  id: number;
  user_id: number;
  token: string;
  expires_at: Date;
  created_at: Date;
}

// Creation attributes
export interface SessionCreationAttributes
  extends Optional<SessionAttributes, "id" | "created_at"> {}

// Model class
class Session
  extends Model<SessionAttributes, SessionCreationAttributes>
  implements SessionAttributes
{
  public id!: number;
  public user_id!: number;
  public token!: string;
  public expires_at!: Date;
  public created_at!: Date;

  // Check if session is expired
  public isExpired(): boolean {
    return new Date() > this.expires_at;
  }
}

// Initialize model
Session.init(
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
    token: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: "sessions",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false, // No updated_at column
  }
);

export default Session;
