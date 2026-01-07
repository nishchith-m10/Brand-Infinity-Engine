#!/usr/bin/env bash
set -euo pipefail

PORT=${1:-5678}
HOST=${HOST:-127.0.0.1}

echo "Starting MarkItDown MCP server on ${HOST}:${PORT}..."
# The markitdown-mcp package exposes an MCP server compatible endpoint
# This will install and run the package using npx (no global install required)

npx -y markitdown-mcp --host "$HOST" --port "$PORT" &
PID=$!

# Give the server a few seconds to start
sleep 2

URL="http://${HOST}:${PORT}/mcp-server/http"
if curl -sS --fail "$URL" >/dev/null 2>&1; then
  echo "MarkItDown MCP server started (PID=$PID) and responding at $URL"
  echo $PID > /tmp/markitdown-mcp.pid
else
  echo "MarkItDown MCP server did not respond at $URL"
  echo "Check logs or run 'tail -f /tmp/markitdown-mcp.log' if present"
  exit 1
fi
