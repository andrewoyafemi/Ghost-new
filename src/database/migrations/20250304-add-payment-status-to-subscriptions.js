"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // First check if the column already exists
      const tableInfo = await queryInterface.describeTable("subscriptions");

      // Only add the column if it doesn't exist
      if (!tableInfo.payment_status) {
        // Add the payment_status column - MySQL/MariaDB defines ENUM directly in column
        await queryInterface.addColumn("subscriptions", "payment_status", {
          type: Sequelize.ENUM(
            "paid",
            "unpaid",
            "failed",
            "refunded",
            "pending"
          ),
          allowNull: false,
          defaultValue: "paid",
        });

        console.log("Added payment_status column to subscriptions table");
      } else {
        console.log(
          "payment_status column already exists in subscriptions table"
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
      if (tableInfo.payment_status) {
        await queryInterface.removeColumn("subscriptions", "payment_status");
        console.log("Removed payment_status column from subscriptions table");
      } else {
        console.log(
          "payment_status column does not exist in subscriptions table"
        );
      }

      return Promise.resolve();
    } catch (error) {
      console.error("Migration rollback failed:", error);
      return Promise.reject(error);
    }
  },
};
