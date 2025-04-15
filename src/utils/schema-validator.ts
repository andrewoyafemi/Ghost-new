import sequelize from "../config/database";
import logger from "../config/logger";
import { DataTypes, QueryTypes } from "sequelize";

interface DatabaseColumn {
  Field: string;
  Type: string;
  Null: string;
  Key: string;
  Default: string | null;
  Extra: string;
}

/**
 * Utility to validate database schema against Sequelize models
 * This helps identify missing columns in the database
 */
export async function validateDatabaseSchema(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    logger.info("Schema validation skipped in production environment");
    return;
  }

  logger.info("Starting database schema validation...");

  try {
    // Get all models registered with Sequelize
    const models = Object.values(sequelize.models);

    for (const model of models) {
      const modelName = model.name;
      const tableName = model.getTableName();

      logger.info(
        `Validating schema for model ${modelName} (table: ${tableName})`
      );

      // Get model attributes
      const modelAttributes = model.getAttributes();

      // Get actual table columns from database using raw query
      const [dbColumns] = await sequelize.query<DatabaseColumn>(
        `SHOW COLUMNS FROM \`${tableName}\``,
        { type: QueryTypes.SELECT }
      );

      // Convert DB columns to a map for easy lookup
      const dbColumnMap = new Map<string, DatabaseColumn>();
      if (Array.isArray(dbColumns)) {
        dbColumns.forEach((col) => {
          dbColumnMap.set(col.Field, col);
        });
      }

      // Check for missing columns
      for (const [attrName, attrDef] of Object.entries(modelAttributes)) {
        // Skip auto-generated fields like id, created_at, updated_at
        if (
          attrName === "id" ||
          attrName === "created_at" ||
          attrName === "updated_at"
        ) {
          continue;
        }

        // Convert model attribute name to column name (usually snake_case)
        const columnName = (attrDef as any).field || attrName;

        if (!dbColumnMap.has(columnName)) {
          logger.warn(
            `⚠️ Column missing in database: ${columnName} from model ${modelName}`
          );
          logger.warn(`   Run migrations or update your database schema`);
        }
      }

      logger.info(`✓ Completed validation for ${modelName}`);
    }

    logger.info("Database schema validation completed");
  } catch (error) {
    logger.error("Error validating database schema:", error);
  }
}

/**
 * Run schema validation during server startup
 */
export async function validateSchemaOnStartup(): Promise<void> {
  if (process.env.VALIDATE_SCHEMA === "true") {
    try {
      await validateDatabaseSchema();
    } catch (error) {
      logger.error("Schema validation failed:", error);
    }
  }
}
