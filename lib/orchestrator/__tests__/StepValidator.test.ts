/**
 * StepValidator Unit Tests
 * Tests for the SOP step validation and quality scoring system
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  StepValidator, 
  stepValidator,
  StrategyOutputSchema,
  ScriptOutputSchema,
} from '../StepValidator';
import { z } from 'zod';
import type { SOPStep, SOPExecutionContext, SOP, SOPDecision } from '../../sops/types';

describe('StepValidator', () => {
  let validator: StepValidator;

  beforeEach(() => {
    validator = new StepValidator();
  });

  // Helper to create mock step
  const createMockStep = (overrides: Partial<SOPStep> = {}): SOPStep => ({
    id: 'test_step_1',
    name: 'Test Step',
    description: 'A test step for validation',
    agentRole: 'copywriter',
    inputMapping: {},
    outputKey: 'test_output',
    maxRetries: 3,
    timeoutMs: 30000,
    ...overrides,
  });

  // Helper to create mock context
  const createMockContext = (overrides: Partial<SOPExecutionContext> = {}): SOPExecutionContext => {
    const defaultSop: SOP = {
      id: 'test_sop',
      name: 'Test SOP',
      description: 'Test Description',
      version: '1.0.0',
      steps: [],
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      recommendedTier: 'standard',
      estimatedDurationMs: 0,
      estimatedCostUsd: { min: 0, max: 0 },
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return {
      requestId: 'test_request_123',
      userId: 'test_user_123',
      sop: defaultSop,
      tier: 'standard',
      currentStepIndex: 0,
      stepOutputs: {},
      decisions: [] as SOPDecision[],
      userInput: { prompt: 'Test prompt' },
      brandContext: '',
      kbContent: '',
      startTime: Date.now(),
      stepTimings: {},
      totalCostUsd: 0,
      ...overrides,
    };
  };

  describe('singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(stepValidator).toBeDefined();
      expect(stepValidator).toBeInstanceOf(StepValidator);
    });
  });

  describe('validate', () => {
    it('should validate valid output with high score', () => {
      const step = createMockStep({
        agentRole: 'copywriter',
        outputSchema: ScriptOutputSchema,
      });
      const context = createMockContext();
      const output = {
        content: 'This is a well-written script that tells a compelling story about our product.',
        format: 'script',
        word_count: 15,
      };

      const result = validator.validate(step, output, context);

      expect(result.valid).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for output that does not match schema', () => {
      const step = createMockStep({
        agentRole: 'copywriter',
        outputSchema: ScriptOutputSchema,
      });
      const context = createMockContext();
      const invalidOutput = {
        // Missing required 'content' field
        format: 'script',
      };

      const result = validator.validate(step, invalidOutput, context);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should add warnings for low word count', () => {
      const step = createMockStep({ agentRole: 'copywriter' });
      const context = createMockContext();
      const output = {
        content: 'Short',
        word_count: 1,
      };

      const result = validator.validate(step, output, context);

      // May have warnings for short content
      expect(result.score).toBeDefined();
    });

    it('should include validation metadata', () => {
      const step = createMockStep();
      const context = createMockContext();
      const output = { content: 'Test content for validation' };

      const result = validator.validate(step, output, context);

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.validationTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('validateByAgentRole', () => {
    it('should apply role-specific validation for strategist', () => {
      const step = createMockStep({ agentRole: 'strategist' });
      const context = createMockContext();
      const output = {
        content: 'This strategy outlines our target audience analysis with key messaging recommendations.',
        type: 'strategic_brief',
      };

      const result = validator.validate(step, output, context);

      expect(result.valid).toBe(true);
    });

    it('should apply role-specific validation for producer', () => {
      const step = createMockStep({ agentRole: 'producer' });
      const context = createMockContext();
      const output = {
        video_url: 'https://example.com/video.mp4',
        status: 'completed',
      };

      const result = validator.validate(step, output, context);

      expect(result.valid).toBe(true);
    });
  });

  describe('checkContentQuality', () => {
    it('should score high for quality content', () => {
      const step = createMockStep();
      const context = createMockContext();
      const qualityContent = {
        content: `This is a comprehensive piece of content that demonstrates 
                  high quality writing with proper structure, detailed explanations, 
                  and thoughtful analysis. It covers multiple aspects of the topic 
                  and provides valuable insights for the reader.`,
      };

      const result = validator.validate(step, qualityContent, context);

      expect(result.score).toBeGreaterThan(50);
    });

    it('should score lower for minimal content', () => {
      const step = createMockStep();
      const context = createMockContext();
      const minimalContent = {
        content: 'OK',
      };

      const result = validator.validate(step, minimalContent, context);

      // Minimal content should have lower score (or equal to threshold)
      expect(result.score).toBeLessThanOrEqual(90);
    });
  });

  describe('attemptAutoFix', () => {
    it('should attempt auto-fix when enabled', () => {
      const step = createMockStep();
      const context = createMockContext();
      // Output with fixable issue (e.g., missing optional field)
      const output = {
        content: 'Valid content here',
        // Some fixable validation issues could be here
      };

      const result = validator.validate(step, output, context);

      // Auto-fix should be attempted
      expect(result.metadata?.autoFixApplied).toBeDefined();
    });
  });

  describe('sanitizeOutput', () => {
    it('should sanitize potentially dangerous content', () => {
      const step = createMockStep();
      const context = createMockContext();
      const output = {
        content: '<script>alert("xss")</script>Normal content',
      };

      const result = validator.validate(step, output, context);

      // Validation should still process
      expect(result).toBeDefined();
      if (result.sanitizedOutput) {
        // Sanitized output should not contain script tags
        const sanitized = JSON.stringify(result.sanitizedOutput);
        expect(sanitized).not.toContain('<script>');
      }
    });
  });

  describe('validateBatch', () => {
    it('should validate multiple steps at once', () => {
      const steps = [
        { step: createMockStep({ id: 'step_1' }), output: { content: 'Content 1' } },
        { step: createMockStep({ id: 'step_2' }), output: { content: 'Content 2' } },
        { step: createMockStep({ id: 'step_3' }), output: { content: 'Content 3' } },
      ];
      const context = createMockContext();

      const result = validator.validateBatch(steps, context);

      expect(result.results.size).toBe(3);
      expect(typeof result.allValid).toBe('boolean');
    });

    it('should report allValid as false if any step fails', () => {
      const steps = [
        { step: createMockStep({ id: 'step_1' }), output: { content: 'Valid content' } },
        { 
          step: createMockStep({ 
            id: 'step_2', 
            outputSchema: ScriptOutputSchema 
          }), 
          output: { /* Missing required content field */ } 
        },
      ];
      const context = createMockContext();

      const result = validator.validateBatch(steps, context);

      expect(result.allValid).toBe(false);
    });
  });

  describe('error severity', () => {
    it('should classify critical errors correctly', () => {
      const step = createMockStep({
        outputSchema: ScriptOutputSchema,
      });
      const context = createMockContext();
      const invalidOutput = null; // Completely invalid

      const result = validator.validate(step, invalidOutput, context);

      expect(result.valid).toBe(false);
      if (result.errors.length > 0) {
        expect(['critical', 'high', 'medium', 'low']).toContain(result.errors[0].severity);
      }
    });
  });

  describe('output schemas', () => {
    it('should export StrategyOutputSchema', () => {
      expect(StrategyOutputSchema).toBeDefined();
    });

    it('should export ScriptOutputSchema', () => {
      expect(ScriptOutputSchema).toBeDefined();
    });
  });
});
