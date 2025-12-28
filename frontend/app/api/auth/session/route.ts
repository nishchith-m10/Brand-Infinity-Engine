import { createClient } from '@/lib/supabase/client';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) {
      console.error('[Auth:session] error getting user', error);
      return NextResponse.json({ authenticated: false, error: error.message }, { status: 200 });
    }

    const passcodeVerified = req.headers.get('cookie')?.includes('dashboard_passcode_verified=') ?? false;

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
