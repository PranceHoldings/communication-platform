# Monorepo Workspace Boundary Rules

---
name: Clear Workspace Boundaries
description: Enforce strict boundaries between monorepo workspaces to prevent coupling
type: feedback
created: 2026-04-02
severity: critical
---

## Core Principle

**In a monorepo, unclear boundaries lead to unmaintainable coupling.**

Each workspace should have a clear, enforced boundary. Violations are not just "bad practice" - they are architectural failures that compound over time.

## The Rule

**Workspace Import Rules:**

```
apps/web           → CAN import → packages/shared (types only)
                   → CANNOT import → infrastructure

infrastructure     → CAN import → packages/shared (types only)
                   → CANNOT import → apps/web

packages/shared    → CANNOT import → apps/web OR infrastructure
                   → Only type definitions, no runtime logic

packages/database  → CANNOT import → anything except Prisma
```

## Why This Matters

**Past Failure (2026-04-01):**
- Frontend imported Lambda utility function for "convenience"
- Lambda function was coupled to AWS SDK
- Frontend bundle included AWS SDK (5MB increase)
- Could not deploy frontend without backend changes
- Took 12 hours to untangle

**Root Cause:**
- No automated boundary enforcement
- "It works locally" mentality
- Didn't understand transitive dependencies

## Monorepo Anti-Patterns

### ❌ Anti-Pattern 1: Cross-Domain Imports

```typescript
// apps/web/lib/utils.ts
import { formatDate } from '../../../infrastructure/lambda/shared/utils';
// ❌ Frontend importing backend code
```

**Why it's bad:**
- Frontend bundle includes backend dependencies (AWS SDK, etc.)
- Circular dependency risk
- Cannot independently deploy frontend/backend
- TypeScript path resolution issues in production

**Fix:**
```typescript
// packages/shared/src/utils/date.ts
export function formatDate(date: Date): string { ... }

// apps/web/lib/utils.ts
import { formatDate } from '@prance/shared';
// ✅ Shared utility in neutral package
```

### ❌ Anti-Pattern 2: Shared Runtime Logic in Types Package

```typescript
// packages/shared/src/database.ts
import { PrismaClient } from '@prisma/client';
export const prisma = new PrismaClient();
// ❌ Runtime logic in shared types package
```

**Why it's bad:**
- Types package should be pure TypeScript types
- Frontend doesn't need Prisma runtime
- Violates "types only" principle

**Fix:**
```typescript
// packages/shared/src/types.ts
export type User = { ... };
// ✅ Only type definitions

// infrastructure/lambda/shared/database.ts
import { PrismaClient } from '@prisma/client';
export const prisma = new PrismaClient();
// ✅ Runtime logic in backend only
```

### ❌ Anti-Pattern 3: Circular Dependencies

```typescript
// apps/web/lib/api.ts
import { validateRequest } from '@prance/backend-utils';

// packages/backend-utils/src/validate.ts
import { UserSchema } from '@prance/web-types';
// ❌ Circular dependency: web → backend-utils → web-types
```

**Why it's bad:**
- Build order becomes non-deterministic
- Hot reload breaks
- Deployment order issues

**Fix:**
```typescript
// packages/shared/src/types.ts
export type User = { ... };

// packages/shared/src/validation.ts
export const UserSchema = z.object({ ... });

// Both apps/web and infrastructure import from shared
// ✅ Shared types break the cycle
```

## Workspace Dependency Rules

### packages/shared (Foundation Layer)

**Allowed:**
- Type definitions (interfaces, types, enums)
- Pure validation schemas (Zod, no runtime side effects)
- Constants (strings, numbers, readonly objects)

**Forbidden:**
- Database clients (Prisma, MongoDB drivers)
- HTTP clients (fetch wrappers, Axios)
- AWS SDK or any cloud-specific code
- React components or Next.js code
- Node.js-specific APIs (fs, path, etc.)

**Example Structure:**
```
packages/shared/
├── src/
│   ├── types/
│   │   ├── user.ts        // ✅ interface User
│   │   ├── session.ts     // ✅ interface Session
│   │   └── index.ts
│   ├── validation/
│   │   ├── user.ts        // ✅ zod schema
│   │   └── index.ts
│   └── constants/
│       ├── roles.ts       // ✅ export const ROLES = ['USER', 'ADMIN']
│       └── index.ts
└── package.json           // dependencies: {} (empty!)
```

### apps/web (Frontend Layer)

**Allowed:**
- Import from packages/shared (types, validation, constants)
- React, Next.js, frontend libraries
- Browser APIs
- Tailwind CSS, UI components

**Forbidden:**
- Import from infrastructure/**
- Import from packages/database
- Import AWS SDK or backend-specific libraries
- Import Node.js APIs (fs, path, except in API routes)

**Example Structure:**
```
apps/web/
├── app/                   // Next.js 15 App Router
├── components/            // React components
├── lib/
│   ├── api.ts            // ✅ Frontend API client (fetch only)
│   └── utils.ts          // ✅ Frontend utilities (no backend imports)
└── package.json          // dependencies: next, react, @prance/shared
```

### infrastructure (Backend Layer)

**Allowed:**
- Import from packages/shared (types, validation, constants)
- AWS SDK, Lambda runtime
- Prisma Client
- Node.js APIs

**Forbidden:**
- Import from apps/web/**
- Import React, Next.js, or any frontend libraries
- Import browser-specific APIs

**Example Structure:**
```
infrastructure/
├── lambda/
│   ├── auth/
│   │   └── login/
│   │       └── index.ts   // ✅ Uses @prance/shared types
│   └── shared/
│       ├── database.ts    // ✅ Prisma Client instance
│       └── utils.ts       // ✅ Backend utilities
└── package.json           // dependencies: aws-sdk, @prisma/client, @prance/shared
```

## Detection & Enforcement

### Automated Validation Script

```bash
# scripts/validate-monorepo-boundaries.sh

#!/bin/bash

echo "🔍 Validating monorepo workspace boundaries..."

ERRORS=0

# Rule 1: apps/web cannot import from infrastructure
if grep -r "from ['\"].*infrastructure" apps/web --include="*.ts" --include="*.tsx" | grep -v node_modules; then
  echo "❌ Rule 1 Violation: apps/web importing from infrastructure"
  ERRORS=$((ERRORS + 1))
fi

# Rule 2: infrastructure cannot import from apps/web
if grep -r "from ['\"].*apps/web" infrastructure --include="*.ts" | grep -v node_modules; then
  echo "❌ Rule 2 Violation: infrastructure importing from apps/web"
  ERRORS=$((ERRORS + 1))
fi

# Rule 3: packages/shared cannot have runtime dependencies (except type-only)
SHARED_DEPS=$(cat packages/shared/package.json | jq -r '.dependencies // {} | keys | length')
if [ "$SHARED_DEPS" -gt 2 ]; then  # Allow zod + maybe one more
  echo "❌ Rule 3 Violation: packages/shared has too many dependencies ($SHARED_DEPS)"
  echo "   Shared package should only have type-related dependencies"
  ERRORS=$((ERRORS + 1))
fi

# Rule 4: packages/shared cannot import from apps or infrastructure
if grep -r "from ['\"].*\(apps/\|infrastructure/\)" packages/shared/src --include="*.ts" | grep -v node_modules; then
  echo "❌ Rule 4 Violation: packages/shared importing from apps or infrastructure"
  ERRORS=$((ERRORS + 1))
fi

# Rule 5: Check for AWS SDK in frontend
if grep -r "from ['\"].*aws-sdk\|@aws-sdk" apps/web/app apps/web/components --include="*.ts" --include="*.tsx" | grep -v node_modules; then
  echo "❌ Rule 5 Violation: AWS SDK imported in frontend code"
  echo "   AWS SDK should only be in infrastructure (Lambda functions)"
  ERRORS=$((ERRORS + 1))
fi

# Rule 6: Check for Prisma in frontend
if grep -r "from ['\"].*@prisma/client" apps/web/app apps/web/components --include="*.ts" --include="*.tsx" | grep -v node_modules; then
  echo "❌ Rule 6 Violation: Prisma Client imported in frontend code"
  echo "   Prisma should only be in infrastructure (Lambda functions)"
  ERRORS=$((ERRORS + 1))
fi

if [ $ERRORS -eq 0 ]; then
  echo "✅ All monorepo boundary validations passed"
  exit 0
else
  echo "❌ $ERRORS boundary violation(s) detected"
  echo ""
  echo "Fix guide:"
  echo "1. Move shared types to packages/shared"
  echo "2. Move runtime logic to appropriate workspace"
  echo "3. Never import cross-domain (frontend ↔ backend)"
  exit 1
fi
```

### TypeScript Path Validation

Add to `tsconfig.json` to restrict imports:

```json
{
  "compilerOptions": {
    "paths": {
      "@prance/shared": ["./packages/shared/src/index.ts"]
      // Note: NO paths for infrastructure in apps/web tsconfig
      // This makes it harder to accidentally import
    }
  }
}
```

### ESLint Rule (Optional)

```js
// .eslintrc.js
module.exports = {
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['**/infrastructure/**'],
            message: 'Frontend cannot import from infrastructure. Use @prance/shared instead.',
          },
          {
            group: ['**/apps/web/**'],
            message: 'Backend cannot import from frontend. Use @prance/shared instead.',
          },
        ],
      },
    ],
  },
  overrides: [
    {
      files: ['apps/web/**/*'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: ['**/infrastructure/**', '@aws-sdk/**', '@prisma/client'],
            message: 'Frontend cannot import backend dependencies',
          },
        ],
      },
    },
  ],
};
```

## Examples from This Project

### ✅ Good: Type Sharing

```typescript
// packages/shared/src/types/user.ts
export interface User {
  id: string;
  email: string;
  role: UserRole;
}

// apps/web/app/dashboard/page.tsx
import type { User } from '@prance/shared';
// ✅ Frontend uses shared type

// infrastructure/lambda/auth/me/index.ts
import type { User } from '@prance/shared';
// ✅ Backend uses shared type
```

### ✅ Good: Validation Schema Sharing

```typescript
// packages/shared/src/validation/user.ts
import { z } from 'zod';
export const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// apps/web/app/register/page.tsx
import { CreateUserSchema } from '@prance/shared';
// ✅ Frontend validates with shared schema

// infrastructure/lambda/auth/register/index.ts
import { CreateUserSchema } from '@prance/shared';
// ✅ Backend validates with shared schema
```

### ❌ Bad: Runtime Logic in Shared Package

```typescript
// packages/shared/src/database.ts
export const prisma = new PrismaClient();
// ❌ Runtime database client in shared package
// This forces frontend to bundle Prisma!
```

**Fix:**
```typescript
// infrastructure/lambda/shared/database.ts
export const prisma = new PrismaClient();
// ✅ Database client only in backend

// packages/shared/src/types/database.ts
export type PrismaUser = { ... };
// ✅ Only types in shared package
```

## Key Principles

1. **Shared = Types Only** - No runtime logic, no side effects
2. **One-Way Dependencies** - Frontend → Shared ← Backend (never Frontend ↔ Backend)
3. **Explicit Over Implicit** - Use @prance/shared, not relative paths across workspaces
4. **Validate Automatically** - Don't rely on code review alone
5. **Fail Fast** - Block builds/commits that violate boundaries

## Troubleshooting

### "Cannot find module '@prance/shared'"

**Cause:** Workspace not properly linked

**Fix:**
```bash
pnpm install  # Re-link workspaces
cd packages/shared && pnpm run build  # Build shared package
```

### "Module has no exported member 'User'"

**Cause:** Type not exported from shared package index

**Fix:**
```typescript
// packages/shared/src/index.ts
export * from './types/user';  // ✅ Re-export all types
```

### Build works locally but fails in CI

**Cause:** Circular dependency or incorrect import order

**Fix:**
```bash
pnpm run validate:monorepo  # Detect circular dependencies
pnpm exec madge --circular --extensions ts packages/ apps/ infrastructure/
```

---

**Last Updated:** 2026-04-02
**Next Review:** 2026-05-01
**Owner:** Engineering Team
