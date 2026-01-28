import { NextRequest, NextResponse } from 'next/server';
import { requestOrchestrator } from '@/lib/orchestrator/RequestOrchestrator';

// Force Node runtime so server-side createClient uses service role key
export const runtime = 'nodejs';

/**
 * Manual endpoint to trigger orchestration for a specific request ID.
 * Body: { requestId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { requestId } = body;
    if (!requestId) {
      return NextResponse.json({ success: false, error: 'requestId is required' }, { status: 400 });
    }

    const result = await requestOrchestrator.processRequest(requestId);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[Orchestrator] Manual trigger error:', error);
    return NextResponse.json({ success: false, error: error?.message || String(error) }, { status: 500 });
  }
}
