# Quick Reference: API Error Handling & Security

## For All New API Routes

### 1. Always Authenticate First
```typescript
const supabase = await createClient();
const { data: { user }, error: authError } = await supabase.auth.getUser();

if (authError || !user) {
  return NextResponse.json(
    { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
    { status: 401 }
  );
}
```

### 2. Add Rate Limiting for Expensive Operations
```typescript
import { rateLimiters, checkRateLimit } from '@/lib/utils/rate-limit-helpers';

// Check rate limit
const rateLimitResponse = await checkRateLimit(rateLimiters.imageGeneration, user.id);
if (rateLimitResponse) {
  return rateLimitResponse; // Returns 429 with proper headers
}
```

Available rate limiters:
- `rateLimiters.imageGeneration` - 10 req/min
- `rateLimiters.directorChat` - 30 req/min
- `rateLimiters.pipelineGeneration` - 10 req/min

### 3. Validate Request Body
```typescript
import { ImageGenerationSchema } from '@/lib/validations/api-schemas';

const validation = ImageGenerationSchema.safeParse(await request.json());

if (!validation.success) {
  return NextResponse.json(
    { 
      success: false,
      error: { 
        code: 'VALIDATION_ERROR',
        message: 'Invalid request', 
        details: validation.error.issues 
      }
    },
    { status: 400 }
  );
}

const data = validation.data; // Type-safe!
```

### 4. Log Important Operations
```typescript
import { logger } from '@/lib/monitoring/logger';

// Success
logger.info('OperationName', 'Operation succeeded', { 
  userId: user.id,
  extraContext: 'value'
});

// Error
logger.error('OperationName', 'Operation failed', error);
```

### 5. Return Standardized Errors

```typescript
// Database errors
if (error) {
  logger.error('OperationName', 'DB error', error);
  return NextResponse.json(
    { success: false, error: { code: 'DB_ERROR', message: error.message } },
    { status: 500 }
  );
}

// Validation errors (use schema.safeParse)
{ success: false, error: { code: 'VALIDATION_ERROR', message: '...', details: [...] } } // 400

// Auth errors
{ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } } // 401

// Rate limit errors (handled by checkRateLimit)
{ success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: '...' } } // 429

// Generic errors
{ success: false, error: { code: 'INTERNAL_ERROR', message: 'Operation failed' } } // 500
```

### 6. Catch-All Error Handler
```typescript
try {
  // ... your route logic
} catch (error) {
  logger.error('OperationName', 'Unexpected error', error);
  return NextResponse.json(
    { 
      success: false,
      error: { 
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Operation failed' 
      }
    },
    { status: 500 }
  );
}
```

## Common Error Codes

| Code | Status | When to Use |
|------|--------|-------------|
| `UNAUTHORIZED` | 401 | User not authenticated |
| `FORBIDDEN` | 403 | User authenticated but lacks permission |
| `VALIDATION_ERROR` | 400 | Request body validation failed |
| `NOT_FOUND` | 404 | Resource doesn't exist |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `DB_ERROR` | 500 | Database operation failed |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `GENERATION_FAILED` | 500 | AI generation failed |
| `STREAM_FAILED` | 500 | Streaming operation failed |

## Template for New Routes

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rateLimiters, checkRateLimit } from '@/lib/utils/rate-limit-helpers';
import { logger } from '@/lib/monitoring/logger';
import { z } from 'zod';

// Define validation schema
const MySchema = z.object({
  field: z.string().min(1).max(100),
  // ... other fields
});

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    // 2. Check rate limit (if needed)
    const rateLimitResponse = await checkRateLimit(rateLimiters.imageGeneration, user.id);
    if (rateLimitResponse) {
      logger.warn('MyOperation', 'Rate limit exceeded', { userId: user.id });
      return rateLimitResponse;
    }

    // 3. Validate request
    const validation = MySchema.safeParse(await request.json());
    
    if (!validation.success) {
      return NextResponse.json(
        { 
          success: false,
          error: { 
            code: 'VALIDATION_ERROR',
            message: 'Invalid request', 
            details: validation.error.issues 
          }
        },
        { status: 400 }
      );
    }

    const data = validation.data;

    // 4. Perform operation
    const { data: result, error } = await supabase
      .from('table')
      .insert(data)
      .select()
      .single();

    if (error) {
      logger.error('MyOperation', 'DB error', error);
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: error.message } },
        { status: 500 }
      );
    }

    // 5. Log success
    logger.info('MyOperation', 'Operation completed', { 
      userId: user.id,
      resultId: result.id 
    });

    // 6. Return success
    return NextResponse.json({
      success: true,
      data: result,
    });

  } catch (error) {
    logger.error('MyOperation', 'Unexpected error', error);
    return NextResponse.json(
      { 
        success: false,
        error: { 
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Operation failed' 
        }
      },
      { status: 500 }
    );
  }
}
```

## Don't Do This ❌

```typescript
// ❌ Returning 200 on errors
return NextResponse.json({ error: 'Something went wrong' });

// ❌ No authentication
export async function POST(request: NextRequest) {
  const body = await request.json();
  // ... process without checking user
}

// ❌ No validation
const { field } = await request.json();
// ... use field without validating

// ❌ No logging
catch (error) {
  console.error(error); // Only console.error
  return NextResponse.json({ error: 'Failed' });
}

// ❌ Exposing raw errors to client
catch (error) {
  return NextResponse.json({ error: error.stack }, { status: 500 });
}
```

## Do This ✅

```typescript
// ✅ Proper status codes
return NextResponse.json(
  { success: false, error: { code: 'DB_ERROR', message: 'Operation failed' } },
  { status: 500 }
);

// ✅ Always authenticate
const { data: { user }, error: authError } = await supabase.auth.getUser();
if (authError || !user) return NextResponse.json(..., { status: 401 });

// ✅ Always validate
const validation = Schema.safeParse(body);
if (!validation.success) return NextResponse.json(..., { status: 400 });

// ✅ Always log
logger.error('Operation', 'Error occurred', error);

// ✅ Safe error messages
{ error: { code: 'INTERNAL_ERROR', message: 'Operation failed' } }
```
