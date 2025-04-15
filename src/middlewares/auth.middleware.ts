import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models";
import logger from "../config/logger";
import { verifyToken } from "../utils/jwt.utils";

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
      userId?: number;
    }
  }
}

// Interface for decoded JWT token payload
interface DecodedToken {
  id: number;
  email: string;
  iat: number;
  exp: number;
}

/**
 * Authentication middleware to verify JWT tokens
 * Attaches the authenticated user to the request object
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        error: "Authentication required. Please log in.",
      });
      return;
    }

    // Extract token from Bearer prefix
    const token = authHeader.split(" ")[1];

    // Verify token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-secret-key"
    ) as DecodedToken;

    // Find user by id
    const user = await User.findByPk(decoded.id);

    if (!user) {
      res.status(401).json({
        success: false,
        error: "The user belonging to this token no longer exists.",
      });
      return;
    }

    // Add user to request object
    req.user = user;
    req.userId = user.id;

    next();
  } catch (error: any) {
    logger.error("Authentication error:", error);

    if (error.name === "JsonWebTokenError") {
      res.status(401).json({
        success: false,
        error: "Invalid token. Please log in again.",
      });
      return;
    }

    if (error.name === "TokenExpiredError") {
      res.status(401).json({
        success: false,
        error: "Your token has expired. Please log in again.",
      });
      return;
    }

    res.status(401).json({
      success: false,
      error: "Authentication failed. Please log in again.",
    });
  }
};

/**
 * Middleware to check if user has a specific plan
 * @param plans - Array of allowed plans
 */
export const restrictTo = (plans: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Authentication required. Please log in.",
      });
      return;
    }

    if (!plans.includes(req.user.plan)) {
      res.status(403).json({
        success: false,
        error: "You do not have permission to perform this action.",
      });
      return;
    }

    next();
  };
};

/**
 * Simplified JWT authentication middleware used for route protection
 */
export const authenticateJWT = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        message: "Authentication required. Please login.",
      });
      return;
    }

    const token = authHeader.split(" ")[1];

    // Verify the token
    const decoded = verifyToken(token) as unknown as DecodedToken;

    // Set user ID in request for use in controllers
    req.userId = decoded.id;

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: "Invalid or expired token. Please login again.",
    });
  }
};

/**
 * Check if user is an admin
 */
export const isAdmin = (user: User): boolean => {
  // Check if user has admin role or any admin designation
  return user.role === "admin";
};

/**
 * Admin middleware to verify the user has admin privileges
 */
export const adminMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Authentication required. Please log in.",
      });
      return;
    }

    // Check if user is admin
    if (!isAdmin(req.user)) {
      res.status(403).json({
        success: false,
        error: "Admin privileges required for this operation.",
      });
      return;
    }

    next();
  } catch (error) {
    logger.error("Admin authentication error:", error);
    res.status(500).json({
      success: false,
      error: "Server error during admin verification.",
    });
  }
};
