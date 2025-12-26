import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

type ErrorResponse = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

/**
 * Standardized API error handler to prevent information leakage.
 * Logs full error internally, returns sanitized message to client.
 */
export function handleApiError(error: unknown): NextResponse<ErrorResponse> {
  console.error('[API Error]:', error);

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: error.flatten(),
        },
      },
      { status: 400 }
    );
  }

  // Handle Supabase/Postgres errors (sanitize)
  if (typeof error === 'object' && error !== null && 'code' in error && 'message' in error) {
    // We can selectively expose some Supabase errors if needed, but default to safe
    // const pgError = error as { code: string; message: string };
    // return NextResponse.json(...);
    
    // For now, treat DB errors as internal to avoid schema leaking
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'DB_ERROR',
          message: 'Database operation failed',
        },
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    },
    { status: 500 }
  );
}
