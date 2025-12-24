# n8n Workflow Deployment Toolkit

This folder contains reusable scripts for deploying n8n workflows from JSON files.

## Quick Start

```bash
# 1. Set your credentials
export N8N_API_KEY='your-api-key-here'
export N8N_URL='https://your-n8n-instance.com'
export TAG_NAME='My Project Name'  # Optional, defaults to "My Workflows"

# 2. Run deployment
./deploy_to_n8n.sh
```

## Scripts Included

| Script             | Purpose                           |
| ------------------ | --------------------------------- |
| `deploy_to_n8n.sh` | Import all workflows and add tags |
| `add_mock_mode.py` | Add MOCK_MODE toggle to workflows |

## Requirements

- **jq**: JSON processor (`brew install jq`)
- **curl**: HTTP client (pre-installed on macOS)
- **python3**: For mock mode script (pre-installed on macOS)

## Getting Your n8n API Key

1. Go to your n8n dashboard
2. Click your profile (bottom left)
3. Settings → API Keys
4. Create new key

## Folder Structure

```
brand-infinity-workflows/
├── main-workflows/          # Main workflow JSON files
│   ├── Strategist_Main.json
│   ├── Copywriter_Main.json
│   └── ...
├── sub-workflows/           # Sub-workflow JSON files
│   ├── Log_Cost_Event.json
│   ├── Acquire_Lock.json
│   └── ...
├── deploy_to_n8n.sh         # Main deployment script
├── add_mock_mode.py         # Mock mode patcher
├── workflow_ids.env         # Generated: workflow IDs after import
└── README.md                # This file
```

## Environment Variables

| Variable             | Required | Description                                        |
| -------------------- | -------- | -------------------------------------------------- |
| `N8N_API_KEY`        | ✅       | Your n8n API key                                   |
| `N8N_URL`            | ✅       | Your n8n instance URL                              |
| `TAG_NAME`           | ❌       | Tag to apply (default: "My Workflows")             |
| `SUB_WORKFLOWS_DIR`  | ❌       | Path to sub-workflows (default: ./sub-workflows)   |
| `MAIN_WORKFLOWS_DIR` | ❌       | Path to main-workflows (default: ./main-workflows) |

## Sharing With Others

To share this toolkit:

1. **Zip the folder**:

   ```bash
   zip -r brand-infinity-workflows.zip brand-infinity-workflows/
   ```

2. **Send to friend**

3. **Friend runs**:

   ```bash
   unzip brand-infinity-workflows.zip
   cd brand-infinity-workflows

   # Set their credentials
   export N8N_API_KEY='their-key'
   export N8N_URL='https://their-n8n.com'
   export TAG_NAME='Brand Infinity Engine'

   # Deploy
   ./deploy_to_n8n.sh
   ```

## Mock Mode

For testing without spending money on API calls:

```bash
# Patch workflows with mock mode support
python3 add_mock_mode.py

# Re-deploy the updated workflows
./deploy_to_n8n.sh

# Enable mock mode in n8n
# Add environment variable: MOCK_MODE=true
```

## Output

After running `deploy_to_n8n.sh`, check `workflow_ids.env` for all the imported workflow IDs:

```bash
cat workflow_ids.env
```

Use these IDs to configure environment variables in n8n for sub-workflow references.
