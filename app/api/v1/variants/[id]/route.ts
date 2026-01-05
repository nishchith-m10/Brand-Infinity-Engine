
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      variant_id: 'v1',
      video_id: 'mock-video-1',
      platform: 'instagram',
      aspect_ratio: '9:16',
      duration_seconds: 45,
      caption: 'Check out the future!',
      hashtags: ['#Tech', '#Future'],
      status: 'ready',
      created_at: new Date().toISOString(),
    },
  });
}
