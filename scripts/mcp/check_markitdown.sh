#!/usr/bin/env bash
set -euo pipefail
PORT=${1:-5678}
HOST=${HOST:-127.0.0.1}
URL="http://${HOST}:${PORT}/mcp-server/http"

if curl -sS --fail "$URL" >/dev/null 2>&1; then
  echo "MarkItDown MCP server is up at $URL"
  exit 0
else
  echo "MarkItDown MCP server not responding at $URL"
  exit 2
fi
