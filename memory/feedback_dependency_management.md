# Dependency Management Principle

---
name: Minimize Dependencies
description: Dependencies are debt - keep them small and justified
type: feedback
created: 2026-04-02
severity: high
---

## Core Principle

**Dependencies are debt, not assets.**

Every dependency you add:
- Increases security risk (vulnerabilities)
- Increases maintenance cost (version updates)
- Increases build time
- Increases bundle size
- Creates lock-in

## The Rule

**Before adding any dependency:**
1. Can we implement it ourselves in <100 lines?
2. Is this a lightweight package (<10 direct dependencies)?
3. Will this dependency be used extensively (>5 places)?

If the answer to any of these is NO, reconsider.

## Why This Matters

**Past Failure (2026-04-01):**
- Added large UI component library for "convenience"
- Brought 50+ transitive dependencies
- Increased bundle size by 300KB
- Later discovered we only used 3 components
- Removal took 8 hours of refactoring

**Root Cause:**
- Optimized for short-term convenience
- Didn't consider long-term cost
- Assumed "popular = safe"

## How to Apply

### For Small Utilities (lodash, moment, etc.)
```bash
# ❌ Bad: Install entire library
npm install lodash

# ✅ Good: Copy only what you need
# Create utils/array.ts with the 3 functions you need
```

### For UI Components
```bash
# ❌ Bad: Large component library
npm install @material-ui/core  # 50+ dependencies

# ✅ Good: Use headless UI + Tailwind
npm install @headlessui/react  # 2 dependencies
# Style with Tailwind CSS
```

### For Date/Time
```bash
# ❌ Bad: Heavy library
npm install moment  # 20+ dependencies, deprecated

# ✅ Good: Modern native or lightweight
# Use native Intl.DateTimeFormat
# OR: npm install date-fns  # Tree-shakeable, 0 dependencies
```

## Detection

### Automated Check
```bash
# Run before accepting any PR with package.json changes
npm run validate:deps-size
```

### Manual Review
```bash
# Check dependency tree before installing
npm info <package> dependencies

# Count direct + transitive dependencies
npm ls <package> --depth=5 | grep -c "─"
```

## Threshold Guidelines

| Dependency Type | Max Direct Deps | Max Transitive Deps | Justification Required |
|----------------|-----------------|---------------------|------------------------|
| Utility | 0-5 | 0-20 | Consider self-implementation |
| UI Component | 0-10 | 0-50 | Prefer headless + styling |
| Framework | 0-20 | 0-100 | Core framework only |
| Testing | 0-15 | 0-80 | Dev dependencies OK |

**Red Flags:**
- 🚨 Direct deps > 20: Almost certainly too heavy
- 🚨 Transitive deps > 100: Maintenance nightmare
- 🚨 Multiple versions of same package: Bloat + conflicts

## Examples

### ✅ Good Decisions

**1. Used shadcn/ui instead of Material-UI**
```
Why: Shadcn copies components into your codebase
Result: 0 runtime dependencies, full control
Trade-off: Manual updates, but worth it for bundle size
```

**2. Built custom i18n system instead of next-intl**
```
Why: next-intl was 15 dependencies for simple JSON loading
Result: 200-line custom system, 0 dependencies
Trade-off: Missing edge cases, but covers our 95% use case
```

**3. Used native Date instead of moment.js**
```
Why: moment.js is 20+ deps, deprecated, heavy
Result: Intl.DateTimeFormat + custom helpers
Trade-off: More verbose, but modern and lightweight
```

### ❌ Bad Decisions (Past Mistakes)

**1. Used Winston logger everywhere (Fixed)**
```
Problem: Winston has 30+ dependencies for "structured logging"
Solution: Built custom logger with AWS CloudWatch integration
Result: -35 dependencies, better integration
```

**2. Used Axios instead of native fetch (Fixed)**
```
Problem: Axios is 5 dependencies for simple HTTP client
Solution: Switched to native fetch + custom retry wrapper
Result: -5 dependencies, smaller bundle
```

## Automation

### Validation Script
```bash
# scripts/validate-dependency-size.sh
# Runs on: pre-commit hook, PR checks, manual review

EXIT_CODE=0

# Check each package.json change
for file in $(git diff --name-only HEAD | grep package.json); do
  # Extract newly added dependencies
  ADDED=$(git diff HEAD $file | grep "^+" | grep -oP '"\K[^"]+(?=":)')
  
  for dep in $ADDED; do
    # Get dependency count
    DIRECT=$(npm info $dep dependencies | grep -c ":")
    TRANSITIVE=$(npm ls $dep --depth=5 2>/dev/null | grep -c "─")
    
    if [ $DIRECT -gt 20 ] || [ $TRANSITIVE -gt 100 ]; then
      echo "🚨 Heavy dependency detected: $dep"
      echo "   Direct: $DIRECT, Transitive: $TRANSITIVE"
      echo "   Consider alternatives or self-implementation"
      EXIT_CODE=1
    elif [ $DIRECT -gt 10 ]; then
      echo "⚠️  Medium dependency: $dep (Direct: $DIRECT)"
      echo "   Review if this is necessary"
    fi
  done
done

exit $EXIT_CODE
```

## Investment Decision Framework

**Time vs. Dependency Trade-off:**

```
If implementation time < 4 hours → Implement yourself
If implementation time 4-8 hours → Consider lightweight library
If implementation time > 8 hours → Accept dependency (with careful selection)
```

**Example:**
- Array utilities: 1 hour → Self-implement ✅
- CSV parser: 3 hours → Self-implement ✅
- PDF generator: 20 hours → Use library (carefully chosen) ✅
- Video transcoding: 100 hours → Use service (AWS MediaConvert) ✅

## Key Takeaways

1. **Dependencies are a liability, not an asset**
2. **Popular ≠ Good** - Evaluate based on size and maintenance
3. **Tree-shakeable > Monolithic** - Prefer libraries that allow importing only what you need
4. **Native > Library** - Modern JavaScript has many built-in features
5. **Invest in custom code** - 1 hour writing code saves 10 hours debugging dependencies

## Monthly Review

**Check every month:**
```bash
# List all dependencies and their sizes
npm ls --depth=0 --long

# Identify unused dependencies
npx depcheck

# Find duplicate dependencies
npm dedupe --dry-run

# Check for updates (security + features)
npm outdated
```

**Questions to ask:**
- Which dependencies have we not used in 3+ months?
- Which dependencies have security vulnerabilities?
- Which dependencies have lighter alternatives now?
- Can we upgrade to use native features instead?

---

**Last Updated:** 2026-04-02
**Next Review:** 2026-05-01
**Owner:** Engineering Team
