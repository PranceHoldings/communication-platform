#!/bin/bash
#
# i18n System Validation Script (v2 - Shared Library版)
# Purpose: Prevent next-intl remnants from re-appearing
# MEMORY.md Rule 1: Only use custom i18n system, never next-intl
#

# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# Get project root (where .git directory is)
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [ -z "$PROJECT_ROOT" ]; then
  die "Not in a git repository"
fi

cd "$PROJECT_ROOT" || die "Failed to cd to project root"

echo "🔍 Validating i18n system (MEMORY.md Rule 1)..."

# Check 1: next-intl imports (ensure NOT used)
echo -n "  Verifying next-intl is NOT used... "
NEXT_INTL_IMPORTS=$(grep -r "from 'next-intl" apps/web --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v node_modules | wc -l)
if [ "$NEXT_INTL_IMPORTS" -gt 0 ]; then
  echo -e "${RED}FAILED${NC}"
  echo -e "${RED}    Found $NEXT_INTL_IMPORTS next-intl imports (forbidden):${NC}"
  grep -rn "from 'next-intl" apps/web --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v node_modules | head -5
  increment_counter FAILED
else
  echo -e "${GREEN}OK (none found)${NC}"
fi

# Check 2: apps/web/i18n/ directory (ensure NOT exists)
echo -n "  Verifying apps/web/i18n/ does NOT exist... "
if [ -d "apps/web/i18n" ]; then
  echo -e "${RED}FAILED${NC}"
  echo -e "${RED}    apps/web/i18n/ directory exists (should be deleted)${NC}"
  increment_counter FAILED
else
  echo -e "${GREEN}OK (deleted)${NC}"
fi

# Check 3: useI18n usage (ensure IS used)
echo -n "  Verifying useI18n hook IS used... "
USE_I18N_COUNT=$(grep -r "from '@/lib/i18n/provider'" apps/web --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v node_modules | wc -l)
if [ "$USE_I18N_COUNT" -gt 0 ]; then
  echo -e "${GREEN}OK ($USE_I18N_COUNT files)${NC}"
else
  echo -e "${YELLOW}WARNING (No files using custom i18n)${NC}"
fi

# Check 4: messages files (ensure exist)
echo -n "  Verifying translation message files exist... "
if [ -d "apps/web/messages" ]; then
  # Check if at least one language has translation files
  LANG_DIRS=$(find apps/web/messages -mindepth 1 -maxdepth 1 -type d | wc -l)
  if [ "$LANG_DIRS" -gt 0 ]; then
    echo -e "${GREEN}OK${NC} ($LANG_DIRS languages)"
  else
    echo -e "${YELLOW}WARNING${NC} (No language directories found)"
  fi
else
  echo -e "${YELLOW}WARNING${NC} (messages/ directory missing)"
fi

# Check 5: Validate all translation keys (CRITICAL - prevents runtime errors)
echo ""
echo "🔍 Validating translation keys (all used keys must exist in files)..."
if [ -f "$SCRIPT_DIR/validate-i18n-keys.js" ]; then
  # Skip unused key check in pre-commit (it can be slow with many keys)
  if SKIP_UNUSED_CHECK=1 node "$SCRIPT_DIR/validate-i18n-keys.js"; then
    echo ""  # Key validation prints its own success message
  else
    increment_counter FAILED
  fi
else
  log_warning "validate-i18n-keys.js not found (skipping key validation)"
fi

# Summary
echo ""
if [ "$FAILED" -eq 0 ]; then
  echo -e "${GREEN}✅ i18n system validation passed (system + keys)${NC}"
  exit 0
else
  echo -e "${RED}❌ i18n system validation FAILED${NC}"
  echo ""
  echo "Fix steps:"
  echo "  1. Remove next-intl imports: Replace with useI18n from '@/lib/i18n/provider'"
  echo "  2. Delete apps/web/i18n/ directory: rm -rf apps/web/i18n"
  echo "  3. Add missing translation keys to apps/web/messages/<lang>/<category>.json"
  echo "  4. See docs/07-development/I18N_SYSTEM_GUIDELINES.md"
  exit 1
fi
