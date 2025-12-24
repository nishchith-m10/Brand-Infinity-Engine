import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Auth pages (no protection needed)
  const authPaths = ['/login', '/signup', '/verify-passcode'];
  const isAuthPage = authPaths.some(path => request.nextUrl.pathname.startsWith(path));

  // Root path - redirect to login if not authenticated, dashboard if authenticated
  if (request.nextUrl.pathname === '/') {
    const url = request.nextUrl.clone();
    if (!user) {
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
    // Check passcode for authenticated users
    const passcodeVerified = request.cookies.get('dashboard_passcode_verified');
    if (!passcodeVerified) {
      url.pathname = '/verify-passcode';
      return NextResponse.redirect(url);
    }
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  // Protected routes (everything except auth pages)
  const isProtectedRoute = !isAuthPage;

  // Redirect to login if not authenticated
  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Check passcode verification for authenticated users on protected routes
  if (isProtectedRoute && user) {
    const passcodeVerified = request.cookies.get('dashboard_passcode_verified');
    if (!passcodeVerified) {
      const url = request.nextUrl.clone();
      url.pathname = '/verify-passcode';
      return NextResponse.redirect(url);
    }
  }

  // Redirect logged-in users with passcode away from auth pages
  if (isAuthPage && user) {
    const passcodeVerified = request.cookies.get('dashboard_passcode_verified');
    if (passcodeVerified && request.nextUrl.pathname !== '/verify-passcode') {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse;
}
