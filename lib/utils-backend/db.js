/**
 * Database Connection Module
 * @module utils/db
 * 
 * Provides PostgreSQL connection pooling with Supabase support and pgvector integration.
 * Supports both local Docker Postgres and hosted Supabase instances.
 */

import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

const { Pool } = pg;

// =============================================================================
// Configuration
// =============================================================================

const config = {
  // Postgres connection (Supabase cloud)
  postgres: {
    connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
    host: process.env.POSTGRES_HOST || 'aws-1-us-west-1.pooler.supabase.com',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DB || 'postgres',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD,
    ssl: { rejectUnauthorized: false }, // Required for Supabase
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECT_TIMEOUT || '10000', 10),
  },
  // Supabase client (for auth, storage, realtime)
  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
  // Vector settings
  vector: {
    dimensions: parseInt(process.env.VECTOR_DIMENSIONS || '1536', 10),
    indexMethod: process.env.VECTOR_INDEX_METHOD || 'ivfflat',
  },
};

// =============================================================================
// PostgreSQL Connection Pool
// =============================================================================

let pool = null;

/**
 * Get or create the PostgreSQL connection pool
 * @returns {pg.Pool} PostgreSQL connection pool
 */
export function getPool() {
  if (!pool) {
    const poolConfig = config.postgres.connectionString
      ? {
          connectionString: config.postgres.connectionString,
          ssl: config.postgres.ssl,
          max: config.postgres.max,
          idleTimeoutMillis: config.postgres.idleTimeoutMillis,
          connectionTimeoutMillis: config.postgres.connectionTimeoutMillis,
        }
      : {
          host: config.postgres.host,
          port: config.postgres.port,
          database: config.postgres.database,
          user: config.postgres.user,
          password: config.postgres.password,
          ssl: config.postgres.ssl,
          max: config.postgres.max,
          idleTimeoutMillis: config.postgres.idleTimeoutMillis,
          connectionTimeoutMillis: config.postgres.connectionTimeoutMillis,
        };

    pool = new Pool(poolConfig);

    // Handle pool errors
    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });

    // Handle pool connect for logging
    pool.on('connect', () => {
      if (process.env.LOG_LEVEL === 'debug') {
        console.log('New client connected to PostgreSQL');
      }
    });
  }

  return pool;
}

/**
 * Execute a query with automatic connection management
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<pg.QueryResult>} Query result
 */
export async function query(text, params = []) {
  const pool = getPool();
  const start = Date.now();
  
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    if (process.env.LOG_LEVEL === 'debug') {
      console.log('Executed query', { text: text.substring(0, 100), duration, rows: result.rowCount });
    }
    
    return result;
  } catch (error) {
    console.error('Query error', { text: text.substring(0, 100), error: error.message });
    throw error;
  }
}

/**
 * Get a client from the pool for transactions
 * @returns {Promise<pg.PoolClient>} PostgreSQL client
 */
export async function getClient() {
  const pool = getPool();
  const client = await pool.connect();
  
  // Monkey-patch the query method to add logging
  const originalQuery = client.query.bind(client);
  client.query = async (...args) => {
    const start = Date.now();
    try {
      const result = await originalQuery(...args);
      const duration = Date.now() - start;
      if (process.env.LOG_LEVEL === 'debug') {
        console.log('Transaction query', { duration, rows: result.rowCount });
      }
      return result;
    } catch (error) {
      console.error('Transaction query error', { error: error.message });
      throw error;
    }
  };
  
  return client;
}

/**
 * Execute a transaction with automatic commit/rollback
 * @param {Function} callback - Async function receiving the client
 * @returns {Promise<any>} Result of the callback
 */
export async function transaction(callback) {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// =============================================================================
// Supabase Client
// =============================================================================

let supabaseClient = null;
let supabaseAdminClient = null;

/**
 * Get Supabase client (anon key - for client-side operations)
 * @returns {import('@supabase/supabase-js').SupabaseClient|null}
 */
export function getSupabase() {
  if (!supabaseClient && config.supabase.url && config.supabase.anonKey) {
    supabaseClient = createClient(config.supabase.url, config.supabase.anonKey);
  }
  return supabaseClient;
}

/**
 * Get Supabase admin client (service role key - for server-side operations)
 * @returns {import('@supabase/supabase-js').SupabaseClient|null}
 */
export function getSupabaseAdmin() {
  if (!supabaseAdminClient && config.supabase.url && config.supabase.serviceRoleKey) {
    supabaseAdminClient = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabaseAdminClient;
}

// =============================================================================
// Vector Operations (pgvector)
// =============================================================================

/**
 * Store a vector embedding in the database
 * @param {string} table - Table name (must have 'embedding' vector column)
 * @param {string} id - Record ID
 * @param {number[]} embedding - Vector embedding array
 * @param {Object} metadata - Additional metadata to store
 * @returns {Promise<pg.QueryResult>}
 */
export async function storeEmbedding(table, id, embedding, metadata = {}) {
  const embeddingStr = `[${embedding.join(',')}]`;
  
  const result = await query(
    `UPDATE ${table} 
     SET embedding = $1::vector, 
         metadata = metadata || $2::jsonb,
         updated_at = NOW()
     WHERE id = $3
     RETURNING id`,
    [embeddingStr, JSON.stringify(metadata), id]
  );
  
  return result;
}

/**
 * Search for similar vectors using cosine similarity
 * @param {string} table - Table name with vector column
 * @param {number[]} queryEmbedding - Query vector
 * @param {number} limit - Maximum results to return
 * @param {number} threshold - Minimum similarity threshold (0-1)
 * @returns {Promise<Array>} Array of matching records with similarity scores
 */
export async function searchSimilar(table, queryEmbedding, limit = 10, threshold = 0.7) {
  const embeddingStr = `[${queryEmbedding.join(',')}]`;
  
  const result = await query(
    `SELECT *, 
            1 - (embedding <=> $1::vector) as similarity
     FROM ${table}
     WHERE embedding IS NOT NULL
       AND 1 - (embedding <=> $1::vector) >= $2
     ORDER BY embedding <=> $1::vector
     LIMIT $3`,
    [embeddingStr, threshold, limit]
  );
  
  return result.rows;
}

/**
 * Search using L2 (Euclidean) distance
 * @param {string} table - Table name with vector column
 * @param {number[]} queryEmbedding - Query vector
 * @param {number} limit - Maximum results
 * @returns {Promise<Array>} Matching records
 */
export async function searchByL2Distance(table, queryEmbedding, limit = 10) {
  const embeddingStr = `[${queryEmbedding.join(',')}]`;
  
  const result = await query(
    `SELECT *, 
            embedding <-> $1::vector as distance
     FROM ${table}
     WHERE embedding IS NOT NULL
     ORDER BY embedding <-> $1::vector
     LIMIT $2`,
    [embeddingStr, limit]
  );
  
  return result.rows;
}

// =============================================================================
// Health Check
// =============================================================================

/**
 * Check database connectivity and return status
 * @returns {Promise<Object>} Health status object
 */
export async function healthCheck() {
  const status = {
    postgres: false,
    supabase: false,
    pgvector: false,
    timestamp: new Date().toISOString(),
  };

  // Check PostgreSQL
  try {
    const result = await query('SELECT NOW() as time, version() as version');
    status.postgres = true;
    status.postgresVersion = result.rows[0]?.version?.split(' ')[1];
  } catch (error) {
    status.postgresError = error.message;
  }

  // Check pgvector extension
  try {
    const result = await query("SELECT extversion FROM pg_extension WHERE extname = 'vector'");
    status.pgvector = result.rows.length > 0;
    status.pgvectorVersion = result.rows[0]?.extversion;
  } catch (error) {
    status.pgvectorError = error.message;
  }

  // Check Supabase (if configured)
  if (config.supabase.url) {
    try {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        // Simple check - just verify client exists
        status.supabase = true;
      }
    } catch (error) {
      status.supabaseError = error.message;
    }
  }

  return status;
}

// =============================================================================
// Cleanup
// =============================================================================

/**
 * Close all database connections gracefully
 * @returns {Promise<void>}
 */
export async function closeConnections() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('PostgreSQL pool closed');
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  await closeConnections();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeConnections();
  process.exit(0);
});

// =============================================================================
// Exports
// =============================================================================

export default {
  getPool,
  query,
  getClient,
  transaction,
  getSupabase,
  getSupabaseAdmin,
  storeEmbedding,
  searchSimilar,
  searchByL2Distance,
  healthCheck,
  closeConnections,
  config,
};
