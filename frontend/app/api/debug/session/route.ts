import { NextResponse } from 'next/server';

// Debug endpoint removed - keep a harmless stub to avoid 404 noise in logs
export async function GET() {
  return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
}
