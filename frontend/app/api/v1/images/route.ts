import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateImageDallE, getDallECost } from '@/lib/ai/dalle';
import { generateImageNanoB, isNanoBConfigured } from '@/lib/ai/nanob';
import { getBrandContext, enrichPromptWithBrandContext } from '@/lib/ai/rag';
import { z } from 'zod';

const GenerateImageSchema = z.object({
  prompt: z.string().min(1).max(4000),
  model: z.enum(['dalle-3', 'nanob']).default('dalle-3'),
  size: z.enum(['1024x1024', '1792x1024', '1024x1792']).default('1024x1024'),
  quality: z.enum(['standard', 'hd']).default('standard'),
  style: z.enum(['vivid', 'natural']).optional(),
  campaign_id: z.string().uuid().optional(),
  brand_id: z.string().uuid().optional(),
  use_brand_context: z.boolean().default(true),
});

/**
 * POST /api/v1/images/generate
 * Generate an image using DALL-E 3 or Nano B
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = GenerateImageSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const params = validation.data;
    let enrichedPrompt = params.prompt;

    // Apply brand context via RAG if brand_id provided
    if (params.use_brand_context && params.brand_id) {
      const brandContext = await getBrandContext(params.prompt, params.brand_id);
      enrichedPrompt = enrichPromptWithBrandContext(params.prompt, brandContext);
    }

    let result;
    let cost = 0;

    if (params.model === 'dalle-3') {
      result = await generateImageDallE({
        prompt: enrichedPrompt,
        size: params.size,
        quality: params.quality,
        style: params.style,
      });
      cost = getDallECost(params.quality, params.size);
    } else if (params.model === 'nanob') {
      if (!isNanoBConfigured()) {
        return NextResponse.json(
          { error: 'Nano B is not configured. Please add NANOB_API_KEY to environment.' },
          { status: 400 }
        );
      }
      const aspectRatio = params.size === '1792x1024' ? '16:9' : params.size === '1024x1792' ? '9:16' : '1:1';
      result = await generateImageNanoB({
        prompt: enrichedPrompt,
        aspect_ratio: aspectRatio,
      });
      cost = 0.01; // Estimate for Nano B
    } else {
      return NextResponse.json({ error: 'Invalid model' }, { status: 400 });
    }

    // Log cost to database
    const supabase = await createClient();
    await supabase.from('cost_ledger').insert({
      operation_type: 'image_generation',
      model_name: params.model,
      cost_usd: cost,
      metadata: {
        prompt: params.prompt.substring(0, 200),
        size: params.size,
        quality: params.quality,
        campaign_id: params.campaign_id,
      },
    });

    // Store image reference if campaign_id provided
    if (params.campaign_id) {
      await supabase.from('generation_jobs').insert({
        campaign_id: params.campaign_id,
        job_type: 'image',
        status: 'completed',
        output_url: result.url,
        metadata: {
          model: params.model,
          prompt: params.prompt,
          generation_time_ms: result.generation_time_ms,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        image_id: crypto.randomUUID(),
        url: result.url,
        model: result.model,
        generation_time_ms: result.generation_time_ms,
        cost_usd: cost,
        revised_prompt: 'revised_prompt' in result ? result.revised_prompt : undefined,
      },
    });
  } catch (error) {
    console.error('Image generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Image generation failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/images
 * List generated images (optional, for gallery view)
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const searchParams = request.nextUrl.searchParams;
  const campaignId = searchParams.get('campaign_id');

  let query = supabase
    .from('generation_jobs')
    .select('*')
    .eq('job_type', 'image')
    .order('created_at', { ascending: false })
    .limit(50);

  if (campaignId) {
    query = query.eq('campaign_id', campaignId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}
