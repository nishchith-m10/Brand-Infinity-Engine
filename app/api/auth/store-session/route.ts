import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function POST(request: NextRequest) {
  console.log('[Auth:store-session] Request received');
  try {
    const body = await request.json();
    const { access_token, refresh_token } = body;

    if (!access_token) {
      console.error('[Auth:store-session] No access token provided');
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_TOKEN',
          message: 'access_token required',
          details: {}
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: 'mock-request-id'
        }
      }, { status: 400 });
    }

    // If the refresh token is missing, return a clear error instead of calling setSession
    if (!refresh_token) {
      console.error('[Auth:store-session] No refresh token provided');
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_REFRESH_TOKEN',
          message: 'refresh_token required to set server session',
          details: {}
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: 'mock-request-id'
        }
      }, { status: 400 });
    }

    console.log('[Auth:store-session] Creating Supabase client and setting session...');
    
    // We need to build the response object and let Supabase set cookies on it
    const cookiesToSet: Array<{ name: string; value: string; options: any }> = [];

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
      console.error('[Auth:store-session] Missing Supabase URL or anon key');
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_CONFIG',
          message: 'Missing Supabase URL or anon key',
          details: {}
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: 'mock-request-id'
        }
      }, { status: 500 });
    }

    const supabase = createServerClient(
      supabaseUrl,
      anonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookieList) {
            cookiesToSet.push(...cookieList);
          },
        },
      }
    );

    // Set the session - this will capture cookies in cookiesToSet
    const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });

    if (error) {
      console.error('[Auth:store-session] setSession error:', error.message);
      return NextResponse.json({
        success: false,
        error: {
          code: 'SET_SESSION_ERROR',
          message: error.message,
          details: {}
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: 'mock-request-id'
        }
      }, { status: 500 });
    }

    console.log('[Auth:store-session] ✅ Session set for user:', data.user?.email);
    console.log('[Auth:store-session] Setting', cookiesToSet.length, 'cookies in response');
    
    // Create response and set all cookies
    const response = NextResponse.json({
      success: true,
      data: {
        session: data.session ?? null
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: 'mock-request-id'
      }
    });
    cookiesToSet.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
      console.log('[Auth:store-session] Set cookie:', name);
    });
    
    return response;
  } catch (err) {
    console.error('[Auth:store-session] Unexpected error:', err);
    return NextResponse.json({
      success: false,
      error: {
        code: 'UNEXPECTED_ERROR',
        message: (err as Error).message,
        details: {}
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: 'mock-request-id'
      }
    }, { status: 500 });
  }
}
