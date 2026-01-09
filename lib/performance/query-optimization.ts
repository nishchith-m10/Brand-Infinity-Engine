// =============================================================================
// QUERY OPTIMIZATION UTILITIES
// Helpers for optimizing database queries and API responses
// =============================================================================

/**
 * Default pagination limits to prevent unbounded queries
 */
export const PAGINATION_DEFAULTS = {
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 500,
  DEFAULT_OFFSET: 0,
} as const;

/**
 * Cache durations for different types of data (in seconds)
 */
export const CACHE_DURATIONS = {
  // Static or rarely changing data
  STATIC: 3600, // 1 hour
  PLATFORMS: 3600, // 1 hour
  BRAND_GUIDELINES: 1800, // 30 minutes

  // Semi-static data
  CAMPAIGNS: 300, // 5 minutes
  SCRIPTS: 300, // 5 minutes
  VIDEOS: 180, // 3 minutes

  // Dynamic data
  DASHBOARD_STATS: 60, // 1 minute
  METRICS: 30, // 30 seconds
  LIVE_STATUS: 10, // 10 seconds

  // No cache
  USER_DATA: 0,
  REAL_TIME: 0,
} as const;

/**
 * Validate and normalize pagination parameters
 */
export function normalizePagination(params?: {
  limit?: number;
  offset?: number;
}): { limit: number; offset: number } {
  const limit = Math.min(
    params?.limit || PAGINATION_DEFAULTS.DEFAULT_LIMIT,
    PAGINATION_DEFAULTS.MAX_LIMIT
  );

  const offset = Math.max(params?.offset || PAGINATION_DEFAULTS.DEFAULT_OFFSET, 0);

  return { limit, offset };
}

/**
 * Create pagination metadata for API responses
 */
export function createPaginationMeta(
  total: number,
  limit: number,
  offset: number
): {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
  next_offset: number | null;
} {
  const hasMore = offset + limit < total;
  const nextOffset = hasMore ? offset + limit : null;

  return {
    total,
    limit,
    offset,
    has_more: hasMore,
    next_offset: nextOffset,
  };
}

/**
 * Generate Next.js cache headers for API routes
 */
export function getCacheHeaders(
  duration: number,
  options: {
    staleWhileRevalidate?: number;
    mustRevalidate?: boolean;
    private?: boolean;
  } = {}
): Record<string, string> {
  const {
    staleWhileRevalidate = duration * 2,
    mustRevalidate = false,
    private: isPrivate = true,
  } = options;

  if (duration === 0) {
    return {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    };
  }

  const cacheControl = [
    isPrivate ? 'private' : 'public',
    `max-age=${duration}`,
    `s-maxage=${duration}`,
    `stale-while-revalidate=${staleWhileRevalidate}`,
  ];

  if (mustRevalidate) {
    cacheControl.push('must-revalidate');
  }

  return {
    'Cache-Control': cacheControl.join(', '),
  };
}

/**
 * Optimized query builder helpers
 */
export class QueryOptimizer {
  /**
   * Add standard filters for user-scoped queries
   */
  static userScope(query: any, userId: string, includeDeleted = false) {
    let q = query.eq('user_id', userId);

    if (!includeDeleted) {
      q = q.is('deleted_at', null);
    }

    return q;
  }

  /**
   * Add standard ordering for time-based queries
   */
  static timeOrdered(query: any, column = 'created_at', ascending = false) {
    return query.order(column, { ascending });
  }

  /**
   * Add pagination with limits
   */
  static paginated(query: any, limit: number, offset: number) {
    return query.range(offset, offset + limit - 1);
  }

  /**
   * Build optimized list query with common patterns
   */
  static buildListQuery(
    query: any,
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      orderBy?: string;
      ascending?: boolean;
      includeDeleted?: boolean;
      status?: string;
    } = {}
  ) {
    const { limit, offset } = normalizePagination(options);

    let q = this.userScope(query, userId, options.includeDeleted);

    if (options.status) {
      q = q.eq('status', options.status);
    }

    q = this.timeOrdered(q, options.orderBy, options.ascending);
    q = this.paginated(q, limit, offset);

    return q;
  }
}

/**
 * Batch query executor to prevent N+1 queries
 */
export class BatchLoader<K, V> {
  private batches: Map<string, Promise<Map<K, V>>> = new Map();
  private batchTimeout = 10; // ms

  constructor(
    private loadFn: (keys: K[]) => Promise<Map<K, V>>,
    private keySerializer: (key: K) => string = (k) => String(k)
  ) {}

  async load(key: K): Promise<V | undefined> {
    const batchKey = this.getCurrentBatchKey();

    if (!this.batches.has(batchKey)) {
      const batch = new Map<K, V>();
      const batchKeys: K[] = [];

      // Create a promise that resolves after batching timeout
      const promise = new Promise<Map<K, V>>((resolve) => {
        setTimeout(async () => {
          const results = await this.loadFn(batchKeys);
          resolve(results);
        }, this.batchTimeout);
      });

      this.batches.set(batchKey, promise);

      // Add this key to the batch
      batchKeys.push(key);

      // Wait for batch to complete
      const results = await promise;
      this.batches.delete(batchKey);

      return results.get(key);
    }

    // Wait for existing batch
    const results = await this.batches.get(batchKey)!;
    return results.get(key);
  }

  async loadMany(keys: K[]): Promise<Map<K, V>> {
    return this.loadFn(keys);
  }

  private getCurrentBatchKey(): string {
    // Create a batch key that changes every batchTimeout ms
    return String(Math.floor(Date.now() / this.batchTimeout));
  }
}

/**
 * Connection pool optimization for Supabase
 */
export function optimizeSupabaseClient(client: any) {
  // Configure connection pooling settings
  // These are set at initialization time in lib/supabase/server.ts
  return client;
}

/**
 * Query performance monitoring
 */
export class QueryMonitor {
  static async track<T>(
    queryName: string,
    queryFn: () => Promise<T>,
    warnThresholdMs = 500
  ): Promise<T> {
    const start = Date.now();

    try {
      const result = await queryFn();
      const duration = Date.now() - start;

      if (duration > warnThresholdMs) {
        console.warn(`[QueryMonitor] Slow query: ${queryName} took ${duration}ms`);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      console.error(`[QueryMonitor] Query failed: ${queryName} after ${duration}ms`, error);
      throw error;
    }
  }
}
