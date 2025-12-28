/**
 * PHASE 6 PART 2: Conversation Database Queries
 * Helper functions for conversation sessions and messages
 */

import { createClient } from "@/lib/supabase/server";
import type {
  ConversationSession,
  ConversationMessage,
  ParsedIntent,
  ClarifyingQuestion,
} from "@/lib/agents/types";
import {
  invalidateSessionCache,
  invalidateMessageCache,
  invalidateStatsCache,
} from "@/lib/redis/session-cache";

// ============================================================================
// SESSION QUERIES
// ============================================================================

/**
 * Create a new conversation session
 */
export async function createSession(params: {
  brandId: string;
  userId: string;
  kbIds?: string[];
}): Promise<{ session: ConversationSession | null; error: string | null }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("conversation_sessions")
    .insert({
      brand_id: params.brandId,
      user_id: params.userId,
      state: "initial",
      selected_kb_ids: params.kbIds || [],
      parsed_intent: {},
      answered_questions: {},
      pending_questions: [],
    })
    .select()
    .single();

  if (error) {
    console.error("[createSession] Error:", error);
    return { session: null, error: error.message };
  }

  return { session: data as ConversationSession, error: null };
}

/**
 * Get session by ID
 */
export async function getSession(
  sessionId: string
): Promise<{ session: ConversationSession | null; error: string | null }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("conversation_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (error) {
    console.error("[getSession] Error:", error);
    return { session: null, error: error.message };
  }

  return { session: data as ConversationSession, error: null };
}

/**
 * Update session state and data
 */
export async function updateSession(
  sessionId: string,
  updates: {
    state?: ConversationSession["state"];
    parsed_intent?: Partial<ParsedIntent>;
    answered_questions?: Record<string, unknown>;
    pending_questions?: ClarifyingQuestion[];
    active_task_plan_id?: string | null;
  }
): Promise<{ session: ConversationSession | null; error: string | null }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("conversation_sessions")
    .update(updates)
    .eq("id", sessionId)
    .select()
    .single();

  if (error) {
    console.error("[updateSession] Error:", error);
    return { session: null, error: error.message };
  }

  // Invalidate Redis cache after update
  await invalidateSessionCache(sessionId);

  return { session: data as ConversationSession, error: null };
}

/**
 * Get user's active sessions
 */
export async function getActiveSessions(
  userId: string
): Promise<{ sessions: ConversationSession[]; error: string | null }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("conversation_sessions")
    .select("*")
    .eq("user_id", userId)
    .not("state", "in", '("delivered","cancelled")')
    .order("last_activity_at", { ascending: false });

  if (error) {
    console.error("[getActiveSessions] Error:", error);
    return { sessions: [], error: error.message };
  }

  return { sessions: data as ConversationSession[], error: null };
}

/**
 * Complete a session (mark as delivered)
 */
export async function completeSession(
  sessionId: string
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient();

  const { error } = await supabase.rpc("complete_conversation_session", {
    session_id: sessionId,
  });

  if (error) {
    console.error("[completeSession] Error:", error);
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

/**
 * Cancel a session
 */
export async function cancelSession(
  sessionId: string
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient();

  const { error } = await supabase.rpc("cancel_conversation_session", {
    session_id: sessionId,
  });

  if (error) {
    console.error("[cancelSession] Error:", error);
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

// ============================================================================
// MESSAGE QUERIES
// ============================================================================

/**
 * Create a new message in a session
 */
export async function createMessage(params: {
  sessionId: string;
  brandId: string;
  userId: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata?: {
    tokensUsed?: number;
    modelUsed?: string;
    provider?: string;
    costUsd?: number;
    latencyMs?: number;
    actionTaken?: string;
    questionsAsked?: ClarifyingQuestion[];
    delegationPlan?: unknown;
  };
}): Promise<{ message: ConversationMessage | null; error: string | null }> {
  const supabase = await createClient();

  const insertData: Record<string, unknown> = {
    session_id: params.sessionId,
    brand_id: params.brandId,
    user_id: params.userId,
    role: params.role,
    content: params.content,
  };

  // Add optional metadata if provided
  if (params.metadata) {
    if (params.metadata.tokensUsed !== undefined)
      insertData.tokens_used = params.metadata.tokensUsed;
    if (params.metadata.modelUsed)
      insertData.model_used = params.metadata.modelUsed;
    if (params.metadata.provider) insertData.provider = params.metadata.provider;
    if (params.metadata.costUsd !== undefined)
      insertData.cost_usd = params.metadata.costUsd;
    if (params.metadata.latencyMs !== undefined)
      insertData.latency_ms = params.metadata.latencyMs;
    if (params.metadata.actionTaken)
      insertData.action_taken = params.metadata.actionTaken;
    if (params.metadata.questionsAsked)
      insertData.questions_asked = params.metadata.questionsAsked;
    if (params.metadata.delegationPlan)
      insertData.delegation_plan = params.metadata.delegationPlan;
  }

  const { data, error } = await supabase
    .from("conversation_messages")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error("[createMessage] Error:", error);
    return { message: null, error: error.message };
  }

  // Invalidate caches after new message
  await invalidateMessageCache(params.sessionId);
  await invalidateStatsCache(params.sessionId);

  return { message: data as ConversationMessage, error: null };
}

/**
 * Get messages for a session
 */
export async function getSessionMessages(
  sessionId: string,
  limit: number = 50
): Promise<{ messages: ConversationMessage[]; error: string | null }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("conversation_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[getSessionMessages] Error:", error);
    return { messages: [], error: error.message };
  }

  return { messages: data as ConversationMessage[], error: null };
}

/**
 * Get conversation history using database function
 */
export async function getConversationHistory(
  sessionId: string,
  limit: number = 50
): Promise<{
  messages: Array<{
    id: string;
    role: string;
    content: string;
    created_at: string;
    tokens_used?: number;
    model_used?: string;
  }>;
  error: string | null;
}> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_conversation_history", {
    p_session_id: sessionId,
    p_limit: limit,
  });

  if (error) {
    console.error("[getConversationHistory] Error:", error);
    return { messages: [], error: error.message };
  }

  return { messages: data || [], error: null };
}

/**
 * Calculate total cost for a session
 */
export async function getSessionCost(
  sessionId: string
): Promise<{ cost: number; error: string | null }> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_session_cost", {
    p_session_id: sessionId,
  });

  if (error) {
    console.error("[getSessionCost] Error:", error);
    return { cost: 0, error: error.message };
  }

  return { cost: data || 0, error: null };
}

/**
 * Get message statistics for a session
 */
export async function getSessionStats(
  sessionId: string
): Promise<{
  stats: Array<{
    role: string;
    message_count: number;
    total_tokens: number;
    total_cost: number;
  }>;
  error: string | null;
}> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_session_message_stats", {
    p_session_id: sessionId,
  });

  if (error) {
    console.error("[getSessionStats] Error:", error);
    return { stats: [], error: error.message };
  }

  return { stats: data || [], error: null };
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Check if user owns a session (for authorization)
 */
export async function userOwnsSession(
  sessionId: string,
  userId: string
): Promise<boolean> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("conversation_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .single();

  if (error || !data) return false;
  return true;
}

/**
 * Verify session exists and is active
 */
export async function isSessionActive(sessionId: string): Promise<boolean> {
  const { session } = await getSession(sessionId);
  if (!session) return false;
  return !["delivered", "cancelled"].includes(session.state);
}

