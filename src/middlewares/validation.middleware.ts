import { Request, Response, NextFunction } from "express";
import { validationResult, ValidationChain } from "express-validator";
import { ValidationError } from "./error.middleware";

/**
 * Middleware to validate request using express-validator
 * @param validations Array of validation chains
 */
export const validate = (validations: ValidationChain[]) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    // Run all validations
    await Promise.all(validations.map((validation) => validation.run(req)));

    // Check for validation errors
    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    // Format errors and throw validation error
    const formattedErrors = errors.array().map((error: any) => ({
      field: error.path || error.param || error.location,
      message: error.msg,
      value: error.value,
    }));

    // Throw validation error with all errors
    next(new ValidationError("Validation failed", formattedErrors));
  };
};
