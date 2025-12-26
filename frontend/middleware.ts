import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Minimal middleware stub for preview deployments.
// Disabled complex imports to avoid edge runtime incompatibilities
// (e.g., @/lib/supabase/middleware and @/lib/ratelimit).
// Reintroduce full middleware after implementing edge-compatible utilities.
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
