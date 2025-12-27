/**
 * Copywriter Agent - Content Creation & Scripts
 * Slice 6: Task Planning & Delegation
 */

import { getLLMService } from '@/lib/llm';
import type { Task, ParsedIntent } from '../types';
import { AGENT_TEMPERATURES, AGENT_MAX_TOKENS } from '../config';

export class CopywriterAgent {
  private llmService = getLLMService();
  private agentModel: string;

  constructor(tier: 'premium' | 'budget' = 'budget') {
    this.agentModel = this.llmService.selectModel('copywriter', tier);
  }

  /**
   * Execute copywriting task
   */
  async executeTask(params: {
    task: Task;
    intent: ParsedIntent;
    strategicBrief?: string;
    brandContext?: string;
  }): Promise<{ result: any; success: boolean; error?: string }> {
    try {
      const systemPrompt = `You are a Creative Copywriter Agent.
Write compelling, on-brand content that resonates with the target audience.

Your content should:
- Match the specified tone and style
- Include key messages naturally
- Be platform-appropriate
- Follow best practices for engagement
- Be ready to use with minimal editing

Be creative, persuasive, and authentic.`;

      const userPrompt = `Create content for:

TASK: ${params.task.name}

CAMPAIGN DETAILS:
- Tone: ${params.intent.tone || 'professional'}
- Platform: ${params.intent.platform || 'social media'}
- Target Audience: ${params.intent.target_audience || 'general audience'}

${params.strategicBrief ? `\nSTRATEGIC BRIEF:\n${params.strategicBrief}` : ''}
${params.brandContext ? `\nBRAND CONTEXT:\n${params.brandContext}` : ''}

Write the content now.`;

      const response = await this.llmService.generateCompletion({
        model: this.agentModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: AGENT_TEMPERATURES.copywriter,
        maxTokens: AGENT_MAX_TOKENS.copywriter,
      });

      return {
        result: {
          type: 'content',
          content: response.content,
          content_type: this.detectContentType(params.task.name),
          model: response.model,
          tokens_used: response.usage.totalTokens,
        },
        success: true,
      };
    } catch (error) {
      console.error('[CopywriterAgent] Task execution failed:', error);
      return {
        result: null,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Detect content type from task description
   */
  private detectContentType(description: string): string {
    const lower = description.toLowerCase();
    if (lower.includes('script')) return 'script';
    if (lower.includes('social')) return 'social_post';
    if (lower.includes('email')) return 'email';
    if (lower.includes('ad')) return 'ad_copy';
    if (lower.includes('blog')) return 'blog_post';
    return 'general';
  }

  /**
   * Write video script
   */
  async writeScript(params: {
    duration: number;
    goal: string;
    tone: string;
    keyMessages: string[];
  }): Promise<string> {
    const prompt = `Write a ${params.duration}-second video script for:

Goal: ${params.goal}
Tone: ${params.tone}
Key Messages: ${params.keyMessages.join(', ')}

Format:
[0:00-0:05] HOOK: ...
[0:05-0:15] PROBLEM: ...
[0:15-0:25] SOLUTION: ...
[0:25-0:30] CTA: ...`;

    const response = await this.llmService.generateCompletion({
      model: this.agentModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: AGENT_TEMPERATURES.copywriter,
      maxTokens: 2000,
    });

    return response.content;
  }

  /**
   * Write social media posts
   */
  async writeSocialPosts(params: {
    platform: string;
    count: number;
    tone: string;
    keyMessages: string[];
  }): Promise<string[]> {
    const prompt = `Write ${params.count} engaging ${params.platform} posts:

Tone: ${params.tone}
Key Messages: ${params.keyMessages.join(', ')}

Requirements:
- Match platform best practices
- Include relevant hashtags
- Strong hooks
- Clear CTAs

Format: One post per line, separated by "---"`;

    const response = await this.llmService.generateCompletion({
      model: this.agentModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: AGENT_TEMPERATURES.copywriter + 0.1,
      maxTokens: 1500,
    });

    return response.content.split('---').map(p => p.trim()).filter(p => p.length > 0);
  }
}

/**
 * Create copywriter agent instance
 */
export function createCopywriterAgent(tier: 'premium' | 'budget' = 'budget'): CopywriterAgent {
  return new CopywriterAgent(tier);
}

