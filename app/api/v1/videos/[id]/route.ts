
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      video_id: 'mock-video-1',
      script_id: 'mock-script-1',
      status: 'completed',
      model_used: 'VideoGen-XL',
      scenes_count: 3,
      total_duration_seconds: 45,
      total_cost_usd: 12.50,
      quality_score: 9,
      output_url: 'https://example.com/video.mp4',
      created_at: new Date().toISOString(),
    },
  });
}
