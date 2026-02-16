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
  private userId: string;
  private apiKey?: string;

  constructor(tier: 'premium' | 'budget' = 'premium', userId?: string, apiKey?: string, modelId?: string) {
    this.agentModel = modelId || this.llmService.selectModel('executive', tier);
    this.userId = userId || 'system'; // Fallback to 'system' for testing
    this.apiKey = apiKey;
  }

  public getModel(): string {
    return this.agentModel;
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
      userId: this.userId,
      agentType: 'executive',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      model: this.agentModel,
      temperature: AGENT_TEMPERATURES.executive,
      maxTokens: AGENT_MAX_TOKENS.executive,
      responseFormat: 'json',
      apiKey: this.apiKey,
    });

    try {
      const parsed = JSON.parse(response.content);
      return {
        content_type: parsed.content_type || parsed.content_types?.[0],
        platform: parsed.platform || parsed.platforms?.[0],
        product: parsed.product,
        target_audience: parsed.target_audience,
        key_message: parsed.key_message || parsed.key_messages?.[0],
        tone: parsed.tone,
        duration: parsed.duration,
        call_to_action: parsed.call_to_action,
        confidence: 0.8,
        raw_message: userMessage,
      };
    } catch (error) {
      console.error('[ExecutiveAgent] Failed to parse intent:', error);
      // Return default intent on parse failure
      return {
        confidence: 0.3,
        raw_message: userMessage,
      };
    }
  }

  /**
   * Identify missing information that needs clarification
   */
  private identifyMissingInfo(intent: ParsedIntent): ClarifyingQuestion[] {
    const questions: ClarifyingQuestion[] = [];

    // Check for missing critical information
    if (!intent.content_type) {
      questions.push({
        id: 'content_type',
        question: 'What type of content would you like to create?',
        field: 'content_type',
        type: 'choice',
        required: true,
        options: ['video', 'image', 'carousel', 'story'],
      });
    }

    if (!intent.platform) {
      questions.push({
        id: 'platform',
        question: 'Which platform will you use?',
        field: 'platform',
        type: 'choice',
        required: true,
        options: ['tiktok', 'instagram_reels', 'youtube_shorts', 'facebook', 'linkedin'],
      });
    }

    if (!intent.target_audience) {
      questions.push({
        id: 'target_audience',
        question: 'Who is your target audience?',
        field: 'target_audience',
        type: 'text',
        required: true,
      });
    }

    return questions;
  }

  /**
   * Process answers to clarifying questions
   */
  async processAnswers(params: {
    session: ConversationSession;
    answers: Record<string, unknown>;
  }): Promise<ExecutiveAction> {
    // Merge answers into intent
    const updatedIntent = {
      ...params.session.parsed_intent,
      ...params.answers,
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

Content Type: ${intent.content_type || 'video'}
Target Audience: ${intent.target_audience || 'general audience'}
Tone: ${intent.tone || 'professional'}
Platform: ${intent.platform || 'social media'}

Be encouraging and specific about what they'll receive.`;

    const response = await this.llmService.generateCompletion({
      userId: this.userId,
      agentType: 'executive',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      model: this.agentModel,
      temperature: 0.7,
      maxTokens: 500,
      apiKey: this.apiKey,
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
export function createExecutiveAgent(
  tier: 'premium' | 'budget' = 'premium', 
  userId?: string,
  apiKey?: string,
  modelId?: string
): ExecutiveAgent {
  return new ExecutiveAgent(tier, userId, apiKey, modelId);
}

