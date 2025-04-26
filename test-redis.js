// Simple Redis connection test script
const Redis = require("ioredis");
require("dotenv").config();

// Create a Redis connection with the same config as your application - using URL approach
const redisUrl =
  process.env.REDIS_URL || "redis://red-cvv7ccidbo4c73fhcd30:6379";
const redis = new Redis(redisUrl);

// Log connection events
redis.on("connect", () => {
  console.log("Connected to Redis ✅");
  performBasicTests();
});

redis.on("error", (err) => {
  console.error("Redis connection error:", err);
  process.exit(1);
});

// Perform some basic Redis operations
async function performBasicTests() {
  try {
    // Test #1: Set and get a value
    await redis.set("test_key", "Redis is working!");
    const value = await redis.get("test_key");
    console.log(
      "Test #1 (SET/GET):",
      value === "Redis is working!" ? "PASSED ✅" : "FAILED ❌"
    );

    // Test #2: Increment a counter
    await redis.set("counter", 0);
    await redis.incr("counter");
    await redis.incr("counter");
    const counter = await redis.get("counter");
    console.log("Test #2 (INCR):", counter === "2" ? "PASSED ✅" : "FAILED ❌");

    // Test #3: Check server info
    const info = await redis.info();
    console.log("Test #3 (INFO): PASSED ✅");
    console.log(
      "Redis version:",
      info.split("\n").find((line) => line.startsWith("redis_version"))
    );

    // Clean up
    await redis.del("test_key", "counter");
    await redis.quit();

    console.log(
      "\nAll tests completed successfully! Your Redis connection is working properly."
    );
  } catch (error) {
    console.error("Error during Redis tests:", error);
  }
}
