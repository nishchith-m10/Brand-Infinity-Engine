# N8N Integration Security - Quick Reference

## 🔒 Security Features (Active)

### 1. Webhook Signature Validation
**Status**: ✅ ACTIVE  
**Impact**: Prevents unauthorized workflow triggers  
**Required**: `N8N_WEBHOOK_SECRET` in `.env`

```bash
# Generate secret
openssl rand -hex 32

# Add to .env
N8N_WEBHOOK_SECRET=<your_secret>
```

### 2. Retry Logic
**Status**: ✅ ACTIVE  
**Impact**: Recovers from transient failures  
**Default**: 3 retries with exponential backoff

### 3. Idempotency
**Status**: ✅ ACTIVE  
**Impact**: Prevents duplicate workflow executions  
**Cache**: 24-hour TTL, auto-cleanup

### 4. Circuit Breaker
**Status**: ✅ ACTIVE  
**Impact**: Protects from cascading failures  
**Threshold**: Opens at 50% failure rate

### 5. Configurable Timeouts
**Status**: ✅ ACTIVE  
**Impact**: Optimizes resource usage  
- Video: 5 minutes
- Image: 2 minutes  
- Quick: 30 seconds

---

## 🚀 Usage Examples

### Basic Workflow Trigger
```typescript
import { getN8NClient } from '@/lib/n8n/client';

const n8n = getN8NClient();
const result = await n8n.triggerWorkflow('/video-production', {
  script: 'Video script here',
  brand_id: 'brand-123',
});
```

### With Custom Options
```typescript
const result = await n8n.triggerWorkflow(
  '/video-production',
  { script: 'Video script' },
  {
    idempotencyKey: 'custom-key-123', // Optional
    timeout: 600000, // 10 minutes (optional)
    retries: 5, // Override default (optional)
  }
);
```

---

## 🔍 Monitoring

### Check Circuit Breaker Status
```typescript
const n8n = getN8NClient();
// Logs automatically on state changes
```

### Key Log Messages
```
✅ [N8N] Workflow triggered - Success
⚠️ [N8N] Request failed, retrying - Retry attempt
🔄 [N8N] Returning cached result - Idempotency hit
⚡ [N8N] Circuit breaker opened - Service degraded
```

---

## ⚠️ Common Errors

### "Missing webhook signature"
**Cause**: n8n workflow not sending signature  
**Fix**: Update workflow to include `x-n8n-signature` header  
**Docs**: See `N8N_WEBHOOK_SIGNATURE_SETUP.md`

### "Invalid webhook signature"  
**Cause**: Secret mismatch between .env and n8n  
**Fix**: Verify `N8N_WEBHOOK_SECRET` matches in both places

### "Circuit breaker open"
**Cause**: High failure rate (>50%)  
**Fix**: Check n8n service health, wait 60s for auto-recovery

---

## 📋 Deployment Checklist

- [ ] Generate `N8N_WEBHOOK_SECRET`
- [ ] Add to `.env` file
- [ ] Update n8n workflows with signature
- [ ] Test signature validation
- [ ] Monitor logs for 24 hours
- [ ] Verify circuit breaker functionality

---

## 🔗 Related Documentation

- **Setup Guide**: `docs/N8N_WEBHOOK_SIGNATURE_SETUP.md`
- **Implementation Details**: `docs/N8N_SECURITY_FIXES_IMPLEMENTATION.md`
- **API Reference**: `lib/n8n/client.ts`
- **Webhook Handler**: `app/api/v1/callbacks/n8n/route.ts`

---

**Last Updated**: January 5, 2026  
**Status**: Production Ready ✅
