import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getBrandContext } from '@/lib/ai/rag';
import { n8nClient } from '@/lib/n8n/client';
import OpenAI from 'openai';
import { z } from 'zod';

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

const ParsePromptSchema = z.object({
  prompt: z.string().min(1).max(2000),
  brand_id: z.string().uuid().optional(),
});

const LaunchCampaignSchema = z.object({
  parsed_intent: z.object({
    platform: z.string(),
    duration_seconds: z.number().optional(),
    campaign_theme: z.string().optional(),
    tone: z.string().optional(),
    content_type: z.enum(['video', 'image']),
    target_audience: z.string().optional(),
    product: z.string().optional(),
  }),
  brand_id: z.string().uuid().optional(),
  confirmed: z.boolean(),
});

/**
 * POST /api/v1/director/parse
 * Parse natural language prompt into structured campaign parameters
 */
export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const action = url.pathname.endsWith('/launch') ? 'launch' : 'parse';

    if (action === 'launch') {
      return handleLaunch(request);
    }

    const body = await request.json();
    const validation = ParsePromptSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { prompt, brand_id } = validation.data;

    // Get brand context via RAG if brand_id provided
    let brandContext = null;
    if (brand_id) {
      brandContext = await getBrandContext(prompt, brand_id);
    }

    // Build messages array - use vision if images are available
    const hasImages = brandContext?.image_urls && brandContext.image_urls.length > 0;
    const model = hasImages ? 'gpt-4o' : 'gpt-4o-mini'; // Use vision-capable model if images present

    const systemPrompt = `You are a creative brief parser. Extract structured campaign parameters from natural language prompts.
${hasImages ? '\nYou have access to brand images - analyze them and incorporate visual context into your understanding.' : ''}
${brandContext?.assets?.length ? `\nAvailable brand assets:\n${brandContext.assets.map(a => `- ${a.file_name} (${a.asset_type}): ${a.content.substring(0, 200)}...`).join('\n')}` : ''}

Return a JSON object with these fields:
- platform: string (e.g., "instagram_stories", "tiktok", "youtube_shorts", "facebook", "twitter", "thumbnail")
- duration_seconds: number (for video content, default 15)
- campaign_theme: string (the main topic/theme)
- tone: string (e.g., "energetic", "professional", "casual", "luxury")
- content_type: "video" or "image"
- target_audience: string (if mentioned)
- product: string (if mentioned)
- confidence: number (0-1, how confident you are in the parsing)
${hasImages ? '- image_context: brief description of what you observe in the brand images' : ''}

Only return valid JSON, no markdown.`;

    // Build user message content
    const userContent: any = hasImages
      ? [
          { type: 'text', text: prompt },
          ...brandContext.image_urls!.map((img) => ({
            type: 'image_url',
            image_url: {
              url: img.url,
              detail: 'auto',
            },
          })),
        ]
      : prompt;

    // Use GPT to parse the prompt (with vision if images available)
    const parseResponse = await getOpenAI().chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userContent,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: hasImages ? 2000 : 1000,
    });

    const parsedContent = parseResponse.choices[0]?.message?.content;
    let parsedIntent;
    try {
      parsedIntent = JSON.parse(parsedContent || '{}');
    } catch {
      parsedIntent = { error: 'Failed to parse response' };
    }

    return NextResponse.json({
      success: true,
      data: {
        ...parsedIntent,
        brand_context: brandContext,
      },
    });
  } catch (error) {
    console.error('Director parse error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to parse prompt' },
      { status: 500 }
    );
  }
}

/**
 * Handle campaign launch after confirmation
 */
async function handleLaunch(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = LaunchCampaignSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { parsed_intent, brand_id, confirmed } = validation.data;

    if (!confirmed) {
      return NextResponse.json({ error: 'Confirmation required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Create campaign in database
    const { data: campaign, error } = await supabase
      .from('campaigns')
      .insert({
        campaign_name: parsed_intent.campaign_theme || 'New Campaign',
        brand_id: brand_id || null,
        status: parsed_intent.content_type === 'image' ? 'generating_image' : 'strategizing',
        metadata: {
          platform: parsed_intent.platform,
          duration_seconds: parsed_intent.duration_seconds,
          tone: parsed_intent.tone,
          content_type: parsed_intent.content_type,
          target_audience: parsed_intent.target_audience,
          product: parsed_intent.product,
        },
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // For video content, trigger n8n Strategist workflow
    if (parsed_intent.content_type === 'video') {
      await n8nClient.triggerWorkflow('/strategist/campaign', {
        campaign_id: campaign.campaign_id,
        brand_id: brand_id,
        ...parsed_intent,
      });
    }

    // For image content, the frontend will call /api/v1/images/generate directly

    return NextResponse.json({
      success: true,
      data: {
        campaign_id: campaign.campaign_id,
        status: campaign.status,
        content_type: parsed_intent.content_type,
        next_action: parsed_intent.content_type === 'image' 
          ? 'Call /api/v1/images/generate with campaign_id'
          : 'Strategist workflow triggered',
      },
    });
  } catch (error) {
    console.error('Director launch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to launch campaign' },
      { status: 500 }
    );
  }
}
