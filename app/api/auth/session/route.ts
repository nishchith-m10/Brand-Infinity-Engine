import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    // Create server-side Supabase client using the incoming request's cookies
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
