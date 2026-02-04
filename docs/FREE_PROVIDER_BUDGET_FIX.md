# Free Provider Budget Fix - Implementation Summary

## Problem
Users couldn't create requests using free providers (e.g., Pollinations) because the system was unconditionally trying to reserve campaign budget, resulting in `INSUFFICIENT_BUDGET` errors even when the provider costs $0.

## Root Causes
1. **Estimator**: `calculateEstimate()` didn't recognize free providers like Pollinations and always returned non-zero costs based on tier pricing
2. **Budget Reservation**: Request creation route called `reserveBudget()` whenever a `campaign_id` was present, regardless of estimated cost
3. **No Zero-Cost Guard**: The `withBudget()` helper didn't skip reservation when `estimatedCost === 0`

## Solution

### 1. Provider-Aware Cost Override (lib/pipeline/estimator.ts)
- Added `FREE_PROVIDERS` constant listing known free providers: `['pollinations', 'Pollinations', 'POLLINATIONS']`
- Modified `calculateEstimate()` to detect free providers and delegate to `calculateFreeProviderEstimate()`
- New helper `calculateFreeProviderEstimate()` returns `cost: 0` while still calculating realistic time estimates

```typescript
// Before
export function calculateEstimate(params: EstimateParams): CostEstimate {
  const tierCosts = PROVIDER_TIER_COSTS[params.tier];
  // ... always calculates cost based on tier
}

// After
export function calculateEstimate(params: EstimateParams): CostEstimate {
  // Override: Free providers always return zero cost
  if (params.provider && FREE_PROVIDERS.includes(params.provider)) {
    return calculateFreeProviderEstimate(params);
  }
  // ... existing logic
}
```

### 2. Skip Budget Reservation for Zero-Cost Requests (app/api/v1/requests/route.ts)
- Changed condition from `if (input.campaign_id)` to `if (input.campaign_id && estimate.cost > 0)`
- Added logging for skipped reservations when cost is zero
- Prevents unnecessary DB calls and budget checks for free operations

```typescript
// Before
if (input.campaign_id) {
  const budgetReservation = await reserveBudget(...);
  // ...
}

// After
if (input.campaign_id && estimate.cost > 0) {
  const budgetReservation = await reserveBudget(...);
  // ...
} else if (input.campaign_id && estimate.cost === 0) {
  console.log(`[BudgetCheck] Skipping budget reservation for zero-cost request`);
}
```

### 3. Defensive Guard in Budget Helper (lib/budget/reservation.ts)
- Updated `withBudget()` to skip reservation when `estimatedCost === 0`
- Prevents accidental budget reservations in other code paths
- Maintains backward compatibility

```typescript
// Before
if (!campaignId) {
  const result = await operation();
  return { result };
}

// After
if (!campaignId || estimatedCost === 0) {
  const result = await operation();
  return { result };
}
```

## Tests Added

### Unit Tests (tests/lib/pipeline/estimator.test.ts)
- ✅ `should return zero cost for Pollinations provider`
- ✅ `should return zero cost for Pollinations provider (case-insensitive)`
- ✅ `should calculate time estimate for free video providers`

### Integration Tests (tests/integration/api/requests.test.ts)
- ✅ `should create request with free provider without budget reservation`
- ✅ `should create request with zero budget campaign when using free provider`

## Verified
- ✅ All estimator tests pass (17/17)
- ✅ No TypeScript errors
- ✅ Backward compatible (paid providers still reserve budget normally)
- ✅ Zero-cost requests can be created even with campaigns that have `budget_limit: 0`

## Usage Examples

### Create Image Request with Pollinations (Free)
```typescript
const request = {
  brand_id: "...",
  campaign_id: "...", // Optional, budget won't be checked
  title: "Test Free Image",
  type: "image",
  requirements: {
    prompt: "A beautiful sunset",
    aspect_ratio: "16:9"
  },
  settings: {
    provider: "pollinations", // ← Free provider
    tier: "standard"
  }
};

// Result:
// ✅ estimated_cost: 0
// ✅ Status: 201 Created
// ✅ No INSUFFICIENT_BUDGET error
```

### Test Script
Run `./test-free-provider.sh` to verify end-to-end behavior with a curl command.

## Future Enhancements (Optional)
1. Add more free providers to `FREE_PROVIDERS` constant as they're integrated
2. Create `lib/pipeline/providerCosts.ts` for provider-specific cost plugins
3. Add UI indicator showing when selected provider is free
4. Display available budget in UI before request creation to guide users

## Files Modified
- ✅ `app/api/v1/requests/route.ts` (skip reservation for zero-cost)
- ✅ `lib/budget/reservation.ts` (defensive guard in withBudget)
- ✅ `lib/pipeline/estimator.ts` (free provider override)
- ✅ `tests/lib/pipeline/estimator.test.ts` (3 new tests)
- ✅ `tests/integration/api/requests.test.ts` (2 new tests)
- ✅ `test-free-provider.sh` (manual testing script)

---
**Status**: ✅ Complete and tested
**PR Ready**: Yes
**Breaking Changes**: None
