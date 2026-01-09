/**
 * Test Environment Configuration
 * 
 * Configures the testing environment with proper mocks and overrides
 */

import { beforeAll, afterAll, vi } from 'vitest';
import { setupIntegrationTests, teardownIntegrationTests, TestDatabase, MockN8NClient } from './test-helpers';

// Set up test environment variables
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-key';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-anon-key';
process.env.UPSTASH_REDIS_REST_URL = 'redis://localhost:6379';
process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

// Global test database instance
let testDatabase: TestDatabase;

// Setup before all tests
beforeAll(async () => {
  testDatabase = await setupIntegrationTests();
  
// Mock N8N Client
  vi.mock('@/lib/n8n/client', () => ({
    getN8NClient: () => MockN8NClient.getInstance(),
    N8NClient: MockN8NClient,
  }));

  // Mock Supabase at the import level with per-test override support
  vi.mock('@supabase/supabase-js', () => {
    // In-memory state tracking for mock database
    const mockState = {
      campaigns: new Map(),
      brands: new Map(),
      users: new Map(),
      content_requests: new Map(),
      generation_jobs: new Map(),
      request_events: new Map()
    };

    // Helper to get or create records for any table
    const getRecord = (table, id, defaults = {}) => {
      if (!mockState[table]) mockState[table] = new Map();
      if (!mockState[table].has(id)) {
        const record = {
          id: id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...defaults
        };
        mockState[table].set(id, record);
      }
      return mockState[table].get(id);
    };

    // Helper for campaigns with specific defaults
    const getCampaign = (id) => getRecord('campaigns', id, {
      budget_used: 0,
      budget_reserved: 0,
      budget_limit_usd: 100,
      name: 'Mock Campaign',
      status: 'active'
    });

    // Helper for content requests
    const getContentRequest = (id) => getRecord('content_requests', id, {
      status: 'intake',
      title: 'Mock Request',
      brief: { description: 'Mock brief' }
    });

    // Helper for generation jobs (videos)
    const getGenerationJob = (id) => getRecord('generation_jobs', id, {
      status: 'pending',
      approval_status: 'pending',
      job_type: 'video'
    });

    // Mock query builder that supports chaining AND promises
    class MockQueryBuilder {
      constructor(table, initialData = null) {
        this.table = table;
        this.data = initialData;
        this.filters = [];
        this.updateData = null;
        this.insertData = null;
        this.isDelete = false;
        this.selectColumns = '*';
        this.orderBy = null;
        this.limitCount = null;
        this.offsetCount = null;
        this.rangeFrom = null;
        this.rangeTo = null;
        
        // Make this object thenable so it can be awaited directly
        this.then = (onFulfilled, onRejected) => {
          return this._execute().then(onFulfilled, onRejected);
        };
        
        this.catch = (onRejected) => {
          return this._execute().catch(onRejected);
        };
        
        this.finally = (onFinally) => {
          return this._execute().finally(onFinally);
        };
      }

      eq(column, value) {
        this.filters.push({ column, value, operator: 'eq' });
        return this;
      }

      neq(column, value) {
        this.filters.push({ column, value, operator: 'neq' });
        return this;
      }

      gt(column, value) {
        this.filters.push({ column, value, operator: 'gt' });
        return this;
      }

      gte(column, value) {
        this.filters.push({ column, value, operator: 'gte' });
        return this;
      }

      lt(column, value) {
        this.filters.push({ column, value, operator: 'lt' });
        return this;
      }

      lte(column, value) {
        this.filters.push({ column, value, operator: 'lte' });
        return this;
      }

      like(column, pattern) {
        this.filters.push({ column, pattern, operator: 'like' });
        return this;
      }

      in(column, values) {
        this.filters.push({ column, values, operator: 'in' });
        return this;
      }

      not(column, operator, value) {
        this.filters.push({ column, value, operator: 'not', subOperator: operator });
        return this;
      }

      is(column, value) {
        this.filters.push({ column, value, operator: 'is' });
        return this;
      }

      limit(count) {
        this.limitCount = count;
        return this;
      }

      offset(count) {
        this.offsetCount = count;
        return this;
      }

      range(from, to) {
        this.rangeFrom = from;
        this.rangeTo = to;
        return this;
      }

      select(columns = '*') {
        this.selectColumns = columns;
        return this;
      }

      update(data) {
        this.updateData = data;
        return this;
      }

      insert(data) {
        this.insertData = data;
        return this;
      }

      delete() {
        // Mark this as a delete operation
        this.isDelete = true;
        return this;
      }

      single() {
        return this._execute();
      }

      order(column, options) {
        this.orderBy = { column, ...options };
        return this;
      }

      async _execute() {
        if (this.insertData) {
          return this._handleInsert();
        }
        if (this.updateData) {
          return this._handleUpdate();
        }
        if (this.isDelete) {
          return this._handleDelete();
        }
        if (this.filters.some(f => f.operator === 'like')) {
          return this._handleDelete();
        }
        return this._handleSelect();
      }

      _handleInsert() {
        if (!mockState[this.table]) mockState[this.table] = new Map();
        
        // Handle both single records and arrays
        const recordsToInsert = Array.isArray(this.insertData) ? this.insertData : [this.insertData];
        const insertedRecords = [];
        
        for (const recordData of recordsToInsert) {
          const id = recordData.id || `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const record = { 
            ...recordData, 
            id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          mockState[this.table].set(id, record);
          insertedRecords.push(record);
        }
        
        // Return single record or array based on input
        const resultData = Array.isArray(this.insertData) ? insertedRecords : insertedRecords[0];
        
        return Promise.resolve({
          data: resultData,
          error: null
        });
      }

      _handleUpdate() {
        // Find record by filters (usually by id)
        const idFilter = this.filters.find(f => f.column === 'id');
        if (!idFilter) {
          return Promise.resolve({ error: new Error('Update requires ID filter') });
        }

        let record;
        switch (this.table) {
          case 'campaigns':
            record = getCampaign(idFilter.value);
            break;
          case 'content_requests':
            record = getContentRequest(idFilter.value);
            break;
          case 'generation_jobs':
            record = getGenerationJob(idFilter.value);
            break;
          default:
            record = getRecord(this.table, idFilter.value);
        }

        // Apply updates
        Object.assign(record, this.updateData, {
          updated_at: new Date().toISOString()
        });

        return Promise.resolve({
          data: record,
          error: null
        });
      }

      _handleSelect() {
        // Handle different select scenarios
        const idFilter = this.filters.find(f => f.column === 'id');
        
        if (idFilter) {
          // Single record select
          let record;
          switch (this.table) {
            case 'campaigns':
              record = getCampaign(idFilter.value);
              break;
            case 'content_requests':
              record = getContentRequest(idFilter.value);
              break;
            case 'generation_jobs':
              record = getGenerationJob(idFilter.value);
              break;
            default:
              record = getRecord(this.table, idFilter.value);
          }
          
          return Promise.resolve({
            data: record,
            error: null
          });
        } else {
          // Multi-record select (for request_events, etc.)
          if (!mockState[this.table]) {
            mockState[this.table] = new Map();
          }
          
          const allRecords = Array.from(mockState[this.table].values());
          let filteredRecords = allRecords;

          // Apply filters
          for (const filter of this.filters) {
            switch (filter.operator) {
              case 'eq':
                filteredRecords = filteredRecords.filter(record => 
                  record[filter.column] === filter.value
                );
                break;
              case 'neq':
                filteredRecords = filteredRecords.filter(record => 
                  record[filter.column] !== filter.value
                );
                break;
              case 'gt':
                filteredRecords = filteredRecords.filter(record => 
                  record[filter.column] > filter.value
                );
                break;
              case 'gte':
                filteredRecords = filteredRecords.filter(record => 
                  record[filter.column] >= filter.value
                );
                break;
              case 'lt':
                filteredRecords = filteredRecords.filter(record => 
                  record[filter.column] < filter.value
                );
                break;
              case 'lte':
                filteredRecords = filteredRecords.filter(record => 
                  record[filter.column] <= filter.value
                );
                break;
              case 'like':
                filteredRecords = filteredRecords.filter(record => {
                  const pattern = filter.pattern.replace(/%/g, '.*');
                  const regex = new RegExp('^' + pattern + '$', 'i');
                  return regex.test(String(record[filter.column] || ''));
                });
                break;
              case 'in':
                filteredRecords = filteredRecords.filter(record => 
                  filter.values.includes(record[filter.column])
                );
                break;
              case 'not':
                if (filter.subOperator === 'is') {
                  filteredRecords = filteredRecords.filter(record => 
                    record[filter.column] !== null && record[filter.column] !== filter.value
                  );
                }
                break;
              case 'is':
                filteredRecords = filteredRecords.filter(record => {
                  if (filter.value === null) {
                    return record[filter.column] === null || record[filter.column] === undefined;
                  }
                  return record[filter.column] === filter.value;
                });
                break;
            }
          }

          // Apply ordering
          if (this.orderBy) {
            filteredRecords.sort((a, b) => {
              const aVal = a[this.orderBy.column];
              const bVal = b[this.orderBy.column];
              const ascending = this.orderBy.ascending !== false; // Default to ascending
              
              if (aVal < bVal) return ascending ? -1 : 1;
              if (aVal > bVal) return ascending ? 1 : -1;
              return 0;
            });
          }

          // Apply pagination
          if (this.offsetCount !== null) {
            filteredRecords = filteredRecords.slice(this.offsetCount);
          }
          if (this.limitCount !== null) {
            filteredRecords = filteredRecords.slice(0, this.limitCount);
          }
          if (this.rangeFrom !== null && this.rangeTo !== null) {
            filteredRecords = filteredRecords.slice(this.rangeFrom, this.rangeTo + 1);
          }

          return Promise.resolve({
            data: filteredRecords,
            error: null
          });
        }
      }

      _handleDelete() {
        // Handle actual delete operations
        if (!mockState[this.table]) {
          return Promise.resolve({ data: [], error: null });
        }

        const tableMap = mockState[this.table];
        let deletedRecords = [];
        
        // Apply filters and delete matching records
        for (const [key, record] of tableMap.entries()) {
          let matches = true;
          for (const filter of this.filters) {
            if (filter.operator === 'eq' && record[filter.column] !== filter.value) {
              matches = false;
              break;
            } else if (filter.operator === 'like') {
              // Handle LIKE pattern matching (primarily for cleanup)
              const pattern = filter.pattern.replace(/%/g, '.*');
              const regex = new RegExp('^' + pattern + '$');
              if (!regex.test(String(record[filter.column] || ''))) {
                matches = false;
                break;
              }
            }
          }
          if (matches) {
            deletedRecords.push(record);
            tableMap.delete(key);
          }
        }
        
        return Promise.resolve({ data: deletedRecords, error: null });
      }
    }

    return {
      createClient: vi.fn(() => ({
        auth: {
          admin: {
            createUser: vi.fn().mockResolvedValue({
              data: { 
                user: { 
                  id: 'mock-user-id', 
                  email: 'test@example.com' 
                } 
              },
              error: null
            }),
            deleteUser: vi.fn().mockResolvedValue({ error: null }),
            listUsers: vi.fn().mockResolvedValue({
              data: { users: [] },
              error: null
            }),
            createSession: vi.fn().mockResolvedValue({
              data: {
                session: {
                  access_token: 'mock-session-token',
                  user: { id: 'mock-user-id', email: 'test@example.com' }
                }
              },
              error: null
            })
          },
          signInWithPassword: vi.fn().mockResolvedValue({
            data: {
              user: { id: 'mock-user-id', email: 'test@example.com' },
              session: { access_token: 'mock-token' }
            },
            error: null
          }),
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'mock-user-id', email: 'test@example.com' } },
            error: null
          })
        },
        from: vi.fn((table) => new MockQueryBuilder(table)),
        rpc: vi.fn().mockImplementation((functionName, params) => {
          // Mock different RPC functions with stateful logic
          switch (functionName) {
            case 'reserve_budget':
              const campaignId = params?.p_campaign_id;
              const amount = params?.p_amount || 0;
              const campaign = getCampaign(campaignId);
              
              // Check if reservation would exceed budget
              const totalAfterReservation = campaign.budget_used + campaign.budget_reserved + amount;
              const shouldSucceed = totalAfterReservation <= campaign.budget_limit_usd;
              
              if (shouldSucceed) {
                campaign.budget_reserved += amount;
                return Promise.resolve({
                  data: [{ success: true, reserved: amount }],
                  error: null
                });
              } else {
                return Promise.resolve({
                  data: [],
                  error: { message: 'Budget exceeded' }
                });
              }
              
            case 'refund_budget':
              const refundCampaignId = params?.p_campaign_id;
              const refundAmount = params?.p_amount || 0;
              const refundCampaign = getCampaign(refundCampaignId);
              
              refundCampaign.budget_reserved = Math.max(0, refundCampaign.budget_reserved - refundAmount);
              return Promise.resolve({
                data: [{ success: true, refunded: refundAmount }],
                error: null
              });
              
            case 'update_actual_cost':
              const costCampaignId = params?.p_campaign_id;
              const reserved = params?.p_reserved || 0;
              const actual = params?.p_actual || 0;
              const costCampaign = getCampaign(costCampaignId);
              
              // Convert reserved to used
              costCampaign.budget_reserved = Math.max(0, costCampaign.budget_reserved - reserved);
              costCampaign.budget_used += actual;
              
              return Promise.resolve({
                data: [{ success: true, actual_cost: actual }],
                error: null
              });
              
            case 'get_available_budget':
              return Promise.resolve({
                data: { available_budget: 100.00 },
                error: null
              });
              
            default:
              return Promise.resolve({
                data: { estimated_cost: 25.00 },
                error: null
              });
          }
        })
      }))
    };
  });

  // Mock Supabase server-side client to support per-test overrides
  vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn().mockResolvedValue({
      // Default mock implementation - tests can override this
      auth: {
        admin: {
          createUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'mock-user-id', email: 'test@example.com' } },
            error: null
          }),
          deleteUser: vi.fn().mockResolvedValue({ error: null }),
          listUsers: vi.fn().mockResolvedValue({ data: { users: [] }, error: null }),
          createSession: vi.fn().mockResolvedValue({
            data: { session: { access_token: 'mock-session-token' } },
            error: null
          })
        },
        signInWithOtp: vi.fn().mockResolvedValue({
          data: { user: null, session: null },
          error: null
        }),
        signInWithPassword: vi.fn().mockResolvedValue({
          data: {
            user: { id: 'mock-user-id', email: 'test@example.com' },
            session: { access_token: 'mock-token' }
          },
          error: null
        }),
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'mock-user-id', email: 'test@example.com' } },
          error: null
        })
      },
      from: vi.fn((table) => new MockQueryBuilder(table)),
      rpc: vi.fn().mockImplementation((functionName, params) => {
        // Mock RPC functions
        switch (functionName) {
          case 'reserve_budget':
          case 'refund_budget':
          case 'update_actual_cost':
            return Promise.resolve({ data: [{ success: true }], error: null });
          default:
            return Promise.resolve({ data: { estimated_cost: 25.00 }, error: null });
        }
      })
    })
  }));

  // Mock external services
  vi.mock('@/lib/llm', () => ({
    getLLMService: () => ({
      generateText: vi.fn().mockResolvedValue('Mock LLM response'),
      generateImage: vi.fn().mockResolvedValue('http://mock-image-url.com/image.jpg'),
      generateVideo: vi.fn().mockResolvedValue('http://mock-video-url.com/video.mp4'),
    }),
  }));

  // Mock Upstash Redis and Ratelimit for rate limiting
  vi.mock('@upstash/redis', () => ({
    Redis: {
      fromEnv: vi.fn(() => ({
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue('OK'),
        incr: vi.fn().mockResolvedValue(1),
        expire: vi.fn().mockResolvedValue(1),
        del: vi.fn().mockResolvedValue(1),
        exists: vi.fn().mockResolvedValue(0),
        hget: vi.fn().mockResolvedValue(null),
        hset: vi.fn().mockResolvedValue(1),
        hdel: vi.fn().mockResolvedValue(1)
      }))
    }
  }));

  vi.mock('@upstash/ratelimit', () => {
    // Create proper constructor function
    function MockRatelimit(config) {
      this.limit = vi.fn().mockResolvedValue({ 
        success: true, 
        limit: config?.limiter?.count || 10, 
        remaining: (config?.limiter?.count || 10) - 1, 
        reset: Date.now() + 60000 
      });
      this.reset = vi.fn().mockResolvedValue(undefined);
    }

    // Add static methods that return MockRatelimit instances (not config objects!)
    MockRatelimit.slidingWindow = vi.fn((count, window) => {
      return new MockRatelimit({ limiter: { count, window, type: 'sliding-window' } });
    });
    
    MockRatelimit.fixedWindow = vi.fn((count, window) => {
      return new MockRatelimit({ limiter: { count, window, type: 'fixed-window' } });
    });

    return {
      Ratelimit: MockRatelimit
    };
  });

  // Mock Sentry
  vi.mock('@sentry/nextjs', () => ({
    captureException: vi.fn(),
    captureMessage: vi.fn(),
    setTag: vi.fn(),
    setUser: vi.fn(),
    setContext: vi.fn(),
  }));

  // Mock logger to prevent console spam during tests
  vi.mock('@/lib/monitoring/logger', () => ({
    logger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
  }));

  console.log('Integration test environment initialized');
});

// Cleanup after all tests
afterAll(async () => {
  if (testDatabase) {
    await teardownIntegrationTests(testDatabase);
    console.log('Integration test environment cleaned up');
  }
  
  vi.restoreAllMocks();
});

export { testDatabase };