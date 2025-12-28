# Conversation API - Slice 2

**Status**: ✅ Basic Implementation Complete  
**Phase**: 6 Part 2 - Multi-Agent Creative Director  
**Slice**: 2 - Session Management API

---

## Overview

This directory contains the conversation management API endpoints. In **Slice 2**, we implement basic session creation and retrieval with hardcoded responses. Full agent intelligence will be added in **Slice 5**.

---

## Endpoints

### 1. POST `/api/v1/conversation/start`

Create a new conversation session.

**Request Body**:
```json
{
  "brand_id": "uuid",
  "initial_message": "I need a campaign for my new product",
  "selected_kb_ids": ["kb-uuid-1", "kb-uuid-2"]  // optional
}
```

**Response (Success)**:
```json
{
  "success": true,
  "session_id": "session-uuid",
  "response": {
    "type": "message",
    "content": "Hello! I'm your Creative Director AI assistant..."
  },
  "state": "initial"
}
```

**Response (Error)**:
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

**Error Codes**:
- `UNAUTHORIZED` (401) - Not authenticated
- `MISSING_BRAND_ID` (400) - Missing brand_id field
- `MISSING_MESSAGE` (400) - Missing initial_message field
- `BRAND_NOT_FOUND` (404) - Brand doesn't exist or access denied
- `SESSION_CREATE_FAILED` (500) - Database error
- `INTERNAL_ERROR` (500) - Unexpected error

---

### 2. GET `/api/v1/conversation/[id]`

Retrieve a conversation session with full message history.

**Response (Success)**:
```json
{
  "success": true,
  "session": {
    "id": "session-uuid",
    "brand_id": "brand-uuid",
    "state": "initial",
    "created_at": "2025-12-26T10:00:00Z",
    "last_activity_at": "2025-12-26T10:00:30Z",
    "parsed_intent": {},
    "answered_questions": {},
    "pending_questions": [],
    "selected_kb_ids": ["kb-1"],
    "active_task_plan_id": null
  },
  "messages": [
    {
      "id": "msg-uuid-1",
      "role": "user",
      "content": "I need a campaign...",
      "created_at": "2025-12-26T10:00:00Z",
      "tokens_used": 0,
      "model_used": null,
      "provider": null,
      "cost_usd": 0,
      "action_taken": null
    },
    {
      "id": "msg-uuid-2",
      "role": "assistant",
      "content": "Hello! I'm your Creative Director...",
      "created_at": "2025-12-26T10:00:30Z",
      "tokens_used": 0,
      "model_used": "hardcoded-slice-2",
      "provider": "none",
      "cost_usd": 0,
      "action_taken": "responded"
    }
  ],
  "stats": {
    "total_messages": 2,
    "total_cost": 0,
    "total_tokens": 0,
    "by_role": [
      {
        "role": "user",
        "message_count": 1,
        "total_tokens": 0,
        "total_cost": 0
      },
      {
        "role": "assistant",
        "message_count": 1,
        "total_tokens": 0,
        "total_cost": 0
      }
    ]
  }
}
```

**Response (Error)**:
```json
{
  "success": false,
  "error": {
    "code": "SESSION_NOT_FOUND",
    "message": "Session not found or access denied"
  }
}
```

**Error Codes**:
- `UNAUTHORIZED` (401) - Not authenticated
- `SESSION_NOT_FOUND` (404) - Session doesn't exist or access denied
- `SESSION_FETCH_FAILED` (500) - Database error
- `INTERNAL_ERROR` (500) - Unexpected error

---

## Testing

### Setup

1. **Get your access token**:
```bash
# Login to your app first, then extract token from browser
# Or use Supabase CLI
supabase auth login
```

2. **Get a brand ID**:
```bash
# Query your brands table
curl -X GET 'http://localhost:3000/api/brands' \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### Test 1: Create New Conversation

```bash
curl -X POST 'http://localhost:3000/api/v1/conversation/start' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -d '{
    "brand_id": "YOUR_BRAND_ID",
    "initial_message": "I need to create a product launch campaign"
  }'
```

**Expected**: Returns session_id and hardcoded greeting.

---

### Test 2: Retrieve Session

```bash
# Use session_id from Test 1
curl -X GET 'http://localhost:3000/api/v1/conversation/SESSION_ID' \
  -H 'Authorization: Bearer YOUR_TOKEN'
```

**Expected**: Returns full session with 2 messages (user + assistant).

---

### Test 3: Missing Brand ID

```bash
curl -X POST 'http://localhost:3000/api/v1/conversation/start' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -d '{
    "initial_message": "Test"
  }'
```

**Expected**: 400 error with code `MISSING_BRAND_ID`.

---

### Test 4: Invalid Brand ID

```bash
curl -X POST 'http://localhost:3000/api/v1/conversation/start' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -d '{
    "brand_id": "00000000-0000-0000-0000-000000000000",
    "initial_message": "Test"
  }'
```

**Expected**: 404 error with code `BRAND_NOT_FOUND`.

---

### Test 5: Unauthorized Access

```bash
curl -X GET 'http://localhost:3000/api/v1/conversation/SOMEONE_ELSES_SESSION_ID' \
  -H 'Authorization: Bearer YOUR_TOKEN'
```

**Expected**: 404 error with code `SESSION_NOT_FOUND` (RLS blocks access).

---

## Database Verification

After running tests, verify data in Supabase:

```sql
-- Check sessions
SELECT 
  id, 
  brand_id, 
  state, 
  created_at,
  parsed_intent,
  pending_questions
FROM conversation_sessions
ORDER BY created_at DESC
LIMIT 5;

-- Check messages
SELECT 
  id,
  session_id,
  role,
  LEFT(content, 50) as content_preview,
  model_used,
  provider,
  created_at
FROM conversation_messages
ORDER BY created_at DESC
LIMIT 10;

-- Check RLS is working
SELECT id, user_id 
FROM conversation_sessions 
WHERE user_id != auth.uid();
-- Should return empty (RLS blocking)
```

---

## Architecture Notes

### Current State (Slice 2)

```
User Request
    ↓
POST /api/v1/conversation/start
    ↓
1. Authenticate User
2. Validate Brand Access
3. Create Session in DB
4. Store User Message
5. Generate HARDCODED Response
6. Store Assistant Message
7. Return Response
```

### Future State (Slice 5)

```
User Request
    ↓
POST /api/v1/conversation/start
    ↓
1. Authenticate User
2. Validate Brand Access
3. Create Session in DB
4. Store User Message
5. Call Executive Agent ← REPLACE HARDCODED
   - Load brand KB
   - Parse intent
   - Ask clarifying questions
   - Create task plan
6. Store Agent Response
7. Return Response
```

---

## Security Features

### Implemented

✅ **Authentication**: All endpoints require valid JWT  
✅ **Row Level Security**: Users can only access their own sessions  
✅ **Brand Ownership**: Verified before session creation  
✅ **Input Validation**: Required fields checked  
✅ **Error Handling**: No sensitive data in error messages

### Pending (Future Slices)

- Rate limiting (Slice 9)
- Request size limits (Slice 9)
- SQL injection protection (using Supabase prepared statements ✅)
- XSS protection (Slice 8 - frontend)

---

## Performance Considerations

### Current

- Single DB queries (no joins yet)
- Simple session create/read operations
- No caching (not needed for low volume)

### Future Optimizations

- Redis caching for active sessions (Slice 3)
- Message pagination for long conversations
- Lazy loading of statistics
- Connection pooling (already handled by Supabase)

---

## Next Steps

After Slice 2 is validated:

1. **Slice 3**: Redis Integration
   - Session state caching
   - Pending questions cache
   - Active task plan cache

2. **Slice 4**: Multi-Provider LLM Service
   - Provider abstraction layer
   - Model selection logic
   - Cost tracking

3. **Slice 5**: Executive Agent Implementation
   - Replace hardcoded responses
   - Intent parsing
   - Clarifying questions
   - Task planning

---

## Troubleshooting

### "Session not found" on GET

**Cause**: RLS policy blocking access  
**Fix**: Verify you own the session, check user_id matches

### "Brand not found"

**Cause**: Brand doesn't exist or you're not the owner  
**Fix**: Query brands table, verify owner_id

### "Authentication required"

**Cause**: Missing or invalid token  
**Fix**: Verify Authorization header, refresh token

### Database connection errors

**Cause**: Supabase client not initialized  
**Fix**: Check environment variables (SUPABASE_URL, SUPABASE_ANON_KEY)

---

## Files

```
frontend/app/api/v1/conversation/
├── README.md                    # This file
├── start/
│   └── route.ts                 # POST endpoint
└── [id]/
    └── route.ts                 # GET endpoint

frontend/lib/conversation/
└── queries.ts                   # Database helper functions
```

---

**Last Updated**: December 26, 2025  
**Status**: Ready for Testing ✅

