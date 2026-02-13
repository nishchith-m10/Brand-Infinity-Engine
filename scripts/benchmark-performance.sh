#!/usr/bin/env bash
# =============================================================================
# Performance Benchmarking Script
# Tests query performance and identifies optimization opportunities
# =============================================================================

set -e

echo "🚀 Brand Infinity Engine - Performance Benchmark"
echo "=================================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ Error: DATABASE_URL environment variable not set${NC}"
    exit 1
fi

# Temporary file for results
RESULTS_FILE=$(mktemp)

echo "📊 Running database performance tests..."
echo ""

# =============================================================================
# Test 1: Dashboard Query Performance
# =============================================================================
echo "Test 1: Dashboard Stats Query"
echo "------------------------------"

QUERY_1="
EXPLAIN (ANALYZE, BUFFERS) 
SELECT status, COUNT(*) 
FROM campaigns 
WHERE user_id = (SELECT id FROM auth.users LIMIT 1)
  AND deleted_at IS NULL
  AND status NOT IN ('archived', 'pending_deletion')
GROUP BY status;
"

psql "$DATABASE_URL" -c "$QUERY_1" | tee -a "$RESULTS_FILE"

# Extract execution time
EXEC_TIME=$(psql "$DATABASE_URL" -t -c "$QUERY_1" 2>/dev/null | grep "Execution Time" | awk '{print $3}')

if [ -n "$EXEC_TIME" ]; then
    if (( $(echo "$EXEC_TIME < 100" | bc -l) )); then
        echo -e "${GREEN}✅ Excellent: ${EXEC_TIME}ms${NC}"
    elif (( $(echo "$EXEC_TIME < 500" | bc -l) )); then
        echo -e "${YELLOW}⚠️  Acceptable: ${EXEC_TIME}ms${NC}"
    else
        echo -e "${RED}❌ Slow: ${EXEC_TIME}ms - Consider optimizing${NC}"
    fi
fi

echo ""

# =============================================================================
# Test 2: Budget Reservation Query Performance
# =============================================================================
echo "Test 2: Budget Reservation Query"
echo "---------------------------------"

QUERY_2="
EXPLAIN (ANALYZE, BUFFERS)
SELECT 
  c.budget_limit,
  COALESCE(SUM(cl.cost_usd), 0) as spent,
  COALESCE((
    SELECT SUM(amount_usd) 
    FROM budget_reservations 
    WHERE campaign_id = c.campaign_id 
      AND status = 'reserved'
  ), 0) as reserved
FROM campaigns c
LEFT JOIN cost_ledger cl ON cl.campaign_id = c.campaign_id
WHERE c.campaign_id = (SELECT campaign_id FROM campaigns LIMIT 1)
GROUP BY c.campaign_id, c.budget_limit;
"

psql "$DATABASE_URL" -c "$QUERY_2" | tee -a "$RESULTS_FILE"

echo ""

# =============================================================================
# Test 3: Index Usage Check
# =============================================================================
echo "Test 3: Index Usage Statistics"
echo "-------------------------------"

QUERY_3="
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched,
  CASE 
    WHEN idx_scan = 0 THEN 'UNUSED'
    WHEN idx_scan < 100 THEN 'LOW USAGE'
    ELSE 'ACTIVE'
  END as status
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC
LIMIT 20;
"

echo "Checking index usage (showing least used indexes first):"
psql "$DATABASE_URL" -c "$QUERY_3" | tee -a "$RESULTS_FILE"

echo ""

# =============================================================================
# Test 4: Table Bloat Check
# =============================================================================
echo "Test 4: Table Bloat Analysis"
echo "----------------------------"

QUERY_4="
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
  n_live_tup as live_rows,
  n_dead_tup as dead_rows,
  CASE 
    WHEN n_dead_tup > n_live_tup * 0.1 THEN 'NEEDS VACUUM'
    ELSE 'OK'
  END as status
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_dead_tup DESC
LIMIT 10;
"

psql "$DATABASE_URL" -c "$QUERY_4" | tee -a "$RESULTS_FILE"

echo ""

# =============================================================================
# Test 5: Slow Query Identification
# =============================================================================
echo "Test 5: Connection Pool Statistics"
echo "-----------------------------------"

QUERY_5="
SELECT 
  datname as database,
  numbackends as active_connections,
  xact_commit as commits,
  xact_rollback as rollbacks,
  blks_read as disk_reads,
  blks_hit as cache_hits,
  CASE 
    WHEN blks_hit + blks_read = 0 THEN 0
    ELSE ROUND((blks_hit::numeric / (blks_hit + blks_read)) * 100, 2)
  END as cache_hit_ratio
FROM pg_stat_database
WHERE datname = current_database();
"

psql "$DATABASE_URL" -c "$QUERY_5" | tee -a "$RESULTS_FILE"

echo ""

# =============================================================================
# Test 6: Budget Reservation Function Performance
# =============================================================================
echo "Test 6: Budget Reservation Function Benchmark"
echo "----------------------------------------------"

echo "Testing 10 concurrent budget reservation calls..."

# Create a test campaign if it doesn't exist
psql "$DATABASE_URL" <<SQL
DO \$\$
DECLARE
  test_user_id UUID;
  test_campaign_id UUID;
BEGIN
  -- Get or create test user (using first user in system)
  SELECT id INTO test_user_id FROM auth.users LIMIT 1;
  
  IF test_user_id IS NULL THEN
    RAISE EXCEPTION 'No users found in database. Cannot run benchmark.';
  END IF;
  
  -- Check if test campaign exists
  SELECT campaign_id INTO test_campaign_id 
  FROM campaigns 
  WHERE user_id = test_user_id 
    AND campaign_name = 'PERF_TEST_CAMPAIGN'
  LIMIT 1;
  
  -- Create test campaign if it doesn't exist
  IF test_campaign_id IS NULL THEN
    INSERT INTO campaigns (user_id, campaign_name, budget_limit)
    VALUES (test_user_id, 'PERF_TEST_CAMPAIGN', 1000.00)
    RETURNING campaign_id INTO test_campaign_id;
    
    RAISE NOTICE 'Created test campaign: %', test_campaign_id;
  ELSE
    RAISE NOTICE 'Using existing test campaign: %', test_campaign_id;
  END IF;
END \$\$;
SQL

# Run benchmark
START_TIME=$(date +%s%3N)

for i in {1..10}; do
  psql "$DATABASE_URL" -q <<SQL &
    SELECT reserve_campaign_budget(
      (SELECT campaign_id FROM campaigns WHERE campaign_name = 'PERF_TEST_CAMPAIGN' LIMIT 1),
      gen_random_uuid(),
      10.00
    );
SQL
done

wait

END_TIME=$(date +%s%3N)
DURATION=$((END_TIME - START_TIME))

echo -e "${GREEN}✅ Completed 10 concurrent reservations in ${DURATION}ms${NC}"
echo -e "   Average: $((DURATION / 10))ms per reservation"

echo ""

# =============================================================================
# Test 7: Cache Hit Ratio Analysis
# =============================================================================
echo "Test 7: Database Cache Performance"
echo "-----------------------------------"

QUERY_7="
SELECT 
  'Index Cache Hit Rate' as metric,
  ROUND((sum(idx_blks_hit) / NULLIF(sum(idx_blks_hit + idx_blks_read), 0)) * 100, 2) as percentage
FROM pg_statio_user_indexes
UNION ALL
SELECT 
  'Table Cache Hit Rate' as metric,
  ROUND((sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit + heap_blks_read), 0)) * 100, 2) as percentage
FROM pg_statio_user_tables;
"

psql "$DATABASE_URL" -c "$QUERY_7" | tee -a "$RESULTS_FILE"

echo ""
echo "Note: Cache hit ratio should be >95% for good performance"

echo ""

# =============================================================================
# Summary and Recommendations
# =============================================================================
echo "📋 Performance Summary"
echo "======================"
echo ""

# Count indexes
INDEX_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public';")
echo "Total Indexes: $INDEX_COUNT"

# Count tables
TABLE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
echo "Total Tables: $TABLE_COUNT"

# Database size
DB_SIZE=$(psql "$DATABASE_URL" -t -c "SELECT pg_size_pretty(pg_database_size(current_database()));")
echo "Database Size: $DB_SIZE"

echo ""
echo "✅ Benchmark complete!"
echo ""
echo "Full results saved to: $RESULTS_FILE"
echo ""
echo "Recommendations:"
echo "----------------"
echo "1. Run ANALYZE regularly: psql \$DATABASE_URL -c 'ANALYZE;'"
echo "2. Monitor slow queries in Supabase Dashboard"
echo "3. Review unused indexes (idx_scan = 0) and consider dropping"
echo "4. VACUUM tables with high dead tuple counts"
echo "5. Ensure cache hit ratio >95% (add more memory if lower)"
echo ""
