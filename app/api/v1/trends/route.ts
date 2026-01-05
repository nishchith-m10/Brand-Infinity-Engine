
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    success: true,
    data: [
      {
        id: '1',
        name: '#AIBranding',
        category: 'Technology',
        source: 'Twitter',
        engagement_score: 85,
        hashtags: ['#AI', '#Marketing'],
        created_at: new Date().toISOString(),
      },
      {
        id: '2',
        name: 'Sustainable Living',
        category: 'Lifestyle',
        source: 'Instagram',
        engagement_score: 92,
        hashtags: ['#EcoFriendly', '#Green'],
        created_at: new Date().toISOString(),
      }
    ],
  });
}
