# Deployment Enforcement System

**Status:** 🟢 **ACTIVE** - Automated Validation Enforced
**Date:** 2026-03-12
**Priority:** 🔴 **CRITICAL** - Prevents Service Outages

---

## 📋 Overview

This document describes the **enforced deployment system** that prevents deployment failures by **automatically validating** all prerequisites before any AWS CDK deployment.

### Key Principle

> **"All validations are MANDATORY, not optional"**

The system enforces validation by wrapping all deployment commands through a validation layer that cannot be bypassed.

---

## 🚫 What You Should NOT Do

### ❌ Direct CDK Commands (BLOCKED)

```bash
# ❌ DO NOT use these commands directly
pnpm exec cdk deploy Prance-dev-ApiLambda
pnpm exec cdk deploy --all
cd infrastructure && pnpm exec cdk deploy
```

**Why blocked:**
- Bypasses all validations
- Can deploy broken code
- Causes service outages
- Results in Import Module Errors

### ❌ Manual Validation (UNRELIABLE)

```bash
# ❌ DO NOT rely on manual validation
pnpm run lambda:predeploy  # Run manually
# ... (forget to run)
pnpm exec cdk deploy            # Deploy anyway
```

**Why unreliable:**
- Humans forget steps
- No enforcement mechanism
- Easy to skip when in a hurry

---

## ✅ What You SHOULD Do

### ✅ Use Enforced Deployment Commands

```bash
# ✅ Root-level deployment (RECOMMENDED)
pnpm run deploy:lambda

# ✅ Infrastructure-level deployment
cd infrastructure
pnpm run deploy:lambda

# ✅ Full stack deployment
pnpm run deploy:dev
```

**Why safe:**
- Automatically runs all validations
- Blocks deployment if any validation fails
- Cannot be bypassed
- Consistent across all environments

---

## 🔒 Enforcement Mechanism

### Architecture

```
User Command
    ↓
npm script (package.json)
    ↓
CDK Wrapper (scripts/cdk-wrapper.sh)
    ↓
[VALIDATION LAYER - CANNOT BE BYPASSED]
    ├─ CHECK 1: Space-containing directories
    ├─ CHECK 2: Lambda dependencies
    └─ CHECK 3: CDK bundling configuration
    ↓
✅ All checks passed → Deploy
❌ Any check failed → BLOCK deployment
```

### Implementation

**File:** `infrastructure/scripts/cdk-wrapper.sh`

**Features:**
1. **Automatic Validation** - Runs before every deployment
2. **Fail-Fast** - Stops immediately on first failure
3. **Clear Feedback** - Shows which check failed and how to fix
4. **Selective Execution** - Only runs relevant checks for the deployment type

---

## 📝 Validation Checks

### CHECK 1: Space-Containing Directories

**Purpose:** Prevent TypeScript compilation errors from macOS Finder auto-generated files

**Command:** `pnpm run clean:spaces`

**What it checks:**
- No directories with spaces in names
- No files matching `* 2.*` pattern
- No `.broken-*` directories

**Fix if failed:**
```bash
pnpm run clean:spaces
```

### CHECK 2: Lambda Dependencies

**Purpose:** Ensure all Lambda SDK dependencies are properly installed

**Command:** `pnpm run lambda:validate`

**What it checks:**
- Azure Speech SDK (`microsoft-cognitiveservices-speech-sdk`)
- AWS SDK packages (`@aws-sdk/client-bedrock-runtime`, etc.)
- All other Lambda dependencies

**Fix if failed:**
```bash
pnpm run lambda:fix
pnpm run lambda:validate
```

### CHECK 3: CDK Bundling Configuration

**Purpose:** Verify CDK bundling paths are correct

**Command:** `pnpm run validate:bundling`

**What it checks:**
- No wrong path patterns (`/asset-input/shared/`)
- All shared module directories exist
- CDK stack compiles successfully

**Fix if failed:**
```bash
# Check the error message for specific issues
cd infrastructure
pnpm run validate:bundling
```

---

## 🎯 Usage Examples

### Example 1: Deploy Lambda Functions

```bash
# From project root
pnpm run deploy:lambda

# Output:
# ============================================
# CDK Wrapper - Enforced Validation
# ============================================
#
# [VALIDATION] Running pre-deployment checks...
#
# [1/3] Checking for space-containing directories...
#   ✓ No space-containing directories
#
# [2/3] Validating Lambda dependencies...
#   ✓ Lambda dependencies valid
#
# [3/3] Validating CDK bundling configuration...
#   ✓ CDK bundling configuration valid
#
# ============================================
# ✅ All validations passed
# ============================================
#
# [CDK] Executing: cdk deploy Prance-dev-ApiLambda --require-approval never
# ...
```

### Example 2: Deploy All Stacks

```bash
# From infrastructure directory
cd infrastructure
pnpm run deploy

# Or from root
pnpm run deploy:dev
```

### Example 3: Validation Failure

```bash
pnpm run deploy:lambda

# Output:
# ============================================
# CDK Wrapper - Enforced Validation
# ============================================
#
# [VALIDATION] Running pre-deployment checks...
#
# [1/3] Checking for space-containing directories...
#   ✗ Space-containing directories found
#
# Run: pnpm run clean:spaces
#
# [Deployment BLOCKED]
```

---

## 🔧 Bypass for Emergency (Use with Extreme Caution)

### Emergency Bypass (NOT RECOMMENDED)

If you absolutely must bypass validation (e.g., emergency hotfix), use:

```bash
# ONLY use in emergency situations
cd infrastructure
pnpm exec cdk deploy Prance-dev-ApiLambda --require-approval never

# ⚠️  WARNING: This bypasses ALL validations
# ⚠️  Use at your own risk
# ⚠️  May cause service outages
```

**When to use:**
- ✅ Production emergency requiring immediate fix
- ✅ Validation system itself is broken
- ✅ You have manually verified all requirements

**When NOT to use:**
- ❌ "I'm in a hurry"
- ❌ "Validation is too slow"
- ❌ "I know what I'm doing"

---

## 📊 Validation History

### Past Incidents Prevented

| Date | Issue Prevented | Validation Check |
|------|----------------|------------------|
| 2026-03-12 | WebSocket Import Module Error | CHECK 3: CDK bundling paths |
| 2026-03-12 | TypeScript compilation failure | CHECK 1: Space-containing directories |
| 2026-03-11 | Azure SDK missing | CHECK 2: Lambda dependencies |

---

## 🎓 Training & Onboarding

### For New Team Members

1. **Read this document first**
2. **Try a test deployment:**
   ```bash
   pnpm run deploy:lambda
   ```
3. **Observe the validation process**
4. **Understand each check's purpose**
5. **Never use direct `pnpm exec cdk` commands**

### For Existing Team Members

1. **Update your habits:**
   - Old: `pnpm exec cdk deploy`
   - New: `pnpm run deploy:lambda`

2. **Update your scripts/documentation:**
   - Replace all `pnpm exec cdk deploy` references
   - Use `pnpm run deploy:lambda` instead

3. **Report issues:**
   - If validation fails incorrectly
   - If new validation checks are needed

---

## 🔍 Troubleshooting

### Q: "pnpm run deploy:lambda is slow"

**A:** Validation adds ~10-30 seconds. This is intentional to prevent hours of debugging deployment failures.

### Q: "I fixed the issue but validation still fails"

**A:** Try:
```bash
# Clean and rebuild
pnpm run build:clean
pnpm run lambda:fix
pnpm run deploy:lambda
```

### Q: "Can I add custom validations?"

**A:** Yes! Edit `infrastructure/scripts/cdk-wrapper.sh` and add your check.

### Q: "Validation passed but deployment still failed"

**A:** Report this immediately. We need to add a new validation check for this case.

---

## 📚 Related Documents

- [ROOT_CAUSE_ANALYSIS_2026-03-12_websocket_import_error.md](../09-progress/ROOT_CAUSE_ANALYSIS_2026-03-12_websocket_import_error.md)
- [SPACE_DIRECTORY_PREVENTION.md](./SPACE_DIRECTORY_PREVENTION.md)
- [LAMBDA_BUILD_DEPLOY_GUIDE.md](./LAMBDA_BUILD_DEPLOY_GUIDE.md)

---

## 📞 Support

**If you encounter issues:**

1. Check validation error message
2. Run suggested fix command
3. Retry deployment
4. If still failing, check related documents above
5. If nothing works, report to team

---

**Last Updated:** 2026-03-12
**Maintained By:** Platform Team
**Status:** 🟢 Active & Enforced
