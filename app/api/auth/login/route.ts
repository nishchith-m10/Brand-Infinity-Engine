/**
 * Login API Route - Stub for Testing
 * This is a stub implementation for testing purposes
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Mock login implementation for testing
    return NextResponse.json({
      success: true,
      data: {
        message: 'Login successful',
        user: {
          id: 'test-user-id',
          email: body.email
        },
        session: {
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token'
        }
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: 'mock-request-id'
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'LOGIN_FAILED',
          message: 'Login failed',
          details: {}
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: 'mock-request-id'
        }
      },
      { status: 400 }
    );
  }
}