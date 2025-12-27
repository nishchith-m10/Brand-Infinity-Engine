
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      hooks: [
        {
          id: '1',
          script_id: 'mock-script-1',
          hook_text: 'Stop scrolling! You need to see this.',
          hook_type: 'Direct Address',
          psychological_trigger: 'FOMO',
          effectiveness_score: 9,
          rank: 1,
        }
      ]
    },
  });
}
