#!/bin/bash
# =============================================================================
# Brand Infinity Engine - n8n Workflow Import Script (v2)
# Imports all 20 Phase 4 workflows - strips extra properties for API compatibility
# =============================================================================

set -e

# Configuration
N8N_BASE_URL="${N8N_REMOTE_URL:-https://n8n-deployment-hlnal.ondigitalocean.app}"
N8N_API_KEY="${N8N_API_KEY:-}"
N8N_BASE_URL="${N8N_BASE_URL%/}"

# Paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKFLOWS_DIR="$SCRIPT_DIR/brand-infinity-workflows"
SUB_WORKFLOWS_DIR="$WORKFLOWS_DIR/sub-workflows"
MAIN_WORKFLOWS_DIR="$WORKFLOWS_DIR/main-workflows"
OUTPUT_FILE="$SCRIPT_DIR/workflow_ids.env"
TEMP_DIR="$SCRIPT_DIR/.workflow_temp"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}n8n Workflow Import Script v2${NC}"
echo -e "${BLUE}Brand Infinity Engine - Phase 4${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check for API key
if [ -z "$N8N_API_KEY" ]; then
    echo -e "${RED}ERROR: N8N_API_KEY is not set${NC}"
    echo "  export N8N_API_KEY='your-api-key-here'"
    exit 1
fi

# Check for jq
if ! command -v jq &> /dev/null; then
    echo -e "${RED}ERROR: jq is required but not installed${NC}"
    echo "  brew install jq"
    exit 1
fi

# Create temp directory
mkdir -p "$TEMP_DIR"

echo -e "${GREEN}✓ Configuration validated${NC}"
echo -e "  Base URL: $N8N_BASE_URL"
echo ""

# Function to clean and import a workflow
import_workflow() {
    local json_file="$1"
    local workflow_name=$(basename "$json_file" .json)
    local temp_file="$TEMP_DIR/${workflow_name}_clean.json"
    
    echo -n "  Importing $workflow_name... "
    
    # Clean the JSON - remove properties n8n API doesn't accept
    # Keep only: name, nodes, connections, settings, staticData, tags, active
    jq '{
        name: .name,
        nodes: .nodes,
        connections: .connections,
        settings: .settings,
        staticData: .staticData
    }' "$json_file" > "$temp_file" 2>/dev/null
    
    if [ ! -s "$temp_file" ]; then
        echo -e "${RED}✗${NC} (Failed to parse JSON)"
        return 1
    fi
    
    # Make API call
    response=$(curl -s -X POST "$N8N_BASE_URL/api/v1/workflows" \
        -H "X-N8N-API-KEY: $N8N_API_KEY" \
        -H "Content-Type: application/json" \
        -d @"$temp_file" 2>&1)
    
    # Check result
    if echo "$response" | grep -q '"id"'; then
        workflow_id=$(echo "$response" | jq -r '.id')
        echo -e "${GREEN}✓${NC} (ID: $workflow_id)"
        echo "$workflow_name=$workflow_id" >> "$OUTPUT_FILE"
        return 0
    else
        error_msg=$(echo "$response" | jq -r '.message // .error // "Unknown error"' 2>/dev/null || echo "$response")
        echo -e "${RED}✗${NC} ($error_msg)"
        return 1
    fi
}

# Initialize output file
echo "# n8n Workflow IDs - Generated $(date)" > "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# =============================================================================
# Step 1: Import Sub-Workflows
# =============================================================================
echo -e "${YELLOW}Step 1: Importing Sub-Workflows (8 files)${NC}"
echo "# Sub-Workflow IDs" >> "$OUTPUT_FILE"

sub_workflow_files=(
    "Log_Cost_Event.json"
    "Acquire_Lock.json"
    "Release_Lock.json"
    "Validate_Schema.json"
    "Check_Circuit_Breaker.json"
    "Get_Brand_Context.json"
    "Refresh_Platform_Token.json"
    "Send_Alert.json"
)

sub_success=0
sub_failed=0

for file in "${sub_workflow_files[@]}"; do
    filepath="$SUB_WORKFLOWS_DIR/$file"
    if [ -f "$filepath" ]; then
        if import_workflow "$filepath"; then
            ((sub_success++))
        else
            ((sub_failed++))
        fi
    else
        echo -e "  ${RED}✗ File not found: $file${NC}"
        ((sub_failed++))
    fi
done

echo ""
echo -e "  Sub-workflows: ${GREEN}$sub_success imported${NC}, ${RED}$sub_failed failed${NC}"
echo "" >> "$OUTPUT_FILE"

# =============================================================================
# Step 2: Import Main Workflows
# =============================================================================
echo ""
echo -e "${YELLOW}Step 2: Importing Main Workflows (12 files)${NC}"
echo "# Main Workflow IDs" >> "$OUTPUT_FILE"

main_workflow_files=(
    "Strategist_Main.json"
    "Copywriter_Main.json"
    "Production_Dispatcher.json"
    "Production_Poller.json"
    "Production_Downloader.json"
    "Video_Assembly.json"
    "Campaign_Verifier.json"
    "Broadcaster_Main.json"
    "Approval_Handler.json"
    "Performance_Monitor.json"
    "Zombie_Reaper.json"
    "Circuit_Breaker_Monitor.json"
)

main_success=0
main_failed=0

for file in "${main_workflow_files[@]}"; do
    filepath="$MAIN_WORKFLOWS_DIR/$file"
    if [ -f "$filepath" ]; then
        if import_workflow "$filepath"; then
            ((main_success++))
        else
            ((main_failed++))
        fi
    else
        echo -e "  ${RED}✗ File not found: $file${NC}"
        ((main_failed++))
    fi
done

echo ""
echo -e "  Main workflows: ${GREEN}$main_success imported${NC}, ${RED}$main_failed failed${NC}"

# Cleanup
rm -rf "$TEMP_DIR"

# =============================================================================
# Summary
# =============================================================================
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Import Complete${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

total_success=$((sub_success + main_success))
total_failed=$((sub_failed + main_failed))

echo -e "  Total imported: ${GREEN}$total_success${NC}"
echo -e "  Total failed:   ${RED}$total_failed${NC}"
echo ""
echo -e "  Workflow IDs saved to: ${YELLOW}$OUTPUT_FILE${NC}"
echo ""

if [ $total_success -gt 0 ]; then
    echo -e "${GREEN}✓ Success! Check your n8n dashboard to see the imported workflows.${NC}"
fi
