/**
 * Executive Agent - Orchestrator & Intent Parser
 * Slice 5: Core Agent Intelligence
 */

import { getLLMService } from '@/lib/llm';
import type {
  ConversationSession,
  ParsedIntent,
  ClarifyingQuestion,
  ExecutiveAction,
  TaskPlan,
} from './types';
import { AGENT_TEMPERATURES, AGENT_MAX_TOKENS } from './config';
import { createTaskPlanner } from './task-planner';

export class ExecutiveAgent {
  private llmService = getLLMService();
  private agentModel: string;

  constructor(tier: 'premium' | 'budget' = 'premium') {
    this.agentModel = this.llmService.selectModel('executive', tier);
  }

  /**
   * Main entry point: Process user message and decide action
   */
  async processMessage(params: {
    session: ConversationSession;
    userMessage: string;
    brandKnowledge?: string;
  }): Promise<ExecutiveAction> {
    // Parse intent from user message
    const intent = await this.parseIntent(params.userMessage, params.brandKnowledge);

    // Check if we need more information
    const questions = this.identifyMissingInfo(intent);
    
    if (questions.length > 0) {
      return {
        type: 'ask_questions',
        questions,
        parsedIntent: intent,
      };
    }

    // If we have everything, create task plan
    return {
      type: 'create_plan',
      parsedIntent: intent,
    };
  }

  /**
   * Parse user intent from message
   */
  private async parseIntent(
    userMessage: string,
    brandKnowledge?: string
  ): Promise<ParsedIntent> {
    const systemPrompt = `You are the Executive Agent for a brand content generation system.
Your job is to understand what the user wants to create and extract structured intent.

Parse the user's request into these categories:
1. content_types: ["script", "visual", "video", "social_post", "campaign"]
2. campaign_goal: string (awareness, conversion, engagement, etc.)
3. target_audience: { demographics, psychographics, personas }
4. key_messages: string[] (main points to communicate)
5. tone: string (professional, casual, humorous, etc.)
6. platform: string[] (instagram, youtube, tiktok, etc.)
7. constraints: { budget?, duration?, deadline? }

${brandKnowledge ? `\nBrand Context:\n${brandKnowledge}` : ''}

Return ONLY valid JSON matching this structure.`;

    const response = await this.llmService.generateCompletion({
      model: this.agentModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: AGENT_TEMPERATURES.executive,
      maxTokens: AGENT_MAX_TOKENS.executive,
      responseFormat: 'json',
    });

    try {
      const parsed = JSON.parse(response.content);
      return {
        content_types: parsed.content_types || [],
        campaign_goal: parsed.campaign_goal || 'general',
        target_audience: parsed.target_audience || {},
        key_messages: parsed.key_messages || [],
        tone: parsed.tone || 'professional',
        platform: parsed.platform || [],
        constraints: parsed.constraints || {},
        confidence: 0.8,
        raw_request: userMessage,
      };
    } catch (error) {
      console.error('[ExecutiveAgent] Failed to parse intent:', error);
      // Return default intent on parse failure
      return {
        content_types: ['campaign'],
        campaign_goal: 'general',
        target_audience: {},
        key_messages: [],
        tone: 'professional',
        platform: [],
        constraints: {},
        confidence: 0.3,
        raw_request: userMessage,
      };
    }
  }

  /**
   * Identify missing information that needs clarification
   */
  private identifyMissingInfo(intent: ParsedIntent): ClarifyingQuestion[] {
    const questions: ClarifyingQuestion[] = [];

    // Check for missing critical information
    if (!intent.content_types || intent.content_types.length === 0) {
      questions.push({
        id: 'content_types',
        question: 'What type of content would you like to create?',
        field: 'content_types',
        required: true,
        options: ['script', 'visual', 'video', 'social_post', 'full_campaign'],
        multiple: true,
      });
    }

    if (!intent.campaign_goal || intent.campaign_goal === 'general') {
      questions.push({
        id: 'campaign_goal',
        question: 'What is the primary goal of this campaign?',
        field: 'campaign_goal',
        required: true,
        options: ['awareness', 'conversion', 'engagement', 'retention', 'education'],
        multiple: false,
      });
    }

    if (!intent.target_audience || Object.keys(intent.target_audience).length === 0) {
      questions.push({
        id: 'target_audience',
        question: 'Who is your target audience?',
        field: 'target_audience',
        required: true,
        options: undefined,
        multiple: false,
      });
    }

    if (!intent.platform || intent.platform.length === 0) {
      questions.push({
        id: 'platform',
        question: 'Which platforms will you use?',
        field: 'platform',
        required: false,
        options: ['instagram', 'facebook', 'youtube', 'tiktok', 'twitter', 'linkedin'],
        multiple: true,
      });
    }

    return questions;
  }

  /**
   * Process answers to clarifying questions
   */
  async processAnswers(params: {
    session: ConversationSession;
    answers: Record<string, any>;
  }): Promise<ExecutiveAction> {
    // Merge answers into intent
    const updatedIntent = {
      ...params.session.parsed_intent,
      ...answers,
    } as ParsedIntent;

    // Check if we still need more info
    const remainingQuestions = this.identifyMissingInfo(updatedIntent);

    if (remainingQuestions.length > 0) {
      return {
        type: 'ask_questions',
        questions: remainingQuestions,
        parsedIntent: updatedIntent,
      };
    }

    // Ready to create plan
    return {
      type: 'create_plan',
      parsedIntent: updatedIntent,
    };
  }

  /**
   * Generate explanation of what will be created
   */
  async explainPlan(intent: ParsedIntent): Promise<string> {
    const systemPrompt = `You are the Executive Agent explaining a content creation plan to the user.
Be clear, concise, and friendly. Summarize what will be created based on the parsed intent.`;

    const userPrompt = `Explain this content plan to the user in 2-3 sentences:

Content Types: ${intent.content_types.join(', ')}
Goal: ${intent.campaign_goal}
Target Audience: ${JSON.stringify(intent.target_audience)}
Tone: ${intent.tone}
Platforms: ${intent.platform.join(', ')}

Be encouraging and specific about what they'll receive.`;

    const response = await this.llmService.generateCompletion({
      model: this.agentModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      maxTokens: 500,
    });

    return response.content;
  }

  /**
   * Create task plan from confirmed intent
   */
  async createTaskPlan(intent: ParsedIntent): Promise<TaskPlan> {
    const planner = createTaskPlanner('premium');
    return await planner.createTaskPlan(intent);
  }
}

/**
 * Create Executive Agent instance
 */
export function createExecutiveAgent(tier: 'premium' | 'budget' = 'premium'): ExecutiveAgent {
  return new ExecutiveAgent(tier);
}

