
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      platforms: [
        {
          id: 'instagram',
          name: 'Instagram',
          aspect_ratio: '9:16',
          max_duration: 60,
          min_duration: 3,
          supported_formats: ['mp4', 'mov'],
        },
        {
          id: 'tiktok',
          name: 'TikTok',
          aspect_ratio: '9:16',
          max_duration: 180,
          min_duration: 3,
          supported_formats: ['mp4', 'mov'],
        },
        {
          id: 'youtube',
          name: 'YouTube Shorts',
          aspect_ratio: '9:16',
          max_duration: 60,
          min_duration: 5,
          supported_formats: ['mp4', 'mov'],
        }
      ]
    },
  });
}
