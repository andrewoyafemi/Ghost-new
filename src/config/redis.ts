import Redis from "ioredis";
import logger from "./logger";
import dotenv from "dotenv";

dotenv.config();

// Create a Redis client
// const redisClient = new Redis({
//   host: process.env.REDIS_HOST || "localhost",
//   port: parseInt(process.env.REDIS_PORT || "6379"),
//   password: process.env.REDIS_PASSWORD || undefined,
// });

// FOR RENDER
const redisClient = new Redis(
  process.env.REDIS_URL || "redis://red-cvv7ccidbo4c73fhcd30:6379"
);

redisClient.set("ghostryt:status", "active");
redisClient.get("ghostryt:status").then(console.log);
// Log connection events
redisClient.on("connect", () => {
  logger.info("Connected to Redis");
});

redisClient.on("error", (err) => {
  logger.error("Redis connection error:", err);
});

// Export the Redis client
export default redisClient;
