/**
 * Decision Logger
 * Phase 5: MVP Hardening - Observability
 * 
 * Purpose:
 * - Log all decisions made during SOP execution
 * - Enable debugging and auditing of AI decision-making
 * - Store reasoning for post-hoc analysis
 */

import type { SOPDecision } from '@/lib/sops/types';
import { createClient } from '@/lib/supabase/server';

/**
 * Log a decision to the database
 */
export async function logDecision(
  requestId: string,
  decision: SOPDecision
): Promise<void> {
  try {
    const supabase = await createClient();
    
    // Store in request metadata or a dedicated decisions table
    // For now, we append to the request's metadata
    const { data: request, error: getError } = await supabase
      .from('content_requests')
      .select('metadata')
      .eq('id', requestId)
      .single();
    
    if (getError) {
      console.error('[DecisionLogger] Failed to fetch request:', getError);
      return;
    }
    
    const existingMetadata = (request?.metadata as Record<string, unknown>) || {};
    const existingDecisions = (existingMetadata.decisions as SOPDecision[]) || [];
    
    const { error: updateError } = await supabase
      .from('content_requests')
      .update({
        metadata: {
          ...existingMetadata,
          decisions: [...existingDecisions, decision],
        },
      })
      .eq('id', requestId);
    
    if (updateError) {
      console.error('[DecisionLogger] Failed to log decision:', updateError);
    } else {
      console.log(`[DecisionLogger] Logged decision: ${decision.decisionType} for step ${decision.stepId}`);
    }
  } catch (error) {
    console.error('[DecisionLogger] Unexpected error:', error);
  }
}

/**
 * Log SOP selection decision
 */
export function createSOPSelectionDecision(
  sopId: string,
  reasoning: string,
  confidence: number,
  alternatives: string[] = []
): SOPDecision {
  return {
    timestamp: new Date().toISOString(),
    stepId: 'sop-selection',
    decisionType: 'sop-selection',
    reasoning,
    selectedOption: sopId,
    alternatives,
    confidence,
  };
}

/**
 * Log model selection decision
 */
export function createModelSelectionDecision(
  stepId: string,
  modelId: string,
  reasoning: string,
  alternatives: string[] = []
): SOPDecision {
  return {
    timestamp: new Date().toISOString(),
    stepId,
    decisionType: 'model-selection',
    reasoning,
    selectedOption: modelId,
    alternatives,
    confidence: 0.9,
  };
}

/**
 * Log error recovery decision
 */
export function createErrorRecoveryDecision(
  stepId: string,
  action: string,
  reasoning: string
): SOPDecision {
  return {
    timestamp: new Date().toISOString(),
    stepId,
    decisionType: 'error-recovery',
    reasoning,
    selectedOption: action,
    alternatives: ['retry', 'skip', 'abort'],
    confidence: 0.7,
  };
}

/**
 * Get all decisions for a request
 */
export async function getDecisions(requestId: string): Promise<SOPDecision[]> {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('content_requests')
      .select('metadata')
      .eq('id', requestId)
      .single();
    
    if (error) {
      console.error('[DecisionLogger] Failed to fetch decisions:', error);
      return [];
    }
    
    const metadata = (data?.metadata as Record<string, unknown>) || {};
    return (metadata.decisions as SOPDecision[]) || [];
  } catch (error) {
    console.error('[DecisionLogger] Unexpected error:', error);
    return [];
  }
}
