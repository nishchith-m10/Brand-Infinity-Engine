import 'dotenv/config';
import { ping, listWorkflows, importWorkflow, setOverrides } from '../utils/n8n_mcp.js';

// Parse CLI args: --token=xxx --url=xxx
const args = process.argv.slice(2);
const overrides = {};
for (const arg of args) {
  if (arg.startsWith('--token=')) overrides.mcpToken = arg.split('=')[1];
  if (arg.startsWith('--url=')) overrides.mcpUrl = arg.split('=')[1];
}

if (overrides.mcpToken || overrides.mcpUrl) {
  console.log('Using CLI overrides:', overrides);
  setOverrides(overrides);
}

async function run() {
  console.log('== n8n MCP Probe ==');
  console.log('Usage: node scripts/n8n_probe.js [--token=xxx] [--url=xxx]');

  try {
    console.log('-- ping --');
    const p = await ping();
    console.log(JSON.stringify(p, null, 2));
  } catch (e) {
    console.error('Ping error:', e.message);
  }

  try {
    console.log('-- listWorkflows --');
    const l = await listWorkflows();
    console.log(JSON.stringify(l, null, 2));
  } catch (e) {
    console.error('List error:', e.message);
  }

  // Do not auto-import workflows without explicit need
  console.log('Probe complete.');
}

run().catch(e => { console.error('Probe failed:', e); process.exit(1); });
