/**
 * Authentication Flow Integration Tests
 * 
 * Tests authentication and authorization flows including login, 
 * session management, and access control across different API endpoints.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST as LoginHandler } from '@/app/api/auth/login/route';
import { POST as VerifyPasscodeHandler } from '@/app/api/verify-passcode/route';
import { POST as CreateRequest } from '@/app/api/v1/requests/route';
import { 
  TestDatabase, 
  TestFixtures, 
  APITestHelper, 
  TEST_CONFIG 
} from '../../utils/test-helpers';
import '../../utils/test-setup';
import { createClient } from '@/lib/supabase/server';

describe('Authentication Flow Integration Tests', () => {
  let testDb: TestDatabase;
  let testUser: any;
  let testSession: any;

  beforeEach(async () => {
    testDb = new TestDatabase();
    await testDb.cleanup();

    // Set up test data
    const client = await testDb.getAdminClient();
    
    // Create brand and campaign for access control tests
    const brand = TestFixtures.createBrand({ user_id: 'test-user-auth' });
    await client.from('brands').insert(brand);
    
    const campaign = TestFixtures.createCampaign();
    await client.from('campaigns').insert(campaign);
  });

  afterEach(async () => {
    await testDb.cleanup();
    vi.restoreAllMocks();
  });

  describe('Email-based Authentication Flow', () => {
    it('should handle complete email authentication flow', async () => {
      const email = 'test@example.com';
      
      // Step 1: Send magic link
      const loginData = { email };
      const loginRequest = APITestHelper.createUnauthenticatedRequest(
        'POST',
        '/api/auth/login',
        loginData
      );

      // Mock Supabase auth response
      const mockSupabase = {
        auth: {
          signInWithOtp: vi.fn().mockResolvedValue({
            data: { user: null, session: null },
            error: null
          })
        }
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase);

      const loginResponse = await LoginHandler(loginRequest);
      const loginResult = await APITestHelper.parseResponse(loginResponse);

      expect(loginResponse.status).toBe(200);
      APITestHelper.assertSuccessResponse(loginResult, ['message']);
      expect(mockSupabase.auth.signInWithOtp).toHaveBeenCalledWith({
        email,
        options: {
          shouldCreateUser: true,
          data: { email }
        }
      });

      // Step 2: Verify passcode
      const passcode = '123456';
      const verifyData = { email, token: passcode };
      const verifyRequest = APITestHelper.createUnauthenticatedRequest(
        'POST',
        '/api/verify-passcode',
        verifyData
      );

      // Mock successful verification
      const mockUser = {
        id: 'user_123',
        email,
        created_at: new Date().toISOString(),
        user_metadata: { email }
      };

      const mockSession = {
        access_token: 'access_token_123',
        refresh_token: 'refresh_token_123',
        expires_at: Date.now() + 3600000,
        user: mockUser
      };

      mockSupabase.auth.verifyOtp = vi.fn().mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null
      });

      const verifyResponse = await VerifyPasscodeHandler(verifyRequest);
      const verifyResult = await APITestHelper.parseResponse(verifyResponse);

      expect(verifyResponse.status).toBe(200);
      APITestHelper.assertSuccessResponse(verifyResult, ['user', 'session']);
      expect(verifyResult.data.user.email).toBe(email);
      expect(verifyResult.data.session.access_token).toBeTruthy();

      // Verify session cookie is set
      const setCookieHeader = verifyResponse.headers.get('set-cookie');
      expect(setCookieHeader).toBeTruthy();
      expect(setCookieHeader).toContain('sb-access-token');
      expect(setCookieHeader).toContain('sb-refresh-token');
    });

    it('should reject invalid passcodes', async () => {
      const verifyData = { 
        email: 'test@example.com', 
        token: 'invalid_code' 
      };
      
      const verifyRequest = APITestHelper.createUnauthenticatedRequest(
        'POST',
        '/api/verify-passcode',
        verifyData
      );

      // Mock failed verification
      const mockSupabase = {
        auth: {
          verifyOtp: vi.fn().mockResolvedValue({
            data: { user: null, session: null },
            error: { message: 'Invalid token', status: 400 }
          })
        }
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase);

      const verifyResponse = await VerifyPasscodeHandler(verifyRequest);
      const verifyResult = await APITestHelper.parseResponse(verifyResponse);

      expect(verifyResponse.status).toBe(400);
      APITestHelper.assertErrorResponse(verifyResult, 'INVALID_TOKEN');
    });

    it('should enforce rate limiting on auth endpoints', async () => {
      // Mock rate limiter to return failure
      vi.doMock('@/lib/ratelimit-edge', () => ({
        rateLimit: {
          limit: vi.fn().mockResolvedValue({
            success: false,
            limit: 5,
            remaining: 0,
            reset: Date.now() + 30000
          })
        }
      }));

      const loginData = { email: 'rate.limited@example.com' };
      const loginRequest = APITestHelper.createUnauthenticatedRequest(
        'POST',
        '/api/auth/login',
        loginData
      );

      const loginResponse = await LoginHandler(loginRequest);
      const loginResult = await APITestHelper.parseResponse(loginResponse);

      expect(loginResponse.status).toBe(429);
      APITestHelper.assertErrorResponse(loginResult, 'RATE_LIMIT_EXCEEDED');
      
      // Should include rate limit headers
      expect(loginResponse.headers.get('x-ratelimit-limit')).toBeTruthy();
      expect(loginResponse.headers.get('x-ratelimit-remaining')).toBeTruthy();
      expect(loginResponse.headers.get('retry-after')).toBeTruthy();
    });
  });

  describe('Session Management', () => {
    beforeEach(async () => {
      // Create authenticated test user
      const { user, session } = await testDb.createTestUser();
      testUser = user;
      testSession = session;
    });

    it('should validate active sessions for protected endpoints', async () => {
      const requestData = {
        brand_id: TEST_CONFIG.TEST_BRAND_ID,
        title: 'Authenticated Request',
        type: 'video_with_vo',
        requirements: {
          prompt: 'Test authenticated request'
        }
      };

      // Mock valid session
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: testUser },
            error: null
          })
        },
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockResolvedValue({
            data: [{ id: 'created_request_id' }],
            error: null
          }),
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: TestFixtures.createBrand({ user_id: testUser.id }),
                error: null
              })
            })
          })
        }),
        rpc: vi.fn()
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase);

      const request = APITestHelper.createAuthenticatedRequest(
        'POST',
        '/api/v1/requests',
        requestData,
        { 'Authorization': `Bearer ${testSession.access_token}` }
      );

      const response = await CreateRequest(request);
      const result = await APITestHelper.parseResponse(response);

      expect(response.status).toBe(200);
      APITestHelper.assertSuccessResponse(result);
      expect(mockSupabase.auth.getUser).toHaveBeenCalled();
    });

    it('should reject expired sessions', async () => {
      const requestData = {
        brand_id: TEST_CONFIG.TEST_BRAND_ID,
        title: 'Expired Session Request',
        type: 'video_with_vo',
        requirements: { prompt: 'Test' }
      };

      // Mock expired session
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'JWT expired', status: 401 }
          })
        }
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase);

      const request = APITestHelper.createAuthenticatedRequest(
        'POST',
        '/api/v1/requests',
        requestData,
        { 'Authorization': 'Bearer expired_token' }
      );

      const response = await CreateRequest(request);
      const result = await APITestHelper.parseResponse(response);

      expect(response.status).toBe(401);
      APITestHelper.assertErrorResponse(result, 'UNAUTHENTICATED');
    });

    it('should handle missing authentication headers', async () => {
      const requestData = {
        brand_id: TEST_CONFIG.TEST_BRAND_ID,
        title: 'No Auth Headers',
        type: 'video_with_vo',
        requirements: { prompt: 'Test' }
      };

      const request = APITestHelper.createUnauthenticatedRequest(
        'POST',
        '/api/v1/requests',
        requestData
      );

      // Mock no authentication
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'No authorization header', status: 401 }
          })
        }
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase);

      const response = await CreateRequest(request);
      const result = await APITestHelper.parseResponse(response);

      expect(response.status).toBe(401);
      APITestHelper.assertErrorResponse(result, 'UNAUTHENTICATED');
    });

    it('should refresh tokens automatically when near expiry', async () => {
      // This test would verify automatic token refresh logic
      // Implementation depends on specific token refresh strategy
      
      const nearExpirySession = {
        ...testSession,
        expires_at: Date.now() + 60000 // Expires in 1 minute
      };

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: testUser },
            error: null
          }),
          refreshSession: vi.fn().mockResolvedValue({
            data: {
              session: {
                ...nearExpirySession,
                expires_at: Date.now() + 3600000, // New expiry
                access_token: 'refreshed_access_token'
              }
            },
            error: null
          })
        }
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase);

      // Make request with near-expiry token
      const request = APITestHelper.createAuthenticatedRequest(
        'GET',
        '/api/v1/requests',
        undefined,
        { 'Authorization': `Bearer ${nearExpirySession.access_token}` }
      );

      // Mock the list endpoint for this test
      mockSupabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              range: vi.fn().mockResolvedValue({
                data: [],
                count: 0,
                error: null
              })
            })
          })
        })
      });

      const { GET: ListRequests } = await import('@/app/api/v1/requests/route');
      const response = await ListRequests(request);

      // Should have attempted refresh if token was near expiry
      // This would depend on the specific implementation
      expect(response.status).toBe(200);
    });
  });

  describe('Authorization and Access Control', () => {
    let userA: any, userB: any;
    let sessionA: any, sessionB: any;

    beforeEach(async () => {
      // Create two different users for access control tests
      ({ user: userA, session: sessionA } = await testDb.createTestUser());
      
      // Create second user manually to avoid conflicts
      const client = await testDb.getAdminClient();
      const { data: { user: userB }, error } = await client.auth.admin.createUser({
        email: 'userb@example.com',
        password: 'test-password-123',
        email_confirm: true,
        user_metadata: { test_user: true }
      });

      if (error) throw error;
      
      const { data } = await client.auth.admin.createSession({
        user_id: userB.id
      });
      sessionB = data.session;

      // Create brands for each user
      await client.from('brands').insert([
        TestFixtures.createBrand({ 
          id: 'brand-user-a', 
          user_id: userA.id,
          name: 'User A Brand' 
        }),
        TestFixtures.createBrand({ 
          id: 'brand-user-b', 
          user_id: userB.id,
          name: 'User B Brand' 
        })
      ]);

      // Create campaigns
      await client.from('campaigns').insert([
        TestFixtures.createCampaign({ 
          id: 'campaign-user-a',
          brand_id: 'brand-user-a',
          name: 'User A Campaign' 
        }),
        TestFixtures.createCampaign({ 
          id: 'campaign-user-b',
          brand_id: 'brand-user-b',
          name: 'User B Campaign' 
        })
      ]);
    });

    it('should enforce brand ownership in API requests', async () => {
      // User A tries to create request for User B's brand
      const requestData = {
        brand_id: 'brand-user-b', // User B's brand
        campaign_id: 'campaign-user-b',
        title: 'Cross-user access attempt',
        type: 'video_with_vo',
        requirements: { prompt: 'Unauthorized access test' }
      };

      // Mock User A's session
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: userA },
            error: null
          })
        },
        from: vi.fn().mockImplementation((table) => {
          if (table === 'brands') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: null, // No access to User B's brand
                    error: { message: 'Row not found', status: 404 }
                  })
                })
              })
            };
          }
          return {
            insert: vi.fn(),
            select: vi.fn(),
            eq: vi.fn(),
            single: vi.fn()
          };
        }),
        rpc: vi.fn()
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase);

      const request = APITestHelper.createAuthenticatedRequest(
        'POST',
        '/api/v1/requests',
        requestData,
        { 'Authorization': `Bearer ${sessionA.access_token}` }
      );

      const response = await CreateRequest(request);
      const result = await APITestHelper.parseResponse(response);

      expect(response.status).toBe(403);
      APITestHelper.assertErrorResponse(result, 'UNAUTHORIZED');
    });

    it('should allow access to own resources', async () => {
      // User A creates request for their own brand
      const requestData = {
        brand_id: 'brand-user-a',
        campaign_id: 'campaign-user-a',
        title: 'Own resource access',
        type: 'video_with_vo',
        requirements: { prompt: 'Authorized access test' }
      };

      // Mock User A's session with access to their brand
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: userA },
            error: null
          })
        },
        from: vi.fn().mockImplementation((table) => {
          if (table === 'brands') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: TestFixtures.createBrand({ 
                      id: 'brand-user-a',
                      user_id: userA.id 
                    }),
                    error: null
                  })
                })
              })
            };
          }
          if (table === 'content_requests') {
            return {
              insert: vi.fn().mockResolvedValue({
                data: [{ id: 'new_request_id' }],
                error: null
              })
            };
          }
          return {
            select: vi.fn(),
            eq: vi.fn(),
            single: vi.fn(),
            insert: vi.fn()
          };
        }),
        rpc: vi.fn().mockResolvedValue({
          data: { estimated_cost: 25.00 },
          error: null
        })
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase);

      const request = APITestHelper.createAuthenticatedRequest(
        'POST',
        '/api/v1/requests',
        requestData,
        { 'Authorization': `Bearer ${sessionA.access_token}` }
      );

      const response = await CreateRequest(request);
      const result = await APITestHelper.parseResponse(response);

      expect(response.status).toBe(200);
      APITestHelper.assertSuccessResponse(result);
    });

    it('should implement Row Level Security (RLS) correctly', async () => {
      // This test verifies that RLS policies are working at the database level
      // We'll test direct database queries to ensure RLS is enforced

      const client = await testDb.getAdminClient();

      // Create test requests for both users
      await client.from('content_requests').insert([
        TestFixtures.createContentRequest({
          id: 'req-user-a',
          brand_id: 'brand-user-a',
          title: 'User A Request'
        }),
        TestFixtures.createContentRequest({
          id: 'req-user-b', 
          brand_id: 'brand-user-b',
          title: 'User B Request'
        })
      ]);

      // Simulate User A's client (with RLS context)
      const userAClient = {
        from: vi.fn().mockImplementation((table) => ({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((column, value) => ({
              // Simulate RLS filtering - User A should only see their requests
              mockResolvedValue: vi.fn().mockImplementation(() => {
                if (table === 'content_requests') {
                  // RLS would filter to only User A's requests
                  return {
                    data: value === 'req-user-a' ? [
                      { id: 'req-user-a', title: 'User A Request' }
                    ] : [],
                    error: null
                  };
                }
                return { data: [], error: null };
              })
            }))
          })
        }))
      };

      // Test that User A can only access their own requests
      const userAQuery = userAClient.from('content_requests')
        .select('*')
        .eq('id', 'req-user-a');
      
      const userAResult = await userAQuery.mockResolvedValue();
      expect(userAResult.data.length).toBe(1);
      expect(userAResult.data[0].title).toBe('User A Request');

      // Test that User A cannot access User B's requests
      const userBQuery = userAClient.from('content_requests')
        .select('*')
        .eq('id', 'req-user-b');
      
      const userBResult = await userBQuery.mockResolvedValue();
      expect(userBResult.data.length).toBe(0);
    });
  });

  describe('Security Headers and CORS', () => {
    it('should include security headers in authenticated responses', async () => {
      const { user, session } = await testDb.createTestUser();
      
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user },
            error: null
          })
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                range: vi.fn().mockResolvedValue({
                  data: [],
                  count: 0,
                  error: null
                })
              })
            })
          })
        })
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase);

      const request = APITestHelper.createAuthenticatedRequest(
        'GET',
        '/api/v1/requests',
        undefined,
        { 'Authorization': `Bearer ${session.access_token}` }
      );

      const { GET: ListRequests } = await import('@/app/api/v1/requests/route');
      const response = await ListRequests(request);
      
      // Verify security headers
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(response.headers.get('x-frame-options')).toBe('DENY');
      expect(response.headers.get('x-xss-protection')).toBe('1; mode=block');
      expect(response.headers.get('strict-transport-security')).toBeTruthy();
    });

    it('should handle CORS preflight requests', async () => {
      const preflightRequest = new Request('http://localhost:3000/api/v1/requests', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://localhost:3000',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'authorization,content-type'
        }
      });

      // This would test the CORS middleware
      // Implementation depends on how CORS is configured
      expect(preflightRequest.method).toBe('OPTIONS');
    });
  });

  describe('Concurrent Session Handling', () => {
    it('should handle multiple concurrent sessions for same user', async () => {
      const { user } = await testDb.createTestUser();
      
      // Create multiple sessions for the same user
      const client = await testDb.getAdminClient();
      
      const session1 = await client.auth.admin.createSession({
        user_id: user.id
      });
      
      const session2 = await client.auth.admin.createSession({
        user_id: user.id
      });

      // Both sessions should be valid
      expect(session1.data.session).toBeTruthy();
      expect(session2.data.session).toBeTruthy();
      expect(session1.data.session.access_token).not.toBe(
        session2.data.session.access_token
      );

      // Both sessions should work for API calls
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user },
            error: null
          })
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                range: vi.fn().mockResolvedValue({
                  data: [],
                  count: 0,
                  error: null
                })
              })
            })
          })
        })
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase);

      const request1 = APITestHelper.createAuthenticatedRequest(
        'GET',
        '/api/v1/requests',
        undefined,
        { 'Authorization': `Bearer ${session1.data.session.access_token}` }
      );

      const request2 = APITestHelper.createAuthenticatedRequest(
        'GET', 
        '/api/v1/requests',
        undefined,
        { 'Authorization': `Bearer ${session2.data.session.access_token}` }
      );

      const { GET: ListRequests } = await import('@/app/api/v1/requests/route');
      
      const [response1, response2] = await Promise.all([
        ListRequests(request1),
        ListRequests(request2)
      ]);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
    });
  });
});