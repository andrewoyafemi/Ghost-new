"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // First check if the column already exists
      const tableInfo = await queryInterface.describeTable("subscriptions");

      // Only add the column if it doesn't exist
      if (!tableInfo.trial_end) {
        // Add the trial_end column
        await queryInterface.addColumn("subscriptions", "trial_end", {
          type: Sequelize.DATE,
          allowNull: true,
        });

        console.log("Added trial_end column to subscriptions table");
      } else {
        console.log("trial_end column already exists in subscriptions table");
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
      if (tableInfo.trial_end) {
        await queryInterface.removeColumn("subscriptions", "trial_end");
        console.log("Removed trial_end column from subscriptions table");
      } else {
        console.log("trial_end column does not exist in subscriptions table");
      }

      return Promise.resolve();
    } catch (error) {
      console.error("Migration rollback failed:", error);
      return Promise.reject(error);
    }
  },
};
