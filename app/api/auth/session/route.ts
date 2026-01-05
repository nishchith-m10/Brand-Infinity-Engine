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

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      console.error('[Auth:session] error getting user', error);
      return NextResponse.json({ authenticated: false, error: error.message }, { status: 200 });
    }

    const passcodeVerified = !!req.cookies.get('dashboard_passcode_verified');

    return NextResponse.json({
      authenticated: !!user,
      user_email: user?.email ?? null,
      passcodeVerified,
    });
  } catch (err) {
    console.error('[Auth:session] unexpected error', err);
    return NextResponse.json({ authenticated: false, error: 'unexpected' }, { status: 500 });
  }
}
