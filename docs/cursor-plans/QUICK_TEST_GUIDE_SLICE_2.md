# Quick Test Guide - Slice 2

**Time Required**: 10 minutes  
**Prerequisites**: App running on localhost:3000

---

## 🚀 Fast Track Testing

### Step 1: Get Your Credentials (2 min)

#### Option A: From Browser (Easiest)
1. Open your app: `http://localhost:3000`
2. Login if needed
3. Open browser DevTools (F12)
4. Go to **Application** tab → **Cookies**
5. Find cookie with `sb-` prefix
6. Copy the value (this is your access token)

#### Option B: From Database
```sql
-- In Supabase SQL Editor
SELECT id as brand_id, name 
FROM brands 
WHERE owner_id = auth.uid() 
LIMIT 1;
```

---

### Step 2: Quick API Test (3 min)

#### Test 1: Create Conversation

```bash
curl -X POST 'http://localhost:3000/api/v1/conversation/start' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN_HERE' \
  -d '{
    "brand_id": "YOUR_BRAND_ID_HERE",
    "initial_message": "I need a product launch campaign"
  }'
```

**Expected**: You'll get back a `session_id` and a hardcoded greeting message.

**Example Response**:
```json
{
  "success": true,
  "session_id": "abc-123-def-456",
  "response": {
    "type": "message",
    "content": "Hello! I'm your Creative Director AI assistant..."
  },
  "state": "initial"
}
```

#### Test 2: Retrieve Conversation

```bash
# Use session_id from Test 1
curl -X GET 'http://localhost:3000/api/v1/conversation/SESSION_ID_HERE' \
  -H 'Authorization: Bearer YOUR_TOKEN_HERE'
```

**Expected**: You'll see the full conversation with 2 messages.

---

### Step 3: Verify Database (2 min)

In Supabase SQL Editor:

```sql
-- Check your latest session
SELECT 
  id,
  state,
  created_at,
  parsed_intent,
  pending_questions
FROM conversation_sessions
WHERE user_id = auth.uid()
ORDER BY created_at DESC
LIMIT 1;

-- Check messages for that session
SELECT 
  role,
  LEFT(content, 50) as content_preview,
  model_used,
  created_at
FROM conversation_messages
WHERE session_id = 'YOUR_SESSION_ID'
ORDER BY created_at;
```

**Expected**: 
- 1 session with state = "initial"
- 2 messages (user + assistant)

---

### Step 4: Test Error Handling (3 min)

#### Missing Brand ID
```bash
curl -X POST 'http://localhost:3000/api/v1/conversation/start' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -d '{"initial_message": "Test"}'
```
**Expected**: 400 error, code "MISSING_BRAND_ID"

#### Invalid Brand ID
```bash
curl -X POST 'http://localhost:3000/api/v1/conversation/start' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -d '{
    "brand_id": "00000000-0000-0000-0000-000000000000",
    "initial_message": "Test"
  }'
```
**Expected**: 404 error, code "BRAND_NOT_FOUND"

#### No Authentication
```bash
curl -X POST 'http://localhost:3000/api/v1/conversation/start' \
  -H 'Content-Type: application/json' \
  -d '{
    "brand_id": "YOUR_BRAND_ID",
    "initial_message": "Test"
  }'
```
**Expected**: 401 error, code "UNAUTHORIZED"

---

## ✅ Success Checklist

- [ ] Test 1 returns session_id and greeting
- [ ] Test 2 shows 2 messages in history
- [ ] Database has session record
- [ ] Database has 2 message records
- [ ] Missing brand_id returns 400
- [ ] Invalid brand_id returns 404
- [ ] No auth returns 401

---

## 🐛 Troubleshooting

### "Could not fetch"
- **Problem**: App not running
- **Fix**: `cd frontend && npm run dev`

### "Invalid token"
- **Problem**: Token expired
- **Fix**: Get fresh token from browser

### "Brand not found"
- **Problem**: Wrong brand_id or not owner
- **Fix**: Query brands table to get correct ID

### "Session not found" on GET
- **Problem**: RLS blocking access
- **Fix**: Make sure you own the session

---

## 🎯 What You're Testing

In Slice 2, we're testing **API infrastructure only**:

✅ Session creation works  
✅ Message storage works  
✅ Authentication enforced  
✅ RLS policies working  
✅ Error handling robust  

We are **NOT** testing agent intelligence (that's Slice 5).

The response will be a hardcoded greeting - this is expected!

---

## 📊 Automated Testing

For comprehensive testing, use the automated script:

```bash
# 1. Edit the script
nano test-conversation-api.sh
# Set ACCESS_TOKEN and BRAND_ID

# 2. Make executable
chmod +x test-conversation-api.sh

# 3. Run all tests
./test-conversation-api.sh
```

This will run all 5 test cases automatically with color-coded output.

---

## 🎉 If All Tests Pass

1. ✅ Mark Slice 2 complete in `SLICE_2_CHECKLIST.md`
2. 🚀 Ready for **Slice 3: Redis Integration**

---

**Total Time**: ~10 minutes  
**Difficulty**: Easy  
**Prerequisites**: Running app + Supabase access

---

*Quick Reference for Phase 6 Part 2 Development*

