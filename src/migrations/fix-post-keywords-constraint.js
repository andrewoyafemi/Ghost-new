"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // Get table indexes to identify the exact constraint name
      const indexes = await queryInterface.showIndex("post_keywords");

      // Find the problematic index (usually named 'post_id' or similar)
      const constraintToRemove = indexes.find(
        (index) =>
          index.fields.length === 1 &&
          index.fields[0].attribute === "post_id" &&
          index.unique
      );

      if (constraintToRemove) {
        console.log(`Removing constraint: ${constraintToRemove.name}`);
        // Drop the problematic constraint
        await queryInterface.removeIndex(
          "post_keywords",
          constraintToRemove.name
        );
      } else {
        console.log("No problematic constraint found with just post_id");
      }

      // Check if the correct constraint already exists
      const correctConstraint = indexes.find(
        (index) =>
          index.fields.length === 2 &&
          index.fields[0].attribute === "post_id" &&
          index.fields[1].attribute === "keyword_id" &&
          index.unique
      );

      if (!correctConstraint) {
        console.log("Adding proper composite unique constraint");
        // Add the correct constraint
        await queryInterface.addConstraint("post_keywords", {
          fields: ["post_id", "keyword_id"],
          type: "unique",
          name: "post_keywords_post_id_keyword_id_unique",
        });
      } else {
        console.log("Correct constraint already exists");
      }

      console.log("Migration completed successfully");
    } catch (error) {
      console.error("Migration failed:", error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      // Remove the constraint we added
      await queryInterface.removeConstraint(
        "post_keywords",
        "post_keywords_post_id_keyword_id_unique"
      );

      // Add back the original constraint (though this is probably not desirable)
      await queryInterface.addIndex("post_keywords", ["post_id"], {
        name: "post_id",
        unique: true,
      });

      console.log("Rollback completed successfully");
    } catch (error) {
      console.error("Rollback failed:", error);
      throw error;
    }
  },
};
