/**
 * Standardized API Response Utilities
 * 
 * Provides consistent response formatting across all API endpoints.
 * Ensures proper HTTP status codes and error handling.
 */

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ErrorCodes, ErrorCodeStatusMap, type ErrorCode } from "./error-codes";
import { randomUUID } from "crypto";

/**
 * Standard error response envelope
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
    timestamp?: string;
  };
}

/**
 * Standard success response envelope
 */
export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  requestId?: string;
  timestamp?: string;
}

/**
 * Generate a unique request ID for tracing
 */
export function generateRequestId(): string {
  return randomUUID();
}

/**
 * Create a standardized success response
 * 
 * @param data - The response data
 * @param requestId - Optional request ID for tracing
 * @returns NextResponse with standardized success envelope
 */
export function successResponse<T>(
  data: T,
  requestId?: string
): NextResponse<SuccessResponse<T>> {
  const response: SuccessResponse<T> = {
    success: true,
    data,
    requestId: requestId || generateRequestId(),
    timestamp: new Date().toISOString(),
  };
  
  return NextResponse.json(response, { status: 200 });
}

/**
 * Create a standardized error response
 * 
 * @param code - Machine-readable error code
 * @param message - Human-readable error message
 * @param status - HTTP status code (defaults based on error code)
 * @param details - Additional error details
 * @param requestId - Optional request ID for tracing
 * @returns NextResponse with standardized error envelope
 */
export function errorResponse(
  code: ErrorCode | string,
  message: string,
  status?: number,
  details?: unknown,
  requestId?: string
): NextResponse<ErrorResponse> {
  // Determine status code from error code mapping or use provided status
  const statusCode = status || ErrorCodeStatusMap[code] || 500;
  
  const response: ErrorResponse = {
    success: false,
    error: {
      code,
      message,
      details: sanitizeErrorDetails(details),
      requestId: requestId || generateRequestId(),
      timestamp: new Date().toISOString(),
    },
  };
  
  // Log error in development
  if (process.env.NODE_ENV === "development") {
    console.error("[API Error]", {
      code,
      message,
      status: statusCode,
      details,
      requestId: response.error.requestId,
    });
  }
  
  return NextResponse.json(response, { status: statusCode });
}

/**
 * Create a validation error response from Zod errors
 * 
 * @param errors - Zod validation errors or custom validation errors
 * @param requestId - Optional request ID for tracing
 * @returns NextResponse with validation error details
 */
export function validationErrorResponse(
  errors: ZodError | Record<string, string[]> | unknown,
  requestId?: string
): NextResponse<ErrorResponse> {
  let validationDetails: unknown;
  
  if (errors instanceof ZodError) {
    // Format Zod errors into field-level errors
    validationDetails = errors.issues.map((err) => ({
      field: err.path.join("."),
      message: err.message,
      code: err.code,
    }));
  } else {
    validationDetails = errors;
  }
  
  return errorResponse(
    ErrorCodes.VALIDATION_ERROR,
    "Validation failed",
    400,
    validationDetails,
    requestId
  );
}

/**
 * Create a server error response from an exception
 * 
 * @param error - The error or exception
 * @param requestId - Optional request ID for tracing
 * @returns NextResponse with server error details
 */
export function serverErrorResponse(
  error: Error | unknown,
  requestId?: string
): NextResponse<ErrorResponse> {
  const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
  const errorStack = error instanceof Error ? error.stack : undefined;
  
  // Log the full error in development
  if (process.env.NODE_ENV === "development" && errorStack) {
    console.error("[Server Error]", errorStack);
  }
  
  // Only include stack trace in development
  const details = process.env.NODE_ENV === "development" && errorStack
    ? { stack: errorStack }
    : undefined;
  
  return errorResponse(
    ErrorCodes.INTERNAL_ERROR,
    errorMessage,
    500,
    details,
    requestId
  );
}

/**
 * Create an authentication error response
 * 
 * @param message - Optional custom message
 * @param requestId - Optional request ID for tracing
 * @returns NextResponse with authentication error
 */
export function authenticationErrorResponse(
  message: string = "Authentication required",
  requestId?: string
): NextResponse<ErrorResponse> {
  return errorResponse(
    ErrorCodes.UNAUTHENTICATED,
    message,
    401,
    undefined,
    requestId
  );
}

/**
 * Create an authorization error response
 * 
 * @param message - Optional custom message
 * @param requestId - Optional request ID for tracing
 * @returns NextResponse with authorization error
 */
export function authorizationErrorResponse(
  message: string = "Insufficient permissions",
  requestId?: string
): NextResponse<ErrorResponse> {
  return errorResponse(
    ErrorCodes.UNAUTHORIZED,
    message,
    403,
    undefined,
    requestId
  );
}

/**
 * Create a not found error response
 * 
 * @param resource - The resource that was not found
 * @param requestId - Optional request ID for tracing
 * @returns NextResponse with not found error
 */
export function notFoundErrorResponse(
  resource: string = "Resource",
  requestId?: string
): NextResponse<ErrorResponse> {
  return errorResponse(
    ErrorCodes.RESOURCE_NOT_FOUND,
    `${resource} not found`,
    404,
    undefined,
    requestId
  );
}

/**
 * Create a rate limit error response
 * 
 * @param retryAfter - Seconds until rate limit resets
 * @param requestId - Optional request ID for tracing
 * @returns NextResponse with rate limit error
 */
export function rateLimitErrorResponse(
  retryAfter?: number,
  requestId?: string
): NextResponse<ErrorResponse> {
  const response = errorResponse(
    ErrorCodes.RATE_LIMIT_EXCEEDED,
    "Rate limit exceeded",
    429,
    retryAfter ? { retryAfter } : undefined,
    requestId
  );
  
  if (retryAfter) {
    response.headers.set("Retry-After", retryAfter.toString());
  }
  
  return response;
}

/**
 * Sanitize error details to prevent sensitive information leakage
 * 
 * @param details - Raw error details
 * @returns Sanitized error details
 */
function sanitizeErrorDetails(details: unknown): unknown {
  if (process.env.NODE_ENV === "production") {
    // In production, be more restrictive
    if (typeof details === "object" && details !== null) {
      // Remove potentially sensitive fields
      const sanitized = { ...details } as Record<string, unknown>;
      delete sanitized.password;
      delete sanitized.token;
      delete sanitized.apiKey;
      delete sanitized.secret;
      delete sanitized.credentials;
      return sanitized;
    }
  }
  
  return details;
}

/**
 * Type guard to check if a response is an error response
 */
export function isErrorResponse(response: unknown): response is ErrorResponse {
  return (
    typeof response === "object" &&
    response !== null &&
    "success" in response &&
    response.success === false &&
    "error" in response
  );
}

/**
 * Type guard to check if a response is a success response
 */
export function isSuccessResponse<T = unknown>(
  response: unknown
): response is SuccessResponse<T> {
  return (
    typeof response === "object" &&
    response !== null &&
    "success" in response &&
    response.success === true &&
    "data" in response
  );
}
