/**
 * PHASE 6 PART 2: Start New Conversation
 * POST /api/v1/conversation/start
 * 
 * Creates a new conversation session and returns a hardcoded greeting.
 * Note: This is Slice 2 - no agent logic yet, just session management.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSession, createMessage, updateSession } from "@/lib/conversation/queries";
import {
  setCachedSession,
  invalidateMessageCache,
  invalidateStatsCache,
  setCachedQuestions,
} from "@/lib/redis/session-cache";
import type { ClarifyingQuestion } from "@/lib/agents/types";
import { createExecutiveAgent } from "@/lib/agents/executive";

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

interface ContextPayload {
  campaign_id: string;
  campaign_name: string;
  kb_ids: string[];
  identity_mode: 'isolated' | 'shared' | 'inherited';
  identity: {
    brand_name?: string;
    brand_voice?: string;
    tagline?: string;
    mission_statement?: string;
    target_audience?: string;
    tone_style?: string;
    personality_traits?: string[];
    content_pillars?: string[];
  } | null;
}

interface StartConversationRequest {
  brand_id: string;
  initial_message: string;
  selected_kb_ids?: string[]; // Legacy support
  context?: ContextPayload; // New context payload
  provider?: string;
  model_id?: string;
  openrouter_api_key?: string;
}

interface StartConversationResponse {
  success: boolean;
  session_id?: string;
  response?: {
    type: "message" | "questions" | "error";
    content: string;
    questions?: ClarifyingQuestion[];
  };
  state?: string;
  error?: {
    code: string;
    message: string;
  };
}

// ============================================================================
// ROUTE HANDLER
// ============================================================================

export async function POST(
  request: NextRequest
): Promise<NextResponse<StartConversationResponse>> {
  try {
    // Step 1: Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required",
          },
        },
        { status: 401 }
      );
    }

    // Step 2: Parse request body
    const body: StartConversationRequest = await request.json();

    // Validate required fields
    if (!body.brand_id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "MISSING_BRAND_ID",
            message: "brand_id is required",
          },
        },
        { status: 400 }
      );
    }

    if (!body.initial_message) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "MISSING_MESSAGE",
            message: "initial_message is required",
          },
        },
        { status: 400 }
      );
    }

    // Step 3: Verify user has access to brand
    const { data: brand, error: brandError } = await supabase
      .from("brands")
      .select("id")
      .eq("id", body.brand_id)
      .eq("owner_id", user.id)
      .single();

    if (brandError || !brand) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "BRAND_NOT_FOUND",
            message: "Brand not found or access denied",
          },
        },
        { status: 404 }
      );
    }

    // Step 4: Create conversation session
    const { session, error: sessionError } = await createSession({
      brandId: body.brand_id,
      userId: user.id,
      kbIds: body.selected_kb_ids || [],
    });

    if (sessionError || !session) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "SESSION_CREATE_FAILED",
            message: sessionError || "Failed to create session",
          },
        },
        { status: 500 }
      );
    }

    // Cache the new session in Redis
    await setCachedSession(session.id, session);

    // Step 5: Store user's initial message
    const { error: userMessageError } = await createMessage({
      sessionId: session.id,
      brandId: body.brand_id,
      userId: user.id,
      role: "user",
      content: body.initial_message,
    });

    if (userMessageError) {
      console.error("[start] Failed to store user message:", userMessageError);
      // Don't fail the request, just log the error
    }

    // Step 6: Extract context (use new context payload or fallback to legacy)
    const kbIds = body.context?.kb_ids || body.selected_kb_ids || [];
    const identity = body.context?.identity || null;
    const campaignName = body.context?.campaign_name || null;
    
    // Load brand knowledge from selected KBs
    let brandKnowledge = '';
    if (kbIds.length > 0) {
      const { data: kbData } = await supabase
        .from('brand_knowledge_base')
        .select('content')
        .in('knowledge_base_id', kbIds)
        .eq('is_active', true)
        .limit(10);
      
      if (kbData && kbData.length > 0) {
        brandKnowledge = kbData.map(kb => kb.content).join('\n\n');
      }
    }
    
    // Build identity context string for AI
    let identityContext = '';
    if (identity) {
      const parts = [];
      if (identity.brand_name) parts.push(`Brand: ${identity.brand_name}`);
      if (identity.brand_voice) parts.push(`Voice: ${identity.brand_voice}`);
      if (identity.tagline) parts.push(`Tagline: ${identity.tagline}`);
      if (identity.target_audience) parts.push(`Target Audience: ${identity.target_audience}`);
      if (identity.tone_style) parts.push(`Tone: ${identity.tone_style}`);
      if (identity.personality_traits?.length) parts.push(`Personality: ${identity.personality_traits.join(', ')}`);
      if (identity.content_pillars?.length) parts.push(`Content Pillars: ${identity.content_pillars.join(', ')}`);
      identityContext = parts.join('\n');
    }
    
    // Campaign context
    let campaignContext = '';
    if (campaignName) {
      campaignContext = `\nCampaign: ${campaignName}\n`;
    }

    // Step 7: Use Executive Agent to process message
    // Use provided model or default to premium preset
    const preset = body.provider && body.model_id 
      ? 'budget' as const
      : 'premium' as const;
    
    // Use user-provided API key and specific model if available
    const agent = createExecutiveAgent(preset, user.id, body.openrouter_api_key, body.model_id);
    
    // Combine all context for the agent
    const fullContext = [
      campaignContext,
      identityContext ? `\n--- Brand Identity ---\n${identityContext}` : '',
      brandKnowledge ? `\n--- Brand Knowledge ---\n${brandKnowledge}` : '',
    ].filter(Boolean).join('\n');
    
    // Step 8: Process message with Agent
    let action;
    try {
      action = await agent.processMessage({
        session,
        userMessage: body.initial_message,
        brandKnowledge: fullContext,
      });
    } catch (agentError: any) {
      console.error("[start] Executive Agent error:", agentError);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "AGENT_ERROR",
            message: agentError.message || "The AI agent failed to process your request",
          },
        },
        { status: 500 }
      );
    }

    let assistantContent = '';
    let responseType: 'message' | 'questions' = 'message';
    let actionTaken = 'responded';

    if (action.type === 'ask_questions') {
      // Agent needs more information
      assistantContent = `I'd like to understand your needs better. Please answer these questions:\n\n${action.questions.map((q: { question: string }, i: number) => `${i + 1}. ${q.question}`).join('\n')}`;
      responseType = 'questions';
      actionTaken = 'asked_questions';

      // Update session with parsed intent and pending questions
      await updateSession(session.id, {
        state: 'gathering' as const,
        parsed_intent: action.parsedIntent,
        pending_questions: action.questions,
      });

      // Cache questions in Redis
      await setCachedQuestions(session.id, action.questions);

    } else if (action.type === 'create_plan') {
      // Agent has everything, explain the plan
      assistantContent = await agent.explainPlan(action.parsedIntent);
      actionTaken = 'explained_plan';

      // Update session with final intent
      await updateSession(session.id, {
        state: 'confirming' as const,
        parsed_intent: action.parsedIntent,
        pending_questions: [],
      });
    }

    // Step 8: Store assistant response
    const { error: assistantMessageError } = await createMessage({
      sessionId: session.id,
      brandId: body.brand_id,
      userId: user.id,
      role: "assistant",
      content: assistantContent,
      metadata: {
        actionTaken,
        modelUsed: agent.getModel(),
        provider: 'openai',
        tokensUsed: 0, // Will be updated after LLM call
        costUsd: 0,
        questionsAsked: action.type === 'ask_questions' ? action.questions : undefined,
      },
    });

    if (assistantMessageError) {
      console.error(
        "[start] Failed to store assistant message:",
        assistantMessageError
      );
    }

    // Invalidate caches since we added new messages
    await invalidateMessageCache(session.id);
    await invalidateStatsCache(session.id);

    // Step 9: Return response
    return NextResponse.json(
      {
        success: true,
        session_id: session.id,
        response: {
          type: responseType,
          content: assistantContent,
          questions: action.type === 'ask_questions' ? action.questions : undefined,
        },
        state: session.state,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[start] Unexpected error:", error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message:
            error instanceof Error ? error.message : "An unexpected error occurred",
        },
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// OPTIONS HANDLER (CORS)
// ============================================================================

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  
  // Whitelist of allowed origins
  const allowedOrigins = [
    process.env.NEXT_PUBLIC_APP_URL,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ].filter(Boolean);
  
  // Check if origin is allowed
  const corsOrigin = origin && allowedOrigins.includes(origin) 
    ? origin 
    : allowedOrigins[0] || '';
  
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true",
      },
    }
  );
}

