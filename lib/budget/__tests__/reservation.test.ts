/**
 * Unit Tests for Budget Reservation Service
 * Phase II, Pillar 2: Budget Race Condition Fix
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase
const mockRpc = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve({
    rpc: mockRpc,
  })),
}));

// Mock logger
vi.mock('@/lib/monitoring/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Import after mocks
import {
  reserveBudget,
  commitBudget,
  releaseBudget,
  getAvailableBudget,
  withBudget,
  BudgetExceededError,
  ESTIMATED_COSTS,
} from '../reservation';

describe('Budget Reservation Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('reserveBudget', () => {
    it('should return success when budget is available', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [{
          id: 'campaign-123',
          budget_limit_usd: 100,
          budget_used: 20,
          budget_reserved: 10,
          status: 'active',
        }],
        error: null,
      });

      const result = await reserveBudget('campaign-123', 5);

      expect(result.success).toBe(true);
      expect(result.campaignId).toBe('campaign-123');
      expect(result.reservedAmount).toBe(5);
      expect(result.budgetLimit).toBe(100);
      expect(mockRpc).toHaveBeenCalledWith('reserve_budget', {
        p_campaign_id: 'campaign-123',
        p_amount: 5,
      });
    });

    it('should return failure when budget is insufficient', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const result = await reserveBudget('campaign-123', 100);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient');
    });

    it('should return failure on RPC error', async () => {
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' },
      });

      const result = await reserveBudget('campaign-123', 5);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('commitBudget', () => {
    it('should call update_actual_cost RPC', async () => {
      mockRpc.mockResolvedValueOnce({ error: null });

      await commitBudget('campaign-123', 10, 8);

      expect(mockRpc).toHaveBeenCalledWith('update_actual_cost', {
        p_campaign_id: 'campaign-123',
        p_reserved: 10,
        p_actual: 8,
      });
    });

    it('should throw on RPC error', async () => {
      mockRpc.mockResolvedValueOnce({
        error: { message: 'Commit failed' },
      });

      await expect(commitBudget('campaign-123', 10, 8)).rejects.toThrow();
    });
  });

  describe('releaseBudget', () => {
    it('should call refund_budget RPC', async () => {
      mockRpc.mockResolvedValueOnce({ error: null });

      await releaseBudget('campaign-123', 10);

      expect(mockRpc).toHaveBeenCalledWith('refund_budget', {
        p_campaign_id: 'campaign-123',
        p_amount: 10,
      });
    });
  });

  describe('getAvailableBudget', () => {
    it('should return available budget', async () => {
      mockRpc.mockResolvedValueOnce({
        data: 75.50,
        error: null,
      });

      const available = await getAvailableBudget('campaign-123');

      expect(available).toBe(75.50);
      expect(mockRpc).toHaveBeenCalledWith('get_available_budget', {
        p_campaign_id: 'campaign-123',
      });
    });

    it('should return 0 on error', async () => {
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Error' },
      });

      const available = await getAvailableBudget('campaign-123');

      expect(available).toBe(0);
    });
  });

  describe('withBudget', () => {
    it('should skip budget tracking when no campaign ID', async () => {
      const operation = vi.fn().mockResolvedValue('result');

      const { result } = await withBudget(null, 5, operation);

      expect(result).toBe('result');
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('should reserve and commit on success', async () => {
      // Reserve success
      mockRpc.mockResolvedValueOnce({
        data: [{ id: 'c1', budget_limit_usd: 100, budget_used: 0, budget_reserved: 0 }],
        error: null,
      });
      // Commit success
      mockRpc.mockResolvedValueOnce({ error: null });

      const operation = vi.fn().mockResolvedValue('result');

      const { result, reservation } = await withBudget('campaign-123', 5, operation);

      expect(result).toBe('result');
      expect(reservation?.success).toBe(true);
      expect(mockRpc).toHaveBeenCalledTimes(2);
    });

    it('should reserve and release on failure', async () => {
      // Reserve success
      mockRpc.mockResolvedValueOnce({
        data: [{ id: 'c1', budget_limit_usd: 100 }],
        error: null,
      });
      // Release (refund) success
      mockRpc.mockResolvedValueOnce({ error: null });

      const operation = vi.fn().mockRejectedValue(new Error('Operation failed'));

      await expect(withBudget('campaign-123', 5, operation)).rejects.toThrow('Operation failed');

      expect(mockRpc).toHaveBeenNthCalledWith(2, 'refund_budget', {
        p_campaign_id: 'campaign-123',
        p_amount: 5,
      });
    });

    it('should throw BudgetExceededError when insufficient', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const operation = vi.fn();

      await expect(withBudget('campaign-123', 1000, operation)).rejects.toThrow(BudgetExceededError);
      expect(operation).not.toHaveBeenCalled();
    });
  });

  describe('ESTIMATED_COSTS', () => {
    it('should have expected cost estimates', () => {
      expect(ESTIMATED_COSTS.llm_chat).toBe(0.02);
      expect(ESTIMATED_COSTS.image_generation_standard).toBe(0.04);
      expect(ESTIMATED_COSTS.video_generation).toBe(0.50);
    });
  });
});
