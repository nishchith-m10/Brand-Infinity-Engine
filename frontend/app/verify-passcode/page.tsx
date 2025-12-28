'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Loader2, LogOut } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth/auth-provider';
import { createClient } from '@supabase/supabase-js';

// Client-side Supabase helper (used to complete OAuth callback on the client)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function VerifyPasscodePage() {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { user, signOut } = useAuth();

  // Attempt to exchange OAuth callback for a Supabase session and store it
  useEffect(() => {
    const tryExchange = async () => {
      try {
        // Preferred method if available
        // Type cast for auth extension methods
        const auth = supabase.auth as unknown as {
          getSessionFromUrl: (opts: { storeSession: boolean }) => Promise<{ data: { session: { access_token: string, refresh_token: string } | null }, error: unknown }>;
          exchangeCodeForSession: (opts: { code: string }) => Promise<{ data: { session: { access_token: string, refresh_token: string } | null }, error: unknown }>;
        };

        if (typeof auth.getSessionFromUrl === 'function') {
          const { data, error } = await auth.getSessionFromUrl({ storeSession: true });
          if (!error && data?.session) {
            await storeSessionOnServer(data.session);
            return;
          }
        }

        // Fallback: try exchangeCodeForSession if available
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');
        if (code && typeof auth.exchangeCodeForSession === 'function') {
          const { data, error } = await auth.exchangeCodeForSession({ code });
          if (!error && data?.session) {
            await storeSessionOnServer(data.session);
            return;
          }
        }
      } catch (err) {
        console.error('[VerifyPasscode] unexpected error while exchanging session', err);
      }
    };

    const storeSessionOnServer = async (session: { access_token: string, refresh_token: string }) => {
      try {
        const storeRes = await fetch('/api/auth/store-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          }),
          credentials: 'include',
        });

        const storeJson = await storeRes.json();
        if (storeJson.success) {
          console.log('[VerifyPasscode] Server-side session stored, redirecting to dashboard');
          window.location.href = '/dashboard';
          return;
        }

        console.warn('[VerifyPasscode] Failed to store session on server, falling back to redirect', storeJson);
        window.location.href = '/dashboard';
      } catch (err) {
        console.error('[VerifyPasscode] Error storing session on server', err);
        window.location.href = '/dashboard';
      }
    };


    // Only attempt exchange when auth callback params are present
    const url = new URL(window.location.href);
    if (url.searchParams.has('code') || window.location.hash.includes('access_token')) {
      tryExchange();
    }
  }, []);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/verify-passcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
        credentials: 'include', // Ensure cookies are sent/received
      });

      const data = await response.json();

      if (response.ok) {
        console.log('[Passcode] Verification successful, redirecting to dashboard');
        // Use window.location instead of router.push to ensure middleware sees the new cookie
        window.location.href = '/dashboard';
      } else {
        setError(data.error || 'Invalid passcode');
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-lamaSkyLight px-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100/50">
          {/* Header */}
          <div className="mb-8 text-center">
            <motion.div 
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-lamaYellowLight"
            >
              <Lock className="h-7 w-7 text-amber-600" />
            </motion.div>
            <h1 className="text-2xl font-bold text-slate-800">Dashboard Access</h1>
            <p className="mt-2 text-sm text-slate-500">
              Enter the dashboard passcode to continue
            </p>
            {user && (
              <p className="mt-1 text-xs text-slate-400">
                Signed in as {user.email}
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Passcode Field */}
            <div>
              <label htmlFor="passcode" className="block text-sm font-medium text-slate-700 mb-1.5">
                Passcode
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={16} className="text-slate-400" />
                </div>
                <input
                  id="passcode"
                  type="password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Enter dashboard passcode"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:border-lamaYellow focus:outline-none focus:ring-2 focus:ring-lamaYellow/20 transition-all"
                  required
                  autoFocus
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl p-3 text-sm bg-red-50 text-red-700 border border-red-100"
              >
                {error}
              </motion.div>
            )}

            {/* Action Buttons */}
            <motion.button 
              type="submit"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-lamaYellow text-slate-800 font-medium hover:bg-lamaYellow/90 focus:outline-none focus:ring-2 focus:ring-lamaYellow/50 disabled:opacity-50 transition-all flex items-center justify-center"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify & Access Dashboard'
              )}
            </motion.button>

            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSignOut}
              className="w-full py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200 transition-all flex items-center justify-center"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </motion.button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
