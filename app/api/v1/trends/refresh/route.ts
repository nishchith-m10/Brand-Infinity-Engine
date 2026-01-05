import { NextRequest, NextResponse } from 'next/server';
import { scrapeTrends } from '@/lib/pillars/strategist';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { platforms = [], category = 'all' } = body;

    const trends = await scrapeTrends({ platforms, category });

    return NextResponse.json({
      success: true,
      data: trends,
      meta: {
        timestamp: new Date().toISOString(),
        count: trends.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'SCRAPE_ERROR',
        message: error.message,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    }, { status: 500 });
  }
}
