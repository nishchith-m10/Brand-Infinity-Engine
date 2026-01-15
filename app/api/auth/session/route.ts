import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    // Create server-side Supabase client using the incoming request's cookies
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
      console.error('[Auth:session] Missing Supabase URL or anon key');
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

    // Capture cookies to set in response
    const cookiesToSet: Array<{ name: string; value: string; options: any }> = [];

    const supabase = createServerClient(
      supabaseUrl,
      anonKey,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll();
          },
          setAll(cookieList) {
            cookiesToSet.push(...cookieList);
          },
        },
      }
    );

    // Use getUser to validate user server-side (contacts Supabase Auth server)
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      // Map known auth errors to clearer responses and avoid noisy stack traces
      if ((userError as any)?.code === 'refresh_token_not_found') {
        console.warn('[Auth:session] Refresh token missing or invalid, treating as unauthenticated');
        return NextResponse.json({
          success: false,
          error: {
            code: 'INVALID_REFRESH_TOKEN',
            message: 'Refresh token missing or invalid',
            details: {}
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: 'mock-request-id'
          }
        }, { status: 401 });
      }

      console.warn('[Auth:session] error getting user', userError?.message ?? userError);
      return NextResponse.json({
        success: false,
        error: {
          code: 'USER_ERROR',
          message: userError.message,
          details: {}
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: 'mock-request-id'
        }
      }, { status: 401 });
    }

    const passcodeVerified = !!req.cookies.get('dashboard_passcode_verified');

    // Debug logs for troubleshooting: avoid printing tokens, but show user id/email presence and cookies to set
    console.log('[Auth:session] user:', !!user, 'user_email:', user?.email ?? null, 'passcodeVerified:', passcodeVerified, 'cookiesToSet:', cookiesToSet.map(c => c.name));

    // Return minimal, validated user info - do NOT return raw access tokens from server
    const response = NextResponse.json({
      success: true,
      data: {
        authenticated: !!user,
        user_id: user?.id ?? null,
        user_email: user?.email ?? null,
        passcodeVerified,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: 'mock-request-id'
      }
    });

    // Set any cookies that Supabase needs to update (e.g., refreshed session tokens)
    cookiesToSet.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
      console.log('[Auth:session] Set cookie in response:', name);
    });

    return response;
  } catch (err) {
    console.error('[Auth:session] unexpected error', err);
    return NextResponse.json({
      success: false,
      error: {
        code: 'UNEXPECTED_ERROR',
        message: 'Unexpected error occurred',
        details: { error: String(err) }
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: 'mock-request-id'
      }
    }, { status: 500 });
  }
}
