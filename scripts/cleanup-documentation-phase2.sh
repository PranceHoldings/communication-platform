#!/bin/bash

# ==============================================================================
# Documentation Cleanup - Phase 2
# ==============================================================================
# Purpose: Organize temporary reports and test documentation
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
FILES_MOVED=0
DIRS_CREATED=0

echo "=========================================="
echo "  Documentation Cleanup - Phase 2"
echo "=========================================="
echo ""

# ==============================================================================
# Create archive directories
# ==============================================================================
echo "📁 Creating archive directories..."

ARCHIVE_BASE="docs/09-progress/archives"

# Create directories
mkdir -p "$ARCHIVE_BASE/2026-03-12-reports"
mkdir -p "$ARCHIVE_BASE/2026-03-14-reports"
mkdir -p "$ARCHIVE_BASE/completed-tasks"
mkdir -p "$ARCHIVE_BASE/root-cause-analyses"
mkdir -p "$ARCHIVE_BASE/test-plans"
mkdir -p "$ARCHIVE_BASE/test-reports"

DIRS_CREATED=6

echo -e "${GREEN}✅ Created $DIRS_CREATED archive directories${NC}"
echo ""

# ==============================================================================
# Issue #4: Move date-specific reports
# ==============================================================================
echo "🔍 Moving date-specific reports..."

REPORT_COUNT=0

# 2026-03-12 reports
for file in docs/09-progress/*2026-03-12*.md; do
  if [ -f "$file" ]; then
    mv "$file" "$ARCHIVE_BASE/2026-03-12-reports/"
    REPORT_COUNT=$((REPORT_COUNT + 1))
    echo "  → $(basename "$file")"
  fi
done

# 2026-03-14 reports
for file in docs/09-progress/*2026-03-14*.md; do
  if [ -f "$file" ]; then
    mv "$file" "$ARCHIVE_BASE/2026-03-14-reports/"
    REPORT_COUNT=$((REPORT_COUNT + 1))
    echo "  → $(basename "$file")"
  fi
done

if [ "$REPORT_COUNT" -gt 0 ]; then
  FILES_MOVED=$((FILES_MOVED + REPORT_COUNT))
  echo -e "${GREEN}✅ Moved $REPORT_COUNT date-specific reports${NC}"
else
  echo -e "${YELLOW}No date-specific reports found${NC}"
fi

echo ""

# ==============================================================================
# Issue #4: Move completion reports
# ==============================================================================
echo "🔍 Moving completion reports..."

COMPLETE_COUNT=0

for file in docs/09-progress/*_COMPLETE*.md; do
  if [ -f "$file" ]; then
    mv "$file" "$ARCHIVE_BASE/completed-tasks/"
    COMPLETE_COUNT=$((COMPLETE_COUNT + 1))
    echo "  → $(basename "$file")"
  fi
done

# Also check for IMPLEMENTATION_COMPLETE pattern
for file in docs/09-progress/*IMPLEMENTATION_COMPLETE*.md; do
  if [ -f "$file" ]; then
    # Check if already moved
    if [ ! -f "$ARCHIVE_BASE/completed-tasks/$(basename "$file")" ]; then
      mv "$file" "$ARCHIVE_BASE/completed-tasks/" 2>/dev/null || true
      COMPLETE_COUNT=$((COMPLETE_COUNT + 1))
      echo "  → $(basename "$file")"
    fi
  fi
done

if [ "$COMPLETE_COUNT" -gt 0 ]; then
  FILES_MOVED=$((FILES_MOVED + COMPLETE_COUNT))
  echo -e "${GREEN}✅ Moved $COMPLETE_COUNT completion reports${NC}"
else
  echo -e "${YELLOW}No completion reports found${NC}"
fi

echo ""

# ==============================================================================
# Issue #4: Move ROOT_CAUSE_ANALYSIS files
# ==============================================================================
echo "🔍 Moving root cause analysis files..."

RCA_COUNT=0

for file in docs/09-progress/ROOT_CAUSE_ANALYSIS_*.md; do
  if [ -f "$file" ]; then
    mv "$file" "$ARCHIVE_BASE/root-cause-analyses/"
    RCA_COUNT=$((RCA_COUNT + 1))
    echo "  → $(basename "$file")"
  fi
done

if [ "$RCA_COUNT" -gt 0 ]; then
  FILES_MOVED=$((FILES_MOVED + RCA_COUNT))
  echo -e "${GREEN}✅ Moved $RCA_COUNT root cause analysis files${NC}"
else
  echo -e "${YELLOW}No root cause analysis files found${NC}"
fi

echo ""

# ==============================================================================
# Issue #5: Move test plans and reports
# ==============================================================================
echo "🔍 Moving test plans and reports..."

TEST_COUNT=0

# Test plans from docs/07-development
for file in docs/07-development/*_TEST_PLAN*.md; do
  if [ -f "$file" ]; then
    mv "$file" "$ARCHIVE_BASE/test-plans/"
    TEST_COUNT=$((TEST_COUNT + 1))
    echo "  → $(basename "$file")"
  fi
done

# Test reports from docs/07-development
for file in docs/07-development/*_TEST_REPORT*.md; do
  if [ -f "$file" ]; then
    mv "$file" "$ARCHIVE_BASE/test-reports/"
    TEST_COUNT=$((TEST_COUNT + 1))
    echo "  → $(basename "$file")"
  fi
done

# Test completion files
if [ -f "docs/07-development/TEST_IDS_IMPLEMENTATION_COMPLETE.md" ]; then
  mv "docs/07-development/TEST_IDS_IMPLEMENTATION_COMPLETE.md" "$ARCHIVE_BASE/completed-tasks/"
  TEST_COUNT=$((TEST_COUNT + 1))
  echo "  → TEST_IDS_IMPLEMENTATION_COMPLETE.md"
fi

if [ "$TEST_COUNT" -gt 0 ]; then
  FILES_MOVED=$((FILES_MOVED + TEST_COUNT))
  echo -e "${GREEN}✅ Moved $TEST_COUNT test-related files${NC}"
else
  echo -e "${YELLOW}No test-related files found${NC}"
fi

echo ""

# ==============================================================================
# Summary
# ==============================================================================
echo "=========================================="
echo "  Summary"
echo "=========================================="
echo -e "Archive directories created: ${GREEN}$DIRS_CREATED${NC}"
echo -e "Files moved: ${GREEN}$FILES_MOVED${NC}"
echo ""

if [ "$FILES_MOVED" -gt 0 ]; then
  echo -e "${GREEN}✅ Phase 2 cleanup complete${NC}"
  echo ""
  echo "Archive structure:"
  echo "  $ARCHIVE_BASE/"
  echo "    ├── 2026-03-12-reports/ ($REPORT_COUNT files)"
  echo "    ├── completed-tasks/ ($COMPLETE_COUNT files)"
  echo "    ├── root-cause-analyses/ ($RCA_COUNT files)"
  echo "    ├── test-plans/"
  echo "    └── test-reports/"
  echo ""
  echo "Next steps:"
  echo "  1. Review changes: git status"
  echo "  2. Commit changes: git add . && git commit -m 'docs: organize temporary reports (Phase 2)'"
else
  echo -e "${YELLOW}No files were moved${NC}"
  echo "All reports may have been already organized."
fi

echo ""
