import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  let cookieStore;
  try {
    cookieStore = await cookies();
  } catch {
    // Not in a request context (tests or other runtimes). We'll fall back
    // to a no-op cookie interface so createServerClient still works.
    cookieStore = null;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    // Tests may run without Supabase env vars. Return a lightweight fake supabase
    // client to allow tests to run without an external database. This reuses a
    // shared in-memory store so different clients see the same data.
    if (process.env.NODE_ENV === 'test') {
      return (await import('./fakeClient')).createFakeSupabaseClient();
    }

    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_URL / SUPABASE_ANON_KEY) environment variables');
  }

  return createServerClient(
    supabaseUrl,
    anonKey,
    {
      cookies: {
        getAll() {
          try {
            return cookieStore ? cookieStore.getAll() : [];
          } catch {
            return [];
          }
        },
        setAll(cookiesToSet) {
          if (!cookieStore) return;
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}
