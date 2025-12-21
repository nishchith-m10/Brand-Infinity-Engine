#!/usr/bin/env node
/**
 * Quick token validator for n8n setup
 * Usage: node scripts/validate_n8n_tokens.js
 */

import 'dotenv/config';

function validateEnvTokens() {
  console.log('=== n8n Token Validation ===\n');
  
  const apiKey = process.env.N8N_API_KEY;
  const mcpToken = process.env.N8N_MCP_TOKEN;
  const host = process.env.N8N_HOST;
  const protocol = process.env.N8N_PROTOCOL || 'https';
  const port = process.env.N8N_PORT || (protocol === 'https' ? 443 : 5678);

  console.log(`n8n Host: ${protocol}://${host}:${port}`);
  
  // Check API Key
  if (!apiKey || apiKey.includes('your_') || apiKey === 'your_n8n_api_key_here') {
    console.log('❌ N8N_API_KEY: Invalid or placeholder value');
    console.log('   Please set a real Personal Access Token from n8n Settings > Personal Access Tokens');
  } else {
    console.log(`✅ N8N_API_KEY: Set (***${apiKey.slice(-4)})`);
  }

  // Check MCP Token
  if (!mcpToken || mcpToken.includes('your_')) {
    console.log('⚠️  N8N_MCP_TOKEN: Not set (will use N8N_API_KEY for MCP)');
  } else {
    console.log(`✅ N8N_MCP_TOKEN: Set (***${mcpToken.slice(-4)})`);
  }

  // Check host
  if (!host || host.includes('your_')) {
    console.log('❌ N8N_HOST: Invalid or placeholder value');
  } else {
    console.log(`✅ N8N_HOST: ${host}`);
  }

  console.log('\nNext steps:');
  console.log('1. If tokens are invalid, update .env with real tokens from your n8n instance');
  console.log('2. Run: node scripts/n8n_probe.js');
  console.log('3. If 401 persists, verify token permissions in n8n Settings');
}

validateEnvTokens();