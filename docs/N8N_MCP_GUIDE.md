# n8n MCP Server Guide

This document summarizes how to interact with an n8n instance via its MCP (Machine Control Protocol) server and contains a small helper (`utils/n8n_mcp.js`) included in the project.

## Key points
- MCP endpoint: usually exposed at `/mcp-server/http` on the n8n host. Set `N8N_MCP_SERVER_URL` or rely on `N8N_PROTOCOL`, `N8N_HOST`, `N8N_PORT` env vars.
- Authentication: MCP commonly uses a bearer token. Provide it via `N8N_MCP_TOKEN` or `N8N_API_KEY` in your environment.
- Workflow MCP vs REST: n8n also exposes REST endpoints (`/rest/*`) that accept Personal Access Tokens. If MCP is misconfigured, REST import/list endpoints may still work with a REST token.

## Token Setup (CRITICAL)
**Problem**: If your `.env` contains placeholder values like `your_n8n_api_key_here`, both MCP and REST endpoints will return HTTP 401 Unauthorized.

**Solution**:
1. Log into your n8n instance UI
2. Go to Settings > Personal Access Tokens
3. Generate a new token (for REST endpoints)
4. For MCP: Check Settings > MCP and generate an MCP Access Token if MCP functionality is required
5. Update your `.env`:
```
N8N_API_KEY=pa_1234567890abcdef  # Personal Access Token (REST)
N8N_MCP_TOKEN=mcp_abcdef1234567890  # MCP Token (if different)
```

**Test your tokens**:
```bash
# Test the current setup
node scripts/n8n_probe.js

# Test with specific token
node scripts/n8n_probe.js --token=pa_your_real_token_here
```

## Included helper
- `utils/n8n_mcp.js` exposes:
  - `ping()` — send a simple MCP envelope to probe connectivity.
  - `listWorkflows()` — attempts MCP listing then falls back to REST if available.
  - `importWorkflow(workflowJson)` — tries an MCP import call, then falls back to REST import.

Usage
1. Configure env vars (example in `.env.local`):

```
N8N_PROTOCOL=https
N8N_HOST=your-n8n-host.example
N8N_PORT=443
N8N_MCP_TOKEN=your_mcp_token_here
N8N_API_KEY=your_rest_personal_access_token_here
```

2. From node code:

```js
import { ping, listWorkflows, importWorkflow } from '../utils/n8n_mcp.js';

const p = await ping();
console.log('MCP ping:', p);

const list = await listWorkflows();
console.log('Workflows:', list);

await importWorkflow('./workflows/pillar_1_strategist/generate_brief.workflow.json');
```

Notes and troubleshooting
- If MCP returns HTTP 406 or unexpected responses, ensure:
  - The MCP token has been generated in n8n and the token type matches the endpoint (MCP vs REST).
  - At least one workflow in n8n is enabled for MCP (n8n may require workflows to be explicitly exposed to MCP).
  - Check `n8n` logs for MCP-related errors.
- REST import endpoints differ: they often expect multipart form `file=@...` uploads. The helper attempts a JSON POST fallback if multipart tooling isn't available; you can perform a curl-based multipart upload manually if needed.

Security
- Do not commit tokens. Keep `N8N_MCP_TOKEN` and `N8N_API_KEY` in your `.env` or secure vault only.

References
- n8n docs (instance-specific): https://docs.n8n.io
