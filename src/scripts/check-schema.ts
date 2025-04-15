import dotenv from "dotenv";
dotenv.config();

import { validateDatabaseSchema } from "../utils/schema-validator";
import logger from "../config/logger";

async function main() {
  try {
    logger.info("Running database schema validation...");
    await validateDatabaseSchema();
    logger.info("Schema validation complete");
    process.exit(0);
  } catch (error) {
    logger.error("Schema validation failed:", error);
    process.exit(1);
  }
}

main();
