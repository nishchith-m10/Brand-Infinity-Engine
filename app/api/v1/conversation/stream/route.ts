/**
 * Streaming Conversation Endpoint
 * POST /api/v1/conversation/stream
 * 
 * Uses Server-Sent Events (SSE) to stream LLM responses in real-time.
 */

import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getLLMService } from '@/lib/llm';
import { rateLimiters, checkRateLimit } from '@/lib/utils/rate-limit-helpers';
import { DirectorChatSchema } from '@/lib/validations/api-schemas';
import { logger } from '@/lib/monitoring/logger';

export const runtime = 'edge'; // Use edge runtime for streaming

interface ContextPayload {
  campaign_id?: string;
  campaign_name?: string;
  kb_ids?: string[];
  identity?: {
    brand_name?: string;
    brand_voice?: string;
    tagline?: string;
    target_audience?: string;
    tone_style?: string;
  } | null;
}

interface StreamRequest {
  session_id: string;
  message: string;
  provider?: string;
  model_id?: string;
  openrouter_api_key?: string;
  system_prompt?: string;
  context?: ContextPayload; // Added for brand context support
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate first
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } 
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check rate limit (30 requests/minute for director chat)
    const rateLimitResponse = await checkRateLimit(rateLimiters.directorChat, user.id);
    if (rateLimitResponse) {
      logger.warn('DirectorChat', 'Rate limit exceeded', { userId: user.id });
      return new Response(
        JSON.stringify({
          success: false,
          error: { 
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please try again later.' 
          }
        }),
        { 
          status: 429, 
          headers: rateLimitResponse.headers 
        }
      );
    }

    // Parse and validate request
    const body = await request.json();
    const validation = DirectorChatSchema.safeParse(body);

    if (!validation.success) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: { 
            code: 'VALIDATION_ERROR',
            message: 'Invalid request', 
            details: validation.error.issues 
          } 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { session_id, message, provider, model_id, openrouter_api_key, system_prompt, context } = validation.data;

    // Get LLM service
    const llmService = getLLMService();
    
    // Fetch conversation history for multi-turn context (Bug 1.1 fix)
    const { data: historyMessages } = await supabase
      .from('conversation_messages')
      .select('role, content')
      .eq('session_id', session_id)
      .order('created_at', { ascending: true })
      .limit(20); // Last 20 messages for context

    const conversationHistory = (historyMessages || []).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));
    
    // Determine model
    const modelToUse = model_id 
      ? `${provider || 'openrouter'}/${model_id}`
      : 'anthropic/claude-3-5-sonnet-20241022';

    // Create readable stream
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Build system prompt with context if available
          let fullSystemPrompt = system_prompt || 'You are a helpful Creative Director assistant.';
          
          if (context?.identity) {
            const { brand_name, brand_voice, target_audience, tone_style } = context.identity;
            const contextParts = [];
            if (brand_name) contextParts.push(`Brand: ${brand_name}`);
            if (brand_voice) contextParts.push(`Voice: ${brand_voice}`);
            if (target_audience) contextParts.push(`Target Audience: ${target_audience}`);
            if (tone_style) contextParts.push(`Tone: ${tone_style}`);
            if (contextParts.length > 0) {
              fullSystemPrompt += `\n\n--- Brand Context ---\n${contextParts.join('\n')}`;
            }
          }
          if (context?.campaign_name) {
            fullSystemPrompt += `\n\nCampaign: ${context.campaign_name}`;
          }

          // Stream from LLM with conversation history
          const generator = llmService.streamCompletion({
            userId: user.id,
            agentType: 'executive',
            messages: [
              { 
                role: 'system', 
                content: fullSystemPrompt 
              },
              ...conversationHistory, // Include conversation history
              { role: 'user', content: message },
            ],
            model: modelToUse,
            provider: (provider as 'openrouter' | 'anthropic' | 'openai') || 'openrouter',
            temperature: 0.7,
            maxTokens: 2000,
            apiKey: openrouter_api_key,
          });

          // Yield chunks as SSE using robust buffering to strip echoes
          let buffer = '';
          let checksComplete = false;
          let totalContent = ''; // Track total content to detect empty responses
          const CHECK_THRESHOLD = 100; // Characters to buffer before checking
          
          // Generic pattern to match ANY model echo: "provider/model-name 0" or similar
          // Examples: "openai/gpt-oss-120b 0", "meta-llama/llama-3.2-3b-instruct 0"
          const modelEchoPattern = /^[a-z0-9-]+\/[a-z0-9.-]+\s*\d*\s*/i;

          for await (const chunk of generator) {
            if (checksComplete) {
              // Check each chunk for model echo pattern
              const cleanChunk = chunk.replace(modelEchoPattern, '');
              if (cleanChunk.length > 0) {
                totalContent += cleanChunk;
                const sseData = `data: ${JSON.stringify({ content: cleanChunk })}\n\n`;
                controller.enqueue(encoder.encode(sseData));
              }
              continue;
            }

            buffer += chunk;

            // Check if we have enough data or a newline to make a decision
            if (buffer.length >= CHECK_THRESHOLD || buffer.includes('\n')) {
              // Strip model echo pattern
              let cleanBuffer = buffer.replace(modelEchoPattern, '');
              
              // Also try stripping full model path
              if (cleanBuffer.startsWith(modelToUse) || (model_id && cleanBuffer.startsWith(model_id))) {
                 console.warn('[Stream] Detected model echo in buffer, stripping:', buffer.substring(0, 50));
                 cleanBuffer = cleanBuffer
                   .replace(modelToUse, '')
                   .replace(model_id || '_____', '')
                   .replace(/^\s+\d+\s*/, '')
                   .trimStart();
              }
              
              // Flush buffer
              if (cleanBuffer.length > 0) {
                totalContent += cleanBuffer;
                const sseData = `data: ${JSON.stringify({ content: cleanBuffer })}\n\n`;
                controller.enqueue(encoder.encode(sseData));
              }
              buffer = '';
              checksComplete = true;
            }
          }

          // Handle any remaining buffer if stream ended early (short response)
          if (!checksComplete && buffer.length > 0) {
              // Strip model echo pattern
              let cleanBuffer = buffer.replace(modelEchoPattern, '');
              if (cleanBuffer.startsWith(modelToUse) || (model_id && cleanBuffer.startsWith(model_id))) {
                 console.warn('[Stream] Detected model echo in final buffer, stripping.');
                 cleanBuffer = cleanBuffer
                   .replace(modelToUse, '')
                   .replace(model_id || '_____', '')
                   .replace(/^\s+\d+\s*/, '')
                   .trimStart();
              }
              if (cleanBuffer.length > 0) {
                totalContent += cleanBuffer;
                const sseData = `data: ${JSON.stringify({ content: cleanBuffer })}\n\n`;
                controller.enqueue(encoder.encode(sseData));
              }
          }

          // If no content was generated (model returned only echo), send error message
          if (totalContent.length === 0) {
            console.warn('[Stream] Model returned empty response after sanitization');
            const fallbackMsg = 'I apologize, but I was unable to generate a response. Please try again or select a different model.';
            const sseData = `data: ${JSON.stringify({ content: fallbackMsg })}\n\n`;
            controller.enqueue(encoder.encode(sseData));
          }

          // Send done signal
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();

          // Log successful completion
          logger.info('DirectorChat', 'Streaming response completed', { 
            userId: user.id,
            sessionId: session_id,
            messageLength: totalContent.length 
          });
        } catch (error) {
          logger.error('DirectorChat', 'Stream error', error);
          console.error('[Stream] Error:', error);
          const errorData = `data: ${JSON.stringify({ error: 'Stream failed' })}\n\n`;
          controller.enqueue(encoder.encode(errorData));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    logger.error('DirectorChat', 'Fatal streaming error', error);
    console.error('[Stream] Fatal error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: { 
          code: 'STREAM_FAILED',
          message: error instanceof Error ? error.message : 'Internal server error' 
        }
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
