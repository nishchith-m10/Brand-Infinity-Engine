/**
 * Copywriter Adapter
 * Wraps the existing CopywriterAgent for use with the Phase 8 orchestrator
 * 
 * Purpose:
 * - Translate orchestrator's AgentExecutionParams to copywriter's interface
 * - Execute copywriter agent tasks
 * - Return standardized AgentExecutionResult
 */

import { createCopywriterAgent, CopywriterAgent } from '@/lib/agents/managers/copywriter';
import type { 
  AgentExecutionParams, 
  AgentExecutionResult,
  RequestTask,
} from '@/lib/orchestrator/types';
import type { ParsedIntent } from '@/lib/agents/types';

interface AgentResult {
  type?: string;
  content?: string;
  content_type?: string;
  model?: string;
  tokens_used?: number;
  [key: string]: unknown;
}

export class CopywriterAdapter {
  private agent: CopywriterAgent;
  
  constructor(tier: 'premium' | 'budget' = 'budget') {
    this.agent = createCopywriterAgent(tier);
  }

  /**
   * Execute copywriter task via orchestrator
   */
  async execute(params: AgentExecutionParams): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Build intent from request metadata
      const intent = this.buildIntent(params);
      
      // Build task object for copywriter
      const task = {
        name: params.task.task_name,
        description: params.task.task_name || `Content creation for ${params.request.request_type}`,
        type: 'copy' as const,
        status: 'pending' as const,
        assignedTo: 'copywriter' as const,
        id: params.task.id,
        manager: 'copywriter' as const,
        dependencies: [],
        inputs: {},
      };

      // Get strategic brief from dependencies if available
      const strategicBrief = this.extractStrategicBrief(params);

      // Get brand context if available
      const brandContext = this.extractBrandContext(params);

      // Execute copywriter agent
      const result = await this.agent.executeTask({
        task,
        intent,
        strategicBrief,
        brandContext,
      });

      // Build execution result
      if (result.success) {
        const agentResult = result.result as AgentResult;
        return {
          success: true,
          output: result.result,
          metadata: {
            agent: 'copywriter',
            model: agentResult?.model || 'unknown',
            tokens_used: agentResult?.tokens_used || 0,
            execution_time_ms: Date.now() - startTime,
            timestamp: new Date().toISOString(),
            content_type: agentResult?.content_type || 'general',
          },
        };
      } else {
        return {
          success: false,
          error: {
            code: 'COPYWRITER_EXECUTION_FAILED',
            message: result.error || 'Copywriter agent execution failed',
          },
          metadata: {
            agent: 'copywriter',
            execution_time_ms: Date.now() - startTime,
            timestamp: new Date().toISOString(),
          },
        };
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'COPYWRITER_ADAPTER_ERROR',
          message: error instanceof Error ? error.message : 'Unknown adapter error',
        },
        metadata: {
          agent: 'copywriter',
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
   * Extract strategic brief from task dependencies
   */
  private extractStrategicBrief(params: AgentExecutionParams): string | undefined {
    // Look for completed strategist task in dependencies
    if (!params.completedTasks || params.completedTasks.length === 0) {
      return undefined;
    }

    const strategistTask = params.completedTasks.find(
      (t: RequestTask) => t.agent_role === 'strategist' && t.status === 'completed'
    );

    if (!strategistTask?.output_data) {
      return undefined;
    }

    // Extract strategic brief from output_data
    const result = strategistTask.output_data as AgentResult;
    if (result.type === 'strategic_brief' && result.content) {
      return result.content;
    }

    return undefined;
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
   * Write video script (optional helper method)
   */
  async writeScript(params: {
    duration: number;
    goal: string;
    tone: string;
    keyMessages: string[];
  }): Promise<string> {
    return await this.agent.writeScript(params);
  }

  /**
   * Write social media posts (optional helper method)
   */
  async writeSocialPosts(params: {
    platform: string;
    count: number;
    tone: string;
    keyMessages: string[];
  }): Promise<string[]> {
    return await this.agent.writeSocialPosts(params);
  }
}

/**
 * Create copywriter adapter instance
 */
export function createCopywriterAdapter(tier: 'premium' | 'budget' = 'budget'): CopywriterAdapter {
  return new CopywriterAdapter(tier);
}

/**
 * Execute copywriter task (convenience function)
 */
export async function executeCopywriterTask(
  params: AgentExecutionParams,
  tier: 'premium' | 'budget' = 'budget'
): Promise<AgentExecutionResult> {
  const adapter = createCopywriterAdapter(tier);
  return await adapter.execute(params);
}
