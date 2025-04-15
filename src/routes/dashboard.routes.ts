import express from "express";
import { getDashboardStats } from "../controllers/dashboard.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = express.Router();

// Dashboard routes - all require authentication
router.get("/stats", authenticate, getDashboardStats);

export default router;
