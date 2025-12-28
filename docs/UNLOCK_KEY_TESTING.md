# Master Unlock Key - Testing Mode

This document explains how to use the master unlock key to bypass workflow locks for testing workflows 3-7 (Creative Director, Review, Videos, Distribution, Publishing).

## Overview

The master unlock key system allows you to:
- ✅ Bypass workflow locks while keeping the security logic intact for production
- ✅ Test all workflows without completing prerequisites
- ✅ Easily enable/disable with a single query parameter
- ✅ Maintain production-ready code

## Setup

### 1. Set Environment Variable

Add this to your `.env.local` file:

```bash
NEXT_PUBLIC_MASTER_UNLOCK_KEY=your-secret-key-here
```

**Important:** 
- Use a strong, random key (e.g., generate with `openssl rand -hex 32`)
- Starts with `NEXT_PUBLIC_` so it's accessible in the browser (for development/testing only)
- Keep this secret and only use in development
- **Never commit to git** - it's in `.gitignore`
- **Development only**: In production, implement server-side validation via an API endpoint

### 2. Using the Unlock Key

#### **Option A: One-Time Setup (Recommended)**

Add the unlock key to ANY page once, and it persists across all pages:

```
http://localhost:3000/dashboard?unlock_key=your-secret-key-here
```

The key is saved to browser localStorage and works on all pages:
- ✅ `/director`
- ✅ `/review`
- ✅ `/videos`
- ✅ `/distribution`
- ✅ `/publishing`

#### **Option B: Per-Page Setup**

Add the unlock key to each page individually:

```
http://localhost:3000/director?unlock_key=your-secret-key-here
http://localhost:3000/review?unlock_key=your-secret-key-here
http://localhost:3000/videos?unlock_key=your-secret-key-here
```

#### **Managing the Unlock Key**

A floating unlock button (🔓) appears in the bottom-right corner when testing mode is active:

1. Click the **unlock icon** to open the toolbar
2. View the active key and status
3. Click **"Clear Unlock Key"** to disable testing mode
4. Browser will reload with all locks restored

### 3. What Gets Unlocked

When you provide the valid unlock key, these workflows become accessible:

| Step | Workflow | Requirement | Status |
|------|----------|-------------|--------|
| 1 | Campaigns | None | Always Accessible |
| 2 | Brand Vault | Have a campaign | Always Accessible |
| 3 | Creative Director | Brand identity + assets | **UNLOCKED** |
| 4 | Review | Content generated | **UNLOCKED** |
| 5 | Videos | Content approved | **UNLOCKED** |
| 6 | Distribution | Videos ready | **UNLOCKED** |
| 7 | Publishing | Variants created | **UNLOCKED** |

## How It Works

### Frontend Flow

1. **Page Load**: `useCampaignProgress()` hook checks URL for `unlock_key` parameter
2. **Validation**: Validates the key against `MASTER_UNLOCK_KEY` environment variable
3. **Override**: If valid, forces steps 3-7 to return `true` regardless of actual progress
4. **No Changes**: All other security checks remain intact (auth, ownership, RLS)

### Code Example

```tsx
// In any workflow page
const { canAccessReview, isUnlocked } = useCampaignProgress();

if (!canAccessReview) {
  return <LockedState ... />;
}

// Page renders normally
// If isUnlocked is true, you can optionally show a testing indicator
```

## Clearing the Unlock Key

### **Quick Method:**
Click the 🔓 unlock button in the bottom-right corner and select **"Clear Unlock Key"**

### **Manual Method:**
Delete from browser console:
```javascript
localStorage.removeItem('__unlock_key');
location.reload();
```

### **Automatic Clearing:**
Simply don't include the `?unlock_key=...` parameter and the system won't activate.

## Reverting to Production

The unlock key system is **completely non-intrusive**:

1. **Clear the unlock key** using the toolbar or console
2. All locks return to normal behavior
3. **No code changes needed** - the logic is already there
4. **No environment variables exposed** - key only persists in browser localStorage during testing

## Security Notes

✅ **Safe for Testing:**
- Only affects UI-level access control
- Database authentication still required
- User ownership checks still enforced
- RLS policies still active

⚠️ **Important:**
- The unlock key ONLY bypasses step prerequisite checks
- It does NOT bypass authentication or ownership verification
- Users still need to be logged in with a valid campaign
- API endpoints still enforce all security checks

## Troubleshooting

### Invalid Key Error

If you see "✗ Invalid unlock key" in the console:
1. Check the key matches exactly in `.env.local`
2. Verify environment variable is loaded (restart dev server after changing `.env.local`)
3. Check the URL has `?unlock_key=...` (not `&unlock_key=...`)

### Key Not Loading

1. Create/update `.env.local`:
   ```bash
   MASTER_UNLOCK_KEY=your-key
   ```
2. Restart the Next.js dev server
3. Check browser console for validation messages

### Want to Disable Testing Mode

Simply don't include the unlock key in the URL. The system is completely inactive without it.

## Future Production Implementation

For production, you could enhance this by:

1. **Database Storage**: Store encrypted master key in a `admin_unlock_keys` table
2. **Role-Based**: Limit unlock key use to admin users only
3. **Audit Logging**: Log when unlock keys are used and by whom
4. **Time-Limited**: Make keys expire after a certain period
5. **IP Whitelist**: Restrict unlock keys to specific IP addresses

The current infrastructure is ready for these enhancements without any code changes.

