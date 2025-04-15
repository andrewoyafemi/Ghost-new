"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // First check if the column already exists
      const tableInfo = await queryInterface.describeTable("subscriptions");

      // Only add the column if it doesn't exist
      if (!tableInfo.cancel_at_period_end) {
        // Add the cancel_at_period_end column
        await queryInterface.addColumn(
          "subscriptions",
          "cancel_at_period_end",
          {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
          }
        );

        console.log("Added cancel_at_period_end column to subscriptions table");
      } else {
        console.log(
          "cancel_at_period_end column already exists in subscriptions table"
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
      if (tableInfo.cancel_at_period_end) {
        await queryInterface.removeColumn(
          "subscriptions",
          "cancel_at_period_end"
        );
        console.log(
          "Removed cancel_at_period_end column from subscriptions table"
        );
      } else {
        console.log(
          "cancel_at_period_end column does not exist in subscriptions table"
        );
      }

      return Promise.resolve();
    } catch (error) {
      console.error("Migration rollback failed:", error);
      return Promise.reject(error);
    }
  },
};
