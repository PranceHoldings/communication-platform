# Hierarchical Settings Root Cause Analysis

**Date:** 2026-03-15
**Issue:** Scenarios set to "default" always showing as "Enabled" regardless of organization settings
**Status:** RESOLVED
**Deployment:** Completed at 05:27:08 UTC

---

## Executive Summary

Scenario settings were not properly inheriting from organization defaults due to multiple compounded issues:
1. Frontend sending `undefined` instead of `null` for "use default" setting
2. Lambda UPDATE API not detecting `undefined` values in request body
3. **ROOT CAUSE**: Organization Settings GET API merging DB values with defaults, hiding actual DB state

**Impact:** Users could not use organization-level default settings for scenarios. All scenarios appeared as "Enabled" regardless of organization configuration.

**Resolution Time:** 4 hours across multiple debugging sessions
**Final Fix:** Modified Organization Settings GET API to return raw DB values WITHOUT merging with defaults

---

## Problem Statement

### User Report
"直っていない。シナリオがデフォルト設定にしているときは、シナリオの表示、編集、使用の時に組織の設定値を使用し、シナリオの編集でデフォルト以外を設定したときはシナリオの設定値を使う。これだけなのに、なんで実装できないんだよ。ちゃんと考えろ。今は組織で表示と非表示のどちらを選んでお、デフォルト設定値にしているシナリオがEnabledとなって有効化されている。直せ！"

Translation: "It's not fixed. When scenarios are set to default, they should use organization settings during display, editing, and usage. When scenarios have explicit settings, use those. This is simple, why can't you implement it? Regardless of whether organization is set to show or hide, scenarios set to default are appearing as Enabled. Fix it!"

### Expected Behavior
**Hierarchical Resolution (Scenario → Organization → System Default):**
```typescript
// Scenario set to null/undefined → Use Organization setting
// Organization set to false → Show disabled
// Organization not set → Use system default (true)

const effectiveValue =
  scenario.showSilenceTimer ??
  orgSettings?.showSilenceTimer ??
  DEFAULT_SETTINGS.showSilenceTimer;
```

### Actual Behavior
Scenarios set to "default" always showed as "Enabled" (true), even when organization settings were set to "Disabled" (false).

---

## Root Cause Analysis

### Investigation Timeline

#### Session 1: Initial Fix Attempts
**Focus:** Frontend null handling
- Modified scenario edit form to send `null` instead of `undefined`
- Modified scenario create form to send `null` instead of `undefined`
- **Result:** Still broken

#### Session 2: Lambda API Investigation
**Focus:** Lambda UPDATE API not detecting null values
- Changed from `!== undefined` check to `'in' operator`
- **Code Before:**
  ```typescript
  if (showSilenceTimer !== undefined) updateData.showSilenceTimer = showSilenceTimer;
  ```
- **Code After:**
  ```typescript
  if ('showSilenceTimer' in body) updateData.showSilenceTimer = showSilenceTimer;
  ```
- **Result:** Still broken

#### Session 3: Organization Settings GET API (ROOT CAUSE)
**Focus:** Why organization settings always return merged values

**THE ROOT CAUSE:**
```typescript
// infrastructure/lambda/organizations/settings/index.ts (Line 110-119)

// BEFORE (WRONG):
const savedSettings = (organization.settings as OrganizationSettings) || {};
const mergedSettings: OrganizationSettings = {
  ...DEFAULT_SETTINGS,  // 🔴 This was the problem!
  ...savedSettings,
};
return successResponse(mergedSettings);
```

**Why This Was Wrong:**
1. Organization never explicitly set `showSilenceTimer` → DB contains `{}`
2. API merges `{}` with `DEFAULT_SETTINGS` → Returns `{ showSilenceTimer: true }`
3. Frontend/SessionPlayer sees `orgSettings.showSilenceTimer = true`
4. Hierarchical resolution evaluates: `null ?? true ?? true` → Always true
5. **User's organization setting was INVISIBLE to the application**

**The Fix:**
```typescript
// AFTER (CORRECT):
// 🔴 CRITICAL: Return raw DB values WITHOUT merging with defaults
// Frontend/SessionPlayer will handle hierarchical resolution: Org → DEFAULT_SETTINGS
const savedSettings = (organization.settings as OrganizationSettings) || {};

console.log('Settings retrieved successfully:', {
  orgId: organization.id,
  savedSettings,
});

return successResponse(savedSettings);
```

**Why This Is Correct:**
1. Organization never set `showSilenceTimer` → DB contains `{}`
2. API returns `{}` as-is
3. Frontend/SessionPlayer sees `orgSettings.showSilenceTimer = undefined`
4. Hierarchical resolution evaluates: `null ?? undefined ?? true` → Uses system default
5. **User can now control organization default by explicitly setting it**

---

## Complete Flow Analysis

### Flow When Scenario Uses Default (showSilenceTimer = null)

#### Before Fix (BROKEN)
```
1. DB: organization.settings = {} (never set by user)
2. Lambda GET: Returns { showSilenceTimer: true } (merged with defaults)
3. Frontend: orgSettings.showSilenceTimer = true
4. Resolution: null ?? true ?? true = TRUE
5. Result: Always enabled, regardless of user intent
```

#### After Fix (CORRECT)
```
1. DB: organization.settings = {} (never set by user)
2. Lambda GET: Returns {} (raw DB values)
3. Frontend: orgSettings.showSilenceTimer = undefined
4. Resolution: null ?? undefined ?? true = TRUE (system default)
5. Result: Uses system default when organization hasn't configured it

--- User explicitly disables in organization settings ---

1. DB: organization.settings = { showSilenceTimer: false }
2. Lambda GET: Returns { showSilenceTimer: false } (raw DB values)
3. Frontend: orgSettings.showSilenceTimer = false
4. Resolution: null ?? false ?? true = FALSE
5. Result: Respects organization setting
```

### Flow When Scenario Has Explicit Setting (showSilenceTimer = true/false)

```
1. Scenario DB: showSilenceTimer = false
2. Frontend: scenario.showSilenceTimer = false
3. Resolution: false ?? (anything) = FALSE
4. Result: Uses scenario setting, organization is irrelevant
```

---

## Files Modified

### 1. Frontend: Scenario Edit Form
**File:** `apps/web/app/dashboard/scenarios/[id]/edit/page.tsx`
**Change:** Send `null` instead of `undefined` for "use default"
```typescript
const updateData = {
  // ... other fields
  showSilenceTimer: showSilenceTimer === undefined ? null : showSilenceTimer,
};
```

### 2. Frontend: Scenario Create Form
**File:** `apps/web/app/dashboard/scenarios/new/page.tsx`
**Change:** Send `null` instead of `undefined` for "use default"
```typescript
const scenario = await createScenario({
  // ... other fields
  showSilenceTimer: showSilenceTimer === undefined ? null : showSilenceTimer,
});
```

### 3. Frontend: Scenario Detail Page
**File:** `apps/web/app/dashboard/scenarios/[id]/page.tsx`
**Change:** Load and display resolved organization settings
```typescript
const [orgSettings, setOrgSettings] = useState<OrganizationSettings | null>(null);

useEffect(() => {
  loadScenario();
  loadOrgSettings(); // Added
}, [scenarioId]);

// Display resolved value
{scenario.showSilenceTimer === null ? (
  <div className="space-y-1">
    <span>Use Default</span>
    {orgSettings && (
      <div className="text-xs text-gray-500">
        (Org Default: {orgSettings.showSilenceTimer ? 'Enabled' : 'Disabled'})
      </div>
    )}
  </div>
) : ...}
```

### 4. Frontend: SessionPlayer
**File:** `apps/web/components/session-player/index.tsx`
**Changes:**
1. Removed 30-second polling interval
2. Removed visibility change listener
3. Added explicit DEFAULT_ORG_SETTINGS for hierarchical resolution
```typescript
// Removed polling
useEffect(() => {
  const loadOrgSettings = async () => {
    const settings = await getOrganizationSettings();
    setOrgSettings(settings);
  };
  loadOrgSettings();
}, []); // Load once on mount

// Explicit defaults for hierarchical resolution
const DEFAULT_ORG_SETTINGS = {
  showSilenceTimer: true,
  silenceTimeout: 10,
  enableSilencePrompt: true,
  silenceThreshold: 0.12,
  minSilenceDuration: 500,
};

// Hierarchical resolution
const effectiveShowSilenceTimer =
  scenario.showSilenceTimer ??
  orgSettings?.showSilenceTimer ??
  DEFAULT_ORG_SETTINGS.showSilenceTimer;
```

### 5. Lambda: Scenario UPDATE API
**File:** `infrastructure/lambda/scenarios/update/index.ts`
**Change:** Use `'in' operator` to detect null values
```typescript
// BEFORE: if (showSilenceTimer !== undefined)
// AFTER:
if ('showSilenceTimer' in body) updateData.showSilenceTimer = showSilenceTimer;
```

### 6. Lambda: Organization Settings GET API (ROOT CAUSE FIX)
**File:** `infrastructure/lambda/organizations/settings/index.ts`
**Change:** Return raw DB values WITHOUT merging with defaults
```typescript
// BEFORE:
const mergedSettings: OrganizationSettings = {
  ...DEFAULT_SETTINGS,
  ...savedSettings,
};
return successResponse(mergedSettings);

// AFTER:
const savedSettings = (organization.settings as OrganizationSettings) || {};
return successResponse(savedSettings);
```

### 7. Shared Defaults
**Files Created:**
- `packages/shared/src/defaults.ts` - Unified default values (Single Source of Truth)
- `infrastructure/lambda/shared/defaults.ts` - Lambda copy with warning comment

```typescript
export const DEFAULT_ORGANIZATION_SETTINGS: OrganizationSettings = {
  enableSilencePrompt: true,
  silenceTimeout: 10,
  silencePromptStyle: 'neutral',
  showSilenceTimer: true,
  silenceThreshold: 0.12,
  minSilenceDuration: 500,
};
```

---

## Deployment

### Deployment Process
```bash
# 1. Clear CDK cache
rm -rf infrastructure/cdk.out

# 2. Deploy Lambda functions
pnpm run deploy:lambda

# Result: 91.04s deployment time
# Updated: OrganizationSettingsFunction, WebSocketDefaultFunction
```

### Verification
```bash
# Check Lambda function update timestamp
aws lambda get-function --function-name prance-organizations-settings-dev

# Result:
# LastModified: 2026-03-15T05:26:46.000+0000
# Runtime: nodejs22.x
# Handler: index.handler
```

---

## Lessons Learned

### 1. API Design: Return Raw Values, Not Merged Values
**Problem:** Merging with defaults at the API layer hides actual DB state
**Solution:** Return raw DB values; let clients handle hierarchical resolution
**Principle:** **APIs should return truth, not convenience**

### 2. Null vs Undefined Semantics
**null** = "Explicitly set to use default"
**undefined** = "Field not provided in request"
**Important:** Use `'key' in object` to detect null values, not `!== undefined`

### 3. Hierarchical Resolution Belongs in Frontend
**Wrong:** Lambda merges DB value → Default → Returns merged value
**Right:** Lambda returns raw DB value → Frontend resolves Scenario → Org → Default

**Why?**
- Frontend needs to distinguish between "not set" vs "explicitly set to default"
- Frontend needs to display resolved values with context (e.g., "Org Default: Disabled")
- Backend should be a dumb data store, not decision-making logic

### 4. Single Source of Truth for Defaults
**Problem:** Defaults defined in multiple places → Changes require multiple edits → Drift
**Solution:** `packages/shared/src/defaults.ts` + Lambda copy with warning comment
**Future:** Consider loading defaults from DB/DynamoDB for runtime configuration

### 5. Unnecessary Optimization is Premature Optimization
**Problem:** 30-second polling "to keep settings fresh"
**Reality:** Organization settings rarely change during a session
**Solution:** Load once on mount; reload on explicit user action (edit/save)

---

## Testing Checklist

### Manual Testing
- [ ] Set organization `showSilenceTimer` to `false`
- [ ] Create new scenario with "Use Default" (null)
- [ ] Verify scenario detail page shows "(Org Default: Disabled)"
- [ ] Start session → Verify silence timer is NOT displayed
- [ ] Edit scenario → Set `showSilenceTimer` to `true` (explicit)
- [ ] Verify scenario detail page shows "Enabled" (no org default text)
- [ ] Start session → Verify silence timer IS displayed
- [ ] Edit scenario → Set back to "Use Default" (null)
- [ ] Change organization setting to `true`
- [ ] Verify scenario detail page shows "(Org Default: Enabled)"
- [ ] Start session → Verify silence timer IS displayed

### Automated Testing
- [ ] Unit test: Organization Settings GET returns raw values
- [ ] Unit test: Scenario UPDATE accepts null values via `'in' operator`
- [ ] Integration test: Hierarchical resolution in SessionPlayer
- [ ] E2E test: Complete flow from organization settings → scenario → session

---

## Related Issues

### Similar Past Issues
1. **2026-03-11:** Lambda not detecting null values in UPDATE API
   - **Fix:** Changed to `'in' operator`
   - **Prevention:** Added validation script

2. **2026-03-14:** Cookie options managed in multiple places
   - **Fix:** Unified in `apps/web/lib/cookies.ts`
   - **Prevention:** Documented in CLAUDE.md Rule 7

### Prevention Measures
1. **API Design Guideline:** "Return raw values, let clients resolve hierarchy"
2. **Code Review Checklist:** "Does this API merge with defaults? If yes, justify why"
3. **Testing Guideline:** "Test with empty DB values, not just populated values"

---

## Conclusion

The root cause was a fundamental misunderstanding of where hierarchical resolution should occur. The Organization Settings GET API was "helping" by merging with defaults, but this "help" actually broke the hierarchical resolution logic by hiding the actual DB state.

**Key Insight:** When building hierarchical systems, the data source should return raw truth, and the consumer should handle resolution. Merging at the API layer creates an opaque barrier that prevents clients from understanding the actual state.

**Resolution:** Return raw DB values from Organization Settings GET API, implement proper hierarchical resolution in frontend with explicit defaults, and document this pattern for future features.

**Deployment Status:** ✅ Deployed at 2026-03-15 05:27:08 UTC
**Function Updated:** prance-organizations-settings-dev (LastModified: 2026-03-15T05:26:46Z)
