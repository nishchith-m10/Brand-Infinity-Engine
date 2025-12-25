#!/bin/bash
# =============================================================================
# Verify n8n Workflows Are Actually Saved
# Checks if the workflows from workflow_ids.env exist on your n8n instance
# =============================================================================

set -e

# Configuration
N8N_URL="${N8N_REMOTE_URL:-https://n8n-deployment-hlnal.ondigitalocean.app}"
N8N_API_KEY="${N8N_API_KEY:-}"
N8N_URL="${N8N_URL%/}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}n8n Workflow Verification${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check for API key
if [ -z "$N8N_API_KEY" ]; then
    echo -e "${RED}❌ ERROR: N8N_API_KEY is not set${NC}"
    echo ""
    echo "Set your API key first:"
    echo "  export N8N_API_KEY='your-api-key-here'"
    echo ""
    exit 1
fi

echo -e "${CYAN}🔗 n8n URL: $N8N_URL${NC}"
echo ""

# Fetch all workflows from n8n
echo -e "${YELLOW}📡 Fetching workflows from n8n...${NC}"
response=$(curl -s -X GET "$N8N_URL/api/v1/workflows" \
    -H "X-N8N-API-KEY: $N8N_API_KEY")

if ! echo "$response" | grep -q '"data"'; then
    echo -e "${RED}❌ Failed to connect to n8n${NC}"
    echo "Response: $response"
    exit 1
fi

# Count workflows
total_count=$(echo "$response" | jq '.data | length')
echo -e "${GREEN}✅ Found $total_count workflows on n8n${NC}"
echo ""

# Check each workflow from our workflow_ids.env
echo -e "${YELLOW}🔍 Checking our imported workflows...${NC}"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IDS_FILE="$SCRIPT_DIR/workflow_ids.env"

if [ ! -f "$IDS_FILE" ]; then
    echo -e "${RED}❌ workflow_ids.env not found${NC}"
    exit 1
fi

found=0
missing=0

while IFS='=' read -r name id; do
    # Skip comments and empty lines
    [[ "$name" =~ ^#.*$ ]] && continue
    [[ -z "$name" ]] && continue
    
    # Check if this workflow ID exists
    workflow_json=$(echo "$response" | jq -r ".data[] | select(.id==\"$id\")")
    
    if [ -n "$workflow_json" ]; then
        workflow_name=$(echo "$workflow_json" | jq -r '.name')
        is_active=$(echo "$workflow_json" | jq -r '.active')
        
        if [ "$is_active" = "true" ]; then
            status="${GREEN}✅ ACTIVE${NC}"
        else
            status="${YELLOW}⏸️  INACTIVE${NC}"
        fi
        
        echo -e "  $status  $name"
        echo -e "           ${CYAN}└─ ID: $id  |  Name: $workflow_name${NC}"
        ((found++))
    else
        echo -e "  ${RED}❌ MISSING${NC}  $name (ID: $id)"
        ((missing++))
    fi
done < "$IDS_FILE"

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "  Workflows found:   ${GREEN}$found${NC}"
echo -e "  Workflows missing: ${RED}$missing${NC}"
echo ""

if [ $missing -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Some workflows are missing!${NC}"
    echo ""
    echo "Possible fixes:"
    echo "  1. Re-run the import script: ./import_workflows.sh"
    echo "  2. Check if you're looking at the right n8n URL"
    echo ""
else
    echo -e "${GREEN}✅ All workflows are present on n8n!${NC}"
    echo ""
    echo "If you don't see them on the dashboard:"
    echo "  1. Clear your browser cache (Cmd+Shift+R)"
    echo "  2. Check if you have any filters/tags active"
    echo "  3. Try logging out and back in"
    echo ""
fi
