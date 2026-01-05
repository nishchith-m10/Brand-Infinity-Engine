import fs from 'fs';

// CLI overrides (set via process.env before import or pass to functions)
let CLI_MCP_URL = null;
let CLI_MCP_TOKEN = null;

export function setOverrides({ mcpUrl, mcpToken }) {
  CLI_MCP_URL = mcpUrl;
  CLI_MCP_TOKEN = mcpToken;
}

function getMcpUrl() {
  return CLI_MCP_URL || process.env.N8N_MCP_SERVER_URL || `${process.env.N8N_PROTOCOL || 'https'}://${process.env.N8N_HOST}:${process.env.N8N_PORT || 5678}/mcp-server/http`;
}

function getMcpToken() {
  return CLI_MCP_TOKEN || process.env.N8N_MCP_TOKEN || process.env.N8N_API_KEY;
}

function authHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  const token = getMcpToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function sendMCP(method, params = {}) {
  const body = { method, params };
  const url = getMcpUrl();
  
  console.log(`[MCP] ${method} -> ${url}`);
  console.log(`[MCP] Token: ${getMcpToken() ? '***' + getMcpToken().slice(-4) : 'NONE'}`);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
      timeout: 15000
    });

    const text = await res.text();
    console.log(`[MCP] Response ${res.status}: ${text.slice(0, 200)}${text.length > 200 ? '...' : ''}`);
    
    let json;
    try { json = JSON.parse(text); } catch (e) { json = { status: res.status, raw: text }; }
    return { status: res.status, ok: res.ok, data: json };
  } catch (error) {
    console.error(`[MCP] Fetch error: ${error.message}`);
    return { status: 0, ok: false, data: { error: error.message } };
  }
}

export async function ping() {
  // Generic ping: many n8n MCP servers expect a specific payload; this helper uses a simple envelope
  return sendMCP('ping', {});
}

export async function listWorkflows() {
  // Try MCP first
  const r = await sendMCP('workflows.list', {});
  if (r.ok) return r.data;

  // Fallback to REST if API key available
  if (process.env.N8N_API_KEY) {
    const url = `${process.env.N8N_PROTOCOL || 'https'}://${process.env.N8N_HOST}:${process.env.N8N_PORT || 443}/rest/workflows`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${process.env.N8N_API_KEY}` } });
    return { status: res.status, ok: res.ok, data: await res.json() };
  }

  return r;
}

export async function importWorkflow(workflowJson) {
  // workflowJson can be object or string path
  let payload = workflowJson;
  if (typeof workflowJson === 'string' && fs.existsSync(workflowJson)) {
    payload = JSON.parse(fs.readFileSync(workflowJson, 'utf8'));
  }

  // Try MCP import call
  const r = await sendMCP('workflows.import', { workflow: payload });
  if (r.ok) return r.data;

  // Fallback: attempt REST import (multipart) if API key available
  if (process.env.N8N_API_KEY) {
    const url = `${process.env.N8N_PROTOCOL || 'https'}://${process.env.N8N_HOST}:${process.env.N8N_PORT || 443}/rest/workflows/import`;
    // Note: Node fetch multipart file upload requires FormData; keep simple and post JSON if REST supports it
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.N8N_API_KEY}` },
      body: JSON.stringify({ workflow: payload })
    });
    return { status: res.status, ok: res.ok, data: await res.json() };
  }

  return r;
}

export default { ping, listWorkflows, importWorkflow, sendMCP };
