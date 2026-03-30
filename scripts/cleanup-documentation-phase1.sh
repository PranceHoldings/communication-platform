#!/bin/bash

# ==============================================================================
# Documentation Cleanup - Phase 1
# ==============================================================================
# Purpose: Remove duplicate and obsolete documentation files
# Created: 2026-03-30
# Reference: docs/09-progress/DOCUMENTATION_AUDIT_2026-03-30.md
# ==============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
FILES_REMOVED=0
DIRS_REMOVED=0

echo "=========================================="
echo "  Documentation Cleanup - Phase 1"
echo "=========================================="
echo ""

# ==============================================================================
# Issue #1: Remove duplicate files (" 2.md" suffix)
# ==============================================================================
echo "🔍 Checking for duplicate files (* 2.md)..."

DUPLICATE_FILES=$(find /workspaces/prance-communication-platform -name "* 2.md" -type f | grep -v node_modules | grep -v ".next" | grep -v ".claude" | grep -v backups | wc -l)

if [ "$DUPLICATE_FILES" -gt 0 ]; then
  echo -e "${YELLOW}Found $DUPLICATE_FILES duplicate files${NC}"
  echo ""
  echo "Files to be removed:"
  find /workspaces/prance-communication-platform -name "* 2.md" -type f | grep -v node_modules | grep -v ".next" | grep -v ".claude" | grep -v backups | head -10
  echo ""

  read -p "Remove all $DUPLICATE_FILES files? (y/N) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    find /workspaces/prance-communication-platform -name "* 2.md" -type f | grep -v node_modules | grep -v ".next" | grep -v ".claude" | grep -v backups | xargs rm -f
    FILES_REMOVED=$((FILES_REMOVED + DUPLICATE_FILES))
    echo -e "${GREEN}✅ Removed $DUPLICATE_FILES duplicate files${NC}"
  else
    echo -e "${YELLOW}⏭️  Skipped duplicate files removal${NC}"
  fi
else
  echo -e "${GREEN}✅ No duplicate files found${NC}"
fi

echo ""

# ==============================================================================
# Issue #2: Remove extension-less files
# ==============================================================================
echo "🔍 Checking for extension-less markdown files..."

EXTENSIONLESS_FILES=0

if [ -f "/workspaces/prance-communication-platform/CODING_RULES" ]; then
  echo "  - CODING_RULES (2026-03-22, obsolete)"
  EXTENSIONLESS_FILES=$((EXTENSIONLESS_FILES + 1))
fi

if [ -f "/workspaces/prance-communication-platform/DOCUMENTATION_INDEX" ]; then
  echo "  - DOCUMENTATION_INDEX (2026-03-22, obsolete)"
  EXTENSIONLESS_FILES=$((EXTENSIONLESS_FILES + 1))
fi

if [ -f "/workspaces/prance-communication-platform/PENDING_PUSH" ]; then
  echo "  - PENDING_PUSH (2026-03-22, obsolete)"
  EXTENSIONLESS_FILES=$((EXTENSIONLESS_FILES + 1))
fi

if [ "$EXTENSIONLESS_FILES" -gt 0 ]; then
  echo ""
  read -p "Remove $EXTENSIONLESS_FILES extension-less files? (y/N) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -f /workspaces/prance-communication-platform/CODING_RULES
    rm -f /workspaces/prance-communication-platform/DOCUMENTATION_INDEX
    rm -f /workspaces/prance-communication-platform/PENDING_PUSH
    FILES_REMOVED=$((FILES_REMOVED + EXTENSIONLESS_FILES))
    echo -e "${GREEN}✅ Removed $EXTENSIONLESS_FILES extension-less files${NC}"
  else
    echo -e "${YELLOW}⏭️  Skipped extension-less files removal${NC}"
  fi
else
  echo -e "${GREEN}✅ No extension-less files found${NC}"
fi

echo ""

# ==============================================================================
# Issue #3: Remove misplaced directory
# ==============================================================================
echo "🔍 Checking for misplaced infrastructure/apps/ directory..."

if [ -d "/workspaces/prance-communication-platform/infrastructure/apps" ]; then
  echo -e "${YELLOW}Found misplaced directory: infrastructure/apps/${NC}"
  echo "  - Contains: CLAUDE.md (with file system errors)"
  echo "  - Correct location: apps/CLAUDE.md (exists and functional)"
  echo ""

  read -p "Remove infrastructure/apps/ directory? (y/N) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -rf /workspaces/prance-communication-platform/infrastructure/apps/
    DIRS_REMOVED=$((DIRS_REMOVED + 1))
    echo -e "${GREEN}✅ Removed misplaced infrastructure/apps/ directory${NC}"
  else
    echo -e "${YELLOW}⏭️  Skipped misplaced directory removal${NC}"
  fi
else
  echo -e "${GREEN}✅ No misplaced directory found${NC}"
fi

echo ""

# ==============================================================================
# Summary
# ==============================================================================
echo "=========================================="
echo "  Summary"
echo "=========================================="
echo -e "Files removed: ${GREEN}$FILES_REMOVED${NC}"
echo -e "Directories removed: ${GREEN}$DIRS_REMOVED${NC}"
echo ""

if [ "$FILES_REMOVED" -gt 0 ] || [ "$DIRS_REMOVED" -gt 0 ]; then
  echo -e "${GREEN}✅ Phase 1 cleanup complete${NC}"
  echo ""
  echo "Next steps:"
  echo "  1. Review changes: git status"
  echo "  2. Commit changes: git add . && git commit -m 'docs: remove duplicate and obsolete files'"
  echo "  3. Run Phase 2 (optional): bash scripts/cleanup-documentation-phase2.sh"
else
  echo -e "${YELLOW}No files were removed${NC}"
fi

echo ""
