#!/bin/bash
#
# validate-monorepo-boundaries.sh
#
# Purpose: Enforce strict boundaries between monorepo workspaces
# When to run: Pre-commit hook, PR checks, manual review
# How to run: pnpm run validate:monorepo
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR/.."

echo "🔍 Validating monorepo workspace boundaries..."
echo "========================================"

ERRORS=0

# Rule 1: apps/web cannot import from infrastructure
echo "[1/6] Checking frontend → backend imports..."

FRONTEND_TO_BACKEND=$(grep -r "from ['\"].*infrastructure" \
  "$PROJECT_ROOT/apps/web" \
  --include="*.ts" --include="*.tsx" \
  2>/dev/null | grep -v node_modules | grep -v ".next" || echo "")

if [ -n "$FRONTEND_TO_BACKEND" ]; then
  echo "❌ Rule 1 Violation: apps/web importing from infrastructure"
  echo ""
  echo "$FRONTEND_TO_BACKEND"
  echo ""
  echo "Fix: Move shared code to packages/shared"
  ERRORS=$((ERRORS + 1))
else
  echo "✅ No frontend → backend imports detected"
fi

# Rule 2: infrastructure cannot import from apps/web
echo "[2/6] Checking backend → frontend imports..."

BACKEND_TO_FRONTEND=$(grep -r "from ['\"].*apps/web" \
  "$PROJECT_ROOT/infrastructure/lambda" \
  --include="*.ts" \
  2>/dev/null | grep -v node_modules || echo "")

if [ -n "$BACKEND_TO_FRONTEND" ]; then
  echo "❌ Rule 2 Violation: infrastructure importing from apps/web"
  echo ""
  echo "$BACKEND_TO_FRONTEND"
  echo ""
  echo "Fix: Move shared code to packages/shared"
  ERRORS=$((ERRORS + 1))
else
  echo "✅ No backend → frontend imports detected"
fi

# Rule 3: packages/shared cannot have runtime dependencies (except type-only)
echo "[3/6] Checking packages/shared runtime dependencies..."

if [ -f "$PROJECT_ROOT/packages/shared/package.json" ]; then
  SHARED_DEPS=$(jq -r '.dependencies // {} | keys | length' "$PROJECT_ROOT/packages/shared/package.json" 2>/dev/null || echo "0")

  if [ "$SHARED_DEPS" -gt 2 ]; then
    echo "❌ Rule 3 Violation: packages/shared has too many dependencies ($SHARED_DEPS)"
    echo ""
    echo "Shared package should only have type-related dependencies (e.g., zod)"
    echo "Current dependencies:"
    jq -r '.dependencies // {} | keys[]' "$PROJECT_ROOT/packages/shared/package.json" 2>/dev/null || echo "None"
    echo ""
    echo "Fix: Move runtime logic to apps/web or infrastructure"
    ERRORS=$((ERRORS + 1))
  else
    echo "✅ packages/shared has minimal dependencies ($SHARED_DEPS)"
  fi
else
  echo "⚠️  packages/shared/package.json not found"
fi

# Rule 4: packages/shared cannot import from apps or infrastructure
echo "[4/6] Checking packages/shared imports..."

SHARED_TO_APPS=$(grep -r "from ['\"].*\(apps/\|infrastructure/\)" \
  "$PROJECT_ROOT/packages/shared/src" \
  --include="*.ts" \
  2>/dev/null | grep -v node_modules || echo "")

if [ -n "$SHARED_TO_APPS" ]; then
  echo "❌ Rule 4 Violation: packages/shared importing from apps or infrastructure"
  echo ""
  echo "$SHARED_TO_APPS"
  echo ""
  echo "Fix: Remove imports, shared package should be dependency-free"
  ERRORS=$((ERRORS + 1))
else
  echo "✅ No packages/shared → apps/infrastructure imports detected"
fi

# Rule 5: Check for AWS SDK in frontend
echo "[5/6] Checking for AWS SDK in frontend..."

AWS_IN_FRONTEND=$(grep -r "from ['\"].*\(aws-sdk\|@aws-sdk\)" \
  "$PROJECT_ROOT/apps/web/app" \
  "$PROJECT_ROOT/apps/web/components" \
  --include="*.ts" --include="*.tsx" \
  2>/dev/null | grep -v node_modules | grep -v ".next" || echo "")

if [ -n "$AWS_IN_FRONTEND" ]; then
  echo "❌ Rule 5 Violation: AWS SDK imported in frontend code"
  echo ""
  echo "$AWS_IN_FRONTEND"
  echo ""
  echo "Fix: AWS SDK should only be in infrastructure (Lambda functions)"
  ERRORS=$((ERRORS + 1))
else
  echo "✅ No AWS SDK in frontend code"
fi

# Rule 6: Check for Prisma in frontend (except type imports)
echo "[6/6] Checking for Prisma Client in frontend..."

PRISMA_IN_FRONTEND=$(grep -r "from ['\"].*@prisma/client" \
  "$PROJECT_ROOT/apps/web/app" \
  "$PROJECT_ROOT/apps/web/components" \
  --include="*.ts" --include="*.tsx" \
  2>/dev/null | grep -v node_modules | grep -v ".next" | grep -v "import type" || echo "")

if [ -n "$PRISMA_IN_FRONTEND" ]; then
  echo "❌ Rule 6 Violation: Prisma Client imported in frontend code"
  echo ""
  echo "$PRISMA_IN_FRONTEND"
  echo ""
  echo "Fix: Prisma should only be in infrastructure (Lambda functions)"
  echo "Use 'import type' if you only need types"
  ERRORS=$((ERRORS + 1))
else
  echo "✅ No Prisma Client runtime imports in frontend"
fi

# Bonus Check: Verify correct usage of @prance/shared
echo ""
echo "Bonus: Checking @prance/shared usage..."
echo "────────────────────────────────────────"

SHARED_IMPORTS_FRONTEND=$(grep -r "from '@prance/shared'" \
  "$PROJECT_ROOT/apps/web" \
  --include="*.ts" --include="*.tsx" \
  2>/dev/null | grep -v node_modules | grep -v ".next" | wc -l || echo "0")

SHARED_IMPORTS_BACKEND=$(grep -r "from '@prance/shared'\|from '../../shared/types'" \
  "$PROJECT_ROOT/infrastructure/lambda" \
  --include="*.ts" \
  2>/dev/null | grep -v node_modules | wc -l || echo "0")

echo "✅ @prance/shared imports:"
echo "   Frontend: $SHARED_IMPORTS_FRONTEND files"
echo "   Backend: $SHARED_IMPORTS_BACKEND files"

if [ "$SHARED_IMPORTS_FRONTEND" -eq 0 ] && [ "$SHARED_IMPORTS_BACKEND" -eq 0 ]; then
  echo "⚠️  No @prance/shared imports detected - consider using shared types"
fi

# Summary
echo ""
echo "========================================"
echo "Validation Summary"
echo "========================================"

if [ $ERRORS -eq 0 ]; then
  echo "✅ All monorepo boundary validations passed"
  echo ""
  echo "Workspace dependencies:"
  echo "  apps/web → packages/shared ✅"
  echo "  infrastructure → packages/shared ✅"
  echo "  packages/shared → (none) ✅"
  exit 0
else
  echo "❌ $ERRORS boundary violation(s) detected"
  echo ""
  echo "Monorepo Rules:"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "apps/web          → CAN import → packages/shared (types only)"
  echo "                  → CANNOT import → infrastructure"
  echo ""
  echo "infrastructure    → CAN import → packages/shared (types only)"
  echo "                  → CANNOT import → apps/web"
  echo ""
  echo "packages/shared   → CANNOT import → apps/web OR infrastructure"
  echo "                  → Only type definitions, no runtime logic"
  echo ""
  echo "packages/database → CANNOT import → anything except Prisma"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "Fix guide:"
  echo "1. Move shared types to packages/shared"
  echo "2. Move runtime logic to appropriate workspace"
  echo "3. Never import cross-domain (frontend ↔ backend)"
  echo "4. Use @prance/shared for type definitions"
  echo ""
  echo "Detailed principles: memory/feedback_monorepo_rules.md"
  exit 1
fi
