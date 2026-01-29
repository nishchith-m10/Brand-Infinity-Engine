# Brand Infinity Engine API v1 Contract

**Version**: 1.0.0  
**Base Path**: `/api/v1`  
**Status**: Active  
**Deprecation Date**: TBD  
**Sunset Date**: TBD  

---

## 1. Overview

The Brand Infinity Engine REST API provides endpoints for managing AI-powered content creation workflows, including campaign management, content generation, asset management, and publishing orchestration.

### 1.1 Version Information

- **Current Version**: v1
- **API Prefix**: `/api/v1`
- **Version Header**: `X-API-Version` (optional, defaults to v1)
- **Content Type**: `application/json`
- **Authentication**: Session-based (cookie) or API key (header)

### 1.2 Stability Guarantees

**v1 API Contract Guarantees:**
- ✅ Existing endpoints will not be removed without deprecation notice
- ✅ Required request fields will not change
- ✅ Response envelope structure (`success`, `data`, `error`) will remain consistent
- ✅ HTTP status codes for existing scenarios will not change
- ⚠️ Optional fields may be added to requests (backward compatible)
- ⚠️ New fields may be added to responses (clients should ignore unknown fields)
- ⚠️ New endpoints may be added at any time
- ⚠️ Error message text may change (use error codes instead)

---

## 2. Standard Response Envelopes

### 2.1 Success Response

All successful responses follow this structure:

```typescript
{
  success: true,
  data: T,              // Response payload (type varies by endpoint)
  meta?: {              // Optional metadata
    count?: number,     // Total count for paginated responses
    limit?: number,     // Page size
    offset?: number,    // Page offset
    timestamp?: string  // Response generation time (ISO 8601)
  },
  requestId?: string,   // Trace ID for debugging
  timestamp?: string    // Response timestamp (ISO 8601)
}
```

**HTTP Status Codes for Success:**
- `200 OK` - Standard success
- `201 Created` - Resource created successfully
- `204 No Content` - Success with no response body

### 2.2 Error Response

All error responses follow this structure:

```typescript
{
  success: false,
  error: {
    code: string,        // Machine-readable error code
    message: string,     // Human-readable error message
    details?: unknown,   // Additional error context (e.g., validation errors)
    requestId?: string,  // Trace ID for debugging
    timestamp?: string   // Error timestamp (ISO 8601)
  }
}
```

**Standard Error Codes:**

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `INVALID_PARAMETER` | 400 | Invalid parameter value |
| `MISSING_REQUIRED_FIELD` | 400 | Required field missing |
| `INVALID_INPUT_FORMAT` | 400 | Input format incorrect |
| `AUTHENTICATION_REQUIRED` | 401 | User not authenticated |
| `INVALID_CREDENTIALS` | 401 | Invalid login credentials |
| `SESSION_EXPIRED` | 401 | Session has expired |
| `UNAUTHORIZED_ACCESS` | 403 | Insufficient permissions |
| `RESOURCE_FORBIDDEN` | 403 | Access denied to resource |
| `BRAND_ACCESS_DENIED` | 403 | No access to brand |
| `RESOURCE_NOT_FOUND` | 404 | Resource does not exist |
| `CAMPAIGN_NOT_FOUND` | 404 | Campaign not found |
| `CONFLICT` | 409 | Resource already exists |
| `DUPLICATE_RESOURCE` | 409 | Duplicate entry |
| `INVALID_STATE_TRANSITION` | 409 | Invalid workflow state |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `QUOTA_EXCEEDED` | 429 | Usage quota exceeded |
| `INTERNAL_ERROR` | 500 | Internal server error |
| `DATABASE_ERROR` | 500 | Database operation failed |
| `PROVIDER_ERROR` | 500 | External provider error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |
| `MAINTENANCE_MODE` | 503 | System maintenance |

---

## 3. API Endpoints by Category

### 3.1 Health & System

#### GET /api/v1/health
**Purpose**: Health check endpoint  
**Auth**: None required  
**Response**: `{ status: "ok", timestamp: string }`

---

### 3.2 Campaigns

#### GET /api/v1/campaigns
**Purpose**: List user's campaigns  
**Auth**: Required  
**Query Params**:
- `status?: string` - Filter by status
- `limit?: number` - Results per page (default: 20, max: 100)
- `offset?: number` - Pagination offset

**Response**:
```typescript
{
  success: true,
  data: Campaign[],
  meta: { count: number, limit: number, offset: number }
}
```

#### POST /api/v1/campaigns
**Purpose**: Create new campaign  
**Auth**: Required  
**Request Body**:
```typescript
{
  name: string,              // Campaign name (required)
  description?: string,      // Optional description
  brand_id: string,          // UUID of brand (required)
  budget_tier: 'economy' | 'standard' | 'premium',
  goals?: string[],          // Campaign objectives
  target_platforms?: string[]
}
```

#### GET /api/v1/campaigns/[id]
**Purpose**: Get campaign details  
**Auth**: Required  
**Path Params**: `id` - Campaign UUID

#### PUT /api/v1/campaigns/[id]
**Purpose**: Update campaign  
**Auth**: Required  
**Request Body**: Same as POST (all fields optional)

#### DELETE /api/v1/campaigns/[id]
**Purpose**: Soft delete campaign  
**Auth**: Required

#### POST /api/v1/campaigns/[id]/trigger
**Purpose**: Trigger campaign workflow stage  
**Auth**: Required  
**Request Body**:
```typescript
{
  stage: 'brief' | 'script' | 'video' | 'publish',
  force?: boolean,
  config?: {
    provider?: string,
    tier?: 'economy' | 'standard' | 'premium'
  }
}
```

#### GET /api/v1/campaigns/[id]/analytics
**Purpose**: Get campaign analytics  
**Auth**: Required

#### GET /api/v1/campaigns/[id]/progress
**Purpose**: Get campaign progress status  
**Auth**: Required

---

### 3.3 Creative Briefs

#### GET /api/v1/briefs
**Purpose**: List briefs  
**Auth**: Required  
**Query Params**: `campaign_id?, status?, limit?, offset?`

#### POST /api/v1/briefs
**Purpose**: Create brief  
**Auth**: Required

#### GET /api/v1/briefs/[id]
**Purpose**: Get brief details  
**Auth**: Required

#### PUT /api/v1/briefs/[id]
**Purpose**: Update brief  
**Auth**: Required

#### POST /api/v1/briefs/[id]/approve
**Purpose**: Approve brief  
**Auth**: Required  
**Request Body**: `{ notes?: string }`

#### POST /api/v1/briefs/[id]/reject
**Purpose**: Reject brief  
**Auth**: Required  
**Request Body**: `{ reason: string, notes?: string }`

---

### 3.4 Scripts

#### GET /api/v1/scripts
**Purpose**: List scripts  
**Auth**: Required  
**Query Params**: `brief_id?, status?, limit?, offset?`

#### POST /api/v1/scripts
**Purpose**: Create script  
**Auth**: Required

#### GET /api/v1/scripts/[id]
**Purpose**: Get script details  
**Auth**: Required

#### PUT /api/v1/scripts/[id]
**Purpose**: Update script  
**Auth**: Required

#### POST /api/v1/scripts/[id]/approve
**Purpose**: Approve script  
**Auth**: Required

#### POST /api/v1/scripts/[id]/reject
**Purpose**: Reject script  
**Auth**: Required

#### GET /api/v1/scripts/[id]/hooks
**Purpose**: Get script hooks for video production  
**Auth**: Required

---

### 3.5 Videos

#### GET /api/v1/videos
**Purpose**: List videos  
**Auth**: Required  
**Query Params**: `script_id?, status?, limit?, offset?`

#### POST /api/v1/videos
**Purpose**: Create video  
**Auth**: Required

#### GET /api/v1/videos/[id]
**Purpose**: Get video details  
**Auth**: Required

#### PUT /api/v1/videos/[id]
**Purpose**: Update video metadata  
**Auth**: Required

#### POST /api/v1/videos/[id]/approve
**Purpose**: Approve video  
**Auth**: Required

#### POST /api/v1/videos/[id]/reject
**Purpose**: Reject video  
**Auth**: Required

#### POST /api/v1/videos/[id]/transition
**Purpose**: Transition video status  
**Auth**: Required  
**Request Body**: `{ status: string, reason?: string }`

#### GET /api/v1/videos/[id]/scenes
**Purpose**: Get video scene breakdown  
**Auth**: Required

#### GET /api/v1/videos/[id]/variants
**Purpose**: List platform variants for video  
**Auth**: Required

---

### 3.6 Platform Variants

#### GET /api/v1/variants
**Purpose**: List platform variants  
**Auth**: Required  
**Query Params**: `video_id?, platform?`

#### POST /api/v1/variants
**Purpose**: Create platform variants  
**Auth**: Required  
**Request Body**:
```typescript
{
  video_id: string,  // UUID (required)
  platforms: ('youtube' | 'tiktok' | 'instagram' | 'twitter' | 'linkedin' | 'facebook')[]
}
```

#### GET /api/v1/variants/[id]
**Purpose**: Get variant details  
**Auth**: Required

---

### 3.7 Publications

#### GET /api/v1/publications
**Purpose**: List scheduled publications  
**Auth**: Required  
**Query Params**: `status?, platform?, limit?, offset?`

#### POST /api/v1/publications
**Purpose**: Schedule publication  
**Auth**: Required  
**Request Body**:
```typescript
{
  variant_id: string,        // UUID (required)
  scheduled_time: string,    // ISO 8601 datetime, must be ≥5 minutes in future
  platform?: string,         // Override variant platform
  caption?: string,          // Max 5000 characters
  hashtags?: string[]        // Max 30 tags, each ≤100 chars, must start with #
}
```

#### GET /api/v1/publications/[id]
**Purpose**: Get publication details  
**Auth**: Required

---

### 3.8 Brand Management

#### GET /api/v1/brands
**Purpose**: List user's brands  
**Auth**: Required

#### POST /api/v1/brands
**Purpose**: Create brand  
**Auth**: Required

#### GET /api/v1/brand-identity
**Purpose**: Get brand identity details  
**Auth**: Required  
**Query Params**: `brand_id: string`

#### POST /api/v1/brand-identity
**Purpose**: Save brand identity  
**Auth**: Required

---

### 3.9 Brand Assets

#### GET /api/v1/brand-assets
**Purpose**: List brand assets  
**Auth**: Required  
**Query Params**: `brand_id: string, type?`

#### POST /api/v1/brand-assets
**Purpose**: Create brand asset  
**Auth**: Required

#### POST /api/v1/brand-assets/upload
**Purpose**: Upload brand asset file  
**Auth**: Required  
**Content-Type**: `multipart/form-data`

---

### 3.10 Knowledge Bases

#### GET /api/v1/knowledge-bases
**Purpose**: List knowledge bases  
**Auth**: Required  
**Query Params**: `brand_id?, campaign_id?`

#### POST /api/v1/knowledge-bases
**Purpose**: Create knowledge base  
**Auth**: Required  
**Request Body**:
```typescript
{
  name: string,
  description?: string,
  brand_id: string,
  campaign_id?: string,
  type: 'text' | 'url' | 'file',
  content?: string  // Required if type is 'text'
}
```

#### GET /api/v1/knowledge-bases/[id]
**Purpose**: Get knowledge base details  
**Auth**: Required

#### PUT /api/v1/knowledge-bases/[id]
**Purpose**: Update knowledge base  
**Auth**: Required

#### DELETE /api/v1/knowledge-bases/[id]
**Purpose**: Delete knowledge base  
**Auth**: Required

---

### 3.11 Images

#### GET /api/v1/images
**Purpose**: List generated images  
**Auth**: Required

#### POST /api/v1/images/generate
**Purpose**: Generate AI image  
**Auth**: Required

---

### 3.12 Trends

#### GET /api/v1/trends
**Purpose**: Get trending content  
**Auth**: Required  
**Query Params**: `platform?, region?, limit?`

#### GET /api/v1/trends/[id]/virality
**Purpose**: Analyze trend virality  
**Auth**: Required

#### POST /api/v1/trends/refresh
**Purpose**: Refresh trends data  
**Auth**: Required  
**Request Body**:
```typescript
{
  platforms?: ('youtube' | 'tiktok' | 'instagram' | 'twitter' | 'linkedin')[],
  region?: string,
  limit?: number  // 1-100, default 20
}
```

---

### 3.13 Requests & Tasks

#### GET /api/v1/requests
**Purpose**: List content requests  
**Auth**: Required  
**Query Params**: `campaign_id?, status?, limit?, offset?`

#### POST /api/v1/requests
**Purpose**: Create content request  
**Auth**: Required

#### GET /api/v1/requests/[id]
**Purpose**: Get request details  
**Auth**: Required

#### POST /api/v1/requests/estimate
**Purpose**: Estimate request cost  
**Auth**: Required

#### POST /api/v1/requests/[id]/retry
**Purpose**: Retry failed request  
**Auth**: Required

#### POST /api/v1/requests/[id]/transition
**Purpose**: Transition request state  
**Auth**: Required

#### GET /api/v1/requests/[id]/progress
**Purpose**: Get request progress  
**Auth**: Required

#### GET /api/v1/requests/[id]/events
**Purpose**: Get request event log  
**Auth**: Required

#### POST /api/v1/requests/[id]/tasks/[taskId]/retry
**Purpose**: Retry specific task  
**Auth**: Required

---

### 3.14 Director (AI Agent)

#### POST /api/v1/director/launch
**Purpose**: Launch Director AI agent  
**Auth**: Required

#### GET /api/v1/director
**Purpose**: Get Director agent status  
**Auth**: Required

---

### 3.15 Conversation

#### POST /api/v1/conversation/start
**Purpose**: Start AI conversation  
**Auth**: Required  
**Request Body**:
```typescript
{
  message: string,
  brand_id: string,
  campaign_id?: string,
  context?: Record<string, unknown>,
  provider?: string,
  model_id?: string
}
```

#### POST /api/v1/conversation/[id]/continue
**Purpose**: Continue conversation  
**Auth**: Required  
**Request Body**:
```typescript
{
  message: string,
  answers?: Record<string, unknown>,
  provider?: string,
  model_id?: string
}
```

#### GET /api/v1/conversation/[id]
**Purpose**: Get conversation history  
**Auth**: Required

#### POST /api/v1/conversation/stream
**Purpose**: Streaming conversation endpoint  
**Auth**: Required  
**Response**: Server-Sent Events (SSE)

---

### 3.16 Orchestration

#### POST /api/v1/orchestrator/process
**Purpose**: Control orchestration process  
**Auth**: Required  
**Request Body**:
```typescript
{
  request_id: string,
  action: 'start' | 'pause' | 'resume' | 'cancel',
  force?: boolean,
  reason?: string  // Required for pause/resume/cancel
}
```

---

### 3.17 Analytics

#### GET /api/v1/analytics
**Purpose**: Get system analytics  
**Auth**: Required

#### GET /api/v1/analytics/overview
**Purpose**: Get analytics overview  
**Auth**: Required

#### GET /api/v1/dashboard/stats
**Purpose**: Get dashboard statistics  
**Auth**: Required

---

### 3.18 Models

#### GET /api/v1/models
**Purpose**: List configured AI models  
**Auth**: Required

#### GET /api/v1/models/available
**Purpose**: Get available AI models  
**Auth**: Required

---

### 3.19 Platforms

#### GET /api/v1/platforms
**Purpose**: List supported social platforms  
**Auth**: Required

---

### 3.20 Webhooks & Callbacks

#### POST /api/v1/callbacks/n8n
**Purpose**: N8N workflow callback endpoint  
**Auth**: HMAC signature validation  
**Headers**: `x-n8n-signature`  
**Request Body**: N8N workflow payload

---

### 3.21 Admin & Debug

#### POST /api/v1/admin/undelete
**Purpose**: Restore soft-deleted resource  
**Auth**: Required (admin only)

---

## 4. Common Patterns

### 4.1 Pagination

Paginated endpoints support these query parameters:
- `limit`: Results per page (default varies, max 100)
- `offset`: Number of items to skip

Response includes:
```typescript
{
  data: T[],
  meta: {
    count: number,    // Total available items
    limit: number,    // Page size used
    offset: number    // Offset used
  }
}
```

### 4.2 Filtering

Many list endpoints support filtering:
- `status`: Filter by workflow status
- `campaign_id`: Filter by campaign
- `brand_id`: Filter by brand
- `platform`: Filter by social platform

### 4.3 Approval Workflows

Resources follow approval patterns:
- **States**: `draft`, `pending_review`, `approved`, `rejected`
- **Approve**: `POST /[resource]/[id]/approve` with optional notes
- **Reject**: `POST /[resource]/[id]/reject` with required reason

### 4.4 UUID Format

All resource IDs are UUIDs (v4):
- Format: `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`
- Example: `550e8400-e29b-41d4-a716-446655440000`

### 4.5 Timestamps

All timestamps use ISO 8601 format:
- Format: `YYYY-MM-DDTHH:mm:ss.sssZ`
- Example: `2026-01-11T21:30:00.000Z`
- Timezone: UTC

---

## 5. Rate Limiting

**Current Implementation**: TBD in Phase I  
**Planned Headers**:
- `X-RateLimit-Limit`: Maximum requests per window
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset timestamp

**Expected Behavior**:
- HTTP 429 when rate limit exceeded
- `Retry-After` header with seconds to wait

---

## 6. Versioning Strategy

### 6.1 Version Detection

The API version is determined by:
1. URL path prefix (e.g., `/api/v1/...`)
2. Optional `X-API-Version` header (defaults to v1)

### 6.2 Breaking vs Non-Breaking Changes

**Non-Breaking (Patch/Minor)**:
- Adding new optional fields to requests
- Adding new fields to responses
- Adding new endpoints
- Adding new enum values
- Improving error messages

**Breaking (Major)**:
- Removing endpoints
- Removing request/response fields
- Changing required fields
- Changing field types
- Changing HTTP status codes
- Changing error codes

### 6.3 Deprecation Process

When deprecating v1 features:
1. **Announcement**: 90 days notice via changelog
2. **Headers**: `Deprecation: true` header added
3. **Documentation**: Marked as deprecated in docs
4. **Migration Guide**: v1→v2 guide published
5. **Sunset**: Minimum 180 days after deprecation notice

---

## 7. Security

### 7.1 Authentication

- **Method**: Session cookies or API keys
- **Header**: `Authorization: Bearer <token>` (if using API keys)
- **Cookie**: `session` (if using session auth)

### 7.2 Authorization

- **Row-Level Security (RLS)**: Enabled on all tables
- **Brand Access**: Users can only access their own brands
- **Campaign Access**: Users can only access campaigns for their brands

### 7.3 HTTPS

- **Required**: All production API calls must use HTTPS
- **Development**: HTTP allowed on localhost only

---

## 8. Client Recommendations

### 8.1 Error Handling

```typescript
// Always check success field
if (!response.success) {
  // Use error.code for logic, not error.message
  switch (response.error.code) {
    case 'AUTHENTICATION_REQUIRED':
      redirectToLogin();
      break;
    case 'RATE_LIMIT_EXCEEDED':
      retryAfterDelay();
      break;
    default:
      showError(response.error.message);
  }
}
```

### 8.2 Idempotency

For POST requests that create resources:
- Include `Idempotency-Key` header with UUID
- Safe to retry on network failure
- Same key returns same response (cached for 24h)

### 8.3 Timeouts

Recommended client timeouts:
- Standard requests: 30 seconds
- File uploads: 120 seconds
- Streaming endpoints: No timeout (SSE)

---

## 9. Changelog

### Version 1.0.0 (January 11, 2026)
- Initial v1 API contract
- Standardized error response envelope
- Platform variant and publication endpoints
- Comprehensive validation schemas

---

## 10. Contact & Support

- **Documentation**: `/docs/api/`
- **Issues**: GitHub Issues
- **Deprecation Notices**: Published in changelog
- **API Status**: Check `/api/v1/health`

---

**Contract Status**: ✅ Active  
**Last Updated**: January 11, 2026  
**Next Review**: Q2 2026
