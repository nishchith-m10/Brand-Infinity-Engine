/**
 * Producer Agent - Production Coordination & Asset Management
 * Slice 6: Task Planning & Delegation
 */

import { getLLMService } from '@/lib/llm';
import { getN8NClient } from '@/lib/n8n/client';
import type { SubTask, ParsedIntent } from '../types';
import { AGENT_TEMPERATURES, AGENT_MAX_TOKENS } from '../config';

export class ProducerAgent {
  private llmService = getLLMService();
  private agentModel: string;

  constructor(tier: 'premium' | 'budget' = 'budget') {
    this.agentModel = this.llmService.selectModel('producer', tier);
  }

  /**
   * Execute production task
   */
  async executeTask(params: {
    task: SubTask;
    intent: ParsedIntent;
    previousResults?: any[];
    brandContext?: string;
  }): Promise<{ result: any; success: boolean; error?: string }> {
    try {
      const systemPrompt = `You are a Production Coordinator Agent.
Organize and coordinate content production workflows.

Your responsibilities:
- Create production briefs
- Identify required assets
- Define technical specifications
- Plan timelines
- Coordinate with external tools/systems

Output should be structured, actionable JSON.`;

      const userPrompt = `Coordinate production for:

TASK: ${params.task.description}

CAMPAIGN DETAILS:
- Content Types: ${params.intent.content_types.join(', ')}
- Platforms: ${params.intent.platform.join(', ')}
- Goal: ${params.intent.campaign_goal}

${params.previousResults ? `\nPREVIOUS WORK:\n${JSON.stringify(params.previousResults, null, 2)}` : ''}

Create a production coordination plan with:
1. Required assets list
2. Technical specifications
3. Production timeline
4. Delivery checklist

Return as JSON.`;

      const response = await this.llmService.generateCompletion({
        model: this.agentModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: AGENT_TEMPERATURES.producer,
        maxTokens: AGENT_MAX_TOKENS.producer,
        responseFormat: 'json',
      });

      let productionPlan;
      try {
        productionPlan = JSON.parse(response.content);
      } catch {
        productionPlan = { raw_plan: response.content };
      }

      return {
        result: {
          type: 'production_plan',
          plan: productionPlan,
          model: response.model,
          tokens_used: response.tokensUsed,
          cost_usd: response.costUsd,
        },
        success: true,
      };
    } catch (error) {
      console.error('[ProducerAgent] Task execution failed:', error);
      return {
        result: null,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate n8n workflow payload
   */
  async generateWorkflowPayload(params: {
    workflowType: string;
    content: string;
    specifications: any;
  }): Promise<any> {
    return {
      workflow_type: params.workflowType,
      content: params.content,
      specifications: params.specifications,
      timestamp: new Date().toISOString(),
      priority: 'normal',
    };
  }

  /**
   * Create asset requirements list
   */
  async createAssetRequirements(params: {
    contentType: string;
    platforms: string[];
    specifications?: any;
  }): Promise<any> {
    const prompt = `List required assets for:

Content Type: ${params.contentType}
Platforms: ${params.platforms.join(', ')}
${params.specifications ? `Specifications: ${JSON.stringify(params.specifications)}` : ''}

For each asset, provide:
- Type (image, video, audio, etc.)
- Dimensions/format
- Quantity needed
- Platform-specific requirements

Return as JSON array.`;

    const response = await this.llmService.generateCompletion({
      model: this.agentModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      maxTokens: 1000,
      responseFormat: 'json',
    });

    try {
      return JSON.parse(response.content);
    } catch {
      return [];
    }
  }

  /**
   * Create production timeline
   */
  async createTimeline(params: {
    tasks: string[];
    deadline?: string;
  }): Promise<any> {
    const prompt = `Create production timeline for:

Tasks: ${params.tasks.join(', ')}
${params.deadline ? `Deadline: ${params.deadline}` : ''}

Return as JSON with milestones and dates.`;

    const response = await this.llmService.generateCompletion({
      model: this.agentModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      maxTokens: 800,
      responseFormat: 'json',
    });

    try {
      return JSON.parse(response.content);
    } catch {
      return { timeline: [] };
    }
  }

  /**
   * Trigger n8n workflow for content production
   */
  async triggerN8NWorkflow(params: {
    workflowType: 'content_generation' | 'video_production';
    data: Record<string, any>;
    sessionId: string;
  }): Promise<{ execution_id: string }> {
    const n8n = getN8NClient();

    if (!n8n.isConfigured()) {
      throw new Error('n8n is not configured');
    }

    if (params.workflowType === 'content_generation') {
      return await n8n.triggerContentGeneration({
        ...params.data,
        session_id: params.sessionId,
      });
    } else {
      return await n8n.triggerVideoProduction({
        ...params.data,
        session_id: params.sessionId,
      });
    }
  }
}

/**
 * Create producer agent instance
 */
export function createProducerAgent(tier: 'premium' | 'budget' = 'budget'): ProducerAgent {
  return new ProducerAgent(tier);
}

