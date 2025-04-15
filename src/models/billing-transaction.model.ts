import { Model, DataTypes, Optional } from "sequelize";
import sequelize from "../config/database";
import { PaymentStatus } from "./subscription.model";

// Attributes interface
export interface BillingTransactionAttributes {
  id: number;
  user_id: number;
  stripe_payment_intent_id: string | null;
  stripe_invoice_id: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  description: string;
  transaction_date: Date;
  created_at: Date;
}

// Creation attributes
export interface BillingTransactionCreationAttributes
  extends Optional<
    BillingTransactionAttributes,
    | "id"
    | "created_at"
    | "stripe_payment_intent_id"
    | "stripe_invoice_id"
    | "description"
  > {}

// Model class
class BillingTransaction
  extends Model<
    BillingTransactionAttributes,
    BillingTransactionCreationAttributes
  >
  implements BillingTransactionAttributes
{
  public id!: number;
  public user_id!: number;
  public stripe_payment_intent_id!: string | null;
  public stripe_invoice_id!: string | null;
  public amount!: number;
  public currency!: string;
  public status!: PaymentStatus;
  public description!: string;
  public transaction_date!: Date;
  public created_at!: Date;

  // Format amount for display (e.g., convert 1000 to "10.00" for $10.00)
  public getFormattedAmount(): string {
    return this.amount.toFixed(2);
  }
}

// Initialize model
BillingTransaction.init(
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
    stripe_payment_intent_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    stripe_invoice_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    amount: {
      type: DataTypes.INTEGER, // Stored in cents
      allowNull: false,
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: "usd",
    },
    status: {
      type: DataTypes.ENUM(...Object.values(PaymentStatus)),
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: "Subscription payment",
    },
    transaction_date: {
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
    tableName: "billing_transactions",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false, // No updated_at column
  }
);

export default BillingTransaction;
