/**
 * Budget System Integration Tests
 * 
 * Tests the complete budget management system including reservations,
 * commitments, race condition handling, and budget enforcement.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  reserveBudget, 
  commitBudget, 
  releaseBudget,
  getBudgetStatus,
  ESTIMATED_COSTS 
} from '@/lib/budget/reservation';
import { POST as CreateRequest } from '@/app/api/v1/requests/route';
import { POST as StreamConversation } from '@/app/api/v1/conversation/stream/route';
import { 
  TestDatabase, 
  TestFixtures, 
  APITestHelper, 
  TEST_CONFIG 
} from '../../utils/test-helpers';
import '../../utils/test-setup';

describe('Budget System Integration Tests', () => {
  let testDb: TestDatabase;
  let testUser: any;
  let testSession: any;

  beforeEach(async () => {
    testDb = new TestDatabase();
    await testDb.cleanup();

    // Create test user and session
    const { user, session } = await testDb.createTestUser();
    testUser = user;
    testSession = session;

    // Set up test data with specific budget scenarios
    const client = await testDb.getAdminClient();
    
    // Create brand
    const brand = TestFixtures.createBrand({ user_id: testUser.id });
    await client.from('brands').insert(brand);
    
    // Create campaigns with different budget scenarios
    await client.from('campaigns').insert([
      // Campaign with sufficient budget
      TestFixtures.createCampaign({
        id: 'campaign-sufficient',
        name: 'Sufficient Budget Campaign',
        budget_limit: 1000.00,
        budget_spent: 100.00 // $900 available
      }),
      // Campaign with limited budget
      TestFixtures.createCampaign({
        id: 'campaign-limited',
        name: 'Limited Budget Campaign', 
        budget_limit: 50.00,
        budget_spent: 30.00 // $20 available
      }),
      // Campaign with exhausted budget
      TestFixtures.createCampaign({
        id: 'campaign-exhausted',
        name: 'Exhausted Budget Campaign',
        budget_limit: 100.00,
        budget_spent: 100.00 // $0 available
      })
    ]);

    // Mock authentication
    vi.mocked(await import('@/lib/supabase/server')).createClient = vi.fn().mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: testUser },
          error: null
        })
      },
      from: client.from.bind(client),
      rpc: client.rpc.bind(client)
    });
  });

  afterEach(async () => {
    await testDb.cleanup();
    vi.restoreAllMocks();
  });

  describe('Budget Reservation System', () => {
    it('should reserve budget successfully for valid requests', async () => {
      const result = await reserveBudget({
        campaignId: 'campaign-sufficient',
        requestId: 'test-request-123',
        amount: 50.00,
        operation: 'video_generation',
        metadata: {
          provider: 'openai',
          model_id: 'gpt-4',
          estimated_duration: 30
        }
      });

      expect(result.success).toBe(true);
      expect(result.reservationId).toBeTruthy();
      expect(result.amount).toBe(50.00);

      // Verify reservation was created in database
      const client = await testDb.getAdminClient();
      const { data: reservation } = await client
        .from('budget_reservations')
        .select('*')
        .eq('id', result.reservationId)
        .single();

      expect(reservation).toBeTruthy();
      expect(reservation.campaign_id).toBe('campaign-sufficient');
      expect(reservation.amount_usd).toBe(50.00);
      expect(reservation.status).toBe('reserved');
    });

    it('should reject reservations exceeding available budget', async () => {
      const result = await reserveBudget({
        campaignId: 'campaign-limited', // Only $20 available
        requestId: 'test-request-exceed',
        amount: 30.00, // Requesting more than available
        operation: 'video_generation'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient budget');
      expect(result.available).toBe(20.00);
      expect(result.required).toBe(30.00);

      // Verify no reservation was created
      const client = await testDb.getAdminClient();
      const { data: reservations } = await client
        .from('budget_reservations')
        .select('*')
        .eq('request_id', 'test-request-exceed');

      expect(reservations.length).toBe(0);
    });

    it('should handle concurrent reservation requests without race conditions', async () => {
      // Simulate concurrent requests for the same campaign
      const concurrentRequests = Array.from({ length: 5 }, (_, i) => 
        reserveBudget({
          campaignId: 'campaign-limited', // $20 available
          requestId: `concurrent-request-${i}`,
          amount: 10.00, // Each request needs $10
          operation: 'image_generation'
        })
      );

      const results = await Promise.all(concurrentRequests);

      // Only 2 requests should succeed ($20 / $10 = 2)
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      expect(successful.length).toBe(2);
      expect(failed.length).toBe(3);

      // All failed requests should have proper error messages
      failed.forEach(result => {
        expect(result.error).toContain('Insufficient budget');
      });

      // Verify only successful reservations were created
      const client = await testDb.getAdminClient();
      const { data: reservations } = await client
        .from('budget_reservations')
        .select('*')
        .eq('campaign_id', 'campaign-limited')
        .eq('status', 'reserved');

      expect(reservations.length).toBe(2);
    });

    it('should account for existing reservations in budget calculations', async () => {
      const campaignId = 'campaign-sufficient';

      // Create initial reservation
      const firstReservation = await reserveBudget({
        campaignId,
        requestId: 'first-request',
        amount: 500.00,
        operation: 'video_generation'
      });

      expect(firstReservation.success).toBe(true);

      // Attempt second reservation - should account for first reservation
      const secondReservation = await reserveBudget({
        campaignId,
        requestId: 'second-request', 
        amount: 500.00, // This should fail as only ~$400 is available after first reservation
        operation: 'video_generation'
      });

      expect(secondReservation.success).toBe(false);
      expect(secondReservation.error).toContain('Insufficient budget');

      // Available budget should account for existing reservation
      const available = 1000.00 - 100.00 - 500.00; // limit - spent - reserved
      expect(secondReservation.available).toBe(available);
    });

    it('should handle reservation expiration and cleanup', async () => {
      const client = await testDb.getAdminClient();

      // Create expired reservation manually
      const expiredReservationId = 'expired-reservation-123';
      await client.from('budget_reservations').insert({
        id: expiredReservationId,
        campaign_id: 'campaign-sufficient',
        request_id: 'expired-request',
        amount_usd: 100.00,
        status: 'reserved',
        created_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        expires_at: new Date(Date.now() - 60000).toISOString() // Expired 1 minute ago
      });

      // New reservation should not account for expired reservation
      const result = await reserveBudget({
        campaignId: 'campaign-sufficient',
        requestId: 'after-expiry-request',
        amount: 900.00, // This should succeed if expired reservation is not counted
        operation: 'video_generation'
      });

      expect(result.success).toBe(true);

      // Verify expired reservation was cleaned up
      const { data: expiredRes } = await client
        .from('budget_reservations')
        .select('*')
        .eq('id', expiredReservationId)
        .single();

      expect(expiredRes?.status).not.toBe('reserved'); // Should be cleaned up or marked expired
    });
  });

  describe('Budget Commitment System', () => {
    let reservationId: string;

    beforeEach(async () => {
      // Create a reservation to commit
      const reservation = await reserveBudget({
        campaignId: 'campaign-sufficient',
        requestId: 'test-commit-request',
        amount: 100.00,
        operation: 'script_generation'
      });
      
      expect(reservation.success).toBe(true);
      reservationId = reservation.reservationId;
    });

    it('should commit reserved budget successfully', async () => {
      const result = await commitBudget({
        reservationId,
        actualCost: 85.00, // Actual cost less than reserved
        metadata: {
          provider: 'openai',
          model_id: 'gpt-4',
          tokens_used: 1500,
          duration_seconds: 45
        }
      });

      expect(result.success).toBe(true);
      expect(result.amountCommitted).toBe(85.00);

      // Verify reservation was marked as committed
      const client = await testDb.getAdminClient();
      const { data: reservation } = await client
        .from('budget_reservations')
        .select('*')
        .eq('id', reservationId)
        .single();

      expect(reservation.status).toBe('committed');
      expect(reservation.committed_amount).toBe(85.00);
      expect(reservation.resolved_at).toBeTruthy();

      // Verify cost was logged
      const { data: costEntry } = await client
        .from('cost_ledger')
        .select('*')
        .eq('reservation_id', reservationId)
        .single();

      expect(costEntry).toBeTruthy();
      expect(costEntry.cost_usd).toBe(85.00);
      expect(costEntry.operation_type).toBe('script_generation');
      expect(costEntry.provider).toBe('openai');

      // Verify any excess reservation was released
      expect(result.excessReleased).toBe(15.00); // 100 - 85
    });

    it('should handle commitment exceeding reservation', async () => {
      const result = await commitBudget({
        reservationId,
        actualCost: 120.00, // More than the $100 reserved
        metadata: {
          provider: 'openai',
          model_id: 'gpt-4'
        }
      });

      expect(result.success).toBe(true);
      expect(result.amountCommitted).toBe(120.00);
      expect(result.additionalCharged).toBe(20.00); // Amount over reservation

      // Verify cost entry reflects actual amount
      const client = await testDb.getAdminClient();
      const { data: costEntry } = await client
        .from('cost_ledger')
        .select('*')
        .eq('reservation_id', reservationId)
        .single();

      expect(costEntry.cost_usd).toBe(120.00);
    });

    it('should prevent double commitment of same reservation', async () => {
      // First commitment
      const firstCommit = await commitBudget({
        reservationId,
        actualCost: 75.00
      });

      expect(firstCommit.success).toBe(true);

      // Second commitment attempt
      const secondCommit = await commitBudget({
        reservationId,
        actualCost: 50.00
      });

      expect(secondCommit.success).toBe(false);
      expect(secondCommit.error).toContain('already committed');

      // Verify only one cost entry exists
      const client = await testDb.getAdminClient();
      const { data: costEntries } = await client
        .from('cost_ledger')
        .select('*')
        .eq('reservation_id', reservationId);

      expect(costEntries.length).toBe(1);
      expect(costEntries[0].cost_usd).toBe(75.00);
    });
  });

  describe('Budget Release System', () => {
    let reservationId: string;

    beforeEach(async () => {
      const reservation = await reserveBudget({
        campaignId: 'campaign-sufficient',
        requestId: 'test-release-request',
        amount: 75.00,
        operation: 'image_generation'
      });
      
      expect(reservation.success).toBe(true);
      reservationId = reservation.reservationId;
    });

    it('should release unused budget reservations', async () => {
      const result = await releaseBudget({
        reservationId,
        reason: 'Request cancelled by user'
      });

      expect(result.success).toBe(true);
      expect(result.amountReleased).toBe(75.00);

      // Verify reservation was marked as released
      const client = await testDb.getAdminClient();
      const { data: reservation } = await client
        .from('budget_reservations')
        .select('*')
        .eq('id', reservationId)
        .single();

      expect(reservation.status).toBe('released');
      expect(reservation.resolved_at).toBeTruthy();

      // Released budget should be available for new reservations
      const newReservation = await reserveBudget({
        campaignId: 'campaign-sufficient',
        requestId: 'after-release-request',
        amount: 75.00,
        operation: 'video_generation'
      });

      expect(newReservation.success).toBe(true);
    });

    it('should prevent release of committed reservations', async () => {
      // First commit the reservation
      await commitBudget({
        reservationId,
        actualCost: 75.00
      });

      // Then try to release it
      const result = await releaseBudget({
        reservationId,
        reason: 'Attempting invalid release'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('already committed');

      // Verify reservation status unchanged
      const client = await testDb.getAdminClient();
      const { data: reservation } = await client
        .from('budget_reservations')
        .select('*')
        .eq('id', reservationId)
        .single();

      expect(reservation.status).toBe('committed');
    });
  });

  describe('Budget Status and Reporting', () => {
    beforeEach(async () => {
      // Set up various budget states for testing
      const sufficient = await reserveBudget({
        campaignId: 'campaign-sufficient',
        requestId: 'status-test-1',
        amount: 200.00,
        operation: 'video_generation'
      });

      const limited = await reserveBudget({
        campaignId: 'campaign-limited',
        requestId: 'status-test-2', 
        amount: 15.00,
        operation: 'image_generation'
      });

      // Commit one reservation
      if (sufficient.success) {
        await commitBudget({
          reservationId: sufficient.reservationId,
          actualCost: 180.00
        });
      }
    });

    it('should provide accurate budget status', async () => {
      const status = await getBudgetStatus('campaign-sufficient');

      expect(status.campaignId).toBe('campaign-sufficient');
      expect(status.budgetLimit).toBe(1000.00);
      expect(status.budgetSpent).toBe(280.00); // 100 original + 180 committed
      expect(status.budgetAvailable).toBe(720.00);
      expect(status.reservationsActive).toBe(0);
      expect(status.reservationsTotal).toBe(200.00); // One committed
    });

    it('should track budget utilization metrics', async () => {
      const status = await getBudgetStatus('campaign-limited');

      expect(status.utilizationPercent).toBeCloseTo(85.0); // (30 + 15) / 50 * 100
      expect(status.reservationsActive).toBe(1);
      expect(status.budgetAvailable).toBe(5.00); // 50 - 30 - 15

      // Should indicate high utilization
      expect(status.isHighUtilization).toBe(true); // > 80%
    });

    it('should detect budget exhaustion', async () => {
      const status = await getBudgetStatus('campaign-exhausted');

      expect(status.budgetAvailable).toBe(0.00);
      expect(status.isExhausted).toBe(true);
      expect(status.canReserve).toBe(false);
    });
  });

  describe('API Integration with Budget System', () => {
    beforeEach(async () => {
      // Mock rate limiting to pass
      vi.doMock('@/lib/utils/rate-limit-helpers', () => ({
        checkRateLimit: vi.fn().mockResolvedValue({
          success: true,
          limit: 100,
          remaining: 99
        })
      }));
    });

    it('should enforce budget limits in content request creation', async () => {
      const requestData = {
        brand_id: TEST_CONFIG.TEST_BRAND_ID,
        campaign_id: 'campaign-exhausted', // Campaign with no available budget
        title: 'Budget Limited Request',
        type: 'video_with_vo',
        requirements: {
          prompt: 'Create an expensive video',
          duration: 60,
          style_preset: 'Cinematic'
        }
      };

      // Mock database responses
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: testUser },
            error: null
          })
        },
        from: vi.fn().mockImplementation((table) => {
          if (table === 'brands') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: TestFixtures.createBrand({ user_id: testUser.id }),
                    error: null
                  })
                })
              })
            };
          }
          if (table === 'campaigns') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: 'campaign-exhausted',
                      budget_limit: 100.00,
                      budget_spent: 100.00
                    },
                    error: null
                  })
                })
              })
            };
          }
          return { insert: vi.fn(), select: vi.fn() };
        }),
        rpc: vi.fn()
      };

      vi.mocked(await import('@/lib/supabase/server')).createClient = vi.fn().mockResolvedValue(mockSupabase);

      const request = APITestHelper.createAuthenticatedRequest(
        'POST',
        '/api/v1/requests',
        requestData
      );

      const response = await CreateRequest(request);
      const result = await APITestHelper.parseResponse(response);

      expect(response.status).toBe(402); // Payment Required
      APITestHelper.assertErrorResponse(result, 'INSUFFICIENT_BUDGET');
      expect(result.error.details).toHaveProperty('available', 0);
      expect(result.error.details).toHaveProperty('required');
    });

    it('should reserve budget before expensive operations', async () => {
      let budgetReservationCalls = [];

      // Mock budget reservation
      vi.doMock('@/lib/budget/reservation', () => ({
        reserveBudget: vi.fn().mockImplementation(async (params) => {
          budgetReservationCalls.push(params);
          return {
            success: true,
            reservationId: `res_${Date.now()}`,
            amount: params.amount
          };
        }),
        ESTIMATED_COSTS: {
          CONVERSATION_STREAM: 5.00
        }
      }));

      const conversationData = {
        session_id: `session_${Date.now()}`,
        message: 'Generate expensive content',
        provider: 'openai',
        model_id: 'gpt-4',
        context: {
          campaign_id: 'campaign-sufficient'
        }
      };

      // Mock Supabase and LLM
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: testUser },
            error: null
          })
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { budget_limit: 1000.00, budget_spent: 100.00 },
                error: null
              })
            })
          })
        })
      };

      vi.mocked(await import('@/lib/supabase/server')).createClient = vi.fn().mockResolvedValue(mockSupabase);

      // Mock LLM service
      vi.doMock('@/lib/llm', () => ({
        getLLMService: vi.fn().mockReturnValue({
          streamCompletion: vi.fn().mockResolvedValue({
            async *[Symbol.asyncIterator]() {
              yield 'Mocked streaming response';
            }
          })
        })
      }));

      const request = APITestHelper.createAuthenticatedRequest(
        'POST',
        '/api/v1/conversation/stream',
        conversationData
      );

      await StreamConversation(request);

      // Should have attempted budget reservation
      expect(budgetReservationCalls.length).toBeGreaterThan(0);
      expect(budgetReservationCalls[0]).toHaveProperty('campaignId', 'campaign-sufficient');
      expect(budgetReservationCalls[0]).toHaveProperty('amount', 5.00);
    });
  });

  describe('Budget Enforcement Edge Cases', () => {
    it('should handle budget limit changes during reservation', async () => {
      // Create initial reservation
      const firstRes = await reserveBudget({
        campaignId: 'campaign-limited', // $20 available
        requestId: 'before-limit-change',
        amount: 10.00,
        operation: 'image_generation'
      });

      expect(firstRes.success).toBe(true);

      // Simulate budget limit increase
      const client = await testDb.getAdminClient();
      await client
        .from('campaigns')
        .update({ budget_limit: 100.00 }) // Increase from $50 to $100
        .eq('id', 'campaign-limited');

      // New reservation should succeed with increased limit
      const secondRes = await reserveBudget({
        campaignId: 'campaign-limited',
        requestId: 'after-limit-change',
        amount: 60.00, // Would fail with old limit
        operation: 'video_generation'
      });

      expect(secondRes.success).toBe(true);
    });

    it('should handle campaign deletion with active reservations', async () => {
      // Create reservation
      const reservation = await reserveBudget({
        campaignId: 'campaign-sufficient',
        requestId: 'before-campaign-delete',
        amount: 100.00,
        operation: 'video_generation'
      });

      expect(reservation.success).toBe(true);

      // Simulate campaign deletion (soft delete)
      const client = await testDb.getAdminClient();
      await client
        .from('campaigns')
        .update({ 
          deleted_at: new Date().toISOString(),
          status: 'deleted' 
        })
        .eq('id', 'campaign-sufficient');

      // Budget operations on deleted campaign should fail
      const newReservation = await reserveBudget({
        campaignId: 'campaign-sufficient',
        requestId: 'after-campaign-delete',
        amount: 50.00,
        operation: 'image_generation'
      });

      expect(newReservation.success).toBe(false);
      expect(newReservation.error).toContain('Campaign not found or inactive');

      // Existing reservation should be releasable
      const release = await releaseBudget({
        reservationId: reservation.reservationId,
        reason: 'Campaign deleted'
      });

      expect(release.success).toBe(true);
    });

    it('should handle negative budget scenarios gracefully', async () => {
      // Create campaign with negative available budget (overspent)
      const client = await testDb.getAdminClient();
      await client.from('campaigns').insert({
        id: 'campaign-overspent',
        brand_id: TEST_CONFIG.TEST_BRAND_ID,
        name: 'Overspent Campaign',
        budget_limit: 100.00,
        budget_spent: 150.00, // Overspent by $50
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      const reservation = await reserveBudget({
        campaignId: 'campaign-overspent',
        requestId: 'overspent-test',
        amount: 10.00,
        operation: 'image_generation'
      });

      expect(reservation.success).toBe(false);
      expect(reservation.available).toBe(-50.00); // Negative available budget
      expect(reservation.error).toContain('Budget exceeded');
    });
  });
});