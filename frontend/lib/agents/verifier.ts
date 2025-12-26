/**
 * Verifier Agent - Quality Control & Validation
 * Slice 7: Quality Verification Pipeline
 */

import { getLLMService } from '@/lib/llm';
import type { SubTask, ParsedIntent } from './types';
import { AGENT_TEMPERATURES, AGENT_MAX_TOKENS } from './config';

export interface QualityCheckResult {
  passed: boolean;
  score: number; // 0-100
  issues: QualityIssue[];
  suggestions: string[];
  approved_content?: string;
}

export interface QualityIssue {
  severity: 'critical' | 'major' | 'minor';
  category: 'accuracy' | 'tone' | 'brand_alignment' | 'grammar' | 'structure' | 'platform_requirements';
  description: string;
  location?: string;
  suggested_fix?: string;
}

export interface QualityChecklist {
  brand_alignment: boolean;
  tone_consistency: boolean;
  message_clarity: boolean;
  grammar_spelling: boolean;
  platform_specs: boolean;
  call_to_action: boolean;
  target_audience: boolean;
}

export class VerifierAgent {
  private llmService = getLLMService();
  private agentModel: string;

  constructor(tier: 'premium' | 'budget' = 'budget') {
    this.agentModel = this.llmService.selectModel('verifier', tier);
  }

  /**
   * Verify content quality
   */
  async verifyContent(params: {
    content: string;
    contentType: string;
    intent: ParsedIntent;
    brandGuidelines?: string;
  }): Promise<QualityCheckResult> {
    const systemPrompt = `You are a Quality Verifier Agent.
Your job is to check content quality against requirements and brand standards.

Evaluate content on:
1. Brand Alignment (tone, voice, values)
2. Message Clarity (clear, compelling)
3. Grammar & Spelling (error-free)
4. Target Audience Fit (appropriate, resonates)
5. Platform Requirements (format, length)
6. Call-to-Action (present, clear, compelling)

Return ONLY valid JSON with this structure:
{
  "passed": boolean,
  "score": number (0-100),
  "issues": [{ "severity": "critical|major|minor", "category": "...", "description": "...", "suggested_fix": "..." }],
  "suggestions": ["..."],
  "checklist": { "brand_alignment": bool, "tone_consistency": bool, ... }
}`;

    const userPrompt = `Verify this content:

CONTENT:
${params.content}

CONTENT TYPE: ${params.contentType}

REQUIREMENTS:
- Goal: ${params.intent.campaign_goal}
- Tone: ${params.intent.tone}
- Target Audience: ${JSON.stringify(params.intent.target_audience)}
- Key Messages: ${params.intent.key_messages.join(', ')}
- Platform: ${params.intent.platform.join(', ')}

${params.brandGuidelines ? `\nBRAND GUIDELINES:\n${params.brandGuidelines}` : ''}

Perform quality check now.`;

    try {
      const response = await this.llmService.generateCompletion({
        model: this.agentModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: AGENT_TEMPERATURES.verifier,
        maxTokens: AGENT_MAX_TOKENS.verifier,
        responseFormat: 'json',
      });

      const result = JSON.parse(response.content);

      return {
        passed: result.passed || result.score >= 70,
        score: result.score || 0,
        issues: result.issues || [],
        suggestions: result.suggestions || [],
      };
    } catch (error) {
      console.error('[Verifier] Verification failed:', error);
      
      // Return default failed result
      return {
        passed: false,
        score: 0,
        issues: [{
          severity: 'critical',
          category: 'accuracy',
          description: 'Verification process failed',
        }],
        suggestions: ['Please review content manually'],
      };
    }
  }

  /**
   * Auto-fix minor issues in content
   */
  async autoFix(params: {
    content: string;
    issues: QualityIssue[];
    intent: ParsedIntent;
  }): Promise<string> {
    // Only auto-fix minor issues
    const minorIssues = params.issues.filter(i => i.severity === 'minor');
    
    if (minorIssues.length === 0) {
      return params.content;
    }

    const systemPrompt = `You are a Content Editor Agent.
Fix minor issues in the content while preserving its core message and style.`;

    const userPrompt = `Fix these minor issues in the content:

ORIGINAL CONTENT:
${params.content}

ISSUES TO FIX:
${minorIssues.map(i => `- ${i.description}${i.suggested_fix ? ` (Suggestion: ${i.suggested_fix})` : ''}`).join('\n')}

Return the corrected content, preserving the original tone: ${params.intent.tone}`;

    const response = await this.llmService.generateCompletion({
      model: this.agentModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      maxTokens: 2000,
    });

    return response.content;
  }

  /**
   * Check specific quality criterion
   */
  async checkCriterion(params: {
    content: string;
    criterion: keyof QualityChecklist;
    requirements: any;
  }): Promise<{ passed: boolean; details: string }> {
    const criterionPrompts: Record<keyof QualityChecklist, string> = {
      brand_alignment: 'Does this content align with the brand voice, values, and positioning?',
      tone_consistency: 'Is the tone consistent throughout the content?',
      message_clarity: 'Are the key messages clear and easy to understand?',
      grammar_spelling: 'Is the content free of grammar and spelling errors?',
      platform_specs: 'Does this meet the platform-specific requirements (length, format, etc.)?',
      call_to_action: 'Is there a clear, compelling call-to-action?',
      target_audience: 'Is this appropriate and engaging for the target audience?',
    };

    const prompt = `${criterionPrompts[params.criterion]}

Content: ${params.content}
Requirements: ${JSON.stringify(params.requirements)}

Answer with: YES or NO, followed by a brief explanation.`;

    const response = await this.llmService.generateCompletion({
      model: this.agentModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      maxTokens: 200,
    });

    const passed = response.content.toLowerCase().startsWith('yes');
    
    return {
      passed,
      details: response.content,
    };
  }

  /**
   * Batch verify multiple content pieces
   */
  async batchVerify(params: {
    contentPieces: Array<{ id: string; content: string; type: string }>;
    intent: ParsedIntent;
    brandGuidelines?: string;
  }): Promise<Record<string, QualityCheckResult>> {
    const results: Record<string, QualityCheckResult> = {};

    // Verify in parallel
    const verifications = params.contentPieces.map(piece =>
      this.verifyContent({
        content: piece.content,
        contentType: piece.type,
        intent: params.intent,
        brandGuidelines: params.brandGuidelines,
      }).then(result => ({ id: piece.id, result }))
    );

    const completed = await Promise.all(verifications);
    
    for (const { id, result } of completed) {
      results[id] = result;
    }

    return results;
  }

  /**
   * Generate quality report summary
   */
  generateReport(results: Record<string, QualityCheckResult>): {
    overall_passed: boolean;
    average_score: number;
    total_issues: number;
    by_severity: Record<string, number>;
    recommendations: string[];
  } {
    const resultArray = Object.values(results);
    const allIssues = resultArray.flatMap(r => r.issues);

    return {
      overall_passed: resultArray.every(r => r.passed),
      average_score: resultArray.reduce((sum, r) => sum + r.score, 0) / resultArray.length,
      total_issues: allIssues.length,
      by_severity: {
        critical: allIssues.filter(i => i.severity === 'critical').length,
        major: allIssues.filter(i => i.severity === 'major').length,
        minor: allIssues.filter(i => i.severity === 'minor').length,
      },
      recommendations: [...new Set(resultArray.flatMap(r => r.suggestions))],
    };
  }
}

/**
 * Create verifier agent instance
 */
export function createVerifierAgent(tier: 'premium' | 'budget' = 'budget'): VerifierAgent {
  return new VerifierAgent(tier);
}

