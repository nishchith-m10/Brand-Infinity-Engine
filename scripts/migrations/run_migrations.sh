#!/bin/bash

# =============================================================================
# Brand Infinity Engine - Database Migration Script
# Description: Run all database migrations in order
# =============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo -e "${RED}Error: .env file not found${NC}"
    echo "Please copy .env.example to .env and configure your credentials"
    exit 1
fi

# Database connection details
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_NAME="${POSTGRES_DB:-brand_infinity}"
DB_USER="${POSTGRES_USER:-postgres}"
DB_PASSWORD="${POSTGRES_PASSWORD}"

echo -e "${GREEN}==============================================================================${NC}"
echo -e "${GREEN}Brand Infinity Engine - Database Migration${NC}"
echo -e "${GREEN}==============================================================================${NC}"
echo ""

# Check if PostgreSQL is accessible
echo -e "${YELLOW}Checking database connection...${NC}"
if PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c '\q' 2>/dev/null; then
    echo -e "${GREEN}✓ Database connection successful${NC}"
else
    echo -e "${RED}✗ Cannot connect to database${NC}"
    echo "Please ensure PostgreSQL is running and credentials are correct"
    exit 1
fi

# Create migrations table if it doesn't exist
echo -e "${YELLOW}Creating migrations tracking table...${NC}"
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME <<EOF
CREATE TABLE IF NOT EXISTS schema_migrations (
    migration_id SERIAL PRIMARY KEY,
    filename VARCHAR(255) UNIQUE NOT NULL,
    applied_at TIMESTAMP DEFAULT NOW()
);
EOF

# Get list of migration files
MIGRATION_DIR="database/migrations"
MIGRATIONS=($(ls -1 $MIGRATION_DIR/*.sql | sort))

if [ ${#MIGRATIONS[@]} -eq 0 ]; then
    echo -e "${RED}No migration files found in $MIGRATION_DIR${NC}"
    exit 1
fi

echo -e "${GREEN}Found ${#MIGRATIONS[@]} migration files${NC}"
echo ""

# Run each migration
APPLIED=0
SKIPPED=0
FAILED=0

for migration in "${MIGRATIONS[@]}"; do
    filename=$(basename "$migration")
    
    # Check if migration has already been applied
    ALREADY_APPLIED=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM schema_migrations WHERE filename='$filename';" | xargs)
    
    if [ "$ALREADY_APPLIED" -gt 0 ]; then
        echo -e "${YELLOW}⊘ Skipping: $filename (already applied)${NC}"
        ((SKIPPED++))
        continue
    fi
    
    echo -e "${YELLOW}→ Applying: $filename${NC}"
    
    # Run the migration
    if PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$migration" > /dev/null 2>&1; then
        # Record successful migration
        PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "INSERT INTO schema_migrations (filename) VALUES ('$filename');" > /dev/null
        echo -e "${GREEN}✓ Success: $filename${NC}"
        ((APPLIED++))
    else
        echo -e "${RED}✗ Failed: $filename${NC}"
        ((FAILED++))
        # Continue with other migrations or exit based on preference
        # exit 1  # Uncomment to stop on first failure
    fi
done

echo ""
echo -e "${GREEN}==============================================================================${NC}"
echo -e "${GREEN}Migration Summary${NC}"
echo -e "${GREEN}==============================================================================${NC}"
echo -e "${GREEN}Applied:  $APPLIED${NC}"
echo -e "${YELLOW}Skipped:  $SKIPPED${NC}"
if [ $FAILED -gt 0 ]; then
    echo -e "${RED}Failed:   $FAILED${NC}"
    exit 1
else
    echo -e "${GREEN}Failed:   $FAILED${NC}"
fi
echo ""
echo -e "${GREEN}Database migration completed successfully!${NC}"
