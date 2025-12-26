/**
 * PHASE 6 PART 2: Get Conversation Session
 * GET /api/v1/conversation/[id]
 * 
 * Retrieves a conversation session with its full message history.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getSessionCost,
  userOwnsSession,
} from "@/lib/conversation/queries";
import {
  getCachedSession,
  getCachedMessages,
  getCachedStats,
} from "@/lib/redis/session-cache";

// ============================================================================
// RESPONSE TYPES
// ============================================================================

interface GetConversationResponse {
  success: boolean;
  session?: {
    id: string;
    brand_id: string;
    state: string;
    created_at: string;
    last_activity_at: string;
    parsed_intent: any;
    answered_questions: any;
    pending_questions: any[];
    selected_kb_ids: string[];
    active_task_plan_id: string | null;
  };
  messages?: Array<{
    id: string;
    role: string;
    content: string;
    created_at: string;
    tokens_used?: number;
    model_used?: string;
    provider?: string;
    cost_usd?: number;
    action_taken?: string;
  }>;
  stats?: {
    total_messages: number;
    total_cost: number;
    total_tokens: number;
    by_role: Array<{
      role: string;
      message_count: number;
      total_tokens: number;
      total_cost: number;
    }>;
  };
  error?: {
    code: string;
    message: string;
  };
}

// ============================================================================
// ROUTE HANDLER
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<GetConversationResponse>> {
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

    // Step 2: Verify user owns this session
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

    // Step 3: Fetch session details (Redis cached)
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

    // Step 4: Fetch messages (Redis cached)
    const { messages, error: messagesError } = await getCachedMessages(
      sessionId,
      100 // Get last 100 messages
    );

    if (messagesError) {
      console.error("[get] Failed to fetch messages:", messagesError);
      // Continue anyway, return session without messages
    }

    // Step 5: Fetch statistics (Redis cached, best-effort)
    let totalCost = 0;
    let statsByRole: any[] = [];

    try {
      const { cost } = await getSessionCost(sessionId);
      totalCost = cost;

      const { stats } = await getCachedStats(sessionId);
      statsByRole = stats;
    } catch (error) {
      console.error("[get] Failed to fetch stats:", error);
      // Non-critical, continue
    }

    // Step 6: Calculate total message count and tokens
    const totalMessages = messages.length;
    const totalTokens = messages.reduce((sum, msg) => {
      return sum + (msg.tokens_used || 0);
    }, 0);

    // Step 7: Return response
    return NextResponse.json(
      {
        success: true,
        session: {
          id: session.id,
          brand_id: session.brand_id,
          state: session.state,
          created_at: session.created_at,
          last_activity_at: session.last_activity_at,
          parsed_intent: session.parsed_intent,
          answered_questions: session.answered_questions,
          pending_questions: session.pending_questions,
          selected_kb_ids: session.selected_kb_ids,
          active_task_plan_id: session.active_task_plan_id,
        },
        messages: messages.map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          created_at: msg.created_at,
          tokens_used: msg.tokens_used,
          model_used: msg.model_used,
          provider: msg.provider,
          cost_usd: msg.cost_usd,
          action_taken: msg.action_taken,
        })),
        stats: {
          total_messages: totalMessages,
          total_cost: totalCost,
          total_tokens: totalTokens,
          by_role: statsByRole,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[get] Unexpected error:", error);

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
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true",
      },
    }
  );
}

