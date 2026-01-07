#!/bin/bash

# Apply database migrations directly to Supabase
# Usage: ./apply-migrations.sh

SUPABASE_URL="https://vciscdagwhdpstaviakz.supabase.co"
SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjaXNjZGFnd2hkcHN0YXZpYWt6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjAwMjU2MSwiZXhwIjoyMDgxNTc4NTYxfQ.i9BK0gyJI7LH_WdUQdxpgPfGpQErk_VIfTaVU_ql0JQ"

echo "🔐 Applying security and performance fixes migration..."
SQL_CONTENT=$(cat supabase/migrations/20260105154429_security_and_performance_fixes.sql)

curl -X POST \
  "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"query\": $(echo "$SQL_CONTENT" | jq -Rs .)}"

echo ""
echo "🔐 Applying budget enforcement migration..."
SQL_CONTENT2=$(cat supabase/migrations/20260105160000_budget_enforcement.sql)

curl -X POST \
  "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"query\": $(echo "$SQL_CONTENT2" | jq -Rs .)}"

echo ""
echo "✅ Migrations applied successfully!"
