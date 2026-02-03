import { createBrowserClient } from '@supabase/ssr';

// Single shared browser client to avoid multiple GoTrueClient instances in the same context
let _browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (!_browserClient) {
    _browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return _browserClient;
}
