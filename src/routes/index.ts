import express from "express";
import authRoutes from "./auth.routes";
import profileRoutes from "./profile.routes";
import settingsRoutes from "./settings.routes";
import keywordRoutes from "./keyword.routes";
import testRoutes from "./test.routes";
import postRoutes from "./post.routes";
import wordpressRoutes from "./wordpress.routes";
import stripeRoutes from "./stripe.routes";
import dashboardRoutes from "./dashboard.routes";

const router = express.Router();

// Health check endpoint
router.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", message: "API is running" });
});

// Route definitions
router.use("/auth", authRoutes);
router.use("/profile", profileRoutes);
router.use("/settings", settingsRoutes);
router.use("/keywords", keywordRoutes);
router.use("/test", testRoutes);
router.use("/posts", postRoutes);
router.use("/wordpress", wordpressRoutes);
router.use("/stripe", stripeRoutes);
router.use("/dashboard", dashboardRoutes);

// TODO: Add other route groups as they are created

export default router;
