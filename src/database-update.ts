import sequelize from "./config/database";
import logger from "./config/logger";

async function updateDatabase() {
  try {
    // Connect to the database
    await sequelize.authenticate();
    logger.info("Database connection established successfully");

    // Check if the column exists
    const [checkResults] = await sequelize.query(
      "SHOW COLUMNS FROM subscriptions LIKE 'stripe_price_id'"
    );

    if (Array.isArray(checkResults) && checkResults.length === 0) {
      // Column doesn't exist, add it
      logger.info(
        "Adding missing stripe_price_id column to subscriptions table..."
      );
      await sequelize.query(
        "ALTER TABLE subscriptions ADD COLUMN stripe_price_id VARCHAR(255) NULL AFTER stripe_customer_id"
      );
      logger.info("✅ stripe_price_id column added successfully!");
    } else {
      logger.info(
        "stripe_price_id column already exists in the subscriptions table"
      );
    }

    // Check for any other schema updates needed
    logger.info("Checking for other necessary database updates...");

    // Add more schema updates as needed

    logger.info("Database update completed successfully");
    process.exit(0);
  } catch (error) {
    logger.error("Error updating database:", error);
    process.exit(1);
  }
}

// Run the update function
updateDatabase();
