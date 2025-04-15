import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import logger from "./config/logger";
import { errorMiddleware, NotFoundError } from "./middlewares/error.middleware";
import apiRoutes from "./routes";
import "./models"; // Import models to ensure they are registered
// import morgan from "morgan";
const app: Application = express();

// Middleware
app.use(helmet());
app.use(cors());
// app.use(morgan("dev"));

// For Stripe webhooks - use raw body parser
// Use JSON parser for all non-webhook routes
app.use((req, res, next) => {
  if (req.originalUrl === "/api/v1/stripe/webhook") {
    // For webhook requests, we need the raw body for signature verification
    let rawData = "";
    let rawBuffer = Buffer.from([]);

    req.on("data", (chunk) => {
      // Store both string and buffer formats
      if (typeof chunk === "string") {
        rawData += chunk;
      } else {
        rawBuffer = Buffer.concat([rawBuffer, chunk]);
      }
    });

    req.on("end", () => {
      // Make sure we have both formats
      if (rawData === "" && rawBuffer.length > 0) {
        rawData = rawBuffer.toString("utf8");
      } else if (rawBuffer.length === 0 && rawData !== "") {
        rawBuffer = Buffer.from(rawData, "utf8");
      }

      // Attach raw data to request object
      (req as any).rawBody = rawBuffer;
      (req as any).rawBodyString = rawData;

      // Also parse as JSON if possible (for convenience)
      try {
        (req as any).body = JSON.parse(rawData);
      } catch (e) {
        logger.warn("Could not parse webhook body as JSON");
      }

      next();
    });
  } else {
    // For regular requests, use standard JSON middleware
    express.json()(req, res, next);
  }
});

// Add request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Mount API router
app.use("/api/v1", apiRoutes);

// Handle 404 errors for undefined routes
app.all("*", (req: Request, res: Response, next: NextFunction) => {
  next(new NotFoundError(`Can't find ${req.originalUrl} on this server!`));
});

// Error handling middleware
app.use(errorMiddleware);

export default app;
