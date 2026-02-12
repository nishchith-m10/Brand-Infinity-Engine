import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateImageDallE, getDallECost } from '@/lib/ai/dalle';
import { generateImageNanoB, isNanoBConfigured } from '@/lib/ai/nanob';
import { generateImagePollinations, getPollinationsCost } from '@/lib/ai/pollinations';
import { getBrandContext, enrichPromptWithBrandContext } from '@/lib/ai/rag';
import { z } from 'zod';
import { rateLimiters, checkRateLimit } from '@/lib/utils/rate-limit-helpers';
import { logger } from '@/lib/monitoring/logger';

const GenerateImageSchema = z.object({
  prompt: z.string().min(1).max(4000),
  model: z.enum(['dalle-3', 'nanob', 'pollinations']).default('dalle-3'),
  size: z.enum(['1024x1024', '1792x1024', '1024x1792']).default('1024x1024'),
  quality: z.enum(['standard', 'hd']).default('standard'),
  style: z.enum(['vivid', 'natural']).optional(),
  campaign_id: z.string().uuid().optional(),
  brand_id: z.string().uuid().optional(),
  use_brand_context: z.boolean().default(true),
  pollinations: z.object({
    imageModel: z.string().optional(),
    nologo: z.boolean().optional(),
    enhance: z.boolean().optional(),
  }).optional(),
});

/**
 * POST /api/v1/images/generate
 * Generate an image using DALL-E 3 or Nano B
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  let budgetReserved = false;
  let estimatedCost = 0;
  let params: z.infer<typeof GenerateImageSchema> | undefined;

  try {
    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    // Check rate limit (10 requests/minute for image generation)
    const rateLimitResponse = await checkRateLimit(rateLimiters.imageGeneration, user.id);
    if (rateLimitResponse) {
      logger.warn('ImageGeneration', 'Rate limit exceeded', { userId: user.id });
      return rateLimitResponse;
    }

    const body = await request.json();
    const validation = GenerateImageSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { 
          success: false,
          error: { 
            code: 'VALIDATION_ERROR',
            message: 'Validation failed', 
            details: validation.error.issues 
          }
        },
        { status: 400 }
      );
    }

    params = validation.data;
    let enrichedPrompt = params.prompt;

    // Apply brand context via RAG if brand_id provided
    if (params.use_brand_context && params.brand_id) {
      const brandContext = await getBrandContext(params.prompt, params.brand_id);
      enrichedPrompt = enrichPromptWithBrandContext(params.prompt, brandContext);
    }

    // Estimate cost before generation
    if (params.model === 'dalle-3') {
      estimatedCost = getDallECost(params.quality, params.size);
    } else if (params.model === 'pollinations') {
      estimatedCost = getPollinationsCost(); // Free
    } else {
      estimatedCost = 0.01; // Nano B estimate
    }

    // Reserve budget atomically if campaign_id provided
    if (params.campaign_id) {
      const { data: reservation, error: budgetError } = await supabase.rpc('reserve_budget', {
        p_campaign_id: params.campaign_id,
        p_amount: estimatedCost
      });

      if (budgetError || !reservation || reservation.length === 0) {
        logger.warn('ImageGeneration', 'Budget reservation failed', { 
          userId: user.id, 
          campaignId: params.campaign_id,
          estimatedCost,
          error: budgetError?.message 
        });
        return NextResponse.json(
          { 
            success: false,
            error: { 
              code: 'INSUFFICIENT_BUDGET',
              message: 'Insufficient campaign budget or campaign not eligible',
              details: {
                estimatedCost,
                campaignId: params.campaign_id
              }
            }
          },
          { status: 402 } // Payment Required
        );
      }
      budgetReserved = true;
    }

    let result;
    let cost = 0;

    if (params.model === 'dalle-3') {
      try {
        result = await generateImageDallE({
          prompt: enrichedPrompt,
          size: params.size,
          quality: params.quality,
          style: params.style,
        });
        cost = getDallECost(params.quality, params.size);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('requires a user-supplied key') || msg.includes('OpenAI API key not configured')) {
          // Auto-fallback to free providers if enabled
          if (process.env.USE_FREE_PROVIDERS === 'true') {
            console.log('[Image API] No user key found, auto-falling back to Pollinations (free tier)');
            const [width, height] = params.size.split('x').map(Number);
            result = await generateImagePollinations({
              prompt: enrichedPrompt,
              width,
              height,
              model: params.pollinations?.imageModel || (process.env.POLLINATIONS_IMAGE_MODEL as any) || 'flux',
              nologo: params.pollinations?.nologo !== undefined ? params.pollinations.nologo : true,
              enhance: params.pollinations?.enhance || false,
            });
            cost = getPollinationsCost(); // $0.00
          } else {
            return NextResponse.json(
              {
                success: false,
                error: {
                  code: 'MISSING_PROVIDER_KEY',
                  message: 'An OpenAI API key must be added in Settings to generate images.',
                },
              },
              { status: 403 }
            );
          }
        } else {
          throw err;
        }
      }
    } else if (params.model === 'nanob') {
      if (!isNanoBConfigured()) {
        throw new Error('Nano B is not configured. Please add NANOB_API_KEY to environment.');
      }
      const aspectRatio = params.size === '1792x1024' ? '16:9' : params.size === '1024x1792' ? '9:16' : '1:1';
      result = await generateImageNanoB({
        prompt: enrichedPrompt,
        aspect_ratio: aspectRatio,
      });
      cost = 0.01;
    } else if (params.model === 'pollinations') {
      // FREE tier - no API key needed
      // Use user preferences from request body, or fallback to env vars, or use defaults
      const [width, height] = params.size.split('x').map(Number);
      result = await generateImagePollinations({
        prompt: enrichedPrompt,
        width,
        height,
        model: params.pollinations?.imageModel || (process.env.POLLINATIONS_IMAGE_MODEL as any) || 'flux',
        nologo: params.pollinations?.nologo !== undefined ? params.pollinations.nologo : true,
        enhance: params.pollinations?.enhance || false,
      });
      cost = getPollinationsCost(); // $0.00
    } else {
      throw new Error(`Unsupported model: ${params.model}`);
    }

    // Update actual cost if budget was reserved
    if (budgetReserved && params.campaign_id) {
      await supabase.rpc('update_actual_cost', {
        p_campaign_id: params.campaign_id,
        p_reserved: estimatedCost,
        p_actual: cost
      });
    }

    // Log cost to database
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
        metadata: {
          url: result.url,
          model: params.model
        }
      });
    }
    
    logger.info('ImageGeneration', 'Image generated successfully', { 
      userId: user.id,
      model: params.model,
      cost 
    });

    return NextResponse.json({
      success: true,
      data: {
        image_id: crypto.randomUUID(),
        url: result.url,
        model: 'model' in result ? result.model : params.model,
        generation_time_ms: 'generation_time_ms' in result ? result.generation_time_ms : 0,
        cost_usd: cost,
        revised_prompt: 'revised_prompt' in result ? result.revised_prompt : undefined,
      },
    });
  } catch (error) {
    // Refund reserved budget on error
    if (budgetReserved && params?.campaign_id) {
      const supabase = await createClient();
      await supabase.rpc('refund_budget', {
        p_campaign_id: params.campaign_id,
        p_amount: estimatedCost
      });
      logger.info('ImageGeneration', 'Budget refunded due to error', { 
        campaignId: params.campaign_id, 
        amount: estimatedCost 
      });
    }

    logger.error('ImageGeneration', 'Image generation error', error);
    return NextResponse.json(
      { 
        success: false,
        error: { 
          code: 'GENERATION_FAILED',
          message: error instanceof Error ? error.message : 'Image generation failed' 
        }
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/images
 * List generated images (optional, for gallery view)
 */
export async function GET(request: NextRequest) {
  try {
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
      return NextResponse.json({ 
        success: false,
        error: { code: 'DB_ERROR', message: error.message } 
      }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    logger.error('ImagesList', 'Failed to fetch images', error);
    return NextResponse.json({ 
      success: false,
      error: { 
        code: 'DB_ERROR', 
        message: error instanceof Error ? error.message : 'Failed to fetch images' 
      } 
    }, { status: 500 });
  }
}
