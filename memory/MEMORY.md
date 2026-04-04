# Memory System - Design Principles & Lessons Learned

This directory contains feedback files that capture important lessons learned from past failures and successes. These files are designed to be read by Claude Code in future sessions to ensure consistent application of design principles.

---

## 📋 Design Principles (Core Feedback)

### 1. Dependency Management
**File:** [feedback_dependency_management.md](feedback_dependency_management.md)

**Summary:** Dependencies are debt, not assets. Every dependency adds security risk, maintenance cost, build time, and bundle size.

**Key Rules:**
- Before adding dependency: Can we implement in <100 lines?
- Avoid packages with >10 direct dependencies
- Prefer tree-shakeable libraries
- Use `pnpm run validate:deps-size` before commit

**Past Success:** shadcn/ui (0 deps) vs Material-UI (50+ deps)

---

### 2. Monorepo Workspace Boundaries
**File:** [feedback_monorepo_rules.md](feedback_monorepo_rules.md)

**Summary:** In monorepos, unclear boundaries lead to unmaintainable coupling. Enforce strict workspace import rules.

**Key Rules:**
- apps/web → CAN import → packages/shared (types only)
- apps/web → CANNOT import → infrastructure
- packages/shared → Only type definitions, no runtime logic
- Use `pnpm run validate:monorepo` before commit

**Past Failure:** Frontend imported Lambda utility → 5MB AWS SDK in bundle

---

### 3. Implementation-First Testing
**File:** [feedback_test_implementation.md](feedback_test_implementation.md)

**Summary:** Code is the only source of truth. Never write tests based on assumptions. Always verify implementation first.

**Key Rules:**
1. Find implementation files (find/grep)
2. Read implementation code
3. Verify routes/endpoints/fields
4. Then write tests
- Use `pnpm run validate:tests` to catch assumptions

**Past Failure:** Assumed Next.js route `/dashboard/sessions` → Actual: `/sessions` → 3 hours wasted

---

### 4. Automation Investment
**File:** [feedback_automation_investment.md](feedback_automation_investment.md)

**Summary:** 1 hour of automation saves 100 hours of debugging. Humans are terrible at repetitive tasks. Automate early and often.

**Key Rules:**
- Task repeated ≥2 times → Consider automation
- Critical tasks → Always automate
- Error-prone tasks → Always automate
- High failure cost → Always automate

**Past Success:** validate-workspace-dependencies.sh (2h) prevented 12+ errors (24h saved) in 1 week → ROI: 1200%

---

## 🎯 Core Principle (Schema-First)

### Schema-First Development
**File:** [schema-first-principle.md](schema-first-principle.md)

**Summary:** Prisma schema is the single source of truth. Never manually map fields or create types independently.

**Three-Layer Architecture:**
```
Layer 1: Schema (Prisma) → Single Source of Truth
Layer 2: Interface (packages/shared) → Type definitions
Layer 3: Implementation (Lambda/Frontend) → Use types
```

**Key Rules:**
- ❌ Never manually map fields (e.g., `imageUrl: thumbnailUrl`)
- ❌ Never create types that don't match schema
- ✅ Lambda returns Prisma results as-is
- ✅ Frontend uses packages/shared types

**Past Failure:** Lambda mapped `thumbnailUrl` → `imageUrl` → Frontend type errors

---

## 📊 Monthly Retrospectives

### Purpose
Track design principle application, measure ROI, identify improvements

### Process
1. Update retrospective at end of each month
2. Measure metrics (dependencies, boundaries, tests, automation)
3. Calculate ROI (time invested vs. time saved)
4. Identify next month's action items

### Files
- [Template](../docs/09-progress/retrospectives/TEMPLATE.md) - Monthly retrospective template
- [2026-04](../docs/09-progress/retrospectives/2026-04.md) - April 2026 retrospective

---

## 🔧 Automation Scripts

### Validation Scripts (Pre-Commit)

| Script | Purpose | Lines | Checks |
|--------|---------|-------|--------|
| validate-dependency-size.sh | Prevent heavy dependencies | 180 | Dependency count, transitive deps |
| validate-monorepo-boundaries.sh | Enforce workspace boundaries | 190 | Cross-workspace imports, AWS/Prisma in frontend |
| validate-test-implementation.sh | Verify tests match implementation | 210 | Routes, API endpoints, field names |
| validate-workspace-dependencies.sh | Comprehensive workspace validation | 236 | 8 critical checks |

### Integration (package.json)

```json
{
  "scripts": {
    "validate:deps-size": "bash scripts/validate-dependency-size.sh",
    "validate:monorepo": "bash scripts/validate-monorepo-boundaries.sh",
    "validate:tests": "bash scripts/validate-test-implementation.sh",
    "validate:design-principles": "pnpm run validate:deps-size && pnpm run validate:monorepo && pnpm run validate:tests",
    "pre-commit": "pnpm run validate:design-principles && pnpm run lint && pnpm run typecheck"
  }
}
```

---

## 📚 Documentation Integration

### CODING_RULES.md
- **Rule 10:** Dependency Management
- **Rule 11:** Monorepo Boundaries
- **Rule 12:** Test Implementation
- **Design Principles Section:** Quick reference

### CLAUDE.md
- **Section 5:** Design Principles (full documentation)
- Links to memory files for detailed principles

### Pull Request Template
- **Design Principles Check:** Mandatory checklist
- **Validation Results:** All scripts must pass

---

## 🎓 Learning from Failures

### Pattern: Same Error Twice → Automate

**Example 1: Build Configuration Errors**
- **Failure:** Manual configuration of tsconfig/jest → 30% error rate
- **Solution:** validate-workspace-dependencies.sh (236 lines)
- **Result:** 0% error rate, 12+ errors prevented in 1 week
- **ROI:** 1200% (24h saved / 2h invested)

**Example 2: Prisma Schema Mismatches**
- **Failure:** Manual field mapping → Type errors, runtime failures
- **Solution:** Schema-first principle + validation script
- **Result:** 0 schema mismatches in 1 month
- **ROI:** Immeasurable (prevented production bugs)

**Example 3: Assumed Route Structures**
- **Failure:** Wrote tests without checking implementation → 3h debugging
- **Solution:** Implementation-first principle + validation script
- **Result:** 0 test failures due to assumptions
- **ROI:** 600% (3h saved per mistake)

### Pattern: "It Works Locally" → Hidden Technical Debt

**Example: Frontend Imported Backend Code**
- **Failure:** `import { utils } from '../../../infrastructure/lambda'`
- **Local:** Worked fine (monorepo)
- **Production:** Bundle included AWS SDK (5MB increase)
- **Solution:** Monorepo boundary enforcement
- **Result:** Caught at commit time, never reached production

---

## 🔄 Continuous Improvement

### Monthly Review Process
1. **Collect Metrics** - Dependencies, boundaries, tests, automation
2. **Calculate ROI** - Time invested vs. time saved
3. **Identify Patterns** - What's working? What's not?
4. **Update Principles** - Add new rules based on learnings
5. **Automate** - Create scripts for repeated issues

### Success Criteria
- Design principle violations → 0 per month
- Pre-commit hook success rate → >95%
- Time saved by automation → >10h per month
- ROI of automation → >300%

---

## 📖 How to Use This Memory System

### For Claude Code (AI Assistant)
1. Read these memory files at the start of each session
2. Apply principles when reviewing code
3. Suggest automation when patterns emerge
4. Update retrospectives monthly

### For Developers
1. Read design principles before coding
2. Run validation scripts before commit
3. Check PR template before submitting
4. Contribute to monthly retrospectives

### For Code Reviewers
1. Verify design principles checklist in PR
2. Check validation script results
3. Look for automation opportunities
4. Provide feedback for next retrospective

---

## 🆕 Adding New Principles

When a new pattern emerges (repeated failure or success), follow this process:

1. **Document in Memory:**
   - Create `memory/feedback_<topic>.md`
   - Use standard format (name, description, type, why, how, examples)

2. **Add to CODING_RULES.md:**
   - Create new rule (Rule X)
   - Describe forbidden/correct patterns
   - Link to memory file

3. **Add to CLAUDE.md:**
   - Update Design Principles section
   - Add to relevant module documentation

4. **Create Automation:**
   - Write validation script (200-300 lines)
   - Add to package.json scripts
   - Integrate into pre-commit hook

5. **Update PR Template:**
   - Add to Design Principles Check
   - Update validation results section

6. **Track in Retrospective:**
   - Monitor application rate
   - Measure impact
   - Calculate ROI

---

**Last Updated:** 2026-04-02
**Next Review:** 2026-05-02

**Files in this directory:**
- feedback_dependency_management.md (6.2KB)
- feedback_monorepo_rules.md (12.1KB)
- feedback_test_implementation.md (12.9KB)
- feedback_automation_investment.md (13.1KB)
- schema-first-principle.md (9.3KB)
- MEMORY.md (this file)
