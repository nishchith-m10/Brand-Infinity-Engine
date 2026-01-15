import { NextRequest, NextResponse } from 'next/server';
import { requestOrchestrator } from '@/lib/orchestrator/RequestOrchestrator';
import { validateRequest } from '@/lib/validations/api-schemas';
import { z } from 'zod';

// Force Node runtime so server-side createClient uses service role key
export const runtime = 'nodejs';

// Simple validation schema for this endpoint
const ProcessRequestSchema = z.object({
  requestId: z.string().uuid({ message: 'Must be a valid UUID' }),
});

/**
 * Manual endpoint to trigger orchestration for a specific request ID.
 * Body: { requestId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate request
    const validation = validateRequest(ProcessRequestSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: validation.error.format(),
          },
        },
        { status: 400 }
      );
    }

    const { requestId } = validation.data;

    const result = await requestOrchestrator.processRequest(requestId);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[Orchestrator] Manual trigger error:', error);
    return NextResponse.json({ success: false, error: error?.message || String(error) }, { status: 500 });
  }
}
