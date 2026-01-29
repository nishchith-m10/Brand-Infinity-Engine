/**
 * Budget Reservation Tests
 * Phase II-2: Budget Race Condition Fix
 * 
 * Tests atomic budget reservation to prevent race conditions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  reserveBudget,
  convertReservation,
  releaseReservation,
  cleanupStaleReservations,
  getAvailableBudget,
  withBudget,
  BudgetExceededError,
  ESTIMATED_COSTS,
} from '@/lib/budget/reservation';

// Mock Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    rpc: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      single: vi.fn(),
    })),
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

describe('Budget Reservation System', () => {
  let mockSupabase: any;
  
  beforeEach(async () => {
    vi.clearAllMocks();
    const { createClient } = await import('@/lib/supabase/server');
    mockSupabase = await createClient();
  });

  describe('reserveBudget', () => {
    it('should successfully reserve budget when available', async () => {
      mockSupabase.rpc = vi.fn().mockResolvedValue({
        data: {
          success: true,
          reservation_id: 'res_123',
          reserved_amount: 50,
          available_before: 100,
          available_after: 50,
          total_limit: 1000,
          total_spent: 800,
          total_reserved: 150,
        },
        error: null,
      });

      const result = await reserveBudget('campaign_123', 'request_456', 50);

      expect(result.success).toBe(true);
      expect(result.reservationId).toBe('res_123');
      expect(result.reservedAmount).toBe(50);
      expect(result.availableAfter).toBe(50);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('reserve_campaign_budget', {
        p_campaign_id: 'campaign_123',
        p_request_id: 'request_456',
        p_amount: 50,
      });
    });

    it('should fail when budget is exceeded', async () => {
      mockSupabase.rpc = vi.fn().mockResolvedValue({
        data: {
          success: false,
          error: 'Insufficient budget',
          error_code: 'BUDGET_EXCEEDED',
          requested: 100,
          available: 50,
          total_limit: 1000,
          total_spent: 900,
          total_reserved: 50,
        },
        error: null,
      });

      const result = await reserveBudget('campaign_123', 'request_456', 100);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('BUDGET_EXCEEDED');
      expect(result.error).toBe('Insufficient budget');
    });

    it('should fail when campaign not found', async () => {
      mockSupabase.rpc = vi.fn().mockResolvedValue({
        data: {
          success: false,
          error: 'Campaign not found or deleted',
          error_code: 'CAMPAIGN_NOT_FOUND',
        },
        error: null,
      });

      const result = await reserveBudget('invalid_campaign', 'request_456', 50);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('CAMPAIGN_NOT_FOUND');
    });

    it('should handle database errors gracefully', async () => {
      mockSupabase.rpc = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      });

      const result = await reserveBudget('campaign_123', 'request_456', 50);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('DATABASE_ERROR');
      expect(result.error).toContain('Database connection failed');
    });
  });

  describe('convertReservation', () => {
    it('should successfully convert reservation to actual cost', async () => {
      mockSupabase.rpc = vi.fn().mockResolvedValue({
        data: {
          success: true,
          reservation_id: 'res_123',
          reserved_amount: 50,
          actual_cost: 45,
          difference: 5,
        },
        error: null,
      });

      const result = await convertReservation('res_123', 45);

      expect(result.success).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('convert_budget_reservation', {
        p_reservation_id: 'res_123',
        p_actual_cost: 45,
      });
    });

    it('should fail for invalid reservation ID', async () => {
      mockSupabase.rpc = vi.fn().mockResolvedValue({
        data: {
          success: false,
          error: 'Reservation not found or already processed',
          error_code: 'INVALID_RESERVATION',
        },
        error: null,
      });

      const result = await convertReservation('invalid_res', 45);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found or already processed');
    });

    it('should handle database errors', async () => {
      mockSupabase.rpc = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      const result = await convertReservation('res_123', 45);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('releaseReservation', () => {
    it('should successfully release reservation', async () => {
      mockSupabase.rpc = vi.fn().mockResolvedValue({
        data: {
          success: true,
          reservation_id: 'res_123',
          released_amount: 50,
          reason: 'Operation failed',
        },
        error: null,
      });

      const result = await releaseReservation('res_123', 'Operation failed');

      expect(result.success).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('release_budget_reservation', {
        p_reservation_id: 'res_123',
        p_reason: 'Operation failed',
      });
    });

    it('should release without reason', async () => {
      mockSupabase.rpc = vi.fn().mockResolvedValue({
        data: {
          success: true,
          reservation_id: 'res_123',
          released_amount: 50,
          reason: null,
        },
        error: null,
      });

      const result = await releaseReservation('res_123');

      expect(result.success).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('release_budget_reservation', {
        p_reservation_id: 'res_123',
        p_reason: null,
      });
    });
  });

  describe('cleanupStaleReservations', () => {
    it('should cleanup stale reservations and return count', async () => {
      mockSupabase.rpc = vi.fn().mockResolvedValue({
        data: {
          success: true,
          cleaned_count: 5,
          cleaned_at: '2024-01-20T12:00:00Z',
        },
        error: null,
      });

      const result = await cleanupStaleReservations();

      expect(result).toBe(5);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('cleanup_stale_budget_reservations');
    });

    it('should return 0 on error', async () => {
      mockSupabase.rpc = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Cleanup failed' },
      });

      const result = await cleanupStaleReservations();

      expect(result).toBe(0);
    });
  });

  describe('getAvailableBudget', () => {
    it('should calculate available budget correctly', async () => {
      // Mock campaigns table query
      const mockCampaignsFrom = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { budget_limit: 1000 },
          error: null,
        }),
      };

      // Mock cost_ledger table query
      const mockCostLedgerFrom = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [{ cost_usd: 100 }, { cost_usd: 200 }],
          error: null,
        }),
      };

      // Mock budget_reservations table query
      const mockReservationsFrom = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [{ amount_usd: 50 }, { amount_usd: 150 }],
          error: null,
        }),
      };

      // Set up sequential from() calls
      mockSupabase.from = vi.fn()
        .mockReturnValueOnce(mockCampaignsFrom)
        .mockReturnValueOnce(mockCostLedgerFrom)
        .mockReturnValueOnce(mockReservationsFrom);

      const available = await getAvailableBudget('campaign_123');

      // 1000 - (100 + 200) - (50 + 150) = 500
      expect(available).toBe(500);
    });

    it('should return 0 when campaign not found', async () => {
      mockSupabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      });

      const available = await getAvailableBudget('invalid_campaign');

      expect(available).toBe(0);
    });
  });

  describe('withBudget', () => {
    it('should execute operation and convert reservation on success', async () => {
      // Mock successful reservation then successful conversion
      mockSupabase.rpc = vi.fn()
        .mockResolvedValueOnce({
          data: {
            success: true,
            reservation_id: 'res_123',
            reserved_amount: 50,
            available_after: 950,
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            success: true,
            reservation_id: 'res_123',
            actual_cost: 45,
          },
          error: null,
        });

      const operation = vi.fn().mockResolvedValue({ result: 'success' });
      const getActualCost = vi.fn().mockReturnValue(45);

      const { result, reservation } = await withBudget(
        'campaign_123',
        'request_456',
        50,
        operation,
        getActualCost
      );

      expect(operation).toHaveBeenCalled();
      expect(result).toEqual({ result: 'success' });
      expect(reservation?.success).toBe(true);
      expect(reservation?.reservationId).toBe('res_123');
      
      // Should have called reserve and convert
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(2);
    });

    it('should throw BudgetExceededError when reservation fails', async () => {
      mockSupabase.rpc = vi.fn().mockResolvedValue({
        data: {
          success: false,
          error: 'Insufficient budget',
          error_code: 'BUDGET_EXCEEDED',
        },
        error: null,
      });

      const operation = vi.fn();

      await expect(
        withBudget('campaign_123', 'request_456', 100, operation)
      ).rejects.toThrow(BudgetExceededError);

      expect(operation).not.toHaveBeenCalled();
    });

    it('should release reservation when operation fails', async () => {
      // Mock successful reservation then successful release
      mockSupabase.rpc = vi.fn()
        .mockResolvedValueOnce({
          data: {
            success: true,
            reservation_id: 'res_123',
            reserved_amount: 50,
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            success: true,
            reservation_id: 'res_123',
            released_amount: 50,
          },
          error: null,
        });

      const operation = vi.fn().mockRejectedValue(new Error('Operation failed'));

      await expect(
        withBudget('campaign_123', 'request_456', 50, operation)
      ).rejects.toThrow('Operation failed');

      // Should have called reserve and release
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(2);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('release_budget_reservation', {
        p_reservation_id: 'res_123',
        p_reason: 'Operation failed',
      });
    });

    it('should skip budget tracking when campaignId is null', async () => {
      const operation = vi.fn().mockResolvedValue({ result: 'success' });

      const { result, reservation } = await withBudget(
        null,
        'request_456',
        50,
        operation
      );

      expect(result).toEqual({ result: 'success' });
      expect(reservation).toBeUndefined();
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });
  });

  describe('BudgetExceededError', () => {
    it('should create error with proper message and properties', () => {
      const error = new BudgetExceededError(
        'campaign_123',
        100,
        'Only $50 available',
        'BUDGET_EXCEEDED'
      );

      expect(error.name).toBe('BudgetExceededError');
      expect(error.code).toBe('INSUFFICIENT_BUDGET');
      expect(error.campaignId).toBe('campaign_123');
      expect(error.requestedAmount).toBe(100);
      expect(error.details).toBe('Only $50 available');
      expect(error.errorCode).toBe('BUDGET_EXCEEDED');
      expect(error.message).toContain('$100.00');
      expect(error.message).toContain('Only $50 available');
    });
  });

  describe('ESTIMATED_COSTS', () => {
    it('should have defined costs for all operation types', () => {
      expect(ESTIMATED_COSTS.llm_chat).toBe(0.02);
      expect(ESTIMATED_COSTS.image_generation_standard).toBe(0.04);
      expect(ESTIMATED_COSTS.image_generation_hd).toBe(0.08);
      expect(ESTIMATED_COSTS.video_generation).toBe(0.50);
      expect(ESTIMATED_COSTS.script_generation).toBe(0.05);
      expect(ESTIMATED_COSTS.brief_generation).toBe(0.03);
      expect(ESTIMATED_COSTS.director_parse).toBe(0.02);
    });
  });
});
