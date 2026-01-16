import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { 
  successResponse, 
  errorResponse, 
  serverErrorResponse 
} from '@/lib/api/response';
import { ErrorCodes } from '@/lib/api/error-codes';
import { logger } from '@/lib/monitoring/logger';

// Dev-only helper to create/delete test users for local E2E debugging
// - POST:  { email?, password? } -> creates a user (email_confirm=true) and returns tokens
// - DELETE: { user_id } -> deletes the user
// Security: DISABLED IN PRODUCTION. Returns 404 in production environment.
// Override only for staging/testing: ALLOW_E2E_CREATE_TEST_USER=true

function isProductionBlocked(): boolean {
  return process.env.NODE_ENV === 'production' && process.env.ALLOW_E2E_CREATE_TEST_USER !== 'true';
}

function logAccessAttempt(method: string, allowed: boolean) {
  logger.warn('DebugRoute', 'Debug route access attempt', {
    route: '/api/debug/create-test-user',
    method,
    allowed,
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
}

export async function GET() {
  if (isProductionBlocked()) {
    logAccessAttempt('GET', false);
    return errorResponse(ErrorCodes.NOT_FOUND, 'Not found', 404);
  }
  
  return successResponse({
    message: 'Dev helper: POST to create { email?, password? } -> creates user and returns tokens. DELETE with { user_id } deletes user.',
    environment: process.env.NODE_ENV,
  });
}

export async function POST(req: NextRequest) {
  if (isProductionBlocked()) {
    logAccessAttempt('POST', false);
    return errorResponse(ErrorCodes.NOT_FOUND, 'Not found', 404);
  }
  
  try {
    logAccessAttempt('POST', true);
    
    const body = await req.json().catch(() => ({}));
    const email = body.email || `e2e-test+${Date.now()}@example.com`;
    const password = body.password || 'TempTest!2345';

    const admin = createAdminClient();

    // Create user via Supabase Admin API
    const createResult = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    } as any);

    if ((createResult as any).error) {
      logger.error('DebugRoute', 'Failed to create test user', (createResult as any).error);
      return errorResponse(
        ErrorCodes.INTERNAL_ERROR,
        (createResult as any).error.message || 'Failed to create user',
        500
      );
    }

    // Response shape varies; try to get user object
    const user = (createResult as any).data?.user || (createResult as any).data || (createResult as any).user || null;

    // Exchange password for tokens (sign-in)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (!anonKey) {
      return errorResponse(
        ErrorCodes.INTERNAL_ERROR,
        'Missing NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY',
        500
      );
    }

    const tokenResp = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': anonKey,
      },
      body: JSON.stringify({ email, password }),
    });

    const tokens = await tokenResp.json();

    if (!tokenResp.ok) {
      logger.warn('DebugRoute', 'Token exchange failed for test user', { email });
    }

    logger.info('DebugRoute', 'Test user created successfully', { email });
    return successResponse({ user, tokens });
  } catch (err: any) {
    logger.error('DebugRoute', 'Unexpected error creating test user', err);
    return serverErrorResponse(err);
  }
}

export async function DELETE(req: NextRequest) {
  if (isProductionBlocked()) {
    logAccessAttempt('DELETE', false);
    return errorResponse(ErrorCodes.NOT_FOUND, 'Not found', 404);
  }
  
  try {
    logAccessAttempt('DELETE', true);
    
    const body = await req.json().catch(() => ({}));
    const userId = body.user_id || body.id;
    
    if (!userId) {
      return errorResponse(ErrorCodes.MISSING_REQUIRED_FIELD, 'Missing user_id in body', 400);
    }

    const admin = createAdminClient();
    const deleteResult = await admin.auth.admin.deleteUser(userId as string);

    if ((deleteResult as any).error) {
      logger.error('DebugRoute', 'Failed to delete test user', (deleteResult as any).error);
      return errorResponse(
        ErrorCodes.INTERNAL_ERROR,
        (deleteResult as any).error.message || 'Failed to delete user',
        500
      );
    }

    logger.info('DebugRoute', 'Test user deleted successfully', { userId });
    return successResponse({ user_id: userId });
  } catch (err: any) {
    logger.error('DebugRoute', 'Unexpected error deleting test user', err);
    return serverErrorResponse(err);
  }
}
