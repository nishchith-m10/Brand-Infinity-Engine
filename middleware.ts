import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const authPaths = ['/login', '/signup', '/verify-passcode'];
  const isAuthPage = authPaths.some(path => request.nextUrl.pathname.startsWith(path));
  const isApiRoute = request.nextUrl.pathname.startsWith('/api/');

  // Only perform page redirects for browser navigation
  if (!isApiRoute) {
    let user = false;
    let passcodeVerified = false;
    let sessionCheckSucceeded = false;

    const url = new URL('/api/auth/session', request.url).toString();

      // Configurable timeout for session checks (ms) - increase default to 2500ms
      const SESSION_CHECK_TIMEOUT_MS = Number(process.env.SESSION_CHECK_TIMEOUT_MS) || 2500;
      const start = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SESSION_CHECK_TIMEOUT_MS);

      try {
        const resp = await fetch(url, {
          headers: { cookie: request.headers.get('cookie') ?? '' },
          signal: controller.signal,
        });

        const duration = Date.now() - start;
        clearTimeout(timeoutId);

        // CRITICAL: Only treat as authenticated if resp.ok === true
        if (resp.ok) {
          const json = await resp.json();
          user = json.data?.authenticated || false;
          passcodeVerified = json.data?.passcodeVerified || false;
          sessionCheckSucceeded = true;
          // Telemetry: record successful session check duration
          try {
            const { recordSuccess } = await import('@/utils/metrics');
            await recordSuccess('auth-session-check', duration, { status: resp.status, path: request.nextUrl.pathname });
          } catch (e) {
            // ignore telemetry failures
          }
        } else {
          // Non-OK response (401, 500, etc.) — treat as unauthenticated (fail closed)
          console.warn(`[Middleware] Session check returned non-OK status: ${resp.status} for ${request.nextUrl.pathname}`);
          sessionCheckSucceeded = false;
          try {
            const { recordFailure } = await import('@/utils/metrics');
            await recordFailure('auth-session-check', duration, `STATUS_${resp.status}`, { status: resp.status, path: request.nextUrl.pathname });
          } catch (e) {
            // ignore telemetry failures
          }
        }
      } catch (err) {
        const duration = Date.now() - start;
        clearTimeout(timeoutId);
        // Fetch error (timeout, network failure, etc.) — treat as unauthenticated (fail closed)
        if ((err as Error).name === 'AbortError') {
          console.warn(`[Middleware] Session check timed out for ${request.nextUrl.pathname}`);
          try {
            const { recordFailure } = await import('@/utils/metrics');
            await recordFailure('auth-session-check', duration, 'TIMEOUT', { path: request.nextUrl.pathname });
          } catch (e) {
            // ignore telemetry failures
          }
        } else {
          console.warn(`[Middleware] Session check failed for ${request.nextUrl.pathname}:`, err);
          try {
            const { recordFailure } = await import('@/utils/metrics');
            await recordFailure('auth-session-check', duration, 'ERROR', { error: String(err), path: request.nextUrl.pathname });
          } catch (e) {
            // ignore telemetry failures
          }
        }
        sessionCheckSucceeded = false;
      }

    // Debug: log the computed auth state for this request
    try {
      console.log('[Middleware] Request state:', {
        path: request.nextUrl.pathname,
        isAuthPage,
        isApiRoute,
        user,
        passcodeVerified,
        sessionCheckSucceeded,
        cookies: request.cookies.getAll().map(c => c.name),
      });
    } catch (e) {
      // ignore logging failures
    }

    // Redirect authenticated + passcode-verified users away from auth pages (do this early)
    if (isAuthPage && user && passcodeVerified) {
      console.log('[Middleware] Authenticated user on auth page; redirecting to /dashboard');
      const r = request.nextUrl.clone();
      r.pathname = '/dashboard';
      return NextResponse.redirect(r);
    }

    // Root path logic
    if (request.nextUrl.pathname === '/') {
      const r = request.nextUrl.clone();
      // Redirect root to /dashboard (middleware will enforce auth there)
      r.pathname = '/dashboard';
      return NextResponse.redirect(r);
    }

    const isProtectedRoute = !isAuthPage && !isApiRoute;

    // FAIL CLOSED: if session check failed OR user is not authenticated, redirect to login
    if (isProtectedRoute && (!sessionCheckSucceeded || !user)) {
      const passcodeCookie = request.cookies.get('dashboard_passcode_verified');

      // If session check failed but user has passcode cookie, try to re-establish session.
      // To avoid an endless redirect loop when re-establish fails repeatedly, track a short-lived retry counter.
      if (!sessionCheckSucceeded && passcodeCookie) {
        try {
          const retryVal = Number(request.cookies.get('passcode_retries')?.value ?? '0');
          const r = request.nextUrl.clone();

          if (retryVal >= 1) {
            console.warn('[Middleware] Session re-establish attempts exceeded; redirecting to /login');
            r.pathname = '/login';
            const res = NextResponse.redirect(r);
            // Clear retry cookie
            res.cookies.set('passcode_retries', '', { maxAge: 0, path: '/' });
            return res;
          } else {
            console.warn('[Middleware] Session check failed but passcode cookie present; redirecting to /verify-passcode to re-establish server session');
            r.pathname = '/verify-passcode';
            const res = NextResponse.redirect(r);
            // Set retry cookie valid for 60 seconds
            res.cookies.set('passcode_retries', '1', { maxAge: 60, path: '/' });
            return res;
          }
        } catch (e) {
          // Fallback: just redirect to verify-passcode
          const r = request.nextUrl.clone();
          r.pathname = '/verify-passcode';
          return NextResponse.redirect(r);
        }
      } else {
        const r = request.nextUrl.clone();
        r.pathname = '/login';
        return NextResponse.redirect(r);
      }
    }

    // If user is authenticated but passcode not verified, redirect to verify-passcode
    if (isProtectedRoute && user && !passcodeVerified) {
      const r = request.nextUrl.clone();
      r.pathname = '/verify-passcode';
      return NextResponse.redirect(r);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
