# Environment Variables Template

Copy these variables to `/frontend/.env.local` and fill in the values.

```bash
# ============================================
# Brand Infinity Engine - Environment Variables
# ============================================

# --------------------------------------------
# Supabase Configuration (REQUIRED)
# --------------------------------------------
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Service role key - KEEP SECRET, server-side only
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# --------------------------------------------
# Authentication (REQUIRED)
# --------------------------------------------
# Hashed dashboard passcode (use bcrypt to generate)
# Generate with: node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('YourPasscode123', 10));"
DASHBOARD_PASSCODE_HASH=$2a$10$your-hashed-passcode-here

# --------------------------------------------
# OpenAI Configuration (REQUIRED)
# --------------------------------------------
OPENAI_API_KEY=sk-your-openai-key-here

# --------------------------------------------
# N8N Integration (REQUIRED)
# --------------------------------------------
# N8N webhook base URL (must be HTTPS in production)
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook

# --------------------------------------------
# Redis/Upstash (REQUIRED for rate limiting)
# --------------------------------------------
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token-here

# --------------------------------------------
# Sentry (OPTIONAL - for error tracking)
# --------------------------------------------
SENTRY_ORG=your-sentry-org
SENTRY_PROJECT=your-sentry-project
SENTRY_AUTH_TOKEN=your-sentry-auth-token
NEXT_PUBLIC_SENTRY_DSN=https://your-sentry-dsn

# --------------------------------------------
# Application URLs (OPTIONAL)
# --------------------------------------------
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NEXT_PUBLIC_API_URL=/api/v1

# --------------------------------------------
# Development/Production Mode
# --------------------------------------------
NODE_ENV=development  # or 'production'
```

## How to Generate Dashboard Passcode Hash

```bash
# Install bcryptjs if not already installed
npm install bcryptjs

# Generate hash
node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('YourPasscode123', 10));"
```

## Security Notes

1. **NEVER commit .env.local to version control**
2. Keep `SUPABASE_SERVICE_ROLE_KEY` secret - never expose to browser
3. Use HTTPS URLs in production
4. Rotate keys regularly
5. Use different keys for development and production
6. Store production secrets in secure vault (Vercel, AWS Secrets Manager, etc.)

## Required vs Optional Variables

### Required (Application won't work without these):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DASHBOARD_PASSCODE_HASH`
- `OPENAI_API_KEY`
- `N8N_WEBHOOK_URL`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

### Optional (Application works with reduced functionality):
- `SENTRY_*` - Error tracking will be disabled
- `NEXT_PUBLIC_APP_URL` - Falls back to request URL
- `NEXT_PUBLIC_API_URL` - Falls back to `/api/v1`

## Environment-Specific Configuration

### Development
```bash
NODE_ENV=development
N8N_WEBHOOK_URL=http://localhost:5678/webhook
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Production
```bash
NODE_ENV=production
N8N_WEBHOOK_URL=https://n8n.yourdomain.com/webhook
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

Ensure HTTPS URLs in production for security.

