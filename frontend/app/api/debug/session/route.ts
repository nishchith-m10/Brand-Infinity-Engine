import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getSession();

    return NextResponse.json({
      success: true,
      session: data?.session ?? null,
      error: error ?? null,
      cookies: (request.headers.get('cookie') || '').split('; ').filter(Boolean),
    });
  } catch (err) {
    console.error('[Debug] /api/debug/session error', err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
