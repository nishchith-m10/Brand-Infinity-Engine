import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Dev-only helper to create/delete test users for local E2E debugging
// - POST:  { email?, password? } -> creates a user (email_confirm=true) and returns tokens
// - DELETE: { user_id } -> deletes the user
// Security: disabled in production by default. To enable in production set ALLOW_E2E_CREATE_TEST_USER=true

function ensureAllowed() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_E2E_CREATE_TEST_USER !== 'true') {
    throw new Error('Not allowed in production');
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL');
  }

  if (!anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY');
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message:
      'Dev helper: POST to create { email?, password? } -> creates user and returns tokens. DELETE with { user_id } deletes user. Disabled in production unless ALLOW_E2E_CREATE_TEST_USER=true.',
  });
}

export async function POST(req: NextRequest) {
  try {
    ensureAllowed();

    const body = await req.json().catch(() => ({}));
    const email = body.email || `e2e-test+${Date.now()}@example.com`;
    const password = body.password || 'TempTest!2345';

    const admin = createAdminClient();

    // Create user via Supabase Admin API
    const createResult = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    } as any);

    if ((createResult as any).error) {
      console.error('[debug:create-test-user] create error', (createResult as any).error);
      return NextResponse.json({ success: false, error: (createResult as any).error.message || 'Failed to create user' }, { status: 500 });
    }

    // Response shape varies; try to get user object
    const user = (createResult as any).data?.user || (createResult as any).data || (createResult as any).user || null;

    // Exchange password for tokens (sign-in)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    // Ensure anonKey is a defined string for HeadersInit (TypeScript-safe)
    if (!anonKey) {
      throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY');
    }

    const tokenResp = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': anonKey,
      },
      body: JSON.stringify({ email, password }),
    });

    const tokens = await tokenResp.json();

    if (!tokenResp.ok) {
      console.warn('[debug:create-test-user] token exchange failed', tokens);
    }

    return NextResponse.json({ success: true, data: { user, tokens } });
  } catch (err: any) {
    console.error('[debug:create-test-user] unexpected error', err);
    return NextResponse.json({ success: false, error: err.message || 'Unexpected error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    ensureAllowed();

    const body = await req.json().catch(() => ({}));
    const userId = body.user_id || body.id;
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Missing user_id in body' }, { status: 400 });
    }

    const admin = createAdminClient();
    const deleteResult = await admin.auth.admin.deleteUser(userId as string);

    if ((deleteResult as any).error) {
      console.error('[debug:create-test-user] delete error', (deleteResult as any).error);
      return NextResponse.json({ success: false, error: (deleteResult as any).error.message || 'Failed to delete user' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: { user_id: userId } });
  } catch (err: any) {
    console.error('[debug:create-test-user] unexpected error', err);
    return NextResponse.json({ success: false, error: err.message || 'Unexpected error' }, { status: 500 });
  }
}
