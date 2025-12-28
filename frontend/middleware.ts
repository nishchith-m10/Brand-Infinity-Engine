import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
// TODO: Implement Upstash REST rate limiting for edge middleware.
// Removed import of '@/lib/ratelimit' because it pulls modules incompatible with Edge.

export async function middleware(request: NextRequest) {
  // Note: Rate limiting has been temporarily disabled in middleware.
  // API routes should implement per-route rate limiting until an edge-safe
  // solution (REST-based Upstash ratelimit) is added.

  // For page routing, consult the /api/auth/session endpoint which runs on the server
  const authPaths = ['/login', '/signup', '/verify-passcode'];
  const isAuthPage = authPaths.some(path => request.nextUrl.pathname.startsWith(path));
  const isApiRoute = request.nextUrl.pathname.startsWith('/api/');

  // Only perform page redirects for browser navigation
  if (!isApiRoute) {
    try {
      const url = new URL('/api/auth/session', request.url).toString();
      const resp = await fetch(url, {
        headers: { cookie: request.headers.get('cookie') ?? '' },
      });

      if (resp.ok) {
        const json = await resp.json();
        const user = json.authenticated;
        const passcodeVerified = json.passcodeVerified || false;

        // Root path logic
        if (request.nextUrl.pathname === '/') {
          const r = request.nextUrl.clone();
          if (!user) {
            r.pathname = '/login';
            return NextResponse.redirect(r);
          }
          if (!passcodeVerified) {
            r.pathname = '/verify-passcode';
            return NextResponse.redirect(r);
          }
          r.pathname = '/dashboard';
          return NextResponse.redirect(r);
        }

        const isProtectedRoute = !isAuthPage && !isApiRoute;

        if (isProtectedRoute && !user) {
          const r = request.nextUrl.clone();
          r.pathname = '/login';
          return NextResponse.redirect(r);
        }

        if (isProtectedRoute && user && !passcodeVerified) {
          const r = request.nextUrl.clone();
          r.pathname = '/verify-passcode';
          return NextResponse.redirect(r);
        }

        if (isAuthPage && user && passcodeVerified) {
          const r = request.nextUrl.clone();
          r.pathname = '/dashboard';
          return NextResponse.redirect(r);
        }
      }
    } catch (err) {
      console.warn('[Middleware] session check failed, allowing request', err);
      // Fall back to allowing the request through — app route handlers will enforce auth
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
