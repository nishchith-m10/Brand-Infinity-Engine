// =============================================================================
// Soft Delete Tests
// Phase III, Pillar 2: Test coverage for soft delete functionality
// =============================================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import {
  softDelete,
  undelete,
  isSoftDeleted,
  queryWithoutDeleted,
  queryOnlyDeleted,
  getSoftDeleteStats,
} from '@/lib/soft-delete';

// Test configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Test data
const TEST_BRAND_ID = '00000000-0000-0000-0000-000000000001';
const TEST_USER_ID = '00000000-0000-0000-0000-000000000002';

describe('Soft Delete Utilities', () => {
  let testRequestId: string;

  beforeEach(async () => {
    // Create test content_request
    const { data, error } = await supabase
      .from('content_requests')
      .insert({
        brand_id: TEST_BRAND_ID,
        campaign_id: null,
        title: 'Test Request for Soft Delete',
        content_type: 'video',
        status: 'intake',
        created_by: TEST_USER_ID,
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error('Failed to create test request');
    }

    testRequestId = data.id;
  });

  afterEach(async () => {
    // Clean up test data (hard delete)
    await supabase
      .from('content_requests')
      .delete()
      .eq('id', testRequestId);
  });

  describe('softDelete()', () => {
    it('should soft delete a record', async () => {
      const result = await softDelete(supabase, 'content_requests', testRequestId);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.deleted_at).toBeDefined();
    });

    it('should not delete an already deleted record', async () => {
      // First soft delete
      await softDelete(supabase, 'content_requests', testRequestId);

      // Try to delete again
      const result = await softDelete(supabase, 'content_requests', testRequestId);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('should return error for non-existent record', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000999';
      const result = await softDelete(supabase, 'content_requests', fakeId);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });
  });

  describe('undelete()', () => {
    beforeEach(async () => {
      // Soft delete the test record first
      await softDelete(supabase, 'content_requests', testRequestId);
    });

    it('should restore a soft-deleted record', async () => {
      const result = await undelete(supabase, 'content_requests', testRequestId);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.deleted_at).toBeNull();
    });

    it('should not restore a non-deleted record', async () => {
      // First restore
      await undelete(supabase, 'content_requests', testRequestId);

      // Try to restore again
      const result = await undelete(supabase, 'content_requests', testRequestId);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });
  });

  describe('isSoftDeleted()', () => {
    it('should return false for active record', async () => {
      const isDeleted = await isSoftDeleted(supabase, 'content_requests', testRequestId);
      expect(isDeleted).toBe(false);
    });

    it('should return true for soft-deleted record', async () => {
      await softDelete(supabase, 'content_requests', testRequestId);

      const isDeleted = await isSoftDeleted(supabase, 'content_requests', testRequestId);
      expect(isDeleted).toBe(true);
    });

    it('should return false for non-existent record', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000999';
      const isDeleted = await isSoftDeleted(supabase, 'content_requests', fakeId);
      expect(isDeleted).toBe(false);
    });
  });

  describe('queryWithoutDeleted()', () => {
    it('should exclude soft-deleted records', async () => {
      // Soft delete the test record
      await softDelete(supabase, 'content_requests', testRequestId);

      // Query without deleted
      const query = queryWithoutDeleted(supabase, 'content_requests')
        .eq('id', testRequestId);

      const { data, error } = await query;

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it('should include active records', async () => {
      const query = queryWithoutDeleted(supabase, 'content_requests')
        .eq('id', testRequestId);

      const { data, error } = await query;

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data?.[0].id).toBe(testRequestId);
    });
  });

  describe('queryOnlyDeleted()', () => {
    it('should only return soft-deleted records', async () => {
      // Soft delete the test record
      await softDelete(supabase, 'content_requests', testRequestId);

      // Query only deleted
      const query = queryOnlyDeleted(supabase, 'content_requests')
        .eq('id', testRequestId);

      const { data, error } = await query;

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data?.[0].id).toBe(testRequestId);
      expect(data?.[0].deleted_at).toBeDefined();
    });

    it('should exclude active records', async () => {
      const query = queryOnlyDeleted(supabase, 'content_requests')
        .eq('id', testRequestId);

      const { data, error } = await query;

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });

  describe('getSoftDeleteStats()', () => {
    it('should return correct statistics', async () => {
      const statsBefore = await getSoftDeleteStats(supabase, 'content_requests');
      expect(statsBefore.activeCount).toBeGreaterThanOrEqual(1);
      expect(statsBefore.totalCount).toBeGreaterThanOrEqual(1);

      // Soft delete the test record
      await softDelete(supabase, 'content_requests', testRequestId);

      const statsAfter = await getSoftDeleteStats(supabase, 'content_requests');
      expect(statsAfter.deletedCount).toBeGreaterThanOrEqual(1);
      expect(statsAfter.oldestDeletion).toBeDefined();
      expect(statsAfter.newestDeletion).toBeDefined();
    });
  });
});

describe('Cascade Soft Delete', () => {
  let testRequestId: string;
  let testTaskId: string;

  beforeEach(async () => {
    // Create test content_request
    const { data: request } = await supabase
      .from('content_requests')
      .insert({
        brand_id: TEST_BRAND_ID,
        campaign_id: null,
        title: 'Test Request with Tasks',
        content_type: 'video',
        status: 'intake',
        created_by: TEST_USER_ID,
      })
      .select()
      .single();

    testRequestId = request!.id;

    // Create test task
    const { data: task } = await supabase
      .from('request_tasks')
      .insert({
        request_id: testRequestId,
        task_type: 'strategist',
        status: 'pending',
        sequence_order: 1,
      })
      .select()
      .single();

    testTaskId = task!.id;
  });

  afterEach(async () => {
    // Clean up (hard delete)
    await supabase.from('request_tasks').delete().eq('id', testTaskId);
    await supabase.from('content_requests').delete().eq('id', testRequestId);
  });

  it('should cascade soft delete from content_request to tasks', async () => {
    // Soft delete the request
    await softDelete(supabase, 'content_requests', testRequestId);

    // Check if task was cascaded
    const isTaskDeleted = await isSoftDeleted(supabase, 'request_tasks', testTaskId);
    expect(isTaskDeleted).toBe(true);
  });

  it('should cascade restore from content_request to tasks', async () => {
    // Soft delete the request (cascades to task)
    await softDelete(supabase, 'content_requests', testRequestId);

    // Restore the request
    await undelete(supabase, 'content_requests', testRequestId);

    // Check if task was restored
    const isTaskDeleted = await isSoftDeleted(supabase, 'request_tasks', testTaskId);
    expect(isTaskDeleted).toBe(false);
  });
});
