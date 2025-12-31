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

      // Get brand context if available
      const brandContext = this.extractBrandContext(params);

      // Execute strategist agent
      const result = await this.agent.executeTask({
        task,
        intent,
        brandContext,
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
   * Extract brand context from request
   */
  private extractBrandContext(params: AgentExecutionParams): string | undefined {
    const metadata = params.request.metadata || {} as Record<string, unknown>;

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
