/**
 * Strategist Adapter
 * Wraps the existing StrategistAgent for use with the Phase 8 orchestrator
 * 
 * Purpose:
 * - Translate orchestrator's AgentExecutionParams to strategist's interface
 * - Execute strategist agent tasks
 * - Persist strategic briefs to database for n8n workflows
 * - Return standardized AgentExecutionResult
 */

import { createStrategistAgent, StrategistAgent } from '@/lib/agents/managers/strategist';
import { createAdminClient } from '@/lib/supabase/admin';
import type { 
  AgentExecutionParams, 
  AgentExecutionResult,
} from '@/lib/orchestrator/types';
import type { ParsedIntent } from '@/lib/agents/types';

interface AgentResult {
  type?: string;
  content?: string;
  model?: string;
  tokens_used?: number;
  [key: string]: unknown;
}

export class StrategistAdapter {
  private agent: StrategistAgent;
  
  constructor(tier: 'premium' | 'budget' = 'budget') {
    this.agent = createStrategistAgent(tier);
  }

  /**
   * Execute strategist task via orchestrator
   */
  async execute(params: AgentExecutionParams): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Build intent from request metadata
      const intent = this.buildIntent(params);
      
      // Build task object for strategist
      const task = {
        name: params.task.task_name,
        description: params.task.task_name || `Strategic planning for ${params.request.request_type}`,
        type: 'strategy' as const,
        status: 'pending' as const,
        assignedTo: 'strategist' as const,
        id: params.task.id,
        manager: 'strategist' as const,
        dependencies: [],
        inputs: {},
      };

      // Get brand context if available (now async to fetch assets)
      const brandContext = await this.extractBrandContext(params);

      // Execute strategist agent with userId from request owner
      const result = await this.agent.executeTask({
        task,
        intent,
        brandContext,
        userId: params.request.created_by || undefined, // Pass request owner's user ID
      });

      // Build execution result
      if (result.success) {
        const agentResult = result.result as AgentResult;
        
        // NEW: Persist strategic brief to database for n8n workflows
        let briefId: string | null = null;
        try {
          const supabase = createAdminClient();
          const { data: brief, error: briefError } = await supabase
            .from('creative_briefs')
            .insert({
              brand_id: params.request.brand_id,
              campaign_request: {
                title: params.request.title,
                request_type: params.request.request_type,
                prompt: (params.request as unknown as Record<string, unknown>).prompt,
              },
              creative_brief: {
                content: agentResult?.content || '',
                target_audience: intent.target_audience,
                tone: intent.tone,
                platform: intent.platform,
                generated_at: new Date().toISOString(),
              },
              brand_alignment_score: 0.85, // Default score
              approval_status: 'approved', // Auto-approve for orchestrator flow
              metadata: {
                model: agentResult?.model,
                tokens_used: agentResult?.tokens_used,
                request_id: params.request.id,
                task_id: params.task.id,
              },
            })
            .select('brief_id')
            .single();

          if (briefError) {
            console.error('[StrategistAdapter] Failed to persist brief to database:', briefError.message);
          } else {
            briefId = brief?.brief_id || null;
            console.log('[StrategistAdapter] Persisted strategic brief:', briefId);
          }
        } catch (dbError) {
          console.error('[StrategistAdapter] Database error during persistence:', dbError);
          // Continue execution - persistence failure should not block the pipeline
        }
        
        return {
          success: true,
          output: {
            ...result.result as object,
            brief_id: briefId, // NEW: Include brief_id for downstream tasks
          },
          metadata: {
            agent: 'strategist',
            model: agentResult?.model || 'unknown',
            tokens_used: agentResult?.tokens_used || 0,
            execution_time_ms: Date.now() - startTime,
            timestamp: new Date().toISOString(),
            brief_id: briefId, // Also in metadata for easy access
          },
        };
      } else {
        return {
          success: false,
          error: {
            code: 'STRATEGIST_EXECUTION_FAILED',
            message: result.error || 'Strategist agent execution failed',
          },
          metadata: {
            agent: 'strategist',
            execution_time_ms: Date.now() - startTime,
            timestamp: new Date().toISOString(),
          },
        };
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'STRATEGIST_ADAPTER_ERROR',
          message: error instanceof Error ? error.message : 'Unknown adapter error',
        },
        metadata: {
          agent: 'strategist',
          execution_time_ms: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Build ParsedIntent from request metadata
   */
  private buildIntent(params: AgentExecutionParams): ParsedIntent {
    const metadata = params.request.metadata || {};

    return {
      content_type: params.request.request_type as ParsedIntent['content_type'],
      target_audience: (metadata as Record<string, unknown>).target_audience as string || 'general audience',
      tone: ((metadata as Record<string, unknown>).tone as 'professional' | 'energetic' | 'casual' | 'humorous' | 'inspirational') || 'professional',
      platform: ((metadata as Record<string, unknown>).platform as 'facebook' | 'linkedin' | 'tiktok' | 'instagram_reels' | 'youtube_shorts') || 'tiktok',
      call_to_action: (metadata as Record<string, unknown>).cta as string,
    };
  }

  /**
   * Extract brand context from request (now async to fetch assets)
   */
  private async extractBrandContext(params: AgentExecutionParams): Promise<string | undefined> {
    const metadata = params.request.metadata || {} as Record<string, unknown>;
    const request = params.request as unknown as Record<string, unknown>;

    const brandElements: string[] = [];

    // Brand voice
    if (metadata.brand_voice) {
      brandElements.push(`Brand Voice: ${metadata.brand_voice}`);
    }

    // Brand values
    if (metadata.brand_values) {
      const values = metadata.brand_values;
      brandElements.push(`Brand Values: ${Array.isArray(values) ? values.join(', ') : values}`);
    }

    // Brand guidelines
    if (metadata.brand_guidelines) {
      brandElements.push(`Guidelines: ${metadata.brand_guidelines}`);
    }

    // Company info
    if (metadata.company_name) {
      brandElements.push(`Company: ${metadata.company_name}`);
    }

    // Product/service info
    if (metadata.product_name) {
      brandElements.push(`Product: ${metadata.product_name}`);
    }

    // NEW: Fetch and include brand assets as reference images
    const assetIds = (request.selected_asset_ids as string[]) || [];
    if (assetIds.length > 0) {
      try {
        const supabase = createAdminClient();
        const { data: assets, error } = await supabase
          .from('brand_knowledge_base')
          .select('file_name, file_url, asset_type')
          .in('id', assetIds);

        if (!error && assets?.length) {
          const assetContext = assets.map((a: { asset_type: string; file_name: string; file_url: string }) => 
            `- ${a.asset_type}: ${a.file_name} (URL: ${a.file_url})`
          ).join('\n');
          brandElements.push(`\nReference Brand Assets:\n${assetContext}`);
          console.log(`[StrategistAdapter] Included ${assets.length} brand assets in context`);
        }
      } catch (err) {
        console.error('[StrategistAdapter] Failed to fetch brand assets:', err);
        // Continue without assets - don't block execution
      }
    }

    return brandElements.length > 0 ? brandElements.join('\n') : undefined;
  }

  /**
   * Analyze audience (optional helper method)
   */
  async analyzeAudience(params: {
    demographics: unknown;
    psychographics?: unknown;
  }): Promise<string> {
    return await this.agent.analyzeAudience(params);
  }
}

/**
 * Create strategist adapter instance
 */
export function createStrategistAdapter(tier: 'premium' | 'budget' = 'budget'): StrategistAdapter {
  return new StrategistAdapter(tier);
}

/**
 * Execute strategist task (convenience function)
 */
export async function executeStrategistTask(
  params: AgentExecutionParams,
  tier: 'premium' | 'budget' = 'budget'
): Promise<AgentExecutionResult> {
  const adapter = createStrategistAdapter(tier);
  return await adapter.execute(params);
}
