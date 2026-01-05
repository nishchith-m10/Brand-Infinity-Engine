
import { NextResponse } from 'next/server';

export async function GET() {
  // Mock scheduled posts
  return NextResponse.json({
    success: true,
    data: [
      {
        publication_id: '1',
        variant_id: 'v1',
        platform: 'instagram',
        status: 'scheduled',
        scheduled_time: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      },
      {
        publication_id: '2',
        variant_id: 'v2',
        platform: 'youtube',
        status: 'scheduled',
        scheduled_time: new Date(Date.now() + 172800000).toISOString(), // Day after tomorrow
      }
    ]
  });
}
