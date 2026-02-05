// =============================================================================
// POST /api/v1/requests/estimate - Preview Cost/Time
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { calculateEstimate } from '@/lib/pipeline/estimator';

const EstimateRequestSchema = z.object({
  type: z.enum(['video_with_vo', 'video_no_vo', 'image']),
  duration: z.number().int().min(5).max(300).optional(),
  provider: z.string().optional(),
  tier: z.enum(['economy', 'standard', 'premium']).optional().default('standard'),
  hasVoiceover: z.boolean().optional(),
  autoScript: z.boolean().optional().default(true),
});

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse and validate input
    const body = await request.json();
    const validation = EstimateRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validation.error.flatten(),
        },
        { status: 400 }
      );
    }

    const input = validation.data;

    // 3. Calculate estimate
    const estimate = calculateEstimate({
      type: input.type,
      duration: input.duration,
      provider: input.provider,
      tier: input.tier,
      hasVoiceover: input.hasVoiceover ?? input.type === 'video_with_vo',
      autoScript: input.autoScript,
    });

    // 4. Return estimate
    return NextResponse.json({
      success: true,
      data: {
        estimated_cost: estimate.cost,
        estimated_time_seconds: estimate.timeSeconds,
        breakdown: {
          base_cost: estimate.cost,
          provider: input.provider || 'default',
          tier: input.tier,
        },
      },
    });
  } catch (error) {
    console.error('Unexpected error in POST /api/v1/requests/estimate:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
