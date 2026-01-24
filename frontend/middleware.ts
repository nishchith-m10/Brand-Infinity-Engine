import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Edge-compatible rate limiter using Upstash REST API
 */
async function checkRateLimit(
  identifier: string,
  limit: number = 100,
  windowSeconds: number = 10
): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
  try {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      console.warn('[RateLimit] Missing Upstash credentials');
      return { success: true, limit, remaining: limit, reset: Date.now() + windowSeconds * 1000 };
    }

    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const key = `ratelimit:${identifier}`;
    const windowStart = now - windowMs;

    // Get current count from sorted set
    const countResponse = await fetch(`${url}/zcount/${key}/${windowStart}/${now}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!countResponse.ok) {
      console.warn('[RateLimit] Upstash request failed, allowing request');
      return { success: true, limit, remaining: limit, reset: now + windowMs };
    }

    const countData = await countResponse.json();
    const currentCount = countData.result || 0;

    if (currentCount >= limit) {
      return { success: false, limit, remaining: 0, reset: now + windowMs };
    }

    // Add current timestamp
    await fetch(`${url}/zadd/${key}/${now}/${now}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    // Set expiry
    await fetch(`${url}/expire/${key}/${windowSeconds * 2}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    // Cleanup old entries
    fetch(`${url}/zremrangebyscore/${key}/0/${windowStart}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});

    return { success: true, limit, remaining: limit - currentCount - 1, reset: now + windowMs };
  } catch (error) {
    console.error('[RateLimit] Error in checkRateLimit:', error);
    // Fail open: allow request on error
    return { success: true, limit, remaining: limit, reset: Date.now() + windowSeconds * 1000 };
  }
}

export async function middleware(request: NextRequest) {
  try {
    // Rate limiting: 100 requests per 10 seconds per IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() 
      ?? request.headers.get('x-real-ip') 
      ?? 'unknown';
    const rateLimitResult = await checkRateLimit(ip, 100, 10);

    if (!rateLimitResult.success) {
      return new NextResponse('Too Many Requests', {
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.reset.toString(),
          'Retry-After': Math.ceil((rateLimitResult.reset - Date.now()) / 1000).toString(),
        },
      });
    }

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
  } catch (error) {
    console.error('[Middleware] Critical error, failing open:', error);
    // Critical error: fail open to avoid breaking the site
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
