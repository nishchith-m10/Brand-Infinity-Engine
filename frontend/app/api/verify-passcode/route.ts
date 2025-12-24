import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { passcode } = await request.json();
    // Use env var with fallback
    const expectedPasscode = process.env.DASHBOARD_PASSCODE || 'EarlyBloom@edu123';
    
    // Debug logging (remove in production)
    console.log('Received passcode:', passcode);
    console.log('Expected passcode from env:', process.env.DASHBOARD_PASSCODE);
    console.log('Expected passcode used:', expectedPasscode);
    console.log('Match:', passcode === expectedPasscode);
    
    // Verify passcode against environment variable
    if (passcode === expectedPasscode) {
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
    
    return NextResponse.json(
      { error: 'Invalid passcode' }, 
      { status: 401 }
    );
  } catch (error) {
    console.error('Passcode verification error:', error);
    return NextResponse.json(
      { error: 'Server error' }, 
      { status: 500 }
    );
  }
}
