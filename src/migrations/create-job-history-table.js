"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("job_history", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      job_id: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      job_type: {
        type: Sequelize.ENUM(
          "post_generation",
          "post_publishing",
          "wordpress_publish"
        ),
        allowNull: false,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      status: {
        type: Sequelize.ENUM(
          "queued",
          "processing",
          "completed",
          "failed",
          "retrying"
        ),
        allowNull: false,
        defaultValue: "queued",
      },
      data: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      result: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      error: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      attempts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      started_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      completed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    // Add indexes
    await queryInterface.addIndex("job_history", ["job_id"], {
      name: "job_history_job_id_idx",
    });
    await queryInterface.addIndex("job_history", ["user_id"], {
      name: "job_history_user_id_idx",
    });
    await queryInterface.addIndex("job_history", ["status"], {
      name: "job_history_status_idx",
    });
    await queryInterface.addIndex("job_history", ["job_type"], {
      name: "job_history_job_type_idx",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("job_history");
  },
};
