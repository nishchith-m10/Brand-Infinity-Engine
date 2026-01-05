// =============================================================================
// POST /api/v1/requests - Create Content Request
// GET /api/v1/requests - List Requests
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { calculateEstimate } from '@/lib/pipeline/estimator';
import { createInitialTasks } from '@/lib/pipeline/task-factory';
import { requestOrchestrator } from '@/lib/orchestrator/RequestOrchestrator';
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
  }),

  settings: z
    .object({
      provider: z.string().optional(),
      tier: z.enum(['economy', 'standard', 'premium']).optional().default('standard'),
      auto_script: z.boolean().optional().default(true),
      script_text: z.string().max(10000).optional(),
      selected_kb_ids: z.array(z.string().uuid()).optional().default([]),
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
    const estimate = calculateEstimate({
      type: input.type,
      duration: input.requirements.duration,
      provider: input.settings?.provider,
      tier: input.settings?.tier || 'standard',
      hasVoiceover: input.type === 'video_with_vo',
      autoScript: input.settings?.auto_script ?? true,
    });

    // 5. Create the request record
    const { data: contentRequest, error: insertError } = await supabase
      .from('content_requests')
      .insert({
        brand_id: input.brand_id,
        campaign_id: input.campaign_id || null,
        title: input.title,
        request_type: input.type,
        status: 'intake' as RequestStatus,

        // Creative requirements
        prompt: input.requirements.prompt,
        duration_seconds: input.requirements.duration || null,
        aspect_ratio: input.requirements.aspect_ratio,
        style_preset: input.requirements.style_preset,
        shot_type: input.requirements.shot_type,
        voice_id: input.requirements.voice_id || null,

        // Provider settings
        preferred_provider: input.settings?.provider || null,
        provider_tier: input.settings?.tier || 'standard',

        // Script settings
        auto_script: input.settings?.auto_script ?? true,
        script_text: input.settings?.script_text || null,

        // Knowledge bases
        selected_kb_ids: input.settings?.selected_kb_ids || [],

        // Estimates
        estimated_cost: estimate.cost,
        estimated_time_seconds: estimate.timeSeconds,

        // Audit
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create request:', insertError);
      return NextResponse.json(
        { success: false, error: 'Failed to create request' },
        { status: 500 }
      );
    }

    // 6. Create initial tasks for this request
    const tasks = await createInitialTasks(supabase, contentRequest.id, input.type);

    // 7. Log the creation event
    await supabase.from('request_events').insert({
      request_id: contentRequest.id,
      event_type: 'created',
      description: `Request created: ${input.title}`,
      metadata: {
        type: input.type,
        provider: input.settings?.provider,
        tier: input.settings?.tier,
        task_count: tasks.length,
      },
      actor: `user:${user.id}`,
    });

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
