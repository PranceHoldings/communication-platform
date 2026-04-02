# Test Implementation Principle

---
name: Implementation First, Then Test
description: Never write tests based on assumptions - always verify implementation first
type: feedback
created: 2026-04-02
severity: critical
---

## Core Principle

**Code is the only source of truth. Assumptions are always wrong.**

Before writing any test, you MUST verify the actual implementation. "Common patterns" and "best practices" are not substitutes for reading the actual code.

## The Rule

**Test Writing Process (Non-Negotiable):**

1. **Find** - Use `find` or `ls` to locate the actual files
2. **Read** - Open and read the implementation
3. **Understand** - Trace the code path, understand the logic
4. **Write** - Only then write tests that match reality
5. **Verify** - Run tests and confirm they pass

**Never skip steps 1-3.**

## Why This Matters

**Past Failure (2026-04-01):**

**What happened:**
- Wrote E2E test for `/dashboard/sessions` route
- Assumed Next.js route structure: `app/dashboard/sessions/page.tsx`
- Test failed with 404
- Spent 3 hours debugging test framework
- Finally checked actual code: route was `app/(dashboard)/sessions/page.tsx`

**Root Cause:**
- Wrote test based on "standard Next.js pattern"
- Didn't check actual directory structure
- Assumed implementation matched documentation

**Impact:**
- 3 hours wasted
- False bug report
- Team confusion about "broken routing"
- Lost trust in test suite

## Common Failure Patterns

### ❌ Pattern 1: Assumed URL Structure

```typescript
// ❌ Written without checking implementation
test('dashboard loads', async () => {
  await page.goto('/dashboard/sessions');
  // Fails: actual route is /sessions (not nested)
});
```

**Should have done:**
```bash
# Find actual routes
find apps/web/app -name "page.tsx" | grep -v node_modules

# Result: apps/web/app/(dashboard)/sessions/page.tsx
# URL: /sessions (parentheses = route group, not path segment)
```

**Correct test:**
```typescript
// ✅ Written after verifying implementation
test('sessions page loads', async () => {
  await page.goto('/sessions');  // Correct path
  await expect(page.locator('h1')).toContainText('Sessions');
});
```

### ❌ Pattern 2: Assumed API Endpoint

```typescript
// ❌ Written without checking API implementation
const response = await fetch('/api/v1/users/profile');
// Fails: actual endpoint is /api/v1/auth/me
```

**Should have done:**
```bash
# Find API route handlers
find infrastructure/lambda -name "index.ts" | xargs grep -l "exports.handler"

# Check API Gateway routes in CDK
grep -r "addRoute\|addMethod" infrastructure/lib --include="*.ts"

# Result: Route is /api/v1/auth/me, not /api/v1/users/profile
```

### ❌ Pattern 3: Assumed Response Structure

```typescript
// ❌ Written without checking API response
expect(response.data.user.name).toBe('Test User');
// Fails: actual structure is response.data.profile.fullName
```

**Should have done:**
```bash
# Read Lambda function that handles this endpoint
cat infrastructure/lambda/auth/me/index.ts

# Check return statement
grep -A 20 "return.*statusCode: 200" infrastructure/lambda/auth/me/index.ts
```

**Correct test:**
```typescript
// ✅ Written after reading Lambda implementation
expect(response.data.profile.fullName).toBe('Test User');
```

### ❌ Pattern 4: Assumed Database Schema

```typescript
// ❌ Written without checking Prisma schema
await prisma.user.create({
  data: {
    username: 'test',  // Field doesn't exist
    email: 'test@example.com',
  },
});
// Fails: username field doesn't exist in schema
```

**Should have done:**
```bash
# Read Prisma schema
cat packages/database/prisma/schema.prisma | grep -A 20 "model User"

# Result: No username field, only email and fullName
```

**Correct test:**
```typescript
// ✅ Written after reading schema
await prisma.user.create({
  data: {
    email: 'test@example.com',
    fullName: 'Test User',  // Correct field name
  },
});
```

## Implementation Verification Checklist

### For Frontend Tests (Next.js)

```bash
# 1. Find actual page files
find apps/web/app -name "page.tsx" -o -name "layout.tsx" | grep -v node_modules

# 2. Check route groups (parentheses)
ls -la apps/web/app/
# (dashboard) = route group, NOT in URL
# dashboard = in URL

# 3. Check dynamic routes
ls -la apps/web/app/sessions/
# [id] = dynamic segment, URL: /sessions/123

# 4. Read actual component
cat apps/web/app/sessions/page.tsx

# 5. Check data fetching
grep -n "fetch\|await\|useEffect" apps/web/app/sessions/page.tsx
```

### For Backend Tests (Lambda)

```bash
# 1. Find Lambda function
find infrastructure/lambda -type f -name "index.ts" | grep sessions

# 2. Read handler implementation
cat infrastructure/lambda/sessions/list/index.ts

# 3. Check request validation
grep -A 10 "event.queryStringParameters" infrastructure/lambda/sessions/list/index.ts

# 4. Check response structure
grep -A 20 "return.*statusCode: 200" infrastructure/lambda/sessions/list/index.ts

# 5. Check error handling
grep -A 10 "catch\|statusCode: 4\|statusCode: 5" infrastructure/lambda/sessions/list/index.ts
```

### For API Tests

```bash
# 1. Find API Gateway routes (CDK)
grep -r "addRoute\|addMethod" infrastructure/lib/api-gateway-stack.ts

# 2. Check route paths
grep "path:" infrastructure/lib/api-gateway-stack.ts

# 3. Check Lambda integration
grep "integration:" infrastructure/lib/api-gateway-stack.ts

# 4. Check authorizer configuration
grep -A 5 "authorizer" infrastructure/lib/api-gateway-stack.ts
```

### For Database Tests

```bash
# 1. Read Prisma schema
cat packages/database/prisma/schema.prisma

# 2. Check specific model
grep -A 30 "model User" packages/database/prisma/schema.prisma

# 3. Check relations
grep -A 10 "@@relation" packages/database/prisma/schema.prisma

# 4. Check constraints
grep "@@unique\|@@index\|@@id" packages/database/prisma/schema.prisma
```

## Detection & Prevention

### Pre-Test Checklist

Before writing ANY test, answer these questions:

- [ ] Have I located the actual implementation files?
- [ ] Have I read the implementation code?
- [ ] Have I verified the URL/endpoint path?
- [ ] Have I verified the request/response structure?
- [ ] Have I checked for route groups or dynamic segments?
- [ ] Have I verified the database schema (if applicable)?
- [ ] Am I using actual field names from the schema?

**If you answered NO to any question, STOP and verify first.**

### Automated Detection

```bash
# scripts/validate-test-implementation.sh

#!/bin/bash

echo "🔍 Validating test assumptions against implementation..."

ERRORS=0

# Check 1: Test files reference actual routes
echo "[1/3] Checking route references in tests..."

# Extract routes from tests
TEST_ROUTES=$(grep -rh "goto\|visit\|navigateTo" apps/web/tests --include="*.spec.ts" | grep -oP '["'"'"']/[^"'"'"']+' | sort -u)

# Check if routes exist in app directory
for route in $TEST_ROUTES; do
  # Remove leading / and trailing /
  CLEAN_ROUTE=$(echo "$route" | tr -d '"'"'" | sed 's|^/||' | sed 's|/$||')
  
  # Convert URL to file path (handle dynamic segments)
  FILE_PATH="apps/web/app/${CLEAN_ROUTE}/page.tsx"
  
  if [ ! -f "$FILE_PATH" ]; then
    # Try route group: (dashboard)/sessions → sessions
    ALT_PATH=$(echo "$FILE_PATH" | sed 's|([^)]*/||g')
    if [ ! -f "$ALT_PATH" ]; then
      echo "⚠️  Test references route $route but no page.tsx found"
      echo "    Expected: $FILE_PATH or similar"
      ERRORS=$((ERRORS + 1))
    fi
  fi
done

# Check 2: Test files reference actual API endpoints
echo "[2/3] Checking API endpoint references in tests..."

# Extract API endpoints from tests
TEST_APIS=$(grep -rh "fetch\|axios\|request" apps/web/tests --include="*.spec.ts" | grep -oP '["'"'"']/api/[^"'"'"']+' | sort -u)

# Check if endpoints exist in Lambda functions
for api in $TEST_APIS; do
  CLEAN_API=$(echo "$api" | tr -d '"'"'" | sed 's|/api/v1/||')
  
  # Check if Lambda function exists for this endpoint
  LAMBDA_DIR="infrastructure/lambda/${CLEAN_API}"
  if [ ! -d "$LAMBDA_DIR" ]; then
    echo "⚠️  Test references API $api but no Lambda function found"
    echo "    Expected: $LAMBDA_DIR"
    ERRORS=$((ERRORS + 1))
  fi
done

# Check 3: Test fixtures match Prisma schema
echo "[3/3] Checking test fixtures against Prisma schema..."

# Extract field names from test fixtures
FIXTURE_FIELDS=$(grep -rh "{\s*$" -A 20 apps/web/tests/fixtures --include="*.ts" | grep -oP '^\s*\K\w+(?=:)' | sort -u)

# Check against Prisma schema
for field in $FIXTURE_FIELDS; do
  if ! grep -q "\\b$field\\b" packages/database/prisma/schema.prisma; then
    echo "⚠️  Test fixture uses field '$field' not found in Prisma schema"
    echo "    Verify this field exists or is mapped correctly"
  fi
done

if [ $ERRORS -eq 0 ]; then
  echo "✅ All test implementation validations passed"
  exit 0
else
  echo "❌ $ERRORS validation warning(s) detected"
  echo ""
  echo "⚠️  These might be false positives (dynamic routes, etc.)"
  echo "    But please verify each warning manually"
  exit 0  # Don't block commit, just warn
fi
```

## Examples from This Project

### ✅ Good: Verified Route Structure

```bash
# Step 1: Find actual routes
$ find apps/web/app -name "page.tsx"
apps/web/app/(auth)/login/page.tsx
apps/web/app/(auth)/register/page.tsx
apps/web/app/(dashboard)/sessions/page.tsx
apps/web/app/(dashboard)/scenarios/page.tsx
apps/web/app/page.tsx

# Step 2: Understand route groups
# (auth) and (dashboard) are route groups
# They DON'T appear in URLs

# Step 3: Write correct test
test('sessions page loads', async () => {
  await page.goto('/sessions');  // ✅ Correct (not /dashboard/sessions)
});
```

### ✅ Good: Verified API Response

```bash
# Step 1: Find Lambda function
$ cat infrastructure/lambda/sessions/list/index.ts

# Step 2: Read response structure
return {
  statusCode: 200,
  body: JSON.stringify({
    success: true,
    data: {
      sessions: sessions.map(s => ({
        id: s.id,
        title: s.scenario.title,
        status: s.status,
        // ... (exact fields from code)
      })),
      total: sessions.length,
    },
  }),
};

# Step 3: Write test matching actual structure
test('list sessions returns correct structure', async () => {
  const response = await fetch('/api/v1/sessions');
  const data = await response.json();
  
  expect(data.success).toBe(true);  // ✅ From actual code
  expect(data.data.sessions).toBeInstanceOf(Array);  // ✅ From actual code
  expect(data.data.total).toBeDefined();  // ✅ From actual code
});
```

### ❌ Bad: Assumed Structure (Past Mistake)

```typescript
// ❌ Written without checking implementation
test('avatar has imageUrl field', () => {
  expect(avatar.imageUrl).toBeDefined();
  // Failed: field is actually thumbnailUrl
});
```

**Should have done:**
```bash
# Check Prisma schema
$ grep -A 20 "model Avatar" packages/database/prisma/schema.prisma

model Avatar {
  id           String  @id @default(uuid())
  thumbnailUrl String? @map("thumbnail_url")  // ← Actual field name
  // ...
}
```

**Correct test:**
```typescript
// ✅ Written after checking schema
test('avatar has thumbnailUrl field', () => {
  expect(avatar.thumbnailUrl).toBeDefined();  // Correct field name
});
```

## Key Principles

1. **Code > Documentation** - If they conflict, code is always right
2. **Read > Assume** - 5 minutes reading saves 3 hours debugging
3. **Verify > Trust** - Even "obvious" patterns should be verified
4. **Specific > Generic** - Test exact behavior, not assumed behavior
5. **Trace > Guess** - Follow code execution path, don't guess

## Common Pitfalls

### Next.js Route Groups
```
app/(dashboard)/sessions/page.tsx  → URL: /sessions
app/dashboard/sessions/page.tsx    → URL: /dashboard/sessions
```
**Different!** Parentheses = route group (organization only)

### Dynamic Routes
```
app/sessions/[id]/page.tsx         → URL: /sessions/123
app/sessions/[...slug]/page.tsx    → URL: /sessions/a/b/c
```

### API Gateway Path Mapping
```typescript
// CDK: api.addRoute('/sessions', ...)
// Actual URL: /api/v1/sessions (prefix added by API Gateway)
```

### Prisma Schema vs. Database
```prisma
model User {
  fullName String @map("full_name")  // Code: fullName, DB: full_name
}
```

## Enforcement

### Pre-Commit Hook

```bash
# .git/hooks/pre-commit
npm run validate:tests  # Runs validation script
```

### Code Review Checklist

When reviewing test PRs, check:

- [ ] Test author verified implementation exists
- [ ] Test uses actual field names from schema
- [ ] Test uses actual URL paths from routing
- [ ] Test uses actual API endpoints from Lambda
- [ ] Test doesn't assume "common patterns"

### CI/CD Pipeline

```yaml
# .github/workflows/test.yml
- name: Validate test assumptions
  run: npm run validate:tests
  
- name: Run tests
  run: npm run test
```

---

**Last Updated:** 2026-04-02
**Next Review:** 2026-05-01
**Owner:** Engineering Team
