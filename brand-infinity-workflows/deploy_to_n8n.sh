#!/bin/bash
# =============================================================================
# n8n Workflow Deployment Toolkit
# Import, tag, and manage n8n workflows from JSON files
#
# Usage:
#   1. Set your API key: export N8N_API_KEY='your-key-here'
#   2. Set your n8n URL: export N8N_URL='https://your-n8n.com'
#   3. Run: ./deploy_to_n8n.sh
#
# Requirements:
#   - jq (brew install jq)
#   - curl
# =============================================================================

set -e

# Configuration - Set these via environment variables
N8N_URL="${N8N_URL:-https://your-n8n-instance.com}"
N8N_API_KEY="${N8N_API_KEY:-}"
TAG_NAME="${TAG_NAME:-My Workflows}"

# Remove trailing slash
N8N_URL="${N8N_URL%/}"

# Script directory (where this script lives)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUB_WORKFLOWS_DIR="${SUB_WORKFLOWS_DIR:-$SCRIPT_DIR/sub-workflows}"
MAIN_WORKFLOWS_DIR="${MAIN_WORKFLOWS_DIR:-$SCRIPT_DIR/main-workflows}"
OUTPUT_FILE="$SCRIPT_DIR/workflow_ids.env"
TEMP_DIR="$SCRIPT_DIR/.temp_import"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# =============================================================================
# Helper Functions
# =============================================================================

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

check_requirements() {
    # Check for jq
    if ! command -v jq &> /dev/null; then
        echo -e "${RED}ERROR: jq is required but not installed${NC}"
        echo "  Install with: brew install jq"
        exit 1
    fi
    
    # Check for API key
    if [ -z "$N8N_API_KEY" ]; then
        echo -e "${RED}ERROR: N8N_API_KEY is not set${NC}"
        echo ""
        echo "Set your n8n API key:"
        echo "  export N8N_API_KEY='your-api-key-here'"
        echo ""
        echo "To get an API key:"
        echo "  1. Go to your n8n dashboard"
        echo "  2. Click your profile (bottom left)"
        echo "  3. Settings → API Keys → Create"
        exit 1
    fi
    
    # Check URL is not default
    if [[ "$N8N_URL" == *"your-n8n-instance"* ]]; then
        echo -e "${RED}ERROR: N8N_URL is not set${NC}"
        echo ""
        echo "Set your n8n URL:"
        echo "  export N8N_URL='https://your-n8n.ondigitalocean.app'"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Requirements met${NC}"
    echo "  n8n URL: $N8N_URL"
    echo "  Tag: $TAG_NAME"
    echo ""
}

import_workflow() {
    local json_file="$1"
    local workflow_name=$(basename "$json_file" .json)
    local temp_file="$TEMP_DIR/${workflow_name}_clean.json"
    
    echo -n "  Importing $workflow_name... "
    
    # Clean JSON - remove properties n8n API doesn't accept
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
    
    # Import workflow
    response=$(curl -s -X POST "$N8N_URL/api/v1/workflows" \
        -H "X-N8N-API-KEY: $N8N_API_KEY" \
        -H "Content-Type: application/json" \
        -d @"$temp_file" 2>&1)
    
    # Check result
    if echo "$response" | jq -e '.id' > /dev/null 2>&1; then
        workflow_id=$(echo "$response" | jq -r '.id')
        echo -e "${GREEN}✓${NC} (ID: $workflow_id)"
        echo "$workflow_name=$workflow_id" >> "$OUTPUT_FILE"
        echo "$workflow_id"  # Return ID for tagging
        return 0
    else
        error_msg=$(echo "$response" | jq -r '.message // .error // "Unknown error"' 2>/dev/null || echo "Unknown error")
        echo -e "${RED}✗${NC} ($error_msg)"
        return 1
    fi
}

create_or_get_tag() {
    local tag_name="$1"
    
    # Try to create tag
    local response=$(curl -s -X POST "$N8N_URL/api/v1/tags" \
        -H "X-N8N-API-KEY: $N8N_API_KEY" \
        -H "Content-Type: application/json" \
        -d "{\"name\": \"$tag_name\"}")
    
    local tag_id=$(echo "$response" | jq -r '.id // empty')
    
    if [ -n "$tag_id" ]; then
        echo "$tag_id"
        return 0
    fi
    
    # Tag might already exist, fetch it
    local tags=$(curl -s -X GET "$N8N_URL/api/v1/tags" \
        -H "X-N8N-API-KEY: $N8N_API_KEY")
    
    tag_id=$(echo "$tags" | jq -r ".data[] | select(.name==\"$tag_name\") | .id" 2>/dev/null)
    
    if [ -n "$tag_id" ]; then
        echo "$tag_id"
        return 0
    fi
    
    return 1
}

add_tag_to_workflow() {
    local workflow_id="$1"
    local tag_id="$2"
    
    curl -s -X PUT "$N8N_URL/api/v1/workflows/$workflow_id/tags" \
        -H "X-N8N-API-KEY: $N8N_API_KEY" \
        -H "Content-Type: application/json" \
        -d "[{\"id\": \"$tag_id\"}]" > /dev/null 2>&1
}

# =============================================================================
# Main Script
# =============================================================================

main() {
    print_header "n8n Workflow Deployment Toolkit"
    
    check_requirements
    
    # Create temp directory
    mkdir -p "$TEMP_DIR"
    
    # Initialize output file
    echo "# n8n Workflow IDs - Generated $(date)" > "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    
    # Collect all imported workflow IDs for tagging
    declare -a IMPORTED_IDS=()
    
    # =============================================================================
    # Step 1: Import Sub-Workflows
    # =============================================================================
    if [ -d "$SUB_WORKFLOWS_DIR" ]; then
        print_header "Step 1: Importing Sub-Workflows"
        echo "# Sub-Workflow IDs" >> "$OUTPUT_FILE"
        
        for json_file in "$SUB_WORKFLOWS_DIR"/*.json; do
            [ -f "$json_file" ] || continue
            wf_id=$(import_workflow "$json_file")
            if [ $? -eq 0 ] && [ -n "$wf_id" ]; then
                IMPORTED_IDS+=("$wf_id")
            fi
        done
        echo "" >> "$OUTPUT_FILE"
    fi
    
    # =============================================================================
    # Step 2: Import Main Workflows
    # =============================================================================
    if [ -d "$MAIN_WORKFLOWS_DIR" ]; then
        echo ""
        print_header "Step 2: Importing Main Workflows"
        echo "# Main Workflow IDs" >> "$OUTPUT_FILE"
        
        for json_file in "$MAIN_WORKFLOWS_DIR"/*.json; do
            [ -f "$json_file" ] || continue
            # Skip non-JSON files
            [[ "$json_file" == *.json ]] || continue
            wf_id=$(import_workflow "$json_file")
            if [ $? -eq 0 ] && [ -n "$wf_id" ]; then
                IMPORTED_IDS+=("$wf_id")
            fi
        done
    fi
    
    # =============================================================================
    # Step 3: Add Tags
    # =============================================================================
    echo ""
    print_header "Step 3: Adding Tags"
    
    echo -n "  Creating tag '$TAG_NAME'... "
    TAG_ID=$(create_or_get_tag "$TAG_NAME")
    
    if [ -n "$TAG_ID" ]; then
        echo -e "${GREEN}✓${NC} (ID: $TAG_ID)"
        
        echo "  Tagging ${#IMPORTED_IDS[@]} workflows..."
        for wf_id in "${IMPORTED_IDS[@]}"; do
            add_tag_to_workflow "$wf_id" "$TAG_ID"
        done
        echo -e "  ${GREEN}✓ All workflows tagged${NC}"
    else
        echo -e "${YELLOW}⚠ Could not create/find tag${NC}"
    fi
    
    # Cleanup
    rm -rf "$TEMP_DIR"
    
    # =============================================================================
    # Summary
    # =============================================================================
    echo ""
    print_header "Deployment Complete"
    
    echo -e "  Workflows imported: ${GREEN}${#IMPORTED_IDS[@]}${NC}"
    echo -e "  IDs saved to: ${YELLOW}$OUTPUT_FILE${NC}"
    echo ""
    echo -e "${GREEN}✓ Done! Check your n8n dashboard.${NC}"
}

# Run main function
main "$@"
