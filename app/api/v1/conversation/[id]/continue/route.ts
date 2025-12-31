/**
 * Continue Conversation - Answer Questions or Send Follow-up
 * POST /api/v1/conversation/[id]/continue
 * Slice 5: Executive Agent Integration
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createMessage, userOwnsSession, updateSession } from "@/lib/conversation/queries";
import {
  getCachedSession,
  invalidateMessageCache,
  invalidateStatsCache,
  getCachedQuestions,
  clearCachedQuestions,
} from "@/lib/redis/session-cache";
import { createExecutiveAgent } from "@/lib/agents/executive";
import type { ClarifyingQuestion, TaskPlan } from "@/lib/agents/types";

interface ContextPayload {
  campaign_id: string;
  campaign_name: string;
  kb_ids: string[];
  identity_mode: 'isolated' | 'shared' | 'inherited';
  identity: {
    brand_name?: string;
    brand_voice?: string;
    tagline?: string;
    target_audience?: string;
    tone_style?: string;
    personality_traits?: string[];
    content_pillars?: string[];
  } | null;
}

interface ContinueRequest {
  message: string;
  answers?: Record<string, unknown>;
  context?: ContextPayload;
  provider?: string;
  model_id?: string;
  openrouter_api_key?: string;
}

interface ContinueResponse {
  success: boolean;
  response?: {
    type: "message" | "questions" | "plan";
    content: string;
    questions?: ClarifyingQuestion[];
    plan?: TaskPlan;
  };
  state?: string;
  error?: {
    code: string;
    message: string;
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ContinueResponse>> {
  try {
    const { id: sessionId } = await params;

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

    // Step 2: Verify ownership
    const ownsSession = await userOwnsSession(sessionId, user.id);
    if (!ownsSession) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "SESSION_NOT_FOUND",
            message: "Session not found or access denied",
          },
        },
        { status: 404 }
      );
    }

    // Step 3: Get session
    const { session, error: sessionError } = await getCachedSession(sessionId);
    if (sessionError || !session) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "SESSION_FETCH_FAILED",
            message: sessionError || "Failed to fetch session",
          },
        },
        { status: 500 }
      );
    }

    // Step 4: Parse request
    const body: ContinueRequest = await request.json();
    if (!body.message) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "MISSING_MESSAGE",
            message: "message is required",
          },
        },
        { status: 400 }
      );
    }

    // Note: All models are now allowed - blocking removed per audit fix

    // Step 5: Store user message
    await createMessage({
      sessionId: session.id,
      brandId: session.brand_id,
      userId: user.id,
      role: "user",
      content: body.message,
    });

    // Step 6: Get pending questions if any
    const pendingQuestions = await getCachedQuestions(sessionId);

    // Step 7: Use Executive Agent
    // Use provided model or default to premium preset
    const preset = body.provider && body.model_id 
      ? 'budget' as const
      : 'premium' as const;
    
    // Use user-provided API key if available
    const agent = createExecutiveAgent(preset, user.id, body.openrouter_api_key);
    
    // Build context from context payload
    let fullContext = '';
    if (body.context) {
      const { identity, campaign_name } = body.context;
      const parts: string[] = [];
      
      if (campaign_name) parts.push(`Campaign: ${campaign_name}`);
      
      if (identity) {
        const identityParts: string[] = [];
        if (identity.brand_name) identityParts.push(`Brand: ${identity.brand_name}`);
        if (identity.brand_voice) identityParts.push(`Voice: ${identity.brand_voice}`);
        if (identity.target_audience) identityParts.push(`Audience: ${identity.target_audience}`);
        if (identity.tone_style) identityParts.push(`Tone: ${identity.tone_style}`);
        if (identityParts.length > 0) {
          parts.push(`--- Brand Identity ---\n${identityParts.join('\n')}`);
        }
      }
      
      fullContext = parts.join('\n');
    }
    
    let action;

    if (pendingQuestions.length > 0 && body.answers) {
      // Processing answers to questions
      action = await agent.processAnswers({
        session,
        answers: body.answers,
      });
      
      // Clear pending questions from Redis cache
      await clearCachedQuestions(sessionId);
      
      // CRITICAL: Update session's parsed_intent with answers so they persist
      // This prevents the same questions from being asked again
      const updatedIntent = {
        ...session.parsed_intent,
        ...body.answers,
      };
      await updateSession(sessionId, {
        parsed_intent: updatedIntent,
        answered_questions: body.answers,
      });
    } else {
      // Regular follow-up message
      action = await agent.processMessage({
        session,
        userMessage: body.message,
        brandKnowledge: fullContext,
      });
    }

    // Step 8: Generate response
    let assistantContent = '';
    let responseType: 'message' | 'questions' | 'plan' = 'message';

    if (action.type === 'ask_questions') {
      assistantContent = `I need a bit more information:\n\n${action.questions.map((q: ClarifyingQuestion, i: number) => `${i + 1}. ${q.question}`).join('\n')}`;
      responseType = 'questions';
    } else if (action.type === 'create_plan') {
      assistantContent = await agent.explainPlan(action.parsedIntent);
      responseType = 'plan';
    }

    // Step 9: Store assistant response
    await createMessage({
      sessionId: session.id,
      brandId: session.brand_id,
      userId: user.id,
      role: "assistant",
      content: assistantContent,
      metadata: {
        actionTaken: action.type,
        modelUsed: agent.getModel(),
        provider: 'openai',
      },
    });

    // Invalidate caches
    await invalidateMessageCache(session.id);
    await invalidateStatsCache(session.id);

    // Step 10: Return response
    return NextResponse.json(
      {
        success: true,
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
    console.error("[continue] Unexpected error:", error);

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

export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    }
  );
}

