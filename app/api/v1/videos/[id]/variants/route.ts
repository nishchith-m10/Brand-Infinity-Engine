
import { NextResponse } from 'next/server';

export async function GET() {
  // Removed local mock variants — return empty variants array so UI relies on API data.
  return NextResponse.json({
    success: true,
    data: {
      variants: []
    },
  });
}
