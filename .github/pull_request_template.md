# Pull Request

## Changes

**Brief description of changes:**

<!-- Describe what this PR does -->

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Refactoring (no functional changes, code improvements)
- [ ] Documentation update
- [ ] Dependency update

## Design Principles Check

Please verify your changes follow our design principles:

### 1. Dependency Management
- [ ] **No new heavy dependencies** - New dependencies have <10 direct dependencies
- [ ] **Self-implementation considered** - Evaluated if feature could be implemented in <100 lines
- [ ] **Validated dependency size** - Ran `npm run validate:deps-size` ✅

### 2. Monorepo Boundaries
- [ ] **No cross-domain imports** - Frontend doesn't import backend, and vice versa
- [ ] **Shared types only in packages/shared** - No runtime logic in shared package
- [ ] **Validated boundaries** - Ran `npm run validate:monorepo` ✅

### 3. Test Implementation
- [ ] **Implementation verified** - Read actual implementation before writing tests
- [ ] **No assumptions** - Verified routes, endpoints, and field names exist
- [ ] **Validated tests** - Ran `npm run validate:tests` ✅

### 4. Automation
- [ ] **Repetitive tasks automated** - Created scripts for tasks repeated ≥2 times
- [ ] **Integrated into pre-commit** - Added new validations to hooks if applicable

## Validation Results

**Run all design principle validations:**

```bash
npm run validate:design-principles
```

**Results:**
- [ ] All validations passed

**If failed, explain why (or fix before submitting):**

<!-- Paste validation output or explain exceptions -->

## Test Results

- [ ] **Build successful** - `npm run build` passes
- [ ] **All tests pass** - `npm run test` passes
- [ ] **No lint errors** - `npm run lint` passes
- [ ] **Type check passes** - `npm run typecheck` passes
- [ ] **Pre-commit hooks pass** - `npm run pre-commit` passes

## Schema Changes (if applicable)

- [ ] **Prisma schema updated** - Modified `packages/database/prisma/schema.prisma`
- [ ] **Migration created** - Ran `npx prisma migrate dev`
- [ ] **Types updated** - Updated `packages/shared/src/types/index.ts`
- [ ] **Validated schema-first** - Ran `bash scripts/validate-schema-interface-implementation.sh`

## Environment Variables (if applicable)

- [ ] **Added to .env.local** - New environment variables added
- [ ] **Not hardcoded** - No hardcoded values in code
- [ ] **env-validator updated** - Added getter functions if needed
- [ ] **Validated consistency** - Ran `npm run env:consistency`

## Deployment Checklist (if applicable)

- [ ] **Lambda functions updated** - Code changes deployed
- [ ] **API Gateway routes updated** - New endpoints configured
- [ ] **Database migrations applied** - Schema changes deployed
- [ ] **Environment variables set** - Production values configured

## Breaking Changes

**Does this PR introduce breaking changes?**

- [ ] No breaking changes
- [ ] Yes, breaking changes (describe below)

**If yes, describe the breaking changes and migration path:**

<!-- 
- What breaks?
- How to migrate?
- Deprecation timeline?
-->

## Screenshots (if applicable)

<!-- Add screenshots for UI changes -->

## Related Issues

**Closes:** #<!-- issue number -->
**Related to:** #<!-- issue number -->

## Additional Notes

<!-- Any additional context, concerns, or discussion points -->

---

## Reviewer Checklist

- [ ] Code follows design principles (dependencies, boundaries, tests, automation)
- [ ] All validation scripts pass
- [ ] Tests cover new functionality
- [ ] Documentation updated (if needed)
- [ ] No security vulnerabilities introduced
- [ ] Performance impact acceptable
- [ ] Breaking changes documented and justified
