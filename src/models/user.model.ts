import { Model, DataTypes, Optional } from "sequelize";
import sequelize from "../config/database";
import bcrypt from "bcrypt";
import { BusinessProfileAttributes } from "./business-profile.model";
import BusinessProfile from "./business-profile.model";
import { UserPreferenceAttributes } from "./user-preference.model";
import UserPreference from "./user-preference.model";
import { SubscriptionAttributes } from "./subscription.model";
import Subscription from "./subscription.model";
import { BillingTransactionAttributes } from "./billing-transaction.model";
import BillingTransaction from "./billing-transaction.model";

export enum UserRole {
  ADMIN = "admin",
  USER = "user",
}

export enum UserStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  SUSPENDED = "suspended",
  PENDING = "pending",
}

export interface UserAttributes {
  id: number;
  username: string;
  email: string;
  password: string;
  password_hash?: string;
  role: UserRole;
  status: UserStatus;
  email_verified: boolean;
  last_login: Date | null;
  plan: string;
  failed_attempts: number;
  locked_until: Date | null;
  created_at: Date;
  updated_at: Date;
  // Relations
  businessProfile?: BusinessProfile;
  preferences?: UserPreference;
  subscription?: Subscription;
  billingTransactions?: BillingTransaction[];
}

export interface UserCreationAttributes
  extends Optional<
    UserAttributes,
    | "id"
    | "role"
    | "status"
    | "email_verified"
    | "last_login"
    | "plan"
    | "failed_attempts"
    | "locked_until"
    | "created_at"
    | "updated_at"
    | "businessProfile"
    | "preferences"
    | "subscription"
    | "billingTransactions"
    | "password_hash"
  > {}

class User
  extends Model<UserAttributes, UserCreationAttributes>
  implements UserAttributes
{
  public id!: number;
  public username!: string;
  public email!: string;
  public password!: string;
  public password_hash?: string;
  public role!: UserRole;
  public status!: UserStatus;
  public email_verified!: boolean;
  public last_login!: Date | null;
  public plan!: string;
  public failed_attempts!: number;
  public locked_until!: Date | null;
  public created_at!: Date;
  public updated_at!: Date;
  // Relations
  public businessProfile?: BusinessProfile;
  public preferences?: UserPreference;
  public subscription?: Subscription;
  public billingTransactions?: BillingTransaction[];

  // Instance methods
  public async comparePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password);
  }

  public async validatePassword(password: string): Promise<boolean> {
    return this.comparePassword(password);
  }

  public isAdmin(): boolean {
    return this.role === UserRole.ADMIN;
  }

  public isActive(): boolean {
    return this.status === UserStatus.ACTIVE;
  }

  // Determine if user has an active subscription
  public hasActiveSubscription(): boolean {
    return this.subscription?.isActive || false;
  }

  // Get user's current plan
  public getCurrentPlan(): string | null {
    return this.plan || this.subscription?.plan || null;
  }
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    password_hash: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    plan: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "free",
    },
    failed_attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    locked_until: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    role: {
      type: DataTypes.ENUM(...Object.values(UserRole)),
      allowNull: false,
      defaultValue: UserRole.USER,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(UserStatus)),
      allowNull: false,
      defaultValue: UserStatus.PENDING,
    },
    email_verified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    last_login: {
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
    tableName: "users",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    hooks: {
      // beforeCreate: async (user: User) => {
      //   user.password = await bcrypt.hash(user.password, 10);
      // },
      beforeUpdate: async (user: User) => {
        if (user.changed("password")) {
          user.password = await bcrypt.hash(user.password, 10);
        }
      },
    },
  }
);

export default User;
