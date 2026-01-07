FROM python:3.10-slim

# Install system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
  build-essential \
  ca-certificates \
  curl \
  git \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install markitdown-mcp and its deps
RUN python -m pip install --upgrade pip setuptools wheel
RUN python -m pip install markitdown-mcp

# Default port
ENV MARKITDOWN_HOST=0.0.0.0
ENV MARKITDOWN_PORT=5678

EXPOSE ${MARKITDOWN_PORT}

CMD ["sh", "-c", "markitdown-mcp --host ${MARKITDOWN_HOST} --port ${MARKITDOWN_PORT}"]
