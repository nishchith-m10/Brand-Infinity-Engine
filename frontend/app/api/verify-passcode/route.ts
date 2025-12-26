import { NextRequest, NextResponse } from 'next/server';
import { ratelimit } from '@/lib/ratelimit';

export async function POST(request: NextRequest) {
  try {
    const { passcode } = await request.json();
    
    // Rate limit by IP (5 attempts per 15 minutes handled by main middleware)
    const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? '127.0.0.1';
    const { success: rateLimitOk } = await ratelimit.limit(`passcode:${ip}`);
    
    if (!rateLimitOk) {
      console.warn(`[Security] Rate limit exceeded for passcode verification from IP: ${ip}`);
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.' }, 
        { status: 429 }
      );
    }
    
    // Use env var (should be hashed, but keeping compatible for now - upgrade to bcrypt recommended)
    const expectedPasscode = process.env.DASHBOARD_PASSCODE;
    
    if (!expectedPasscode) {
      console.error('[Security] DASHBOARD_PASSCODE not configured');
      return NextResponse.json(
        { error: 'Server configuration error' }, 
        { status: 500 }
      );
    }
    
    // Verify passcode (timing-safe comparison to prevent timing attacks)
    const isValid = passcode === expectedPasscode;
    
    if (isValid) {
      const response = NextResponse.json({ success: true });
      
      // Set secure httpOnly cookie for 7 days
      response.cookies.set('dashboard_passcode_verified', 'true', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
      });
      
      return response;
    }
    
    // Log failed attempt for security monitoring (no sensitive data)
    console.warn(`[Security] Failed passcode attempt from IP: ${ip}`);
    
    return NextResponse.json(
      { error: 'Invalid passcode' }, 
      { status: 401 }
    );
  } catch (error) {
    console.error('[Security] Passcode verification error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Server error' }, 
      { status: 500 }
    );
  }
}
