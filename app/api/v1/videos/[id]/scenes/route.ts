
import { NextResponse } from 'next/server';

export async function GET() {
  // Removed local mock scenes data — return an empty scenes array so UI shows real API-driven state.
  return NextResponse.json({
    success: true,
    data: {
      scenes: []
    },
  });
}
