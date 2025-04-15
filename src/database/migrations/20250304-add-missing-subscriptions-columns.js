"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // Get current table structure
      const tableInfo = await queryInterface.describeTable("subscriptions");

      // Columns to check and add if missing
      const columnsToCheck = [
        {
          name: "canceled_at",
          spec: {
            type: Sequelize.DATE,
            allowNull: true,
          },
        },
        {
          name: "posts_used_count",
          spec: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0,
          },
        },
        {
          name: "current_period_start",
          spec: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
          },
        },
        {
          name: "current_period_end",
          spec: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal(
              "DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 30 DAY)"
            ),
          },
        },
        {
          name: "billing_cycle",
          spec: {
            type: Sequelize.ENUM("monthly", "annual"),
            allowNull: false,
            defaultValue: "monthly",
          },
        },
        {
          name: "status",
          spec: {
            type: Sequelize.ENUM(
              "active",
              "cancelled",
              "expired",
              "suspended",
              "past_due",
              "trialing"
            ),
            allowNull: false,
            defaultValue: "active",
          },
        },
      ];

      // Check and add each column
      for (const column of columnsToCheck) {
        if (!tableInfo[column.name]) {
          await queryInterface.addColumn(
            "subscriptions",
            column.name,
            column.spec
          );
          console.log(`Added ${column.name} column to subscriptions table`);
        } else {
          console.log(
            `${column.name} column already exists in subscriptions table`
          );
        }
      }

      return Promise.resolve();
    } catch (error) {
      console.error("Migration failed:", error);
      return Promise.reject(error);
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      // Get current table structure
      const tableInfo = await queryInterface.describeTable("subscriptions");

      // Columns to potentially remove
      const columnsToCheck = [
        "canceled_at",
        "posts_used_count",
        "current_period_start",
        "current_period_end",
        "billing_cycle",
        "status",
      ];

      // Check and remove each column (in reverse order to avoid foreign key constraints)
      for (const columnName of columnsToCheck.reverse()) {
        if (tableInfo[columnName]) {
          await queryInterface.removeColumn("subscriptions", columnName);
          console.log(`Removed ${columnName} column from subscriptions table`);
        } else {
          console.log(
            `${columnName} column does not exist in subscriptions table`
          );
        }
      }

      return Promise.resolve();
    } catch (error) {
      console.error("Migration rollback failed:", error);
      return Promise.reject(error);
    }
  },
};
