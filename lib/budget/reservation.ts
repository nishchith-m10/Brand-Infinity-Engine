/**
 * Budget Reservation Service
 * Phase II-2: Budget Race Condition Fix from phase_execution_plan.md
 * 
 * Provides atomic budget reservation to prevent race conditions when multiple
 * concurrent requests attempt to use budget for the same campaign.
 * 
 * Wraps database RPCs for budget management:
 * - reserve_campaign_budget: Atomically reserve budget with request tracking
 * - convert_budget_reservation: Convert reservation to actual cost after success
 * - release_budget_reservation: Release budget on operation failure
 * - cleanup_stale_budget_reservations: Cleanup stale reservations (>1 hour)
 */

import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/monitoring/logger';

/**
 * Estimated costs by operation type (USD)
 */
export const ESTIMATED_COSTS = {
  llm_chat: 0.02,
  image_generation_standard: 0.04,
  image_generation_hd: 0.08,
  video_generation: 0.50,
  script_generation: 0.05,
  brief_generation: 0.03,
  director_parse: 0.02,
} as const;

export type OperationType = keyof typeof ESTIMATED_COSTS;

/**
 * Budget reservation result (extended with reservation ID)
 */
export interface BudgetReservation {
  success: boolean;
  campaignId: string;
  requestId?: string;
  reservationId?: string;
  reservedAmount: number;
  budgetLimit?: number;
  budgetUsed?: number;
  budgetReserved?: number;
  availableBefore?: number;
  availableAfter?: number;
  error?: string;
  errorCode?: 'CAMPAIGN_NOT_FOUND' | 'BUDGET_EXCEEDED' | 'DATABASE_ERROR';
}

/**
 * Reserve budget atomically before an operation
 * Uses the new budget_reservations table for proper race condition prevention
 * 
 * @param campaignId - Campaign to reserve budget from
 * @param requestId - Content request ID for tracking
 * @param estimatedCost - Estimated cost in USD
 * @returns Reservation result with reservation_id for later conversion/release
 */
export async function reserveBudget(
  campaignId: string,
  requestId: string,
  estimatedCost: number
): Promise<BudgetReservation> {
  const supabase = await createClient();

  try {
    logger.info('BudgetService', 'Attempting atomic budget reservation', {
      campaignId,
      requestId,
      estimatedCost,
    });

    const { data, error } = await supabase.rpc('reserve_campaign_budget', {
      p_campaign_id: campaignId,
      p_request_id: requestId,
      p_amount: estimatedCost,
    });

    if (error) {
      logger.error('BudgetService', 'Budget reservation RPC error', {
        campaignId,
        requestId,
        estimatedCost,
        error: error.message,
      });
      
      return {
        success: false,
        campaignId,
        requestId,
        reservedAmount: 0,
        error: error.message,
        errorCode: 'DATABASE_ERROR',
      };
    }

    if (!data || !data.success) {
      logger.warn('BudgetService', 'Budget reservation denied', {
        campaignId,
        requestId,
        estimatedCost,
        error: data?.error,
        errorCode: data?.error_code,
        available: data?.available,
      });

      return {
        success: false,
        campaignId,
        requestId,
        reservedAmount: 0,
        error: data?.error || 'Budget reservation failed',
        errorCode: data?.error_code || 'BUDGET_EXCEEDED',
        budgetLimit: data?.total_limit,
        budgetUsed: data?.total_spent,
        budgetReserved: data?.total_reserved,
      };
    }

    logger.info('BudgetService', 'Budget reserved successfully', {
      campaignId,
      requestId,
      reservationId: data.reservation_id,
      reservedAmount: data.reserved_amount,
      availableAfter: data.available_after,
    });

    return {
      success: true,
      campaignId,
      requestId,
      reservationId: data.reservation_id,
      reservedAmount: data.reserved_amount,
      budgetLimit: data.total_limit,
      budgetUsed: data.total_spent,
      budgetReserved: data.total_reserved,
      availableBefore: data.available_before,
      availableAfter: data.available_after,
    };
  } catch (error) {
    logger.error('BudgetService', 'Budget reservation failed unexpectedly', error);
    
    return {
      success: false,
      campaignId,
      requestId,
      reservedAmount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorCode: 'DATABASE_ERROR',
    };
  }
}

/**
 * Convert budget reservation to actual cost after successful operation
 * 
 * @param reservationId - UUID of the budget reservation
 * @param actualCost - Actual cost incurred
 */
export async function convertReservation(
  reservationId: string,
  actualCost: number
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    logger.info('BudgetService', 'Converting reservation to actual cost', {
      reservationId,
      actualCost,
    });

    const { data, error } = await supabase.rpc('convert_budget_reservation', {
      p_reservation_id: reservationId,
      p_actual_cost: actualCost,
    });

    if (error) {
      logger.error('BudgetService', 'Failed to convert reservation', {
        reservationId,
        actualCost,
        error: error.message,
      });
      
      return {
        success: false,
        error: error.message,
      };
    }

    if (!data || !data.success) {
      logger.warn('BudgetService', 'Reservation conversion denied', {
        reservationId,
        error: data?.error,
      });

      return {
        success: false,
        error: data?.error || 'Reservation conversion failed',
      };
    }

    logger.info('BudgetService', 'Reservation converted successfully', {
      reservationId,
      reservedAmount: data.reserved_amount,
      actualCost: data.actual_cost,
      difference: data.difference,
    });

    return { success: true };
  } catch (error) {
    logger.error('BudgetService', 'Convert reservation error', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Commit budget after successful operation (alias for convertReservation)
 * Maintains backward compatibility
 * 
 * @param campaignId - Campaign ID (unused, kept for compatibility)
 * @param reservationId - Reservation ID to convert
 * @param actualCost - Actual cost incurred
 * @deprecated Use convertReservation instead
 */
export async function commitBudget(
  campaignId: string,
  reservationId: string,
  actualCost: number
): Promise<void> {
  const result = await convertReservation(reservationId, actualCost);
  
  if (!result.success) {
    throw new Error(result.error || 'Failed to commit budget');
  }
}

/**
 * Release reserved budget on operation failure
 * 
 * @param reservationId - UUID of the budget reservation
 * @param reason - Optional reason for release
 */
export async function releaseReservation(
  reservationId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    logger.info('BudgetService', 'Releasing budget reservation', {
      reservationId,
      reason,
    });

    const { data, error } = await supabase.rpc('release_budget_reservation', {
      p_reservation_id: reservationId,
      p_reason: reason || null,
    });

    if (error) {
      logger.error('BudgetService', 'Failed to release budget', {
        reservationId,
        reason,
        error: error.message,
      });
      
      return {
        success: false,
        error: error.message,
      };
    }

    if (!data || !data.success) {
      logger.warn('BudgetService', 'Budget release denied', {
        reservationId,
        error: data?.error,
      });

      return {
        success: false,
        error: data?.error || 'Budget release failed',
      };
    }

    logger.info('BudgetService', 'Budget released successfully', {
      reservationId,
      releasedAmount: data.released_amount,
      reason: data.reason,
    });

    return { success: true };
  } catch (error) {
    logger.error('BudgetService', 'Release budget error', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Legacy releaseBudget function for backward compatibility
 * @deprecated Use releaseReservation instead
 */
export async function releaseBudget(
  campaignId: string,
  amount: number
): Promise<void> {
  // This function is deprecated - new code should use releaseReservation with reservation ID
  logger.warn('BudgetService', 'Using deprecated releaseBudget function', {
    campaignId,
    amount,
  });
  
  throw new Error('releaseBudget is deprecated - use releaseReservation with reservation ID');
}

/**
 * Get available budget for a campaign (including active reservations)
 * 
 * @param campaignId - Campaign ID
 * @returns Available budget in USD
 */
export async function getAvailableBudget(campaignId: string): Promise<number> {
  const supabase = await createClient();

  try {
    // Get campaign budget limit
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('budget_limit')
      .eq('id', campaignId)
      .is('deleted_at', null)
      .single();

    if (campaignError || !campaign) {
      logger.error('BudgetService', 'Campaign not found for budget check', {
        campaignId,
        error: campaignError?.message,
      });
      return 0;
    }

    // Get total spent from cost_ledger
    const { data: spentData } = await supabase
      .from('cost_ledger')
      .select('cost_usd')
      .eq('campaign_id', campaignId);

    const spent = spentData?.reduce((sum, row) => sum + Number(row.cost_usd), 0) || 0;

    // Get total reserved (not yet converted or released)
    const { data: reservedData } = await supabase
      .from('budget_reservations')
      .select('amount_usd')
      .eq('campaign_id', campaignId)
      .eq('status', 'reserved');

    const reserved = reservedData?.reduce((sum, row) => sum + Number(row.amount_usd), 0) || 0;

    const limit = Number(campaign.budget_limit);
    const available = limit - spent - reserved;

    logger.info('BudgetService', 'Available budget calculated', {
      campaignId,
      limit,
      spent,
      reserved,
      available,
    });

    return Math.max(0, available); // Never return negative
  } catch (error) {
    logger.error('BudgetService', 'Get available budget error', error);
    return 0;
  }
}

/**
 * Cleanup stale budget reservations (older than 1 hour)
 * Should be called periodically via cron job
 * 
 * @returns Number of cleaned reservations
 */
export async function cleanupStaleReservations(): Promise<number> {
  const supabase = await createClient();

  try {
    logger.info('BudgetService', 'Starting stale reservation cleanup');

    const { data, error } = await supabase.rpc('cleanup_stale_budget_reservations');

    if (error) {
      logger.error('BudgetService', 'Cleanup failed', {
        error: error.message,
      });
      return 0;
    }

    const cleanedCount = data?.cleaned_count || 0;

    logger.info('BudgetService', 'Cleanup completed', {
      cleanedCount,
      cleanedAt: data?.cleaned_at,
    });

    return cleanedCount;
  } catch (error) {
    logger.error('BudgetService', 'Cleanup error', error);
    return 0;
  }
}

/**
 * Execute an operation with automatic budget management
 * Reserves budget before, converts on success, releases on failure
 * 
 * @param campaignId - Campaign ID (optional - if not provided, no budget tracking)
 * @param requestId - Request ID for tracking
 * @param estimatedCost - Estimated cost in USD
 * @param operation - Async operation to execute
 * @param getActualCost - Optional function to get actual cost from result
 * @returns Operation result with reservation details
 */
export async function withBudget<T>(
  campaignId: string | undefined | null,
  requestId: string,
  estimatedCost: number,
  operation: () => Promise<T>,
  getActualCost?: (result: T) => number
): Promise<{ result: T; reservation?: BudgetReservation }> {
  // No budget tracking if no campaign ID
  if (!campaignId) {
    const result = await operation();
    return { result };
  }

  // Reserve budget atomically
  const reservation = await reserveBudget(campaignId, requestId, estimatedCost);

  if (!reservation.success) {
    throw new BudgetExceededError(
      campaignId,
      estimatedCost,
      reservation.error || 'Budget reservation failed',
      reservation.errorCode
    );
  }

  const reservationId = reservation.reservationId!;

  try {
    // Execute operation
    const result = await operation();

    // Convert reservation to actual cost
    const actualCost = getActualCost ? getActualCost(result) : estimatedCost;
    const convertResult = await convertReservation(reservationId, actualCost);

    if (!convertResult.success) {
      logger.warn('BudgetService', 'Failed to convert reservation, but operation succeeded', {
        reservationId,
        error: convertResult.error,
      });
      // Don't fail the operation - reservation will be cleaned up by scheduled job
    }

    return { result, reservation };
  } catch (error) {
    // Release budget on operation failure
    const releaseResult = await releaseReservation(
      reservationId,
      error instanceof Error ? error.message : 'Operation failed'
    );

    if (!releaseResult.success) {
      logger.error('BudgetService', 'Failed to release reservation after operation failure', {
        reservationId,
        error: releaseResult.error,
      });
      // Don't fail - reservation will be cleaned up by scheduled job
    }

    throw error;
  }
}

/**
 * Error thrown when budget is exceeded
 */
export class BudgetExceededError extends Error {
  public readonly code = 'INSUFFICIENT_BUDGET';
  
  constructor(
    public readonly campaignId: string,
    public readonly requestedAmount: number,
    public readonly details?: string,
    public readonly errorCode?: string
  ) {
    super(
      `Insufficient budget for campaign ${campaignId}. ` +
      `Requested: $${requestedAmount.toFixed(2)}. ${details || ''}`
    );
    this.name = 'BudgetExceededError';
  }
}

/**
 * Get estimated cost for an operation type
 */
export function getEstimatedCost(operationType: OperationType): number {
  return ESTIMATED_COSTS[operationType];
}
