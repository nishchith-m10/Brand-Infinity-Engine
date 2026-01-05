
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      scenes: [
        {
          id: '1',
          video_id: 'mock-video-1',
          scene_number: 1,
          prompt: 'Futuristic city skyline',
          duration_seconds: 5,
          model_used: 'VideoGen-XL',
          cost_usd: 0.5,
          status: 'completed',
          output_url: 'https://example.com/scene1.mp4',
        }
      ]
    },
  });
}
