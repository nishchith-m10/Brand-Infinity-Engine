
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      script_id: 'mock-script-1',
      brief_id: 'mock-brief-1',
      full_script: 'Scene 1: Int. Future Lab...',
      hook_variations_count: 3,
      scene_segments: [],
      brand_compliance_score: 98,
      created_at: new Date().toISOString(),
    },
  });
}
