// =============================================================================
// POST /api/v1/requests - Create Content Request
// GET /api/v1/requests - List Requests
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { calculateEstimate } from '@/lib/pipeline/estimator';
import { taskFactory } from '@/lib/orchestrator/TaskFactory';
import { requestOrchestrator } from '@/lib/orchestrator/RequestOrchestrator';
import { reserveBudget, releaseBudget } from '@/lib/budget/reservation';
import { createRequestAtomic, buildTaskTemplates } from '@/lib/database/transactions';
import { rateLimiters, checkRateLimit } from '@/lib/utils/rate-limit-helpers';
import {
  CreateRequestResponse,
  RequestStatus,
  ListRequestsResponse,
} from '@/types/pipeline';

// Validation Schema
const CreateRequestSchema = z.object({
  brand_id: z.string().uuid(),
  campaign_id: z.string().uuid().optional(),
  title: z.string().min(1).max(255),
  type: z.enum(['video_with_vo', 'video_no_vo', 'image']),

  requirements: z.object({
    prompt: z.string().min(10).max(5000),
    duration: z.number().int().min(5).max(300).optional(),
    aspect_ratio: z.enum(['16:9', '9:16', '1:1', '4:5']).optional().default('16:9'),
    style_preset: z
      .enum(['Realistic', 'Animated', 'Cinematic', '3D', 'Sketch'])
      .optional()
      .default('Realistic'),
    shot_type: z
      .enum(['Close-up', 'Wide', 'Medium', 'POV', 'Aerial'])
      .optional()
      .default('Medium'),
    voice_id: z.string().optional(),
    pollinations_model: z.enum(['flux', 'flux-realism', 'flux-anime', 'flux-3d', 'turbo']).optional(),
  }),

  settings: z
    .object({
      provider: z.string().optional(),
      tier: z.enum(['economy', 'standard', 'premium']).optional().default('standard'),
      auto_script: z.boolean().optional().default(true),
      script_text: z.string().max(10000).optional(),
      selected_kb_ids: z.array(z.string().uuid()).optional().default([]),
      selected_asset_ids: z.array(z.string().uuid()).optional().default([]),
    })
    .optional(),
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

    // 1.5. Check rate limit (10 requests/minute for pipeline generation)
    const rateLimitResponse = await checkRateLimit(rateLimiters.pipelineGeneration, user.id);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // 2. Parse and validate input
    const body = await request.json();
    const validation = CreateRequestSchema.safeParse(body);

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

    // 3. Verify user has access to brand
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('id, name')
      .eq('id', input.brand_id)
      .single();

    if (brandError || !brand) {
      return NextResponse.json(
        { success: false, error: 'Brand not found or access denied' },
        { status: 403 }
      );
    }

    // 4. Calculate cost and time estimates
    const estimateParams = {
      type: input.type,
      duration: input.requirements.duration,
      provider: input.settings?.provider,
      tier: input.settings?.tier || 'standard',
      hasVoiceover: input.type === 'video_with_vo',
      autoScript: input.settings?.auto_script ?? true,
    };
    
    // DEBUG: Log provider and estimate params
    console.log('[DEBUG] Request estimate params:', {
      provider: estimateParams.provider,
      type: estimateParams.type,
      tier: estimateParams.tier,
      settings: input.settings
    });
    
    const estimate = calculateEstimate(estimateParams);
    
    console.log('[DEBUG] Calculated estimate:', {
      cost: estimate.cost,
      provider: estimateParams.provider,
      isFreeProvider: estimateParams.provider && (['pollinations', 'Pollinations', 'POLLINATIONS', 'pollinations-flux', 'pollinations-realism', 'pollinations-anime', 'pollinations-3d', 'pollinations-turbo'].includes(estimateParams.provider))
    });

    // 5. Prepare request data and task templates for atomic creation (Phase III, Pillar 1)
    // Note: Pre-generate a request UUID so budget reservations can reference it prior to creation.
    const { randomUUID } = await import('crypto');
    const preRequestId = randomUUID();

    // Get task templates for this request type
    const taskTemplatesList = taskFactory.getTemplatesForRequestType(input.type);
    const normalizedTemplates = taskTemplatesList.map((t) => ({ ...t, dependencies: t.dependencies || [] }));
    const taskTemplates = buildTaskTemplates(input.type, normalizedTemplates);

    const requestData = {
      id: preRequestId,
      brand_id: input.brand_id,
      campaign_id: input.campaign_id,
      title: input.title,
      request_type: input.type,
      status: 'intake',

      // Creative requirements
      prompt: input.requirements.prompt,
      duration_seconds: input.requirements.duration,
      aspect_ratio: input.requirements.aspect_ratio,
      style_preset: input.requirements.style_preset,
      shot_type: input.requirements.shot_type,
      voice_id: input.requirements.voice_id,

      // Provider settings
      preferred_provider: input.settings?.provider,
      provider_tier: input.settings?.tier || 'standard',

      // Script settings
      auto_script: input.settings?.auto_script ?? true,
      script_text: input.settings?.script_text,

      // Knowledge bases and assets
      selected_kb_ids: input.settings?.selected_kb_ids || [],
      selected_asset_ids: input.settings?.selected_asset_ids || [],

      // Estimates
      estimated_cost: estimate.cost,
      estimated_time_seconds: estimate.timeSeconds,

      // Additional metadata for provider-specific options
      metadata: {
        pollinations_model: input.requirements.pollinations_model,
      },
    };

    // 6. Reserve budget if campaign is provided (Phase II, Pillar 2)
    // This prevents race conditions where concurrent requests exceed budget
    // SKIP reservation for zero-cost operations (free providers like Pollinations)
    if (input.campaign_id && estimate.cost > 0) {
      const budgetReservation = await reserveBudget(input.campaign_id, preRequestId, estimate.cost);
      
      if (!budgetReservation.success) {
        return NextResponse.json(
          {
            success: false,
            error: 'INSUFFICIENT_BUDGET',
            message: budgetReservation.error || 'Insufficient campaign budget',
            details: {
              requested: estimate.cost,
              budgetLimit: budgetReservation.budgetLimit,
              budgetUsed: budgetReservation.budgetUsed,
              budgetReserved: budgetReservation.budgetReserved,
              available: budgetReservation.budgetLimit 
                ? (budgetReservation.budgetLimit - (budgetReservation.budgetUsed || 0) - (budgetReservation.budgetReserved || 0))
                : 0,
            },
          },
          { status: 402 } // Payment Required
        );
      }

      console.log(`[BudgetCheck] Reserved $${estimate.cost} for campaign ${input.campaign_id} (reservation for request ${preRequestId})`);
    } else if (input.campaign_id && estimate.cost === 0) {
      console.log(`[BudgetCheck] Skipping budget reservation for zero-cost request (campaign ${input.campaign_id}, request ${preRequestId})`);
    }

    // 7. Atomically create request + tasks + event (Phase III, Pillar 1)
    // This uses a PostgreSQL RPC function to wrap all operations in a transaction
    const createResult = await createRequestAtomic(
      supabase,
      requestData,
      taskTemplates,
      user.id
    );

    if (!createResult.success) {
      console.error('Failed to create request atomically:', createResult.error);
      
      // Release reserved budget on failure (Phase II, Pillar 2)
      // Only attempt budget release if we actually reserved budget (non-zero cost)
      if (input.campaign_id && estimate.cost > 0) {
        await releaseBudget(input.campaign_id, estimate.cost).catch((err) => {
          console.error('Failed to release budget after request creation failure:', err);
        });
      }
      
      return NextResponse.json(
        { 
          success: false, 
          error: createResult.error || 'Failed to create request',
          code: createResult.code,
          details: createResult.details,
        },
        { status: 500 }
      );
    }

    const contentRequest = createResult.data;
    if (!contentRequest) {
      // This shouldn't happen if success=true, but TypeScript safety
      console.error('Atomic creation succeeded but no data returned');
      return NextResponse.json(
        { success: false, error: 'Internal error: no data returned' },
        { status: 500 }
      );
    }

    // 8. Trigger orchestrator in background (non-blocking)
    // Don't await - let orchestrator process asynchronously
    requestOrchestrator.processRequest(contentRequest.id).catch((error) => {
      console.error(`[Orchestrator] Failed to process request ${contentRequest.id}:`, error);
      // Error is logged but doesn't block response
      // Request will remain in 'intake' status, can be retried
    });

    // 9. Return success response immediately
    const response: CreateRequestResponse = {
      success: true,
      data: {
        id: contentRequest.id,
        status: contentRequest.status,
        title: contentRequest.title,
        request_type: contentRequest.request_type,
        estimated_cost: estimate.cost,
        estimated_time_seconds: estimate.timeSeconds,
        created_at: contentRequest.created_at,
      },
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Unexpected error in POST /api/v1/requests:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// =============================================================================
// GET /api/v1/requests - List Requests
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brand_id');
    const campaignId = searchParams.get('campaign_id');
    const status = searchParams.get('status') as RequestStatus | null;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);

    if (!brandId) {
      return NextResponse.json({ success: false, error: 'brand_id is required' }, { status: 400 });
    }

    // Build query
    let query = supabase
      .from('content_requests')
      .select('*', { count: 'exact' })
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false });

    if (campaignId) {
      query = query.eq('campaign_id', campaignId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    // Pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: requests, error: queryError, count } = await query;

    if (queryError) {
      console.error('Failed to list requests:', queryError);
      return NextResponse.json(
        { success: false, error: 'Failed to list requests' },
        { status: 500 }
      );
    }

    const response: ListRequestsResponse = {
      success: true,
      data: requests || [],
      meta: {
        total: count || 0,
        page,
        limit,
        has_more: (count || 0) > offset + limit,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Unexpected error in GET /api/v1/requests:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
