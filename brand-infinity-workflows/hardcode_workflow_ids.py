#!/usr/bin/env python3
"""
Hardcode Workflow IDs into n8n JSON files
Replaces $env.VARIABLE_NAME expressions with actual IDs from workflow_ids.env
"""

import json
import os
import re

# Paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
IDS_FILE = os.path.join(PROJECT_ROOT, "workflow_ids.env")
MAIN_DIR = os.path.join(SCRIPT_DIR, "main-workflows")
SUB_DIR = os.path.join(SCRIPT_DIR, "sub-workflows")

# Mapping of workflow names to environment variable names
WORKFLOW_TO_ENV_VAR = {
    "Log_Cost_Event": "LOG_COST_EVENT_WORKFLOW_ID",
    "Acquire_Lock": "ACQUIRE_LOCK_WORKFLOW_ID",
    "Release_Lock": "RELEASE_LOCK_WORKFLOW_ID",
    "Validate_Schema": "VALIDATE_SCHEMA_WORKFLOW_ID",
    "Check_Circuit_Breaker": "CHECK_CIRCUIT_BREAKER_WORKFLOW_ID",
    "Get_Brand_Context": "GET_BRAND_CONTEXT_WORKFLOW_ID",
    "Refresh_Platform_Token": "REFRESH_PLATFORM_TOKEN_WORKFLOW_ID",
    "Send_Alert": "SEND_ALERT_WORKFLOW_ID",
}


def load_workflow_ids():
    """Load workflow IDs from workflow_ids.env"""
    ids = {}
    
    if not os.path.exists(IDS_FILE):
        print(f"❌ ERROR: {IDS_FILE} not found")
        print("   Run ./import_workflows.sh first to generate this file.")
        return None
    
    with open(IDS_FILE, 'r') as f:
        for line in f:
            line = line.strip()
            # Skip comments and empty lines
            if not line or line.startswith('#'):
                continue
            
            # Parse "WorkflowName=ID"
            if '=' in line:
                name, workflow_id = line.split('=', 1)
                ids[name.strip()] = workflow_id.strip()
    
    return ids


def create_replacement_map(workflow_ids):
    """Create a map of env expressions to actual IDs"""
    replacements = {}
    
    for workflow_name, env_var_name in WORKFLOW_TO_ENV_VAR.items():
        if workflow_name in workflow_ids:
            # Map the expression to the actual ID
            expression = f"={{{{ $env.{env_var_name} }}}}"
            actual_id = workflow_ids[workflow_name]
            replacements[expression] = actual_id
    
    return replacements


def patch_workflow_file(filepath, replacements):
    """Patch a single workflow JSON file"""
    with open(filepath, 'r') as f:
        content = f.read()
    
    original_content = content
    changes_made = 0
    
    # Replace each expression with the actual ID
    for expression, actual_id in replacements.items():
        if expression in content:
            content = content.replace(expression, actual_id)
            changes_made += content.count(actual_id) - original_content.count(actual_id)
    
    # Only write if changes were made
    if content != original_content:
        with open(filepath, 'w') as f:
            f.write(content)
        return changes_made
    
    return 0


def main():
    print("=" * 60)
    print("Hardcoding Workflow IDs into n8n JSON files")
    print("=" * 60)
    print()
    
    # Load IDs
    print("📂 Loading workflow IDs from workflow_ids.env...")
    workflow_ids = load_workflow_ids()
    
    if not workflow_ids:
        return
    
    print(f"✅ Loaded {len(workflow_ids)} workflow IDs")
    print()
    
    # Create replacement map
    replacements = create_replacement_map(workflow_ids)
    print(f"🔧 Created {len(replacements)} replacement mappings:")
    for expr, wf_id in replacements.items():
        # Extract variable name from expression
        var_name = expr.split('$env.')[1].split(' }}')[0]
        print(f"   {var_name} → {wf_id}")
    print()
    
    # Patch main workflows
    print("📝 Patching main workflows...")
    main_files_patched = 0
    main_changes = 0
    
    for filename in os.listdir(MAIN_DIR):
        if filename.endswith('.json'):
            filepath = os.path.join(MAIN_DIR, filename)
            changes = patch_workflow_file(filepath, replacements)
            if changes > 0:
                print(f"   ✅ {filename} ({changes} replacements)")
                main_files_patched += 1
                main_changes += changes
            else:
                print(f"   ⏭️  {filename} (no changes needed)")
    
    print()
    
    # Patch sub workflows (they might reference each other)
    print("📝 Patching sub-workflows...")
    sub_files_patched = 0
    sub_changes = 0
    
    for filename in os.listdir(SUB_DIR):
        if filename.endswith('.json'):
            filepath = os.path.join(SUB_DIR, filename)
            changes = patch_workflow_file(filepath, replacements)
            if changes > 0:
                print(f"   ✅ {filename} ({changes} replacements)")
                sub_files_patched += 1
                sub_changes += changes
            else:
                print(f"   ⏭️  {filename} (no changes needed)")
    
    print()
    print("=" * 60)
    print("Summary")
    print("=" * 60)
    print(f"  Main workflows patched: {main_files_patched} ({main_changes} replacements)")
    print(f"  Sub-workflows patched:  {sub_files_patched} ({sub_changes} replacements)")
    print()
    
    if main_files_patched > 0 or sub_files_patched > 0:
        print("✅ Done! Workflow IDs have been hardcoded.")
        print()
        print("📋 Next steps:")
        print("   1. Delete the old workflows from your n8n dashboard")
        print("   2. Re-run: ./import_workflows.sh")
        print("   3. The workflows will now work without environment variables!")
    else:
        print("ℹ️  No changes were needed. Workflows may already be hardcoded.")


if __name__ == "__main__":
    main()
