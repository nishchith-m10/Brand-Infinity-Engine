/**
 * Metrics Collector Tests
 * 
 * Tests for job metrics collection and aggregation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import RedisMock from 'ioredis-mock';
import { MetricsCollector } from '../utils/metrics';

describe('MetricsCollector', () => {
  let redis: InstanceType<typeof RedisMock>;
  let metrics: MetricsCollector;

  beforeEach(() => {
    redis = new RedisMock();
    metrics = new MetricsCollector(redis as any);
  });

  afterEach(async () => {
    await redis.flushall();
    await redis.quit();
  });

  // ===========================================================================
  // Record Job Tests
  // ===========================================================================

  describe('recordJob', () => {
    it('should record successful job execution', async () => {
      await metrics.recordJob({
        jobType: 'video-generation',
        durationMs: 1500,
        success: true,
      });

      const summary = await metrics.getSummary('video-generation');
      expect(summary.successCount).toBe(1);
      expect(summary.failureCount).toBe(0);
      expect(summary.totalJobs).toBe(1);
    });

    it('should record failed job execution', async () => {
      await metrics.recordJob({
        jobType: 'video-generation',
        durationMs: 500,
        success: false,
        error: 'Processing failed',
      });

      const summary = await metrics.getSummary('video-generation');
      expect(summary.successCount).toBe(0);
      expect(summary.failureCount).toBe(1);
      expect(summary.totalJobs).toBe(1);
    });

    it('should track multiple job executions', async () => {
      await metrics.recordJob({
        jobType: 'embeddings',
        durationMs: 100,
        success: true,
      });

      await metrics.recordJob({
        jobType: 'embeddings',
        durationMs: 200,
        success: true,
      });

      await metrics.recordJob({
        jobType: 'embeddings',
        durationMs: 150,
        success: false,
        error: 'Error',
      });

      const summary = await metrics.getSummary('embeddings');
      expect(summary.totalJobs).toBe(3);
      expect(summary.successCount).toBe(2);
      expect(summary.failureCount).toBe(1);
    });

    it('should store error details for failed jobs', async () => {
      await metrics.recordJob({
        jobType: 'test-job',
        durationMs: 100,
        success: false,
        error: 'Database connection failed',
        metadata: { retryCount: 3 },
      });

      const summary = await metrics.getSummary('test-job');
      expect(summary.recentErrors.length).toBeGreaterThan(0);
      expect(summary.recentErrors[0].error).toBe('Database connection failed');
      expect(summary.recentErrors[0].metadata).toEqual({ retryCount: 3 });
    });

    it('should store metadata with jobs', async () => {
      await metrics.recordJob({
        jobType: 'test-job',
        durationMs: 100,
        success: false,
        error: 'Test error',
        metadata: { userId: '123', scriptId: 'abc' },
      });

      const summary = await metrics.getSummary('test-job');
      expect(summary.recentErrors[0].metadata).toHaveProperty('userId', '123');
      expect(summary.recentErrors[0].metadata).toHaveProperty('scriptId', 'abc');
    });
  });

  // ===========================================================================
  // Summary Tests
  // ===========================================================================

  describe('getSummary', () => {
    it('should return empty summary for job type with no data', async () => {
      const summary = await metrics.getSummary('non-existent-job');

      expect(summary.totalJobs).toBe(0);
      expect(summary.successCount).toBe(0);
      expect(summary.failureCount).toBe(0);
      expect(summary.successRate).toBe(0);
      expect(summary.avgDuration).toBe(0);
      expect(summary.recentErrors).toEqual([]);
    });

    it('should calculate correct success rate', async () => {
      await metrics.recordJob({ jobType: 'test', durationMs: 100, success: true });
      await metrics.recordJob({ jobType: 'test', durationMs: 100, success: true });
      await metrics.recordJob({ jobType: 'test', durationMs: 100, success: true });
      await metrics.recordJob({ jobType: 'test', durationMs: 100, success: false, error: 'Error' });

      const summary = await metrics.getSummary('test');
      expect(summary.successRate).toBe(0.75); // 3/4
    });

    it('should calculate average duration', async () => {
      await metrics.recordJob({ jobType: 'test', durationMs: 100, success: true });
      await metrics.recordJob({ jobType: 'test', durationMs: 200, success: true });
      await metrics.recordJob({ jobType: 'test', durationMs: 300, success: true });

      const summary = await metrics.getSummary('test');
      expect(summary.avgDuration).toBe(200);
    });

    it('should calculate percentiles correctly', async () => {
      // Record jobs with durations: 100, 200, 300, 400, 500
      for (let i = 1; i <= 5; i++) {
        await metrics.recordJob({
          jobType: 'test',
          durationMs: i * 100,
          success: true,
        });
      }

      const summary = await metrics.getSummary('test');
      expect(summary.p50Duration).toBeGreaterThan(0);
      expect(summary.p95Duration).toBeGreaterThan(0);
      expect(summary.p99Duration).toBeGreaterThan(0);
      expect(summary.p99Duration).toBeGreaterThanOrEqual(summary.p95Duration);
      expect(summary.p95Duration).toBeGreaterThanOrEqual(summary.p50Duration);
    });

    it('should limit recent errors to last 10', async () => {
      // Record 15 errors
      for (let i = 0; i < 15; i++) {
        await metrics.recordJob({
          jobType: 'test',
          durationMs: 100,
          success: false,
          error: `Error ${i}`,
        });
      }

      const summary = await metrics.getSummary('test');
      expect(summary.recentErrors.length).toBe(10);
    });
  });

  // ===========================================================================
  // Get All Summaries Tests
  // ===========================================================================

  describe('getAllSummaries', () => {
    it('should return summaries for all known job types', async () => {
      await metrics.recordJob({
        jobType: 'video-generation',
        durationMs: 1000,
        success: true,
      });

      await metrics.recordJob({
        jobType: 'embeddings',
        durationMs: 500,
        success: true,
      });

      const summaries = await metrics.getAllSummaries();

      expect(summaries).toHaveProperty('video-generation');
      expect(summaries).toHaveProperty('embeddings');
      expect(summaries).toHaveProperty('video-processing');
      expect(summaries).toHaveProperty('brief-generation');
      expect(summaries).toHaveProperty('script-generation');
    });

    it('should include accurate data for each job type', async () => {
      await metrics.recordJob({
        jobType: 'brief-generation',
        durationMs: 800,
        success: true,
      });

      const summaries = await metrics.getAllSummaries();
      expect(summaries['brief-generation'].totalJobs).toBe(1);
      expect(summaries['brief-generation'].successCount).toBe(1);
    });
  });

  // ===========================================================================
  // Reset Tests
  // ===========================================================================

  describe('reset', () => {
    it('should clear all metrics for a job type', async () => {
      await metrics.recordJob({
        jobType: 'test-job',
        durationMs: 100,
        success: true,
      });

      await metrics.recordJob({
        jobType: 'test-job',
        durationMs: 200,
        success: false,
        error: 'Error',
      });

      let summary = await metrics.getSummary('test-job');
      expect(summary.totalJobs).toBe(2);

      // Reset
      await metrics.reset('test-job');

      summary = await metrics.getSummary('test-job');
      expect(summary.totalJobs).toBe(0);
      expect(summary.successCount).toBe(0);
      expect(summary.failureCount).toBe(0);
      expect(summary.recentErrors).toEqual([]);
    });

    it('should only reset specified job type', async () => {
      await metrics.recordJob({ jobType: 'job1', durationMs: 100, success: true });
      await metrics.recordJob({ jobType: 'job2', durationMs: 100, success: true });

      await metrics.reset('job1');

      const summary1 = await metrics.getSummary('job1');
      const summary2 = await metrics.getSummary('job2');

      expect(summary1.totalJobs).toBe(0);
      expect(summary2.totalJobs).toBe(1);
    });
  });

  // ===========================================================================
  // Convenience Function Tests
  // ===========================================================================

  describe('convenience functions', () => {
    it('should export recordSuccess function', async () => {
      const { recordSuccess } = await import('../utils/metrics');
      expect(typeof recordSuccess).toBe('function');
    });

    it('should export recordFailure function', async () => {
      const { recordFailure } = await import('../utils/metrics');
      expect(typeof recordFailure).toBe('function');
    });

    it('should export getMetricsCollector function', async () => {
      const { getMetricsCollector } = await import('../utils/metrics');
      expect(typeof getMetricsCollector).toBe('function');
    });

    it('getMetricsCollector should return singleton', async () => {
      const { getMetricsCollector } = await import('../utils/metrics');
      const instance1 = getMetricsCollector();
      const instance2 = getMetricsCollector();
      expect(instance1).toBe(instance2);
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('edge cases', () => {
    it('should handle zero duration jobs', async () => {
      await metrics.recordJob({
        jobType: 'test',
        durationMs: 0,
        success: true,
      });

      const summary = await metrics.getSummary('test');
      expect(summary.avgDuration).toBe(0);
    });

    it('should handle very large durations', async () => {
      await metrics.recordJob({
        jobType: 'test',
        durationMs: 999999,
        success: true,
      });

      const summary = await metrics.getSummary('test');
      expect(summary.avgDuration).toBe(999999);
    });

    it('should handle errors without metadata', async () => {
      await metrics.recordJob({
        jobType: 'test',
        durationMs: 100,
        success: false,
        error: 'Simple error',
      });

      const summary = await metrics.getSummary('test');
      expect(summary.recentErrors[0].error).toBe('Simple error');
    });

    it('should gracefully handle Redis errors', async () => {
      // Create collector with broken redis
      const brokenRedis = new RedisMock();
      await brokenRedis.quit();

      const brokenMetrics = new MetricsCollector(brokenRedis as any);

      // Should not throw
      await expect(
        brokenMetrics.recordJob({
          jobType: 'test',
          durationMs: 100,
          success: true,
        })
      ).resolves.toBeUndefined();
    });
  });
});
