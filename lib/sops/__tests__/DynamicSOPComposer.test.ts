/**
 * DynamicSOPComposer Unit Tests
 * Tests for dynamic SOP composition based on content requirements
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DynamicSOPComposer, dynamicSOPComposer, ComposerOptions } from '../DynamicSOPComposer';
import type { SOP, SOPStep, PerformanceTier } from '../types';

describe('DynamicSOPComposer', () => {
  let composer: DynamicSOPComposer;

  beforeEach(() => {
    composer = new DynamicSOPComposer();
  });

  describe('singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(dynamicSOPComposer).toBeDefined();
      expect(dynamicSOPComposer).toBeInstanceOf(DynamicSOPComposer);
    });
  });

  describe('compose', () => {
    it('should compose SOP for video content', () => {
      const options: ComposerOptions = {
        contentType: 'video',
        duration: 30,
        hasVoiceover: true,
        complexity: 'standard',
      };

      const sop = composer.compose(options);

      expect(sop).toBeDefined();
      expect(sop.id).toBeDefined();
      expect(sop.name).toBeDefined();
      expect(sop.steps.length).toBeGreaterThan(0);
      expect(sop.tags).toContain('video');
    });

    it('should compose SOP for image content', () => {
      const options: ComposerOptions = {
        contentType: 'image',
        complexity: 'simple',
      };

      const sop = composer.compose(options);

      expect(sop).toBeDefined();
      expect(sop.steps.length).toBeGreaterThan(0);
      expect(sop.tags).toContain('image');
    });

    it('should compose SOP for blog content', () => {
      const options: ComposerOptions = {
        contentType: 'blog',
        complexity: 'complex',
      };

      const sop = composer.compose(options);

      expect(sop).toBeDefined();
      expect(sop.steps.length).toBeGreaterThan(0);
    });

    it('should compose SOP for social content', () => {
      const options: ComposerOptions = {
        contentType: 'social',
        platform: 'instagram',
      };

      const sop = composer.compose(options);

      expect(sop).toBeDefined();
      expect(sop.steps.length).toBeGreaterThan(0);
    });

    it('should include input and output schemas', () => {
      const options: ComposerOptions = {
        contentType: 'video',
        duration: 15,
      };

      const sop = composer.compose(options);

      expect(sop.inputSchema).toBeDefined();
      expect(sop.outputSchema).toBeDefined();
    });

    it('should include cost and time estimates', () => {
      const options: ComposerOptions = {
        contentType: 'video',
        complexity: 'complex',
      };

      const sop = composer.compose(options);

      expect(sop.estimatedDurationMs).toBeGreaterThan(0);
      expect(sop.estimatedCostUsd).toBeDefined();
      expect(sop.estimatedCostUsd.min).toBeGreaterThanOrEqual(0);
      expect(sop.estimatedCostUsd.max).toBeGreaterThanOrEqual(sop.estimatedCostUsd.min);
    });
  });

  describe('step building', () => {
    it('should include strategy step for standard+ complexity', () => {
      const options: ComposerOptions = {
        contentType: 'video',
        complexity: 'standard',
      };

      const sop = composer.compose(options);
      const strategyStep = sop.steps.find(s => s.agentRole === 'strategist');

      expect(strategyStep).toBeDefined();
    });

    it('should include copywriting step for content types needing text', () => {
      const options: ComposerOptions = {
        contentType: 'video',
        hasVoiceover: true,
      };

      const sop = composer.compose(options);
      const copyStep = sop.steps.find(s => s.agentRole === 'copywriter');

      expect(copyStep).toBeDefined();
    });

    it('should include producer step for media generation', () => {
      const options: ComposerOptions = {
        contentType: 'image',
      };

      const sop = composer.compose(options);
      const producerStep = sop.steps.find(s => s.agentRole === 'producer');

      expect(producerStep).toBeDefined();
    });

    it('should include review step', () => {
      const options: ComposerOptions = {
        contentType: 'video',
        complexity: 'complex',
      };

      const sop = composer.compose(options);
      const reviewStep = sop.steps.find(s => s.agentRole === 'reviewer');

      expect(reviewStep).toBeDefined();
    });

    it('should support custom steps injection', () => {
      const customStep: SOPStep = {
        id: 'custom_step',
        name: 'Custom Processing',
        description: 'A custom step added by user',
        agentRole: 'copywriter',
        inputMapping: {},
        outputKey: 'custom_output',
        maxRetries: 2,
        timeoutMs: 20000,
      };

      const options: ComposerOptions = {
        contentType: 'image',
        customSteps: [customStep],
      };

      const sop = composer.compose(options);
      const foundCustom = sop.steps.find(s => s.id === 'custom_step');

      expect(foundCustom).toBeDefined();
    });
  });

  describe('tier selection', () => {
    it('should select eco tier for simple tasks', () => {
      const options: ComposerOptions = {
        contentType: 'social',
        complexity: 'simple',
      };

      const sop = composer.compose(options);

      expect(sop.recommendedTier).toBe('eco');
    });

    it('should select standard tier for standard complexity', () => {
      const options: ComposerOptions = {
        contentType: 'video',
        complexity: 'standard',
      };

      const sop = composer.compose(options);

      expect(sop.recommendedTier).toBe('standard');
    });

    it('should select infinity tier for complex tasks', () => {
      const options: ComposerOptions = {
        contentType: 'video',
        complexity: 'complex',
        hasVoiceover: true,
      };

      const sop = composer.compose(options);

      expect(sop.recommendedTier).toBe('infinity');
    });
  });

  describe('cost and time estimation', () => {
    it('should estimate higher cost for complex tasks', () => {
      const simple = composer.compose({
        contentType: 'image',
        complexity: 'simple',
      });

      const complex = composer.compose({
        contentType: 'image',
        complexity: 'complex',
      });

      expect(complex.estimatedCostUsd.max).toBeGreaterThan(simple.estimatedCostUsd.max);
    });

    it('should estimate longer duration for video than image', () => {
      const image = composer.compose({
        contentType: 'image',
        complexity: 'standard',
      });

      const video = composer.compose({
        contentType: 'video',
        complexity: 'standard',
        hasVoiceover: true,
      });

      expect(video.estimatedDurationMs).toBeGreaterThan(image.estimatedDurationMs);
    });
  });

  describe('generateName', () => {
    it('should generate descriptive name', () => {
      const options: ComposerOptions = {
        contentType: 'video',
        platform: 'tiktok',
      };

      const sop = composer.compose(options);

      expect(sop.name).toBeDefined();
      expect(sop.name.length).toBeGreaterThan(5);
    });
  });

  describe('generateDescription', () => {
    it('should generate comprehensive description', () => {
      const options: ComposerOptions = {
        contentType: 'video',
        duration: 30,
        hasVoiceover: true,
      };

      const sop = composer.compose(options);

      expect(sop.description).toBeDefined();
      expect(sop.description.length).toBeGreaterThan(20);
    });
  });

  describe('generateTags', () => {
    it('should generate relevant tags', () => {
      const options: ComposerOptions = {
        contentType: 'video',
        platform: 'instagram',
        hasVoiceover: true,
      };

      const sop = composer.compose(options);

      expect(sop.tags).toBeDefined();
      expect(sop.tags.length).toBeGreaterThan(0);
      expect(sop.tags).toContain('video');
    });
  });

  describe('SOP structure', () => {
    it('should have valid SOP structure', () => {
      const options: ComposerOptions = {
        contentType: 'video',
      };

      const sop = composer.compose(options);

      // Required fields
      expect(sop.id).toBeDefined();
      expect(sop.name).toBeDefined();
      expect(sop.description).toBeDefined();
      expect(sop.version).toBeDefined();
      expect(sop.steps).toBeDefined();
      expect(Array.isArray(sop.steps)).toBe(true);
      expect(sop.inputSchema).toBeDefined();
      expect(sop.outputSchema).toBeDefined();
      expect(sop.recommendedTier).toBeDefined();
      expect(sop.estimatedDurationMs).toBeDefined();
      expect(sop.estimatedCostUsd).toBeDefined();
      expect(sop.tags).toBeDefined();
      expect(sop.createdAt).toBeDefined();
      expect(sop.updatedAt).toBeDefined();
    });

    it('should have valid step structure', () => {
      const options: ComposerOptions = {
        contentType: 'image',
      };

      const sop = composer.compose(options);

      sop.steps.forEach((step, index) => {
        expect(step.id).toBeDefined();
        expect(step.name).toBeDefined();
        expect(step.agentRole).toBeDefined();
        expect(step.inputMapping).toBeDefined();
        expect(step.outputKey).toBeDefined();
        expect(step.maxRetries).toBeGreaterThanOrEqual(0);
        expect(step.timeoutMs).toBeGreaterThan(0);
      });
    });
  });

  describe('generateSOPId', () => {
    it('should generate unique IDs for different content types', () => {
      const videoSOP = composer.compose({ contentType: 'video' });
      const imageSOP = composer.compose({ contentType: 'image' });

      expect(videoSOP.id).not.toBe(imageSOP.id);
    });

    it('should include content type in ID', () => {
      const sop = composer.compose({ contentType: 'video' });

      expect(sop.id.toLowerCase()).toContain('video');
    });
  });
});
