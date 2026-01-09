/**
 * Test Utilities and Fixtures for Integration Tests
 * 
 * This module provides comprehensive utilities for testing critical paths
 * including API routes, authentication, database operations, and workflows.
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import type { SupabaseClient } from '@supabase/supabase-js';

// Test Configuration
export const TEST_CONFIG = {
  TEST_USER_ID: 'test-user-integration',
  TEST_ORG_ID: 'test-org-integration',
  TEST_BRAND_ID: 'test-brand-integration',
  TEST_CAMPAIGN_ID: 'test-campaign-integration',
  API_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
  CLEANUP_TIMEOUT: 30000, // 30 seconds for cleanup operations
};

// Database connection managers
export class TestDatabase {
  private adminClient?: SupabaseClient;
  private serverClient?: SupabaseClient;

  async getAdminClient(): Promise<SupabaseClient> {
    if (!this.adminClient) {
      this.adminClient = createAdminClient();
    }
    return this.adminClient;
  }

  async getServerClient(): Promise<SupabaseClient> {
    if (!this.serverClient) {
      this.serverClient = await createClient();
    }
    return this.serverClient;
  }

  /**
   * Clean up all test data from the database
   */
  async cleanup(): Promise<void> {
    // Skip cleanup in mock test environment
    if (process.env.SUPABASE_URL?.includes('test.supabase.co')) {
      return;
    }

    const client = await this.getAdminClient();
    
    // Clean up in reverse dependency order
    const tables = [
      'request_events',
      'request_tasks', 
      'budget_reservations',
      'cost_ledger',
      'idempotency_keys',
      'content_requests',
      'creative_briefs',
      'videos',
      'scripts',
      'campaigns',
      'brand_assets',
      'brands',
    ];

    for (const table of tables) {
      const { error } = await client
        .from(table)
        .delete()
        .like('id', `${TEST_CONFIG.TEST_ORG_ID}%`);
      
      if (error && !error.message?.includes('relation') && !error.message?.includes('does not exist')) {
        console.warn(`Cleanup warning for ${table}:`, error.message);
      }
    }

    // Clean up auth users if any test users exist
    try {
      if (process.env.NODE_ENV === 'test' && 
          !process.env.SUPABASE_URL?.includes('test.supabase.co')) {
        const { data: users } = await client.auth.admin.listUsers();
        for (const user of users?.users || []) {
          if (user.id.includes('test-user')) {
            await client.auth.admin.deleteUser(user.id);
          }
        }
      }
    } catch (error) {
      // Skip auth cleanup errors in test environment
      console.warn('Auth cleanup skipped:', error.message);
    }
  }

  /**
   * Create test user with session
   */
  async createTestUser(): Promise<{ user: any; session: any }> {
    const client = await this.getAdminClient();
    
    const { data: { user }, error: userError } = await client.auth.admin.createUser({
      email: 'test@example.com',
      password: 'test-password-123',
      email_confirm: true,
      user_metadata: {
        test_user: true
      }
    });

    if (userError) throw userError;

    // Create session for the user using signInWithPassword
    const { data, error: sessionError } = await client.auth.signInWithPassword({
      email: 'test@example.com',
      password: 'test-password-123'
    });

    if (sessionError) throw sessionError;

    return { user, session: data.session };
  }
}

// Test data fixtures
export class TestFixtures {
  /**
   * Create a complete test brand with assets
   */
  static createBrand(overrides: Partial<any> = {}) {
    return {
      id: TEST_CONFIG.TEST_BRAND_ID,
      user_id: TEST_CONFIG.TEST_USER_ID,
      name: 'Test Brand',
      tagline: 'Test brand tagline',
      tone_style: 'professional',
      target_audience: 'business professionals',
      brand_voice: 'authoritative yet approachable',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides,
    };
  }

  /**
   * Create a test campaign
   */
  static createCampaign(overrides: Partial<any> = {}) {
    return {
      id: TEST_CONFIG.TEST_CAMPAIGN_ID,
      brand_id: TEST_CONFIG.TEST_BRAND_ID,
      name: 'Test Campaign',
      description: 'Test campaign description',
      status: 'active',
      budget_limit: 1000.00,
      budget_spent: 0.00,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides,
    };
  }

  /**
   * Create a test content request
   */
  static createContentRequest(overrides: Partial<any> = {}) {
    return {
      id: `${TEST_CONFIG.TEST_ORG_ID}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      brand_id: TEST_CONFIG.TEST_BRAND_ID,
      campaign_id: TEST_CONFIG.TEST_CAMPAIGN_ID,
      title: 'Test Video Request',
      type: 'video_with_vo',
      status: 'intake',
      requirements: {
        prompt: 'Create a promotional video for our new product launch',
        duration: 30,
        aspect_ratio: '16:9',
        style_preset: 'Cinematic',
        shot_type: 'Medium',
        voice_id: 'test-voice-id'
      },
      settings: {
        provider: 'openai',
        tier: 'standard',
        auto_script: true,
        selected_kb_ids: [],
        selected_asset_ids: []
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides,
    };
  }

  /**
   * Create test tasks for a request
   */
  static createRequestTasks(requestId: string) {
    return [
      {
        id: `${requestId}-executive`,
        request_id: requestId,
        agent_role: 'executive',
        task_name: 'Intent Parsing & Validation',
        status: 'pending',
        sequence_order: 1,
        depends_on: [],
        estimated_duration_seconds: 5,
        is_async: false,
        created_at: new Date().toISOString(),
      },
      {
        id: `${requestId}-strategist`,
        request_id: requestId,
        agent_role: 'strategist',
        task_name: 'Strategic Brief Generation',
        status: 'pending',
        sequence_order: 2,
        depends_on: ['executive'],
        estimated_duration_seconds: 30,
        is_async: false,
        created_at: new Date().toISOString(),
      },
      {
        id: `${requestId}-copywriter`,
        request_id: requestId,
        agent_role: 'copywriter',
        task_name: 'Script Generation',
        status: 'pending',
        sequence_order: 3,
        depends_on: ['strategist'],
        estimated_duration_seconds: 60,
        is_async: true,
        created_at: new Date().toISOString(),
      },
    ];
  }
}

// API Test Helpers
export class APITestHelper {
  /**
   * Create a mock NextRequest with authentication headers
   */
  static createAuthenticatedRequest(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    body?: any,
    headers: Record<string, string> = {}
  ): NextRequest {
    // Ensure absolute URL for NextRequest compatibility
    const absoluteUrl = url.startsWith('http') ? url : `http://localhost:3000${url}`;
    
    const request = new NextRequest(absoluteUrl, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-session-token',
        ...headers,
      },
      ...(body && { body: JSON.stringify(body) }),
    });

    return request;
  }

  /**
   * Create an unauthenticated request
   */
  static createUnauthenticatedRequest(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    body?: any,
    headers: Record<string, string> = {}
  ): NextRequest {
    // Ensure absolute URL for NextRequest compatibility
    const absoluteUrl = url.startsWith('http') ? url : `http://localhost:3000${url}`;
    
    const request = new NextRequest(absoluteUrl, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      ...(body && { body: JSON.stringify(body, (key, value) => {
        // Handle circular references by replacing them with placeholder
        if (typeof value === 'object' && value !== null) {
          if (value.circular_ref) {
            return '[Circular Reference]';
          }
        }
        return value;
      }) }),
    });

    return request;
  }

  /**
   * Parse NextResponse for testing
   */
  static async parseResponse(response: Response): Promise<{
    status: number;
    data: any;
    headers: Record<string, string>;
  }> {
    let data;
    try {
      data = await response.json();
    } catch {
      data = await response.text();
    }

    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    return {
      status: response.status,
      data,
      headers,
    };
  }

  /**
   * Assert successful response format
   */
  static assertSuccessResponse(response: any, expectedKeys: string[] = []) {
    // response has structure: { status, data: { success, data, meta }, headers }
    // We need to check response.data.success
    expect(response.data).toHaveProperty('success', true);
    expect(response.data).toHaveProperty('data');
    
    if (expectedKeys.length > 0) {
      expectedKeys.forEach(key => {
        expect(response.data.data).toHaveProperty(key);
      });
    }
  }

  /**
   * Assert error response format
   */
  static assertErrorResponse(response: any, expectedCode?: string) {
    // response has structure: { status, data: { success, error, meta }, headers }
    expect(response.data).toHaveProperty('success', false);
    expect(response.data).toHaveProperty('error');
    expect(response.data.error).toHaveProperty('code');
    expect(response.data.error).toHaveProperty('message');
    
    if (expectedCode) {
      expect(response.data.error.code).toBe(expectedCode);
    }
  }
}

// Mock N8N Client for testing
export class MockN8NClient {
  private static instance?: MockN8NClient;
  public triggerCalls: Array<{ 
    method: string; 
    params: any; 
    timestamp: Date 
  }> = [];

  static getInstance(): MockN8NClient {
    if (!this.instance) {
      this.instance = new MockN8NClient();
    }
    return this.instance;
  }

  isConfigured(): boolean {
    return true;
  }

  async triggerContentGeneration(params: any): Promise<{ execution_id: string; webhook_url: string }> {
    this.triggerCalls.push({
      method: 'triggerContentGeneration',
      params,
      timestamp: new Date(),
    });

    return {
      execution_id: `mock_exec_${Date.now()}`,
      webhook_url: 'http://mock-n8n.local/webhook/content',
    };
  }

  async triggerVideoProduction(params: any): Promise<{ execution_id: string; webhook_url: string }> {
    this.triggerCalls.push({
      method: 'triggerVideoProduction',
      params,
      timestamp: new Date(),
    });

    return {
      execution_id: `mock_exec_${Date.now()}`,
      webhook_url: 'http://mock-n8n.local/webhook/video',
    };
  }

  reset(): void {
    this.triggerCalls = [];
  }
}

// Global test setup and teardown
export async function setupIntegrationTests() {
  const db = new TestDatabase();
  await db.cleanup();
  
  // Set up test environment variables
  process.env.NODE_ENV = 'test';
  process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  return db;
}

export async function teardownIntegrationTests(db: TestDatabase) {
  await db.cleanup();
}

// Matchers for better test assertions
export const testMatchers = {
  toHaveValidUUID: (received: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return {
      message: () => `expected ${received} to be a valid UUID`,
      pass: uuidRegex.test(received),
    };
  },
  
  toHaveValidTimestamp: (received: string) => {
    const date = new Date(received);
    return {
      message: () => `expected ${received} to be a valid ISO timestamp`,
      pass: !isNaN(date.getTime()) && received === date.toISOString(),
    };
  },
  
  toMatchAPIErrorFormat: (received: any) => {
    const hasRequiredFields = received && 
      received.success === false &&
      received.error &&
      typeof received.error.code === 'string' &&
      typeof received.error.message === 'string';
      
    return {
      message: () => `expected response to match API error format`,
      pass: hasRequiredFields,
    };
  }
};