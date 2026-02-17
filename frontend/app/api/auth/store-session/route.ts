import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { access_token, refresh_token } = body;

    if (!access_token) {
      return NextResponse.json({ success: false, error: 'access_token required' }, { status: 400 });
    }

    let response = NextResponse.json({ success: true });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    // Set the session server-side - this will trigger cookie setting via setAll above
    const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });

    if (error) {
      console.error('[Auth] setSession error', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    console.log('[Auth] Session stored successfully for user:', data.user?.email);
    
    // Return response with cookies set
    response = NextResponse.json({ success: true, session: data.session ?? null });
    
    return response;
  } catch (err) {
    console.error('[Auth] store-session error', err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
