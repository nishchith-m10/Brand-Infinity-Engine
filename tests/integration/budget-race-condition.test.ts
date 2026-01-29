/**
 * Integration Tests for Budget Race Condition Fix
 * Phase II, Pillar 2
 * 
 * Tests that concurrent requests cannot exceed campaign budget limits
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  TestDatabase, 
  TestFixtures, 
  TEST_CONFIG 
} from '../utils/test-helpers';
import '../utils/test-setup';

describe('Budget Race Condition Prevention', () => {
  let testDb: TestDatabase;
  let testCampaignId: string;
  let testBrandId: string;
  let testUserId: string;

  beforeEach(async () => {
    testDb = new TestDatabase();
    await testDb.cleanup();

    // Create test user and session
    const { user } = await testDb.createTestUser();
    testUserId = user.id;

    // Create test data using fixtures
    const client = await testDb.getAdminClient();
    
    const brand = TestFixtures.createBrand({ user_id: testUserId });
    const { data: brandData } = await client.from('brands').insert(brand).select().single();
    testBrandId = brandData?.id || TEST_CONFIG.TEST_BRAND_ID;

    const campaign = TestFixtures.createCampaign({
      brand_id: testBrandId,
      budget_limit_usd: 100.00,
      budget_used: 0,
      budget_reserved: 0
    });
    const { data: campaignData } = await client.from('campaigns').insert(campaign).select().single();
    testCampaignId = campaignData?.id || TEST_CONFIG.TEST_CAMPAIGN_ID;
  });

  afterEach(async () => {
    await testDb.cleanup();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    // TestDatabase cleanup is handled in afterEach
  });

  it('should prevent concurrent requests from exceeding budget', async () => {
    const client = await testDb.getAdminClient();

    // Scenario: 3 concurrent requests, each requesting $40
    // Budget: $100
    // Expected: Only 2 should succeed (total $80), 1 should fail

    const requestAmount = 40;

    // Execute 3 concurrent reservations
    const reservationPromises = [
      client.rpc('reserve_budget', {
        p_campaign_id: testCampaignId,
        p_amount: requestAmount,
      }),
      client.rpc('reserve_budget', {
        p_campaign_id: testCampaignId,
        p_amount: requestAmount,
      }),
      client.rpc('reserve_budget', {
        p_campaign_id: testCampaignId,
        p_amount: requestAmount,
      }),
    ];

    const results = await Promise.all(reservationPromises);

    // Count successes (non-empty data arrays)
    const successCount = results.filter((r) => r.data && Array.isArray(r.data) && r.data.length > 0).length;
    const failureCount = results.filter((r) => !r.data || (Array.isArray(r.data) && r.data.length === 0)).length;

    // Verify exactly 2 succeeded and 1 failed
    expect(successCount).toBe(2);
    expect(failureCount).toBe(1);

    // Verify final budget state
    const { data: campaign } = await client
      .from('campaigns')
      .select('budget_used, budget_reserved')
      .eq('id', testCampaignId)
      .single();

    expect(campaign!.budget_reserved).toBe(80); // 2 × $40
    expect(campaign!.budget_used).toBe(0); // Not converted yet
  });

  it('should handle rapid sequential reservations correctly', async () => {
    const client = await testDb.getAdminClient();

    // Reset campaign budget
    await client
      .from('campaigns')
      .update({ budget_used: 0, budget_reserved: 0 })
      .eq('id', testCampaignId);

    // Make rapid sequential reservations until budget exhausted
    const reservations = [];
    const requestAmount = 15;

    for (let i = 0; i < 10; i++) {
      const { data, error } = await client.rpc('reserve_budget', {
        p_campaign_id: testCampaignId,
        p_amount: requestAmount,
      });

      reservations.push({ success: !!data && Array.isArray(data) && data.length > 0, error });

      // Small delay to ensure sequential execution
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    const successCount = reservations.filter((r) => r.success).length;

    // With $100 budget and $15 per request, should succeed 6 times (6 × $15 = $90)
    // 7th request would exceed budget ($105)
    expect(successCount).toBeGreaterThanOrEqual(6);
    expect(successCount).toBeLessThanOrEqual(7);

    // Verify no over-allocation
    const { data: campaign } = await client
      .from('campaigns')
      .select('budget_reserved, budget_limit_usd')
      .eq('id', testCampaignId)
      .single();

    expect(campaign!.budget_reserved).toBeLessThanOrEqual(campaign!.budget_limit_usd);
  });

  it('should release budget on request failure', async () => {
    const client = await testDb.getAdminClient();

    // Reset campaign budget
    await client
      .from('campaigns')
      .update({ budget_used: 0, budget_reserved: 0 })
      .eq('id', testCampaignId);

    // Reserve budget
    const reserveAmount = 25;
    await client.rpc('reserve_budget', {
      p_campaign_id: testCampaignId,
      p_amount: reserveAmount,
    });

    // Verify reservation
    const { data: afterReserve } = await client
      .from('campaigns')
      .select('budget_reserved')
      .eq('id', testCampaignId)
      .single();

    expect(afterReserve!.budget_reserved).toBe(reserveAmount);

    // Release (refund) budget
    await client.rpc('refund_budget', {
      p_campaign_id: testCampaignId,
      p_amount: reserveAmount,
    });

    // Verify release
    const { data: afterRefund } = await client
      .from('campaigns')
      .select('budget_reserved')
      .eq('id', testCampaignId)
      .single();

    expect(afterRefund!.budget_reserved).toBe(0);
  });

  it('should convert reserved to used on success', async () => {
    const client = await testDb.getAdminClient();

    // Reset campaign budget
    await client
      .from('campaigns')
      .update({ budget_used: 0, budget_reserved: 0 })
      .eq('id', testCampaignId);

    // Reserve budget
    const reserveAmount = 20;
    const actualCost = 18; // Actual cost slightly less than estimate

    await client.rpc('reserve_budget', {
      p_campaign_id: testCampaignId,
      p_amount: reserveAmount,
    });

    // Convert to actual cost
    await client.rpc('update_actual_cost', {
      p_campaign_id: testCampaignId,
      p_reserved: reserveAmount,
      p_actual: actualCost,
    });

    // Verify conversion
    const { data: campaign } = await client
      .from('campaigns')
      .select('budget_used, budget_reserved')
      .eq('id', testCampaignId)
      .single();

    expect(campaign!.budget_used).toBe(actualCost);
    expect(campaign!.budget_reserved).toBe(0); // Reservation cleared
  });

  it('should handle partial refunds correctly', async () => {
    const client = await testDb.getAdminClient();

    // Reset campaign budget
    await client
      .from('campaigns')
      .update({ budget_used: 0, budget_reserved: 0 })
      .eq('id', testCampaignId);

    // Reserve two amounts
    await client.rpc('reserve_budget', { p_campaign_id: testCampaignId, p_amount: 30 });
    await client.rpc('reserve_budget', { p_campaign_id: testCampaignId, p_amount: 20 });

    const { data: afterReserve } = await client
      .from('campaigns')
      .select('budget_reserved')
      .eq('id', testCampaignId)
      .single();

    expect(afterReserve!.budget_reserved).toBe(50);

    // Refund one of them
    await client.rpc('refund_budget', { p_campaign_id: testCampaignId, p_amount: 20 });

    const { data: afterPartialRefund } = await client
      .from('campaigns')
      .select('budget_reserved')
      .eq('id', testCampaignId)
      .single();

    expect(afterPartialRefund!.budget_reserved).toBe(30);
  });
});
