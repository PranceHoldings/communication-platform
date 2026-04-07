#!/bin/bash

# ==============================================================================
# Documentation Cleanup - Phase 1
# ==============================================================================
# Purpose: Remove duplicate and obsolete documentation files
# Created: 2026-03-30
# Reference: docs/09-progress/DOCUMENTATION_AUDIT_2026-03-30.md
# ==============================================================================

# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# Counters
FILES_REMOVED=0
DIRS_REMOVED=0

log_section "Documentation Cleanup - Phase 1"
echo ""

# ==============================================================================
# Issue #1: Remove duplicate files (" 2.md" suffix)
# ==============================================================================
log_info "Checking for duplicate files (* 2.md)..."

DUPLICATE_FILES=$(find /workspaces/prance-communication-platform -name "* 2.md" -type f | grep -v node_modules | grep -v ".next" | grep -v ".claude" | grep -v backups | wc -l)

if [ "$DUPLICATE_FILES" -gt 0 ]; then
  log_warning "Found $DUPLICATE_FILES duplicate files"
  echo ""
  echo "Files to be removed:"
  find /workspaces/prance-communication-platform -name "* 2.md" -type f | grep -v node_modules | grep -v ".next" | grep -v ".claude" | grep -v backups | head -10
  echo ""

  if confirm "Remove all $DUPLICATE_FILES files?" "n"; then
    find /workspaces/prance-communication-platform -name "* 2.md" -type f | grep -v node_modules | grep -v ".next" | grep -v ".claude" | grep -v backups | xargs rm -f
    FILES_REMOVED=$((FILES_REMOVED + DUPLICATE_FILES))
    log_success "Removed $DUPLICATE_FILES duplicate files"
  else
    log_warning "Skipped duplicate files removal"
  fi
else
  log_success "No duplicate files found"
fi

echo ""

# ==============================================================================
# Issue #2: Remove extension-less files
# ==============================================================================
log_info "Checking for extension-less markdown files..."

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
  if confirm "Remove $EXTENSIONLESS_FILES extension-less files?" "n"; then
    rm -f /workspaces/prance-communication-platform/CODING_RULES
    rm -f /workspaces/prance-communication-platform/DOCUMENTATION_INDEX
    rm -f /workspaces/prance-communication-platform/PENDING_PUSH
    FILES_REMOVED=$((FILES_REMOVED + EXTENSIONLESS_FILES))
    log_success "Removed $EXTENSIONLESS_FILES extension-less files"
  else
    log_warning "Skipped extension-less files removal"
  fi
else
  log_success "No extension-less files found"
fi

echo ""

# ==============================================================================
# Issue #3: Remove misplaced directory
# ==============================================================================
log_info "Checking for misplaced infrastructure/apps/ directory..."

if [ -d "/workspaces/prance-communication-platform/infrastructure/apps" ]; then
  log_warning "Found misplaced directory: infrastructure/apps/"
  echo "  - Contains: CLAUDE.md (with file system errors)"
  echo "  - Correct location: apps/CLAUDE.md (exists and functional)"
  echo ""

  if confirm "Remove infrastructure/apps/ directory?" "n"; then
    rm -rf /workspaces/prance-communication-platform/infrastructure/apps/
    DIRS_REMOVED=$((DIRS_REMOVED + 1))
    log_success "Removed misplaced infrastructure/apps/ directory"
  else
    log_warning "Skipped misplaced directory removal"
  fi
else
  log_success "No misplaced directory found"
fi

echo ""

# ==============================================================================
# Summary
# ==============================================================================
log_section "Summary"
echo -e "Files removed: ${GREEN}$FILES_REMOVED${NC}"
echo -e "Directories removed: ${GREEN}$DIRS_REMOVED${NC}"
echo ""

if [ "$FILES_REMOVED" -gt 0 ] || [ "$DIRS_REMOVED" -gt 0 ]; then
  log_success "Phase 1 cleanup complete"
  echo ""
  echo "Next steps:"
  echo "  1. Review changes: git status"
  echo "  2. Commit changes: git add . && git commit -m 'docs: remove duplicate and obsolete files'"
  echo "  3. Run Phase 2 (optional): bash scripts/cleanup-documentation-phase2.sh"
else
  log_warning "No files were removed"
fi

echo ""
