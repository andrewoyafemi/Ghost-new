import { Model, DataTypes, Optional } from "sequelize";
import sequelize from "../config/database";

// Attributes interface
export interface BusinessProfileAttributes {
  id: number;
  user_id: number;
  business_name: string;
  ideal_client: string;
  client_promises: string[] | string;
  client_expectations: string[] | string;
  wordpress_api_key: string | null;
  wordpress_site_url: string | null;
  wordpress_username: string | null;
  created_at: Date;
  updated_at: Date;
}

// Creation attributes
export interface BusinessProfileCreationAttributes
  extends Optional<
    BusinessProfileAttributes,
    | "id"
    | "created_at"
    | "updated_at"
    | "wordpress_api_key"
    | "wordpress_site_url"
    | "wordpress_username"
  > {}

// Model class
class BusinessProfile
  extends Model<BusinessProfileAttributes, BusinessProfileCreationAttributes>
  implements BusinessProfileAttributes
{
  public id!: number;
  public user_id!: number;
  public business_name!: string;
  public ideal_client!: string;
  public client_promises!: string[] | string;
  public client_expectations!: string[] | string;
  public wordpress_api_key!: string | null;
  public wordpress_site_url!: string | null;
  public wordpress_username!: string | null;
  public created_at!: Date;
  public updated_at!: Date;

  // Check if WordPress integration is enabled
  public hasWordPressIntegration(): boolean {
    return !!(
      this.wordpress_api_key &&
      this.wordpress_site_url &&
      this.wordpress_username
    );
  }
}

// Initialize model
BusinessProfile.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true, // One profile per user
    },
    business_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    ideal_client: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    client_promises: {
      type: DataTypes.TEXT,
      allowNull: false,
      get() {
        const rawValue = this.getDataValue("client_promises") as string;
        return rawValue ? JSON.parse(rawValue) : [];
      },
      set(value: string[] | string) {
        if (typeof value === "object") {
          this.setDataValue("client_promises", JSON.stringify(value));
        } else {
          this.setDataValue("client_promises", value);
        }
      },
    },
    client_expectations: {
      type: DataTypes.TEXT,
      allowNull: false,
      get() {
        const rawValue = this.getDataValue("client_expectations") as string;
        return rawValue ? JSON.parse(rawValue) : [];
      },
      set(value: string[] | string) {
        if (typeof value === "object") {
          this.setDataValue("client_expectations", JSON.stringify(value));
        } else {
          this.setDataValue("client_expectations", value);
        }
      },
    },
    wordpress_api_key: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    wordpress_site_url: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    wordpress_username: {
      type: DataTypes.STRING(255),
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
    tableName: "business_profiles",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

export default BusinessProfile;
