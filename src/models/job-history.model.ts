import { Model, DataTypes, Optional } from "sequelize";
import sequelize from "../config/database";

export enum JobStatus {
  QUEUED = "queued",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed",
  RETRYING = "retrying",
}

export enum JobType {
  POST_GENERATION = "post_generation",
  POST_PUBLISHING = "post_publishing",
  WORDPRESS_PUBLISH = "wordpress_publish",
}

export interface JobHistoryAttributes {
  id: number;
  job_id: string;
  job_type: JobType;
  user_id: number;
  status: JobStatus;
  data: any;
  result: any;
  error: string | null;
  attempts: number;
  started_at: Date;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface JobHistoryCreationAttributes
  extends Optional<
    JobHistoryAttributes,
    | "id"
    | "result"
    | "error"
    | "attempts"
    | "completed_at"
    | "created_at"
    | "updated_at"
  > {}

class JobHistory
  extends Model<JobHistoryAttributes, JobHistoryCreationAttributes>
  implements JobHistoryAttributes
{
  public id!: number;
  public job_id!: string;
  public job_type!: JobType;
  public user_id!: number;
  public status!: JobStatus;
  public data!: any;
  public result!: any;
  public error!: string | null;
  public attempts!: number;
  public started_at!: Date;
  public completed_at!: Date | null;
  public created_at!: Date;
  public updated_at!: Date;
}

JobHistory.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    job_id: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    job_type: {
      type: DataTypes.ENUM(...Object.values(JobType)),
      allowNull: false,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
    },
    status: {
      type: DataTypes.ENUM(...Object.values(JobStatus)),
      allowNull: false,
      defaultValue: JobStatus.QUEUED,
    },
    data: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    result: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    error: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    started_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    completed_at: {
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
    tableName: "job_history",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        name: "job_history_job_id_idx",
        fields: ["job_id"],
      },
      {
        name: "job_history_user_id_idx",
        fields: ["user_id"],
      },
      {
        name: "job_history_status_idx",
        fields: ["status"],
      },
      {
        name: "job_history_job_type_idx",
        fields: ["job_type"],
      },
    ],
  }
);

export default JobHistory;
