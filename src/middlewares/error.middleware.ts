import { Request, Response, NextFunction } from "express";
import logger from "../config/logger";

// Custom API Error class
export class ApiError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(statusCode: number, message: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Database-related errors
export class DatabaseError extends ApiError {
  constructor(message: string) {
    super(500, message, true);
  }
}

// Not found error
export class NotFoundError extends ApiError {
  constructor(resource: string = "Resource") {
    super(404, `${resource} not found`);
  }
}

// Validation error
export class ValidationError extends ApiError {
  errors: any[];

  constructor(message: string, errors: any[] = []) {
    super(400, message);
    this.errors = errors;
  }
}

// Authorization error
export class AuthorizationError extends ApiError {
  constructor(
    message: string = "You do not have permission to perform this action"
  ) {
    super(403, message);
  }
}

// Rate limit error
export class RateLimitError extends ApiError {
  constructor(message: string = "Too many requests, please try again later") {
    super(429, message);
  }
}

// Global error handling middleware
export const errorMiddleware = (
  err: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Default error values
  let statusCode = 500;
  let message = "Something went wrong";
  let isOperational = false;
  let errors: any[] = [];

  // Handle specific error types
  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    isOperational = err.isOperational;

    if (err instanceof ValidationError) {
      errors = err.errors;
    }
  }

  // Handle Sequelize errors
  if (
    err.name === "SequelizeValidationError" ||
    err.name === "SequelizeUniqueConstraintError"
  ) {
    statusCode = 400;
    message = "Validation error";
    isOperational = true;
    errors =
      (err as any).errors?.map((e: any) => ({
        field: e.path,
        message: e.message,
      })) || [];
  }

  // Log error
  if (isOperational) {
    logger.warn({
      message: `Operational error: ${message}`,
      path: req.path,
      method: req.method,
      statusCode,
      ...(errors.length && { errors }),
    });
  } else {
    logger.error({
      message: `Unexpected error: ${message}`,
      error: err,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });
  }

  // Send error response
  const errorResponse: any = {
    success: false,
    error: message,
  };

  // Add errors array for validation errors
  if (errors.length) {
    errorResponse.errors = errors;
  }

  // Add stack trace in development mode
  if (process.env.NODE_ENV === "development" && !isOperational) {
    errorResponse.stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
};
