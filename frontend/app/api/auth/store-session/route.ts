import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function POST(request: NextRequest) {
  console.log('[Auth:store-session] Request received');
  try {
    const body = await request.json();
    const { access_token, refresh_token } = body;

    if (!access_token) {
      console.error('[Auth:store-session] No access token provided');
      return NextResponse.json({ success: false, error: 'access_token required' }, { status: 400 });
    }

    console.log('[Auth:store-session] Creating Supabase client and setting session...');
    
    // We need to build the response object and let Supabase set cookies on it
    const cookiesToSet: Array<{ name: string; value: string; options: any }> = [];

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    console.log('[Auth:store-session] ✅ Session set for user:', data.user?.email);
    console.log('[Auth:store-session] Setting', cookiesToSet.length, 'cookies in response');
    
    // Create response and set all cookies
    const response = NextResponse.json({ success: true, session: data.session ?? null });
    cookiesToSet.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
      console.log('[Auth:store-session] Set cookie:', name);
    });
    
    return response;
  } catch (err) {
    console.error('[Auth:store-session] Unexpected error:', err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
