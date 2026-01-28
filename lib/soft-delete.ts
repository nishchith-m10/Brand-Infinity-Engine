// =============================================================================
// Soft Delete Utilities
// Phase III, Pillar 2: Reusable soft delete utilities for application code
// =============================================================================

import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Supported tables with soft delete capability
 */
export type SoftDeleteTable =
  | 'content_requests'
  | 'request_tasks'
  | 'request_events'
  | 'scripts'
  | 'creative_briefs'
  | 'user_provider_keys'
  | 'conversation_sessions'
  | 'conversation_messages'
  | 'campaigns'
  | 'videos'
  | 'knowledge_bases'
  | 'brand_knowledge_base';

/**
 * Result of soft delete operation
 */
export interface SoftDeleteResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Soft delete a record by setting deleted_at to current timestamp
 * 
 * @param supabase - Supabase client
 * @param table - Table name
 * @param id - Record ID
 * @returns Soft delete result with updated record
 * 
 * @example
 * ```typescript
 * const result = await softDelete(supabase, 'content_requests', requestId);
 * if (result.success) {
 *   console.log('Deleted:', result.data);
 * }
 * ```
 */
export async function softDelete<T = unknown>(
  supabase: SupabaseClient,
  table: SoftDeleteTable,
  id: string
): Promise<SoftDeleteResult<T>> {
  try {
    const { data, error } = await supabase
      .from(table)
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null) // Only delete if not already deleted
      .select()
      .single();

    if (error) {
      return {
        success: false,
        error: {
          code: 'SOFT_DELETE_FAILED',
          message: `Failed to soft delete from ${table}`,
          details: error,
        },
      };
    }

    if (!data) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Record not found or already deleted in ${table}`,
        },
      };
    }

    return {
      success: true,
      data: data as T,
    };
  } catch (err) {
    return {
      success: false,
      error: {
        code: 'UNEXPECTED_ERROR',
        message: err instanceof Error ? err.message : 'An unexpected error occurred',
      },
    };
  }
}

/**
 * Restore a soft-deleted record by clearing deleted_at
 * 
 * @param supabase - Supabase client
 * @param table - Table name
 * @param id - Record ID
 * @returns Undelete result with restored record
 * 
 * @example
 * ```typescript
 * const result = await undelete(supabase, 'content_requests', requestId);
 * if (result.success) {
 *   console.log('Restored:', result.data);
 * }
 * ```
 */
export async function undelete<T = unknown>(
  supabase: SupabaseClient,
  table: SoftDeleteTable,
  id: string
): Promise<SoftDeleteResult<T>> {
  try {
    const { data, error } = await supabase
      .from(table)
      .update({ deleted_at: null })
      .eq('id', id)
      .not('deleted_at', 'is', null) // Only restore if currently deleted
      .select()
      .single();

    if (error) {
      return {
        success: false,
        error: {
          code: 'UNDELETE_FAILED',
          message: `Failed to restore from ${table}`,
          details: error,
        },
      };
    }

    if (!data) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Record not found or not deleted in ${table}`,
        },
      };
    }

    return {
      success: true,
      data: data as T,
    };
  } catch (err) {
    return {
      success: false,
      error: {
        code: 'UNEXPECTED_ERROR',
        message: err instanceof Error ? err.message : 'An unexpected error occurred',
      },
    };
  }
}

/**
 * Check if a record is soft-deleted
 * 
 * @param supabase - Supabase client
 * @param table - Table name
 * @param id - Record ID
 * @returns True if record is soft-deleted, false otherwise
 * 
 * @example
 * ```typescript
 * const isDeleted = await isSoftDeleted(supabase, 'content_requests', requestId);
 * console.log('Is deleted:', isDeleted);
 * ```
 */
export async function isSoftDeleted(
  supabase: SupabaseClient,
  table: SoftDeleteTable,
  id: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from(table)
      .select('deleted_at')
      .eq('id', id)
      .single();

    if (error || !data) {
      return false;
    }

    return data.deleted_at !== null;
  } catch {
    return false;
  }
}

/**
 * Query builder that automatically filters out soft-deleted records
 * 
 * @param supabase - Supabase client
 * @param table - Table name
 * @returns Query builder with deleted_at filter applied
 * 
 * @example
 * ```typescript
 * const { data } = await queryWithoutDeleted(supabase, 'content_requests')
 *   .eq('brand_id', brandId)
 *   .select('*');
 * ```
 */
export function queryWithoutDeleted(
  supabase: SupabaseClient,
  table: SoftDeleteTable
) {
  return supabase.from(table).select('*').is('deleted_at', null);
}

/**
 * Query builder for soft-deleted records only
 * 
 * @param supabase - Supabase client
 * @param table - Table name
 * @returns Query builder with filter for only deleted records
 * 
 * @example
 * ```typescript
 * const { data } = await queryOnlyDeleted(supabase, 'content_requests')
 *   .eq('brand_id', brandId)
 *   .select('*');
 * ```
 */
export function queryOnlyDeleted(
  supabase: SupabaseClient,
  table: SoftDeleteTable
) {
  return supabase.from(table).select('*').not('deleted_at', 'is', null);
}

/**
 * Get soft delete statistics for a table
 * 
 * @param supabase - Supabase client
 * @param table - Table name
 * @returns Statistics about soft-deleted records
 * 
 * @example
 * ```typescript
 * const stats = await getSoftDeleteStats(supabase, 'content_requests');
 * console.log(`${stats.deletedCount} deleted, ${stats.activeCount} active`);
 * ```
 */
export async function getSoftDeleteStats(
  supabase: SupabaseClient,
  table: SoftDeleteTable
): Promise<{
  activeCount: number;
  deletedCount: number;
  totalCount: number;
  oldestDeletion: string | null;
  newestDeletion: string | null;
}> {
  try {
    // Get active count
    const { count: activeCount } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null);

    // Get deleted count and dates
    const { count: deletedCount, data: deletedRecords } = await supabase
      .from(table)
      .select('deleted_at', { count: 'exact' })
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: true });

    const oldestDeletion = deletedRecords?.[0]?.deleted_at || null;
    const newestDeletion = deletedRecords?.[deletedRecords.length - 1]?.deleted_at || null;

    return {
      activeCount: activeCount || 0,
      deletedCount: deletedCount || 0,
      totalCount: (activeCount || 0) + (deletedCount || 0),
      oldestDeletion,
      newestDeletion,
    };
  } catch {
    return {
      activeCount: 0,
      deletedCount: 0,
      totalCount: 0,
      oldestDeletion: null,
      newestDeletion: null,
    };
  }
}

/**
 * Permanently delete old soft-deleted records (hard delete)
 * WARNING: This is irreversible. Use with caution.
 * 
 * @param supabase - Supabase client
 * @param table - Table name
 * @param daysOld - Delete records soft-deleted more than this many days ago
 * @returns Number of records permanently deleted
 * 
 * @example
 * ```typescript
 * // Delete records soft-deleted more than 90 days ago
 * const count = await hardDeleteOldRecords(supabase, 'content_requests', 90);
 * console.log(`Permanently deleted ${count} old records`);
 * ```
 */
export async function hardDeleteOldRecords(
  supabase: SupabaseClient,
  table: SoftDeleteTable,
  daysOld: number = 90
): Promise<number> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const { data, error } = await supabase
      .from(table)
      .delete()
      .not('deleted_at', 'is', null)
      .lt('deleted_at', cutoffDate.toISOString())
      .select('id');

    if (error) {
      console.error('Hard delete failed:', error);
      return 0;
    }

    return data?.length || 0;
  } catch (err) {
    console.error('Hard delete error:', err);
    return 0;
  }
}
