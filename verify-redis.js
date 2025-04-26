// Simple Redis connection verification script for Render
const Redis = require("ioredis");
require("dotenv").config();

console.log("Starting Redis connection test...");
console.log("==================================");

// Log environment variables (masked for security)
console.log("Environment variables:");
if (process.env.REDIS_URL) {
  // Mask the actual URL but show format
  const maskedUrl = process.env.REDIS_URL.replace(
    /\/\/(.+?)@/,
    "//****:****@"
  ).replace(/\/\/(.+?):/, "//****:");
  console.log(`REDIS_URL is set to: ${maskedUrl}`);
} else {
  console.log("REDIS_URL is not set");
}

// Connect using URL approach
const redisUrl =
  process.env.REDIS_URL || "redis://red-cvv7ccidbo4c73fhcd30:6379";
console.log(
  `Attempting to connect to Redis using URL: ${redisUrl
    .replace(/\/\/(.+?)@/, "//****:****@")
    .replace(/\/\/(.+?):/, "//****:")}`
);

const redis = new Redis(redisUrl);

// Connection listeners
redis.on("connect", async () => {
  console.log("✅ Successfully connected to Redis!");

  try {
    // Test basic operations
    await redis.set("render-test", "Connection successful on Render");
    const testValue = await redis.get("render-test");
    console.log(`✅ Redis GET/SET test: ${testValue}`);

    // Get server info
    const info = await redis.info();
    const version = info
      .split("\n")
      .find((line) => line.startsWith("redis_version"));
    console.log(`✅ Redis server info: ${version}`);

    // Clean up
    await redis.del("render-test");
    console.log("✅ Cleanup completed");

    console.log("==================================");
    console.log(
      "All tests passed! Your Redis connection is working correctly."
    );

    await redis.quit();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during Redis tests:", error);
    process.exit(1);
  }
});

redis.on("error", (err) => {
  console.error("❌ Redis connection error:", err);
  console.log("==================================");
  console.log("Troubleshooting tips:");
  console.log(
    "1. Check if your REDIS_URL environment variable is set correctly in Render"
  );
  console.log(
    "2. Verify that your Redis instance is running and accessible from Render"
  );
  console.log(
    "3. Check if your Redis instance has password authentication enabled"
  );
  console.log(
    "4. Check if your Redis instance has network access control (firewall) that might be blocking connections"
  );
  console.log("==================================");
  process.exit(1);
});

// Add a timeout in case connection hangs
setTimeout(() => {
  console.error("❌ Connection attempt timed out after 10 seconds");
  process.exit(1);
}, 10000);
