
import { NextResponse } from 'next/server';

export async function GET() {
  // Removed mock variant response — return 404 Not Found to indicate no local mock data.
  return NextResponse.json({ success: false, error: { message: 'Variant not found' } }, { status: 404 });
}
