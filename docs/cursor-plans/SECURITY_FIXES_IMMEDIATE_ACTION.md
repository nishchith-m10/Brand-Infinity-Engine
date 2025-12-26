# IMMEDIATE SECURITY FIXES REQUIRED
**DO THESE FIXES FIRST - CRITICAL VULNERABILITIES**

---

## 🔴 FIX #1: Remove Passcode Logging + Add Rate Limiting

**File:** `/frontend/app/api/verify-passcode/route.ts`

### Current Code (VULNERABLE):
```typescript
export async function POST(request: NextRequest) {
  try {
    const { passcode } = await request.json();
    const expectedPasscode = process.env.DASHBOARD_PASSCODE || 'EarlyBloom@edu123';
    
    // Debug logging (remove in production)  ⚠️ REMOVE THIS
    console.log('Received passcode:', passcode);
    console.log('Expected passcode from env:', process.env.DASHBOARD_PASSCODE);
    console.log('Expected passcode used:', expectedPasscode);
    console.log('Match:', passcode === expectedPasscode);
```

### Fixed Code:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { ratelimit } from '@/lib/ratelimit';
import bcrypt from 'bcryptjs'; // npm install bcryptjs

// Rate limiter for passcode attempts (5 attempts per 15 minutes)
const passcodeRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '15 m'),
  prefix: 'passcode-verify',
});

export async function POST(request: NextRequest) {
  try {
    const { passcode } = await request.json();
    
    // Rate limit by IP
    const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1';
    const { success: rateLimitOk } = await passcodeRateLimit.limit(ip);
    
    if (!rateLimitOk) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.' }, 
        { status: 429 }
      );
    }
    
    // Get hashed passcode from env (you need to hash and store it)
    const hashedPasscode = process.env.DASHBOARD_PASSCODE_HASH;
    
    if (!hashedPasscode) {
      console.error('DASHBOARD_PASSCODE_HASH not configured');
      return NextResponse.json(
        { error: 'Server configuration error' }, 
        { status: 500 }
      );
    }
    
    // Compare hashed passcode
    const isValid = await bcrypt.compare(passcode, hashedPasscode);
    
    if (isValid) {
      const response = NextResponse.json({ success: true });
      
      response.cookies.set('dashboard_passcode_verified', 'true', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
      });
      
      return response;
    }
    
    // Log failed attempt for security monitoring (no sensitive data)
    console.warn(`Failed passcode attempt from IP: ${ip}`);
    
    return NextResponse.json(
      { error: 'Invalid passcode' }, 
      { status: 401 }
    );
  } catch (error) {
    console.error('Passcode verification error:', error);
    return NextResponse.json(
      { error: 'Server error' }, 
      { status: 500 }
    );
  }
}
```

### Migration Steps:
```bash
# 1. Hash your passcode
node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('EarlyBloom@edu123', 10));"

# 2. Add to .env
DASHBOARD_PASSCODE_HASH=$2a$10$[generated_hash]

# 3. Remove old env var
# DASHBOARD_PASSCODE=EarlyBloom@edu123  # DELETE THIS LINE
```

---

## 🔴 FIX #2: Replace Admin Client with RLS-Enabled Client

**File:** `/frontend/app/api/v1/campaigns/[id]/route.ts`

### Current Code (VULNERABLE):
```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createAdminClient(); // ⚠️ BYPASSES ALL SECURITY
    const { id: campaignId } = await params;
    // NO AUTH CHECK!
```

### Fixed Code:
```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Use RLS-enabled client
    const supabase = await createClient();
    const { id: campaignId } = await params;
    
    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }
    
    // RLS will automatically filter results to user's accessible campaigns
    let { data: campaign, error } = await supabase
      .from('campaigns')
      .select(`
        *,
        creative_briefs (*),
        scripts (*),
        generation_jobs (*)
      `)
      .eq('id', campaignId)
      .single();
    
    // If no result and no error, user doesn't have access
    if (!campaign && !error) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }
```

### Apply to ALL These Files:
1. `/frontend/app/api/v1/campaigns/[id]/route.ts` - GET, PUT, DELETE, PATCH
2. `/frontend/app/api/v1/campaigns/[id]/trigger/route.ts` - POST
3. Any other file using `createAdminClient()` in user-facing routes

**Exception:** Only use `createAdminClient()` in:
- System cron jobs
- Admin-only operations
- Webhook handlers from trusted sources (with signature verification)

---

## 🔴 FIX #3: Fix CORS Wildcard

**Files:** 
- `/frontend/app/api/v1/conversation/start/route.ts`
- `/frontend/app/api/v1/conversation/[id]/route.ts`

### Current Code (VULNERABLE):
```typescript
export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*", // ⚠️ ALLOWS ANY WEBSITE
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    }
  );
}
```

### Fixed Code:
```typescript
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  
  // Whitelist of allowed origins
  const allowedOrigins = [
    process.env.NEXT_PUBLIC_APP_URL,
    'http://localhost:3000', // Development
    'https://yourdomain.com',
  ].filter(Boolean);
  
  // Check if origin is allowed
  const corsOrigin = origin && allowedOrigins.includes(origin) 
    ? origin 
    : allowedOrigins[0];
  
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": corsOrigin || '',
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true",
      },
    }
  );
}
```

**Better Solution:** Use Next.js middleware for CORS instead of per-route OPTIONS handlers.

---

## 🔴 FIX #4: Add Authentication to Brand Assets Routes

**File:** `/frontend/app/api/v1/brand-assets/route.ts`

### Add Auth to GET:
```typescript
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  
  // ADD THIS AUTH CHECK
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
      { status: 401 }
    );
  }
  
  const searchParams = request.nextUrl.searchParams;
  const brandId = searchParams.get('brand_id');
  
  // Verify user owns this brand (if brandId provided)
  if (brandId) {
    const { data: brand } = await supabase
      .from('brands')
      .select('id')
      .eq('id', brandId)
      .eq('owner_id', user.id)
      .single();
      
    if (!brand) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }
  }
  
  // Continue with existing logic...
```

### Add Auth to DELETE and PATCH:
Same pattern - check auth, verify ownership before allowing operation.

---

## 🔴 FIX #5: Fix Brand Identity Ownership Bug

**File:** `/frontend/app/api/v1/brand-identity/route.ts`

### Current Code (BUGGY):
```typescript
const { data: existingBrand } = await supabase
  .from('brands')
  .select('id')
  .limit(1)  // ⚠️ GETS ANY BRAND
  .single();
```

### Fixed Code:
```typescript
const { data: existingBrand } = await supabase
  .from('brands')
  .select('id')
  .eq('owner_id', user.id)  // ✅ ONLY USER'S BRAND
  .limit(1)
  .single();
```

**Apply same fix to GET method** (line 21-25):
```typescript
const { data: brand, error } = await supabase
  .from('brands')
  .select('id, name, brand_voice, brand_colors, target_audience, metadata')
  .eq('owner_id', user.id)  // ✅ ADD THIS LINE
  .limit(1)
  .single();
```

---

## 🟠 FIX #6: Add File Upload Validation

**File:** `/frontend/app/api/v1/brand-assets/upload/route.ts`

### Add BEFORE upload (after line 31):
```typescript
if (!file) {
  return NextResponse.json(
    { success: false, error: { code: 'VALIDATION_ERROR', message: 'No file provided' } },
    { status: 400 }
  );
}

// ADD FILE VALIDATION HERE
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
];

// Validate file size
if (file.size > MAX_FILE_SIZE) {
  return NextResponse.json(
    { success: false, error: { code: 'FILE_TOO_LARGE', message: 'File size exceeds 10MB limit' } },
    { status: 400 }
  );
}

// Validate MIME type
if (!ALLOWED_TYPES.includes(file.type)) {
  return NextResponse.json(
    { success: false, error: { code: 'INVALID_FILE_TYPE', message: `File type ${file.type} not allowed` } },
    { status: 400 }
  );
}

// Validate filename (prevent path traversal)
const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
if (safeName.includes('..') || safeName.includes('/') || safeName.includes('\\')) {
  return NextResponse.json(
    { success: false, error: { code: 'INVALID_FILENAME', message: 'Invalid filename' } },
    { status: 400 }
  );
}
```

---

## 🟠 FIX #7: Fix Campaign Progress API Logic

**File:** `/frontend/app/api/v1/campaigns/[id]/progress/route.ts`

### Current Code (BUGGY):
```typescript
// Check brand assets
const { count: assetCount } = await supabase
  .from('brand_knowledge_base')
  .select('*', { count: 'exact', head: true })
  .eq('brand_id', campaignId)  // ⚠️ WRONG! campaignId is NOT brand_id
  .eq('is_active', true);
```

### Fixed Code:
```typescript
// First get the campaign to find its brand_id
const { data: campaign } = await supabase
  .from('campaigns')
  .select('brand_id')
  .eq('id', campaignId)
  .single();

if (!campaign) {
  return NextResponse.json(
    { success: false, error: { code: 'NOT_FOUND', message: 'Campaign not found' } },
    { status: 404 }
  );
}

// NOW check brand assets using the correct brand_id
const { count: assetCount } = await supabase
  .from('brand_knowledge_base')
  .select('*', { count: 'exact', head: true })
  .eq('brand_id', campaign.brand_id)  // ✅ USE campaign.brand_id
  .eq('is_active', true);
```

---

## 🟡 FIX #8: Validate Environment Variables on Startup

**Create new file:** `/frontend/lib/env.ts`

```typescript
/**
 * Validate required environment variables on startup
 * Call this from your root layout or middleware
 */
export function validateEnv() {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPENAI_API_KEY',
    'N8N_WEBHOOK_URL',
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
    'DASHBOARD_PASSCODE_HASH',
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.join('\n')}\n\n` +
      `Please check your .env file and ensure all required variables are set.`
    );
  }

  // Validate formats
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.N8N_WEBHOOK_URL?.startsWith('https://')) {
      throw new Error('N8N_WEBHOOK_URL must use HTTPS in production');
    }
    
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('https://')) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL must use HTTPS in production');
    }
  }

  console.log('✅ Environment variables validated successfully');
}
```

**Call from:** `/frontend/app/layout.tsx`
```typescript
import { validateEnv } from '@/lib/env';

// Validate on server startup
if (typeof window === 'undefined') {
  validateEnv();
}
```

---

## 🟡 FIX #9: Add RLS Policy Verification Script

**Create:** `/frontend/scripts/verify-rls.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

async function verifyRLS() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const tables = [
    'campaigns',
    'brands',
    'brand_knowledge_base',
    'knowledge_bases',
    'conversation_sessions',
    'conversation_messages',
  ];

  console.log('Checking RLS policies...\n');

  for (const table of tables) {
    const { data, error } = await supabase
      .rpc('has_rls_enabled', { table_name: table });

    if (error) {
      console.error(`❌ ${table}: Error checking RLS`);
    } else if (data) {
      console.log(`✅ ${table}: RLS enabled`);
    } else {
      console.error(`❌ ${table}: RLS NOT enabled - FIX IMMEDIATELY`);
    }
  }
}

verifyRLS().catch(console.error);
```

---

## TESTING CHECKLIST

After applying fixes, test these scenarios:

### Authentication Tests:
- [ ] Try accessing API routes without auth token → Should return 401
- [ ] Try accessing another user's campaign → Should return 403
- [ ] Verify passcode works after hashing → Should succeed
- [ ] Try brute forcing passcode → Should rate limit after 5 attempts

### Authorization Tests:
- [ ] User A creates campaign, User B tries to access → Should fail
- [ ] User tries to update brand they don't own → Should fail
- [ ] User tries to delete asset from another brand → Should fail

### File Upload Tests:
- [ ] Upload 11MB file → Should reject
- [ ] Upload .exe file → Should reject
- [ ] Upload file with path traversal in name → Should sanitize
- [ ] Upload valid image → Should succeed

### CORS Tests:
- [ ] Make request from allowed origin → Should succeed
- [ ] Make request from random origin → Should block
- [ ] Check credentials are included → Should work

### Progress API Test:
- [ ] Create campaign with brand_id
- [ ] Upload assets to that brand
- [ ] Call progress API → Should show correct asset count

---

## DEPLOYMENT CHECKLIST

Before deploying these fixes:

1. **Environment Variables:**
   - [ ] Generate new DASHBOARD_PASSCODE_HASH
   - [ ] Update all env vars in production
   - [ ] Remove old DASHBOARD_PASSCODE env var
   - [ ] Verify N8N_WEBHOOK_URL uses HTTPS

2. **Database:**
   - [ ] Run RLS verification script
   - [ ] Add missing RLS policies if found
   - [ ] Test RLS policies with multiple users

3. **Dependencies:**
   - [ ] `npm install bcryptjs` (for passcode hashing)
   - [ ] `npm install @upstash/ratelimit` (if not already)

4. **Testing:**
   - [ ] Run full test suite
   - [ ] Manual security testing
   - [ ] Test with real user accounts

5. **Monitoring:**
   - [ ] Set up alerts for 401/403 errors
   - [ ] Monitor rate limit hits
   - [ ] Track failed passcode attempts

---

## ESTIMATED TIME TO COMPLETE

- Fix #1 (Passcode): **2 hours**
- Fix #2 (Admin Client): **4 hours** (multiple files)
- Fix #3 (CORS): **1 hour**
- Fix #4 (Brand Assets Auth): **2 hours**
- Fix #5 (Brand Identity): **30 minutes**
- Fix #6 (File Upload): **1 hour**
- Fix #7 (Progress API): **30 minutes**
- Fix #8 (Env Validation): **1 hour**
- Testing: **4 hours**

**Total: ~16 hours (2 full work days)**

---

## SUPPORT & QUESTIONS

If you have questions about these fixes:
1. Review the full SECURITY_AUDIT_REPORT.md
2. Check Next.js security best practices
3. Review Supabase RLS documentation
4. Test in development environment first

**DO NOT SKIP THESE FIXES** - They address critical security vulnerabilities that could lead to data breaches.

