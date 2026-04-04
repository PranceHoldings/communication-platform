#!/bin/bash
#
# Pre-Deploy Lambda Check Script
# Purpose: Comprehensive validation before Lambda deployment
# Prevents 500 errors in production
#

# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# Get project root
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [ -z "$PROJECT_ROOT" ]; then
  log_error "Not in a git repository"
  exit 1
fi

cd "$PROJECT_ROOT" || exit 1

log_section "Pre-Deploy Lambda Validation"

TOTAL_CHECKS=0
FAILED_CHECKS=0

# =============================================================================
# Check 0: Space-Containing Directories (CRITICAL)
# =============================================================================

log_info "[CHECK 0/7] 空白文字を含むディレクトリの検証"
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

if [ -f "scripts/clean-space-files-and-dirs.sh" ]; then
  if bash scripts/clean-space-files-and-dirs.sh > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} 空白文字チェック: OK"
  else
    echo -e "  ${RED}✗${NC} 空白文字チェック: FAILED"
    echo -e "  ${YELLOW}→ Run: bash scripts/clean-space-files-and-dirs.sh${NC}"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
  fi
else
  echo -e "  ${YELLOW}⚠${NC} 検証スクリプトなし（スキップ）"
fi

# =============================================================================
# Check 1: Environment Variables
# =============================================================================

log_info "[CHECK 1/7] 環境変数の検証"
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

if [ -f "scripts/validate-env.sh" ]; then
  if bash scripts/validate-env.sh > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} 環境変数: OK"
  else
    echo -e "  ${RED}✗${NC} 環境変数: FAILED"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
  fi
else
  echo -e "  ${YELLOW}⚠${NC} 検証スクリプトなし（スキップ）"
fi

# =============================================================================
# Check 2: Lambda Dependencies
# =============================================================================

log_info "[CHECK 2/7] Lambda依存関係の検証"
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

if [ -f "scripts/validate-lambda-dependencies.sh" ]; then
  if bash scripts/validate-lambda-dependencies.sh > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} Lambda依存関係: OK"
  else
    echo -e "  ${RED}✗${NC} Lambda依存関係: FAILED"
    echo -e "  ${YELLOW}→ Run: pnpm run lambda:fix${NC}"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
  fi
else
  echo -e "  ${RED}✗${NC} 検証スクリプトが見つかりません"
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# =============================================================================
# Check 3: i18n System
# =============================================================================

log_info "[CHECK 3/7] i18nシステムの検証"
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

if [ -f "scripts/validate-i18n-system.sh" ]; then
  if bash scripts/validate-i18n-system.sh > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} i18nシステム: OK"
  else
    echo -e "  ${RED}✗${NC} i18nシステム: FAILED"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
  fi
else
  echo -e "  ${YELLOW}⚠${NC} 検証スクリプトなし（スキップ）"
fi

# =============================================================================
# Check 4: TypeScript Build
# =============================================================================

log_info "[CHECK 4/7] TypeScriptビルドの検証"
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

if [ -d "infrastructure/lib" ]; then
  JS_COUNT=$(find infrastructure/lib -name "*.js" -type f | wc -l)
  if [ "$JS_COUNT" -gt 0 ]; then
    echo -e "  ${GREEN}✓${NC} TypeScriptビルド: OK ($JS_COUNT files)"
  else
    echo -e "  ${RED}✗${NC} TypeScriptビルド: NOT BUILT"
    echo -e "  ${YELLOW}→ Run: pnpm run build${NC}"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
  fi
else
  echo -e "  ${RED}✗${NC} infrastructure/lib not found"
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# =============================================================================
# Check 5: Prisma Client
# =============================================================================

log_info "[CHECK 5/7] Prisma Clientの検証"
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

if [ -d "packages/database/node_modules/.prisma/client" ]; then
  echo -e "  ${GREEN}✓${NC} Prisma Client: OK"
else
  echo -e "  ${RED}✗${NC} Prisma Client: NOT GENERATED"
  echo -e "  ${YELLOW}→ Run: pnpm run db:generate${NC}"
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# =============================================================================
# Check 6: CDK Synthesize
# =============================================================================

log_info "[CHECK 6/7] CDK Synthesizeの検証"
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

cd infrastructure
if pnpm run cdk -- synth --context environment=dev > /dev/null 2>&1; then
  echo -e "  ${GREEN}✓${NC} CDK Synth: OK"
else
  echo -e "  ${RED}✗${NC} CDK Synth: FAILED"
  echo -e "  ${YELLOW}→ Check CDK configuration and dependencies${NC}"
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi
cd ..

# =============================================================================
# Check 7: Manual Zip Files (CRITICAL)
# =============================================================================

log_info "[CHECK 7/7] 手動zipファイルの検証"
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

if [ -f "scripts/validate-deployment-method.sh" ]; then
  if bash scripts/validate-deployment-method.sh > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} デプロイ方法: OK"
  else
    echo -e "  ${RED}✗${NC} デプロイ方法: FAILED"
    echo -e "  ${YELLOW}→ Remove manual zip files before deploying${NC}"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
  fi
else
  echo -e "  ${YELLOW}⚠${NC} 検証スクリプトなし（スキップ）"
fi

# =============================================================================
# Summary
# =============================================================================

echo ""
log_section "Validation Summary"
echo ""
echo -e "Total checks: ${TOTAL_CHECKS}"
echo -e "Failed: ${FAILED_CHECKS}"
echo ""

if [ "$FAILED_CHECKS" -eq 0 ]; then
  log_success "All pre-deploy checks passed"
  echo ""
  log_info "Ready to deploy:"
  echo -e "  ${GREEN}cd infrastructure && pnpm run cdk -- deploy Prance-dev-ApiLambda --require-approval never${NC}"
  echo ""
  exit 0
else
  log_error "Pre-deploy checks FAILED"
  echo ""
  log_warning "Fix the issues above before deploying"
  echo ""
  exit 1
fi
