import { Model, DataTypes, Optional } from "sequelize";
import sequelize from "../config/database";
import { UserStatus } from "./user.model";

// Attributes interface
export interface TemporaryRegistrationAttributes {
  id: number;
  email: string;
  password_hash: string;
  plan: string;
  registration_token: string;
  stripe_session_id: string | null;
  expires_at: Date;
  created_at: Date;
}

// Creation attributes
export interface TemporaryRegistrationCreationAttributes
  extends Optional<
    TemporaryRegistrationAttributes,
    "id" | "created_at" | "stripe_session_id"
  > {}

// Model class
class TemporaryRegistration
  extends Model<
    TemporaryRegistrationAttributes,
    TemporaryRegistrationCreationAttributes
  >
  implements TemporaryRegistrationAttributes
{
  public id!: number;
  public email!: string;
  public password_hash!: string;
  public plan!: string;
  public registration_token!: string;
  public stripe_session_id!: string | null;
  public expires_at!: Date;
  public created_at!: Date;

  // Check if registration has expired
  public isExpired(): boolean {
    return new Date() > this.expires_at;
  }
}

// Initialize model
TemporaryRegistration.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    plan: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "basic",
    },
    registration_token: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    stripe_session_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
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
    tableName: "temporary_registrations",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false, // No updated_at column
    indexes: [
      {
        unique: true,
        fields: ["email"],
      },
      {
        unique: true,
        fields: ["registration_token"],
      },
    ],
  }
);

export default TemporaryRegistration;
