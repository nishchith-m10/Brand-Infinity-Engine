import { NextResponse } from 'next/server';
import { errorResponse } from '@/lib/api/response';
import { ErrorCodes } from '@/lib/api/error-codes';
import { logger } from '@/lib/monitoring/logger';

/**
 * Debug endpoint - DISABLED IN PRODUCTION
 * Returns 404 to prevent information disclosure
 */
export async function GET() {
  // Log access attempt for security monitoring
  if (process.env.NODE_ENV === 'production') {
    logger.warn('DebugRoute', 'Production access attempt to debug/session endpoint', {
      route: '/api/debug/session',
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    });
  }
  
  return errorResponse(ErrorCodes.NOT_FOUND, 'Not found', 404);
}
