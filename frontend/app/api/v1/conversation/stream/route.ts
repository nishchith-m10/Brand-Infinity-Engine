/**
 * Streaming Conversation Endpoint
 * POST /api/v1/conversation/stream
 * 
 * Uses Server-Sent Events (SSE) to stream LLM responses in real-time.
 */

import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getLLMService } from '@/lib/llm';

export const runtime = 'edge'; // Use edge runtime for streaming

interface StreamRequest {
  session_id: string;
  message: string;
  provider?: string;
  model_id?: string;
  openrouter_api_key?: string;
  system_prompt?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Parse request
    const body: StreamRequest = await request.json();
    const { session_id, message, provider, model_id, openrouter_api_key, system_prompt } = body;

    if (!session_id || !message) {
      return new Response(
        JSON.stringify({ error: 'Missing session_id or message' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Authenticate
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get LLM service
    const llmService = getLLMService();
    
    // Determine model
    const modelToUse = model_id 
      ? `${provider || 'openrouter'}/${model_id}`
      : 'anthropic/claude-3-5-sonnet-20241022';

    // Create readable stream
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Stream from LLM
          const generator = llmService.streamCompletion({
            userId: user.id,
            agentType: 'executive',
            messages: [
              { 
                role: 'system', 
                content: system_prompt || 'You are a helpful Creative Director assistant.' 
              },
              { role: 'user', content: message },
            ],
            model: modelToUse,
            provider: (provider as 'openrouter' | 'anthropic' | 'openai') || 'openrouter',
            temperature: 0.7,
            maxTokens: 2000,
            apiKey: openrouter_api_key,
          });

          // Yield chunks as SSE
          for await (const chunk of generator) {
            const sseData = `data: ${JSON.stringify({ content: chunk })}\n\n`;
            controller.enqueue(encoder.encode(sseData));
          }

          // Send done signal
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
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
    console.error('[Stream] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
