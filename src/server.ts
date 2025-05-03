import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import sequelize, { testDatabaseConnection } from "./config/database";
import logger from "./config/logger";
// Import ngrok helper for development mode
import { startNgrokTunnel } from "./utils/ngrok-helper";
import { validateSchemaOnStartup } from "./utils/schema-validator";
import { initializeJobs, shutdownJobs } from "./jobs";

// Import routes
import authRoutes from "./routes/auth.routes";
import keywordRoutes from "./routes/keyword.routes";
import settingsRoutes from "./routes/settings.routes";
import profileRoutes from "./routes/profile.routes";
import testRoutes from "./routes/test.routes";
import postRoutes from "./routes/post.routes";
import wordpressRoutes from "./routes/wordpress.routes";
import adminRoutes from "./routes/admin.routes";

const PORT = process.env.PORT || 3001;

// Database connection and server startup
async function startServer() {
  try {
    // Initialize database connection
    await sequelize.authenticate();
    logger.info("📦 Database connection established successfully");

    // Validate database schema against models
    if (process.env.NODE_ENV === "development") {
      logger.info("🔍 Validating database schema against models...");
      await validateSchemaOnStartup();
    }

    // Run migrations in development mode
    if (
      process.env.NODE_ENV === "development" &&
      process.env.AUTO_MIGRATE === "true"
    ) {
      logger.info("🔄 Running database migrations...");
      try {
        const { exec } = require("child_process");
        exec(
          "npx sequelize-cli db:migrate",
          (error: Error | null, stdout: string, stderr: string) => {
            if (error) {
              logger.error(`Migration error: ${error.message}`);
              return;
            }
            if (stderr) {
              logger.error(`Migration stderr: ${stderr}`);
              return;
            }
            logger.info(`✅ Migrations applied successfully: ${stdout}`);
          }
        );
      } catch (error) {
        logger.error("Failed to run migrations:", error);
      }
    }

    // Sync database models with the database
    try {
      await sequelize.sync({ alter: false });
      logger.info("Database models synchronized");
    } catch (syncError: unknown) {
      const error = syncError as Error;
      logger.error(`Database sync error: ${error.message}`);
      logger.warn("Attempting to continue server startup despite sync errors");
    }

    // Register routes
    app.use("/api/v1/auth", authRoutes);
    app.use("/api/v1/keywords", keywordRoutes);
    app.use("/api/v1/settings", settingsRoutes);
    app.use("/api/v1/profile", profileRoutes);
    app.use("/api/v1/test", testRoutes);
    app.use("/api/v1/posts", postRoutes);
    app.use("/api/v1/wordpress", wordpressRoutes);
    app.use("/api/v1/admin", adminRoutes);
    app.get("/", (req, res) => {
      res.json({
        success: true,
        message: "Welcome to Ghostryt. Congratulations! your API is running!",
      });
    });
    app.get("/server-time", (req, res) => {
      res.send({ time: new Date().toISOString() });
    });

    // Start the Express server
    const server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`API available at https://api.ghostryt.net:${PORT}/api/v1`);

      // Initialize background jobs
      initializeJobs();
    });

    // Graceful shutdown handling
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received. Starting graceful shutdown...`);

      // First shut down the HTTP server
      server.close(() => {
        logger.info("HTTP server closed.");
      });

      // Then shut down the job system
      try {
        await shutdownJobs();
        logger.info("Job system shut down.");
      } catch (error) {
        logger.error("Error shutting down job system:", error);
      }

      // Then close the database connection
      try {
        await sequelize.close();
        logger.info("Database connections closed.");
      } catch (error) {
        logger.error("Error closing database connections:", error);
      }

      logger.info("Graceful shutdown completed.");
      process.exit(0);
    };

    // Set up listeners for termination signals
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

    // Start ngrok tunnel in development mode
    if (process.env.NODE_ENV === "development") {
      // Only start ngrok if ENABLE_NGROK is set to 'true'
      if (process.env.ENABLE_NGROK === "true") {
        const url = await startNgrokTunnel(Number(PORT));
        if (url) {
          logger.info(
            "-------------------------------------------------------------------------"
          );
          logger.info("🌐 Your Stripe webhook URL for development:");
          logger.info(`${url}/api/v1/stripe/webhook`);
          logger.info(
            "-------------------------------------------------------------------------"
          );
        }
      }
    }
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();

// Handle unhandled promise rejections
process.on("unhandledRejection", (err: Error) => {
  logger.error("UNHANDLED REJECTION! 💥 Shutting down...");
  logger.error(err.name, err.message, err.stack);
  process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (err: Error) => {
  logger.error("UNCAUGHT EXCEPTION! 💥 Shutting down...");
  logger.error(err.name, err.message, err.stack);
  process.exit(1);
});
