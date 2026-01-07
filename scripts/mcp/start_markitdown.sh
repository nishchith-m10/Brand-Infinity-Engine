#!/usr/bin/env bash
set -euo pipefail

PORT=${1:-5678}
HOST=${HOST:-127.0.0.1}

echo "Starting MarkItDown MCP server on ${HOST}:${PORT}..."
# The markitdown-mcp package exposes an MCP server compatible endpoint
# This will install and run the package using npx (no global install required)

# Prefer running the Python-based markitdown-mcp server in a virtualenv
VENV_DIR=".venv/markitdown_mcp"
PY_BIN="$VENV_DIR/bin/python"
PIP_BIN="$VENV_DIR/bin/pip"
MARKITDOWN_CMD="$VENV_DIR/bin/markitdown-mcp"

if [ -x "$MARKITDOWN_CMD" ]; then
  echo "Using existing virtualenv at $VENV_DIR"
else
  echo "Creating virtualenv at $VENV_DIR and installing markitdown-mcp (may require Python 3.10+)"
  python3 -m venv "$VENV_DIR" || { echo "Failed to create virtualenv. Ensure Python3 is available."; exit 1; }
  source "$VENV_DIR/bin/activate"
  if ! "$PIP_BIN" install --upgrade pip setuptools wheel >/dev/null 2>&1; then
    echo "Failed to upgrade pip in virtualenv"
  fi
  if ! "$PIP_BIN" install markitdown-mcp >/tmp/markitdown-install.log 2>&1; then
    echo "markitdown-mcp install failed. See /tmp/markitdown-install.log for details"
    echo "Common causes: onnxruntime required by magika; please use Python 3.10+ or install onnxruntime for your platform." 
    echo "Alternative: use 'pipx install markitdown-mcp' or run inside a Python 3.10+ environment." 
    tail -n 200 /tmp/markitdown-install.log || true
    exit 1
  fi
  deactivate || true
fi

# Run the installed markitdown-mcp from the virtualenv
"$MARKITDOWN_CMD" --host "$HOST" --port "$PORT" > /tmp/markitdown-mcp.log 2>&1 &
PID=$!

# Give the server a few seconds to start
sleep 3

URL="http://${HOST}:${PORT}/mcp-server/http"
if curl -sS --fail "$URL" >/dev/null 2>&1; then
  echo "MarkItDown MCP server started (PID=$PID) and responding at $URL"
  echo $PID > /tmp/markitdown-mcp.pid
else
  echo "MarkItDown MCP server did not respond at $URL"
  echo "Check /tmp/markitdown-mcp.log and /tmp/markitdown-install.log for details"
  tail -n 200 /tmp/markitdown-mcp.log || true
  exit 1
fi
