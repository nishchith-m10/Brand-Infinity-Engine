#!/bin/bash

# =============================================================================
# Brand Infinity Engine - Database Rollback Script
# Description: Rollback the last N migrations
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Default number of migrations to rollback
ROLLBACK_COUNT=${1:-1}

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo -e "${RED}Error: .env file not found${NC}"
    exit 1
fi

# Database connection details
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_NAME="${POSTGRES_DB:-brand_infinity}"
DB_USER="${POSTGRES_USER:-postgres}"
DB_PASSWORD="${POSTGRES_PASSWORD}"

echo -e "${YELLOW}==============================================================================${NC}"
echo -e "${YELLOW}Brand Infinity Engine - Migration Rollback${NC}"
echo -e "${YELLOW}==============================================================================${NC}"
echo ""

# Warning
echo -e "${RED}⚠ WARNING: This will rollback the last $ROLLBACK_COUNT migration(s)${NC}"
echo -e "${RED}⚠ This operation cannot be undone automatically${NC}"
read -p "Are you sure? (yes/no) " -r
echo

if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "Rollback cancelled"
    exit 0
fi

# Get last N migrations
LAST_MIGRATIONS=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT filename FROM schema_migrations ORDER BY applied_at DESC LIMIT $ROLLBACK_COUNT;")

if [ -z "$LAST_MIGRATIONS" ]; then
    echo -e "${YELLOW}No migrations to rollback${NC}"
    exit 0
fi

echo -e "${YELLOW}Migrations to rollback:${NC}"
echo "$LAST_MIGRATIONS"
echo ""

# For each migration, we'd need rollback SQL files
# Since we don't have explicit rollback files, we'll just remove from tracking
echo -e "${YELLOW}Removing from migration tracking...${NC}"
echo -e "${RED}Note: You'll need to manually reverse database changes or restore from backup${NC}"

while IFS= read -r filename; do
    filename=$(echo $filename | xargs)  # Trim whitespace
    echo -e "${YELLOW}Removing: $filename${NC}"
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "DELETE FROM schema_migrations WHERE filename='$filename';"
done <<< "$LAST_MIGRATIONS"

echo ""
echo -e "${GREEN}Migration tracking rollback complete${NC}"
echo -e "${RED}Remember: Database schema changes must be manually reversed or restored from backup${NC}"
