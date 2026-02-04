import { createClient } from '@supabase/supabase-js';

/**
 * Creates a Supabase admin client with service role key.
 * 
 * ⚠️ SECURITY WARNING ⚠️
 * - USE ONLY IN API ROUTES (server-side)
 * - NEVER import in client components
 * - This client bypasses ALL Row Level Security policies
 * - Has full database access (use with extreme caution)
 * 
 * Use createClient() from @/lib/supabase/server instead for RLS-enabled access.
 */
export function createAdminClient() {
  // Prevent usage in browser
  if (typeof window !== 'undefined') {
    throw new Error('[Security] Admin client must only be used server-side. Use createClient() from @/lib/supabase/server instead.');
  }

  // Read SUPABASE URL from production or NEXT_PUBLIC_* fallback
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL environment variable');
  }

  if (!supabaseServiceKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
