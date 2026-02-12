/**
 * Strategist Agent - Campaign Strategy & Briefs
 * Slice 6: Task Planning & Delegation
 */

import { getLLMService } from '@/lib/llm';
import type { Task, ParsedIntent } from '../types';
import { AGENT_TEMPERATURES, AGENT_MAX_TOKENS } from '../config';

export class StrategistAgent {
  private llmService = getLLMService();
  private agentModel: string;

  constructor(tier: 'premium' | 'budget' = 'budget') {
    this.agentModel = this.llmService.selectModel('strategist', tier);
  }

  /**
   * Execute strategy task
   */
  async executeTask(params: {
    task: Task;
    intent: ParsedIntent;
    brandContext?: string;
  }): Promise<{ result: unknown; success: boolean; error?: string }> {
    try {
      const systemPrompt = `You are a Brand Strategist Agent.
Create comprehensive strategic briefs for content campaigns.

Your output should include:
1. Campaign Overview
2. Target Audience Analysis
3. Key Messages & Positioning
4. Content Strategy
5. Success Metrics
6. Timeline & Milestones

Be specific, actionable, and aligned with brand goals.`;

      const userPrompt = `Create strategic brief for:

TASK: ${params.task.name}

CAMPAIGN DETAILS:
- Goal: general
- Content Types: ${params.intent.content_type || 'video'}
- Target Audience: ${params.intent.target_audience || 'general audience'}
- Tone: ${params.intent.tone || 'professional'}
- Platforms: ${params.intent.platform || 'social media'}

${params.brandContext ? `\nBRAND CONTEXT:\n${params.brandContext}` : ''}

Provide a detailed strategic brief.`;

      const response = await this.llmService.generateCompletion({
        model: this.agentModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: AGENT_TEMPERATURES.strategist,
        maxTokens: AGENT_MAX_TOKENS.strategist,
      });

      return {
        result: {
          type: 'strategic_brief',
          content: response.content,
          model: response.model,
          tokens_used: response.usage.totalTokens,
        },
        success: true,
      };
    } catch (error) {
      console.error('[StrategistAgent] Task execution failed:', error);
      return {
        result: null,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Analyze target audience
   */
  async analyzeAudience(params: {
    demographics: unknown;
    psychographics?: unknown;
  }): Promise<string> {
    const prompt = `Analyze this target audience and provide insights:

Demographics: ${JSON.stringify(params.demographics)}
${params.psychographics ? `Psychographics: ${JSON.stringify(params.psychographics)}` : ''}

Provide:
1. Audience profile summary
2. Content preferences
3. Communication channels
4. Engagement strategies`;

    const response = await this.llmService.generateCompletion({
      model: this.agentModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      maxTokens: 1000,
    });

    return response.content;
  }
}

/**
 * Create strategist agent instance
 */
export function createStrategistAgent(tier: 'premium' | 'budget' = 'budget'): StrategistAgent {
  return new StrategistAgent(tier);
}

