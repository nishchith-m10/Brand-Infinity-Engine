import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    // Create server-side Supabase client using the incoming request's cookies
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
      console.error('[Auth:session] Missing Supabase URL or anon key');
      return NextResponse.json({ authenticated: false, error: 'Missing Supabase URL or anon key' }, { status: 500 });
    }

    const supabase = createServerClient(
      supabaseUrl,
      anonKey,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll();
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
      console.error('[Auth:session] error getting user', userError);
      return NextResponse.json({ authenticated: false, error: userError.message }, { status: 200 });
    }

    const passcodeVerified = !!req.cookies.get('dashboard_passcode_verified');

    // Return minimal, validated user info - do NOT return raw access tokens from server
    return NextResponse.json({
      authenticated: !!user,
      user_id: user?.id ?? null,
      user_email: user?.email ?? null,
      passcodeVerified,
    });
  } catch (err) {
    console.error('[Auth:session] unexpected error', err);
    return NextResponse.json({ authenticated: false, error: 'unexpected' }, { status: 500 });
  }
}
