/**
 * Standard response formats for the API
 */

// Error response format
export const ErrorResponse = (message: string, errors: any[] = []) => {
  return {
    success: false,
    message,
    errors: errors.length > 0 ? errors : undefined,
  };
};

// Success response format
export const SuccessResponse = (
  data: any = undefined,
  message: string = "Operation completed successfully"
) => {
  return {
    success: true,
    message,
    data,
  };
};
