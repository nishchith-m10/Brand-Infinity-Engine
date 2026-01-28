/**
 * Centralized Error Codes for API Responses
 * 
 * Provides machine-readable error codes for consistent client-side error handling.
 * Each code maps to a specific HTTP status code range.
 */

export const ErrorCodes = {
  // Validation errors (400)
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_PARAMETER: "INVALID_PARAMETER",
  MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",
  INVALID_INPUT_FORMAT: "INVALID_INPUT_FORMAT",
  
  // Authentication errors (401)
  UNAUTHENTICATED: "UNAUTHENTICATED",
  INVALID_TOKEN: "INVALID_TOKEN",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  MISSING_CREDENTIALS: "MISSING_CREDENTIALS",
  
  // Authorization errors (403)
  UNAUTHORIZED: "UNAUTHORIZED",
  INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS",
  FORBIDDEN: "FORBIDDEN",
  
  // Not found errors (404)
  NOT_FOUND: "NOT_FOUND",
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
  ENDPOINT_NOT_FOUND: "ENDPOINT_NOT_FOUND",
  
  // Conflict errors (409)
  CONFLICT: "CONFLICT",
  RESOURCE_ALREADY_EXISTS: "RESOURCE_ALREADY_EXISTS",
  DUPLICATE_ENTRY: "DUPLICATE_ENTRY",
  
  // Rate limit errors (429)
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  TOO_MANY_REQUESTS: "TOO_MANY_REQUESTS",
  
  // Budget/Business Logic errors (400/402)
  BUDGET_EXCEEDED: "BUDGET_EXCEEDED",
  INSUFFICIENT_BUDGET: "INSUFFICIENT_BUDGET",
  INVALID_TRANSITION: "INVALID_TRANSITION",
  
  // Server errors (500)
  INTERNAL_ERROR: "INTERNAL_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",
  LLM_ERROR: "LLM_ERROR",
  GENERATION_FAILED: "GENERATION_FAILED",
  UPLOAD_FAILED: "UPLOAD_FAILED",
  PROCESSING_FAILED: "PROCESSING_FAILED",
  
  // Service Unavailable (503)
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  MAINTENANCE_MODE: "MAINTENANCE_MODE",
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * Maps error codes to their default HTTP status codes
 */
export const ErrorCodeStatusMap: Record<string, number> = {
  // 400 Bad Request
  [ErrorCodes.VALIDATION_ERROR]: 400,
  [ErrorCodes.INVALID_PARAMETER]: 400,
  [ErrorCodes.MISSING_REQUIRED_FIELD]: 400,
  [ErrorCodes.INVALID_INPUT_FORMAT]: 400,
  [ErrorCodes.BUDGET_EXCEEDED]: 400,
  [ErrorCodes.INSUFFICIENT_BUDGET]: 400,
  [ErrorCodes.INVALID_TRANSITION]: 400,
  
  // 401 Unauthorized
  [ErrorCodes.UNAUTHENTICATED]: 401,
  [ErrorCodes.INVALID_TOKEN]: 401,
  [ErrorCodes.TOKEN_EXPIRED]: 401,
  [ErrorCodes.MISSING_CREDENTIALS]: 401,
  
  // 403 Forbidden
  [ErrorCodes.UNAUTHORIZED]: 403,
  [ErrorCodes.INSUFFICIENT_PERMISSIONS]: 403,
  [ErrorCodes.FORBIDDEN]: 403,
  
  // 404 Not Found
  [ErrorCodes.NOT_FOUND]: 404,
  [ErrorCodes.RESOURCE_NOT_FOUND]: 404,
  [ErrorCodes.ENDPOINT_NOT_FOUND]: 404,
  
  // 409 Conflict
  [ErrorCodes.CONFLICT]: 409,
  [ErrorCodes.RESOURCE_ALREADY_EXISTS]: 409,
  [ErrorCodes.DUPLICATE_ENTRY]: 409,
  
  // 429 Too Many Requests
  [ErrorCodes.RATE_LIMIT_EXCEEDED]: 429,
  [ErrorCodes.TOO_MANY_REQUESTS]: 429,
  
  // 500 Internal Server Error
  [ErrorCodes.INTERNAL_ERROR]: 500,
  [ErrorCodes.DATABASE_ERROR]: 500,
  [ErrorCodes.EXTERNAL_SERVICE_ERROR]: 500,
  [ErrorCodes.LLM_ERROR]: 500,
  [ErrorCodes.GENERATION_FAILED]: 500,
  [ErrorCodes.UPLOAD_FAILED]: 500,
  [ErrorCodes.PROCESSING_FAILED]: 500,
  
  // 503 Service Unavailable
  [ErrorCodes.SERVICE_UNAVAILABLE]: 503,
  [ErrorCodes.MAINTENANCE_MODE]: 503,
};
