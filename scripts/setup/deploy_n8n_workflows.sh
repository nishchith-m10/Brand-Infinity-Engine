#!/bin/bash

# =============================================================================
# Brand Infinity Engine - n8n Workflow Deployment
# Description: Deploy all workflow templates to n8n instance
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo -e "${RED}Error: .env file not found${NC}"
    exit 1
fi

N8N_HOST="${N8N_HOST:-localhost}"
N8N_PORT="${N8N_PORT:-5678}"
N8N_PROTOCOL="${N8N_PROTOCOL:-http}"
N8N_API_KEY="${N8N_API_KEY}"

echo -e "${GREEN}==============================================================================${NC}"
echo -e "${GREEN}Brand Infinity Engine - Workflow Deployment${NC}"
echo -e "${GREEN}==============================================================================${NC}"
echo ""

# Check if n8n is accessible
echo -e "${YELLOW}Checking n8n connection...${NC}"
N8N_URL="${N8N_PROTOCOL}://${N8N_HOST}:${N8N_PORT}"

if curl -s -f "${N8N_URL}/healthz" > /dev/null; then
    echo -e "${GREEN}✓ n8n is accessible at ${N8N_URL}${NC}"
else
    echo -e "${RED}✗ Cannot connect to n8n at ${N8N_URL}${NC}"
    echo "Please ensure n8n is running: npm run docker:up"
    exit 1
fi

# Workflow directory
WORKFLOW_DIR="n8n/workflows"

if [ ! -d "$WORKFLOW_DIR" ]; then
    echo -e "${RED}Error: Workflow directory not found: $WORKFLOW_DIR${NC}"
    exit 1
fi

# Get list of workflow files
WORKFLOWS=($(ls -1 $WORKFLOW_DIR/*.json 2>/dev/null))

if [ ${#WORKFLOWS[@]} -eq 0 ]; then
    echo -e "${YELLOW}No workflow files found in $WORKFLOW_DIR${NC}"
    exit 0
fi

echo -e "${GREEN}Found ${#WORKFLOWS[@]} workflow files${NC}"
echo ""

DEPLOYED=0
FAILED=0

# Deploy each workflow
for workflow_file in "${WORKFLOWS[@]}"; do
    filename=$(basename "$workflow_file")
    echo -e "${YELLOW}→ Deploying: $filename${NC}"
    
    # Import workflow via n8n API
    # Note: Actual API endpoint depends on n8n version and authentication setup
    # This is a placeholder - user needs to configure based on their n8n setup
    
    if [ -n "$N8N_API_KEY" ]; then
        # API-based deployment
        RESPONSE=$(curl -s -X POST \
            -H "X-N8N-API-KEY: ${N8N_API_KEY}" \
            -H "Content-Type: application/json" \
            -d @"$workflow_file" \
            "${N8N_URL}/api/v1/workflows" 2>&1)
        
        if echo "$RESPONSE" | grep -q '"id"'; then
            echo -e "${GREEN}✓ Deployed: $filename${NC}"
            ((DEPLOYED++))
        else
            echo -e "${RED}✗ Failed: $filename${NC}"
            echo -e "${RED}   Response: $RESPONSE${NC}"
            ((FAILED++))
        fi
    else
        echo -e "${YELLOW}⚠ N8N_API_KEY not set - manual import required${NC}"
        echo -e "   Import $filename manually via n8n UI"
        ((FAILED++))
    fi
done

echo ""
echo -e "${GREEN}==============================================================================${NC}"
echo -e "${GREEN}Deployment Summary${NC}"
echo -e "${GREEN}==============================================================================${NC}"
echo -e "${GREEN}Deployed: $DEPLOYED${NC}"
if [ $FAILED -gt 0 ]; then
    echo -e "${RED}Failed:   $FAILED${NC}"
else
    echo -e "${GREEN}Failed:   $FAILED${NC}"
fi
echo ""

if [ $FAILED -gt 0 ]; then
    echo -e "${YELLOW}Manual Import Instructions:${NC}"
    echo "1. Go to ${N8N_URL}"
    echo "2. Click 'Workflows' > 'Import from File'"
    echo "3. Upload each .json file from $WORKFLOW_DIR"
    echo ""
fi

echo -e "${GREEN}Access n8n workflows at: ${N8N_URL}/workflows${NC}"
