import {
  Model,
  DataTypes,
  Optional,
  Sequelize,
  BelongsToGetAssociationMixin,
} from "sequelize";
import { PlanType, LegacyPlanType } from "../utils/plan-config";
import sequelize from "../config/database";

// Payment status enum
export enum PaymentStatus {
  PAID = "paid",
  UNPAID = "unpaid",
  FAILED = "failed",
  REFUNDED = "refunded",
  PENDING = "pending",
}

// Subscription status enum
export enum SubscriptionStatus {
  ACTIVE = "active",
  CANCELLED = "cancelled",
  EXPIRED = "expired",
  SUSPENDED = "suspended",
  PAST_DUE = "past_due",
  TRIALING = "trialing",
}

// Billing cycle enum
export enum BillingCycle {
  MONTHLY = "monthly",
  ANNUAL = "annual",
}

// Subscription attributes interface
export interface SubscriptionAttributes {
  id: number;
  user_id: number;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  stripe_price_id: string | null;
  plan: string; // Using string to support both legacy and new plan types
  billing_cycle: BillingCycle;
  status: SubscriptionStatus;
  payment_status: PaymentStatus;
  trial_end: Date | null;
  current_period_start: Date;
  current_period_end: Date;
  cancel_at_period_end: boolean;
  canceled_at: Date | null;
  posts_used_count: number; // Track posts used in current billing cycle
  created_at: Date;
  updated_at: Date;
}

// Subscription creation attributes interface (optional fields)
export interface SubscriptionCreationAttributes
  extends Optional<
    SubscriptionAttributes,
    | "id"
    | "trial_end"
    | "canceled_at"
    | "created_at"
    | "updated_at"
    | "posts_used_count"
    | "cancel_at_period_end"
    | "stripe_subscription_id"
    | "stripe_customer_id"
    | "stripe_price_id"
  > {}

// Subscription model class
class Subscription extends Model<
  SubscriptionAttributes,
  SubscriptionCreationAttributes
> {
  public id!: number;
  public user_id!: number;
  public stripe_subscription_id!: string | null;
  public stripe_customer_id!: string | null;
  public stripe_price_id!: string | null;
  public plan!: string;
  public billing_cycle!: BillingCycle;
  public status!: SubscriptionStatus;
  public payment_status!: PaymentStatus;
  public trial_end!: Date | null;
  public current_period_start!: Date;
  public current_period_end!: Date;
  public cancel_at_period_end!: boolean;
  public canceled_at!: Date | null;
  public posts_used_count!: number; // Track posts used in current billing cycle
  public created_at!: Date;
  public updated_at!: Date;

  // Virtual field to check if subscription is active
  get isActive(): boolean {
    return (
      this.status === SubscriptionStatus.ACTIVE ||
      this.status === SubscriptionStatus.TRIALING
    );
  }

  // Virtual field to check if subscription will renew
  get willRenew(): boolean {
    return (
      this.isActive &&
      !this.cancel_at_period_end &&
      (this.payment_status === PaymentStatus.PAID ||
        this.payment_status === PaymentStatus.PENDING)
    );
  }

  // Method to calculate days until renewal
  public daysUntilRenewal(): number {
    const today = new Date();
    const endDate = new Date(this.current_period_end);
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  }

  // Method to reset post usage count (called at the start of a new billing cycle)
  public resetPostUsage(): void {
    this.posts_used_count = 0;
  }

  // Method to increment post usage count
  public incrementPostUsage(): void {
    this.posts_used_count += 1;
  }

  // Method to check if user has available posts in their plan
  public hasAvailablePosts(planMaxPosts: number): boolean {
    return this.posts_used_count < planMaxPosts;
  }

  // Associations
  public getUser!: BelongsToGetAssociationMixin<any>;

  // Method to initialize the model with sequelize
  public static initialize(sequelize: Sequelize): void {
    Subscription.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        user_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: "users",
            key: "id",
          },
        },
        stripe_subscription_id: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        stripe_customer_id: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        stripe_price_id: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        plan: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: PlanType.LONE_RANGER,
          validate: {
            isValidPlan(value: string) {
              const validPlans = [
                ...Object.values(PlanType),
                ...Object.values(LegacyPlanType),
              ];
              if (!validPlans.includes(value as any)) {
                throw new Error(`Invalid plan: ${value}`);
              }
            },
          },
        },
        billing_cycle: {
          type: DataTypes.ENUM(...Object.values(BillingCycle)),
          allowNull: false,
          defaultValue: BillingCycle.MONTHLY,
        },
        status: {
          type: DataTypes.ENUM(...Object.values(SubscriptionStatus)),
          allowNull: false,
          defaultValue: SubscriptionStatus.ACTIVE,
        },
        payment_status: {
          type: DataTypes.ENUM(...Object.values(PaymentStatus)),
          allowNull: false,
          defaultValue: PaymentStatus.PAID,
        },
        trial_end: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        current_period_start: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        current_period_end: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: () => {
            const date = new Date();
            date.setMonth(date.getMonth() + 1);
            return date;
          },
        },
        cancel_at_period_end: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        canceled_at: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        posts_used_count: {
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
        tableName: "subscriptions",
        modelName: "Subscription",
        timestamps: true,
        createdAt: "created_at",
        updatedAt: "updated_at",
        indexes: [
          {
            name: "user_id_index",
            fields: ["user_id"],
          },
          {
            name: "stripe_subscription_id_index",
            fields: ["stripe_subscription_id"],
            unique: true,
            where: {
              stripe_subscription_id: {
                [Symbol.for("ne")]: null,
              },
            },
          },
          {
            name: "status_index",
            fields: ["status"],
          },
        ],
      }
    );
  }

  // Method to define associations with other models
  public static associate(models: any): void {
    Subscription.belongsTo(models.User, {
      foreignKey: "user_id",
      as: "user",
    });
  }
}

// Initialize the model directly
Subscription.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
    },
    stripe_subscription_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    stripe_customer_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    stripe_price_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    plan: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: PlanType.LONE_RANGER,
      validate: {
        isValidPlan(value: string) {
          const validPlans = [
            ...Object.values(PlanType),
            ...Object.values(LegacyPlanType),
          ];
          if (!validPlans.includes(value as any)) {
            throw new Error(`Invalid plan: ${value}`);
          }
        },
      },
    },
    billing_cycle: {
      type: DataTypes.ENUM(...Object.values(BillingCycle)),
      allowNull: false,
      defaultValue: BillingCycle.MONTHLY,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(SubscriptionStatus)),
      allowNull: false,
      defaultValue: SubscriptionStatus.ACTIVE,
    },
    payment_status: {
      type: DataTypes.ENUM(...Object.values(PaymentStatus)),
      allowNull: false,
      defaultValue: PaymentStatus.PAID,
    },
    trial_end: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    current_period_start: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    current_period_end: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: () => {
        const date = new Date();
        date.setMonth(date.getMonth() + 1);
        return date;
      },
    },
    cancel_at_period_end: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    canceled_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    posts_used_count: {
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
    tableName: "subscriptions",
    modelName: "Subscription",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

export default Subscription;
