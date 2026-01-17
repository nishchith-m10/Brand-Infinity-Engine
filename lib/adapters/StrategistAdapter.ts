/**
 * Strategist Adapter
 * Wraps the existing StrategistAgent for use with the Phase 8 orchestrator
 * 
 * Purpose:
 * - Translate orchestrator's AgentExecutionParams to strategist's interface
 * - Execute strategist agent tasks
 * - Return standardized AgentExecutionResult
 */

import { createStrategistAgent, StrategistAgent } from '@/lib/agents/managers/strategist';
import type { 
  AgentExecutionParams, 
  AgentExecutionResult,
} from '@/lib/orchestrator/types';
import type { ParsedIntent } from '@/lib/agents/types';
import { searchKnowledgeBases, type BrandContext } from '@/lib/ai/rag';
import { getBrandPromptContext } from '@/lib/ai/brand-prompt-builder';

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

      // Get brand context if available (includes KB content via RAG)
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
        return {
          success: true,
          output: result.result,
          metadata: {
            agent: 'strategist',
            model: agentResult?.model || 'unknown',
            tokens_used: agentResult?.tokens_used || 0,
            execution_time_ms: Date.now() - startTime,
            timestamp: new Date().toISOString(),
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
   * Extract brand context from request, including KB content via RAG and brand identity
   * Phase 1 Critical Fix: KB Content Injection
   * Phase 2: Brand Voice Enforcement
   */
  private async extractBrandContext(params: AgentExecutionParams): Promise<string | undefined> {
    const metadata = params.request.metadata || {} as Record<string, unknown>;
    const brandElements: string[] = [];

    // Phase 2: Fetch brand identity and add system prompt prefix
    try {
      const brandId = params.request.brand_id;
      const campaignId = (params.request as any).campaign_id as string | undefined;
      
      if (brandId) {
        const brandContext = await getBrandPromptContext(brandId, campaignId);
        if (brandContext.systemPromptPrefix) {
          brandElements.push(brandContext.systemPromptPrefix);
          console.log('[StrategistAdapter] Injected brand identity into context');
        }
      }
    } catch (error) {
      console.warn('[StrategistAdapter] Failed to fetch brand identity:', error);
    }

    // Phase 1 Critical: Fetch KB content using RAG if selected_kb_ids exist
    const selectedKbIds = (params.request as any).selected_kb_ids as string[] | undefined;
    if (selectedKbIds && selectedKbIds.length > 0 && params.request.prompt) {
      try {
        console.log(`[StrategistAdapter] Fetching KB content for ${selectedKbIds.length} knowledge bases`);
        const ragContext = await searchKnowledgeBases(
          params.request.prompt,
          selectedKbIds,
          { matchThreshold: 0.6, matchCount: 5 }
        );

        // Add matched KB assets to brand context
        if (ragContext.assets && ragContext.assets.length > 0) {
          brandElements.push('=== KNOWLEDGE BASE CONTEXT ===');
          for (const asset of ragContext.assets) {
            brandElements.push(`[${asset.asset_type}] ${asset.file_name}:`);
            // Truncate long content to avoid token limits
            const content = asset.content.length > 1000 
              ? asset.content.substring(0, 1000) + '...' 
              : asset.content;
            brandElements.push(content);
          }
          console.log(`[StrategistAdapter] Injected ${ragContext.assets.length} KB assets into context`);
        }

        // Add brand voice if found
        if (ragContext.brand_voice) {
          brandElements.push(`Brand Voice: ${ragContext.brand_voice}`);
        }

        // Add brand colors if found
        if (ragContext.primary_colors && ragContext.primary_colors.length > 0) {
          brandElements.push(`Brand Colors: ${ragContext.primary_colors.join(', ')}`);
        }
      } catch (error) {
        console.error('[StrategistAdapter] RAG search failed, falling back to static metadata:', error);
        // Continue with static metadata fallback
      }
    }

    // Static metadata fallback (always include if present)
    if (metadata.brand_voice && !brandElements.some(e => e.includes('Brand Voice:'))) {
      brandElements.push(`Brand Voice: ${metadata.brand_voice}`);
    }

    if (metadata.brand_values) {
      const values = metadata.brand_values;
      brandElements.push(`Brand Values: ${Array.isArray(values) ? values.join(', ') : values}`);
    }

    if (metadata.brand_guidelines) {
      brandElements.push(`Guidelines: ${metadata.brand_guidelines}`);
    }

    if (metadata.company_name) {
      brandElements.push(`Company: ${metadata.company_name}`);
    }

    if (metadata.product_name) {
      brandElements.push(`Product: ${metadata.product_name}`);
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
