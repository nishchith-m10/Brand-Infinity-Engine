## MarkItDown MCP server (PDF → Markdown conversion)

We include convenience helpers to run a local MarkItDown MCP server so the MarkItDown browser extension (or other MCP clients) can call it at `http://localhost:5678/mcp-server/http`.

Why this is needed
- The MarkItDown browser extension converts PDFs (and other docs) to Markdown by calling a local or remote MCP server. If the extension is installed but no MCP server is available, conversion will silently fail.

Quick start (recommended)
1. Make sure you have **Python 3.10+** installed. MarkItDown depends on packages (magika) that may require `onnxruntime` which typically needs Python 3.10+.
2. From the repo root run:

   ./scripts/mcp/start_markitdown.sh 5678

   This script creates a virtualenv at `.venv/markitdown_mcp` and installs `markitdown-mcp` (if possible) then starts the server on the chosen port.

3. Confirm the server is healthy:

   ./scripts/mcp/check_markitdown.sh 5678

   Expected output: `MarkItDown MCP server is up at http://127.0.0.1:5678/mcp-server/http`.

Troubleshooting
- Installation may fail due to `onnxruntime` / `magika` dependency resolution problems on some platforms. If the start script fails with an install error:
  - Use Python 3.10+ (we recommend a system with official CPython 3.10+).
  - If you're on macOS ARM or certain Linux distros, you may need to install `onnxruntime` wheels for your platform first (see https://onnxruntime.ai):
    - Example: `python -m pip install onnxruntime` (or `onnxruntime-gpu` if you have GPU support)
  - Alternatively use `pipx install markitdown-mcp` to have pipx manage a venv for you.
  - As a last resort, run the MarkItDown MCP server inside a Linux Docker container with a compatible Python environment.

Using the browser extension
- Configure the MarkItDown extension's MCP server URL to `http://127.0.0.1:5678/mcp-server/http` (or the URL printed by the start script).
- Then open a PDF and click the MarkItDown toolbar; the conversion should succeed if the server is reachable.

If you'd like, I can help you run the server in your environment or create a Dockerfile to make a self-contained image for CI/desktop usage.