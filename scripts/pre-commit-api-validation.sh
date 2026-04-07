#!/bin/bash
#
# Pre-commit Hook: API Response Structure Validation
#
# This hook prevents commits that violate API response structure standards.
# Automatically runs before every commit.
#
# Exit codes:
#   0 - All checks passed, commit allowed
#   1 - Validation failed, commit blocked
#

# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

echo ""
log_section "Pre-commit: API Response Validation"

# Check if Lambda files were modified
LAMBDA_FILES_CHANGED=$(git diff --cached --name-only --diff-filter=ACM | grep "infrastructure/lambda" | grep "\.ts$" || true)

if [ -z "$LAMBDA_FILES_CHANGED" ]; then
  log_success "No Lambda files modified, skipping validation"
  echo ""
  exit 0
fi

log_warning "Lambda files modified:"
echo "$LAMBDA_FILES_CHANGED" | sed 's/^/  /'
echo ""

# ============================================================
# Validation 1: Response Structure
# ============================================================
log_info "[1/3] Validating response structures..."

if bash scripts/validate-lambda-responses.sh > /tmp/response-validation.log 2>&1; then
  log_success "Response structures valid"
else
  log_error "Response structure validation failed"
  echo ""
  cat /tmp/response-validation.log
  echo ""
  log_error "COMMIT BLOCKED: Fix response structures before committing"
  echo ""
  exit 1
fi

# ============================================================
# Validation 2: TypeScript Compilation
# ============================================================
log_info "[2/3] Checking TypeScript compilation..."

cd infrastructure
if pnpm run build > /tmp/tsc-build.log 2>&1; then
  log_success "TypeScript compilation successful"
else
  log_error "TypeScript compilation failed"
  echo ""
  cat /tmp/tsc-build.log | head -20
  echo ""
  log_error "COMMIT BLOCKED: Fix TypeScript errors before committing"
  echo ""
  exit 1
fi
cd ..

# ============================================================
# Validation 3: ESLint
# ============================================================
log_info "[3/3] Running ESLint on Lambda functions..."

cd infrastructure/lambda
if pnpm exec eslint --quiet . > /tmp/eslint.log 2>&1; then
  log_success "ESLint passed"
else
  log_error "ESLint failed"
  echo ""
  cat /tmp/eslint.log
  echo ""
  log_error "COMMIT BLOCKED: Fix ESLint errors before committing"
  echo ""
  exit 1
fi
cd ../..

# ============================================================
# Summary
# ============================================================
echo ""
log_section "All validations passed - Commit allowed"
echo ""

exit 0
