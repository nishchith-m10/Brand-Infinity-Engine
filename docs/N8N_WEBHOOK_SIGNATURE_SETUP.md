# N8N Webhook Signature Configuration

## Critical Security Implementation

This document explains how to configure n8n workflows to send signed webhook callbacks, which are now **required** for all webhook callbacks to `/api/v1/callbacks/n8n`.

## Why This Matters

**SECURITY RISK**: Without signature validation, anyone could trigger your workflows by posting to your webhook endpoint, potentially:
- Executing unauthorized workflows
- Manipulating campaign data
- Causing resource exhaustion
- Injecting malicious payloads

## Setup Steps

### 1. Generate Webhook Secret

Generate a secure random secret key:

```bash
openssl rand -hex 32
```

Add this to your `.env` file:

```env
N8N_WEBHOOK_SECRET=your_generated_secret_here
```

### 2. Configure N8N Workflows

For **every** n8n workflow that sends callbacks to the Brand Infinity Engine, add the following nodes:

#### Step 1: Add Function Node for Signature Generation

Add a **Function** node before your HTTP Request node with this code:

```javascript
const crypto = require('crypto');

// Get webhook secret from environment or credentials
const webhookSecret = $env.N8N_WEBHOOK_SECRET;

// Get the payload that will be sent
const payload = JSON.stringify($input.item.json);

// Generate HMAC SHA256 signature
const signature = crypto
  .createHmac('sha256', webhookSecret)
  .update(payload)
  .digest('hex');

// Return data with signature
return {
  json: {
    payload: $input.item.json,
    signature: signature
  }
};
```

#### Step 2: Configure HTTP Request Node

In your **HTTP Request** node that sends the callback:

**URL**: `https://your-domain.com/api/v1/callbacks/n8n`

**Method**: `POST`

**Headers**:
```json
{
  "Content-Type": "application/json",
  "x-n8n-signature": "={{ $json.signature }}"
}
```

**Body**:
```json
{
  "requestId": "={{ $json.payload.requestId }}",
  "taskId": "={{ $json.payload.taskId }}",
  "executionId": "={{ $json.payload.executionId }}",
  "status": "={{ $json.payload.status }}",
  "result": "={{ $json.payload.result }}"
}
```

### 3. Set N8N Environment Variable

In your n8n instance, set the environment variable:

**Docker Compose**:
```yaml
services:
  n8n:
    environment:
      - N8N_WEBHOOK_SECRET=your_generated_secret_here
```

**Standalone**:
```bash
export N8N_WEBHOOK_SECRET=your_generated_secret_here
```

## Validation

Test that signatures are working:

### Valid Request (should succeed):
```bash
# Generate signature
SECRET="your_webhook_secret"
PAYLOAD='{"requestId":"test","taskId":"test","status":"success"}'
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | cut -d' ' -f2)

# Send request
curl -X POST https://your-domain.com/api/v1/callbacks/n8n \
  -H "Content-Type: application/json" \
  -H "x-n8n-signature: $SIGNATURE" \
  -d "$PAYLOAD"
```

Expected response: `200 OK`

### Invalid Request (should fail):
```bash
# Send without signature
curl -X POST https://your-domain.com/api/v1/callbacks/n8n \
  -H "Content-Type: application/json" \
  -d '{"requestId":"test","taskId":"test","status":"success"}'
```

Expected response: `401 Unauthorized - Missing webhook signature`

## Security Best Practices

1. **Never commit secrets**: Keep `N8N_WEBHOOK_SECRET` in `.env` only
2. **Rotate regularly**: Change the secret every 90 days
3. **Use strong secrets**: Minimum 32 characters, cryptographically random
4. **Monitor failures**: Check logs for unauthorized access attempts
5. **Use HTTPS only**: Never send webhooks over HTTP

## Troubleshooting

### Error: "Missing webhook signature"
- Verify `x-n8n-signature` header is being sent
- Check header name matches exactly (case-sensitive)

### Error: "Invalid webhook signature"
- Verify the secret in n8n matches `N8N_WEBHOOK_SECRET` in your .env
- Ensure payload used for signing matches exactly what's sent
- Check for extra whitespace or formatting differences
- Verify using the same hashing algorithm (HMAC-SHA256)

### Error: "Webhook authentication not configured"
- Add `N8N_WEBHOOK_SECRET` to your `.env` file
- Restart the Next.js application

## Migration Guide

If you have existing n8n workflows:

1. Deploy the updated code with signature validation
2. Initially set `N8N_WEBHOOK_SECRET` but keep validation optional
3. Update all n8n workflows to include signatures
4. Test each workflow
5. Enable required validation (already enabled in production)

## Additional Security Features

The webhook endpoint now includes:

1. ✅ **HMAC Signature Validation** - Prevents unauthorized requests
2. ✅ **Constant-time Comparison** - Prevents timing attacks
3. ✅ **Request Validation** - Validates all required fields
4. ✅ **Idempotency** - Prevents duplicate processing
5. ✅ **Circuit Breaker** - Protects against cascading failures
6. ✅ **Retry Logic** - Handles transient failures
7. ✅ **Configurable Timeouts** - Different timeouts per workflow type
8. ✅ **Rate Limiting** - Protects against abuse

---

**Status**: ✅ Implemented and Active
**Priority**: P0 Critical Security
**Last Updated**: January 5, 2026
