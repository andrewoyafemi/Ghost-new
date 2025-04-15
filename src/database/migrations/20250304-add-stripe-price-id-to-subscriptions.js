"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // First check if the column already exists
      const tableInfo = await queryInterface.describeTable("subscriptions");

      // Only add the column if it doesn't exist
      if (!tableInfo.stripe_price_id) {
        await queryInterface.addColumn("subscriptions", "stripe_price_id", {
          type: Sequelize.STRING(255),
          allowNull: true,
          after: "stripe_customer_id",
        });
        console.log("Added stripe_price_id column to subscriptions table");
      } else {
        console.log(
          "stripe_price_id column already exists in subscriptions table"
        );
      }

      return Promise.resolve();
    } catch (error) {
      console.error("Migration failed:", error);
      return Promise.reject(error);
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      // First check if the column exists
      const tableInfo = await queryInterface.describeTable("subscriptions");

      // Only remove the column if it exists
      if (tableInfo.stripe_price_id) {
        await queryInterface.removeColumn("subscriptions", "stripe_price_id");
        console.log("Removed stripe_price_id column from subscriptions table");
      } else {
        console.log(
          "stripe_price_id column does not exist in subscriptions table"
        );
      }

      return Promise.resolve();
    } catch (error) {
      console.error("Migration rollback failed:", error);
      return Promise.reject(error);
    }
  },
};
