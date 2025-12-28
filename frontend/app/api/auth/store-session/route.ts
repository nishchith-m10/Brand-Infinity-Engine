import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('[Auth] /api/auth/store-session body:', JSON.stringify(body));
    const { access_token, refresh_token } = body;

    if (!access_token) {
      console.warn('[Auth] Missing access_token in request body');
      return NextResponse.json({ success: false, error: 'access_token required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Set the session server-side so middleware can read it on subsequent requests
    const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });

    console.log('[Auth] setSession result:', { session: data?.session ?? null, error: error ?? null });

    if (error) {
      console.error('[Auth] setSession error', error);
      return NextResponse.json({ success: false, error }, { status: 500 });
    }

    return NextResponse.json({ success: true, session: data.session ?? null });
  } catch (err) {
    console.error('[Auth] store-session error', err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
