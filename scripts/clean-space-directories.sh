#!/bin/bash
#
# Clean Space-Containing Directories
# Purpose: Remove directories with spaces in their names before build/deploy
# MEMORY.md Rule 4: File/directory names with spaces are strictly prohibited
#
# This script prevents build failures caused by macOS Finder auto-generated
# directories like "dashboard 2", "chunks 2", etc.
#

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Get project root
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [ -z "$PROJECT_ROOT" ]; then
  echo -e "${RED}Error: Not in a git repository${NC}"
  exit 1
fi

cd "$PROJECT_ROOT" || exit 1

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Cleaning Space-Containing Directories${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

FOUND=0
CLEANED=0
FAILED=0

# Search for directories with spaces (excluding node_modules, .git, .next.broken-*)
echo -e "${YELLOW}[1/3]${NC} Scanning for directories with spaces..."

# Common problematic locations
SEARCH_PATHS=(
  "apps/web/.next"
  "infrastructure/cdk.out"
  "apps/web/.turbo"
  "node_modules/.cache"
)

for search_path in "${SEARCH_PATHS[@]}"; do
  if [ -d "$search_path" ]; then
    echo -e "  Checking: ${search_path}"

    # Find directories with spaces
    while IFS= read -r -d '' dir; do
      FOUND=$((FOUND + 1))
      echo -e "  ${RED}✗${NC} Found: ${dir}"

      # Try to remove with sudo if needed
      if rm -rf "$dir" 2>/dev/null; then
        CLEANED=$((CLEANED + 1))
        echo -e "  ${GREEN}✓${NC} Removed: ${dir}"
      elif sudo rm -rf "$dir" 2>/dev/null; then
        CLEANED=$((CLEANED + 1))
        echo -e "  ${GREEN}✓${NC} Removed (sudo): ${dir}"
      else
        FAILED=$((FAILED + 1))
        echo -e "  ${RED}✗${NC} Failed to remove: ${dir}"
      fi
    done < <(find "$search_path" -type d -name "* *" -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*.broken-*" -print0 2>/dev/null)
  fi
done

echo ""
echo -e "${YELLOW}[2/3]${NC} Checking build output directories..."

# Check if problematic directories exist
PROBLEM_DIRS=(
  "apps/web/.next"
  "infrastructure/cdk.out"
)

for dir in "${PROBLEM_DIRS[@]}"; do
  if [ -d "$dir" ]; then
    # Count space-containing directories in this path
    count=$(find "$dir" -type d -name "* *" -not -path "*/node_modules/*" 2>/dev/null | wc -l)
    if [ "$count" -gt 0 ]; then
      echo -e "  ${RED}✗${NC} ${dir}: ${count} directories with spaces remaining"
      FAILED=$((FAILED + count))
    else
      echo -e "  ${GREEN}✓${NC} ${dir}: Clean"
    fi
  fi
done

echo ""
echo -e "${YELLOW}[3/3]${NC} Cleaning up problematic build directories..."

# If .next has space-containing directories that couldn't be removed, move it
if [ -d "apps/web/.next" ]; then
  space_count=$(find apps/web/.next -type d -name "* *" 2>/dev/null | wc -l)
  if [ "$space_count" -gt 0 ]; then
    echo -e "  ${YELLOW}⚠${NC}  Moving problematic .next directory..."
    timestamp=$(date +%s)
    if sudo mv apps/web/.next "apps/web/.next.broken-$timestamp" 2>/dev/null; then
      mkdir -p apps/web/.next
      echo -e "  ${GREEN}✓${NC} Moved to .next.broken-$timestamp and created new .next"
      CLEANED=$((CLEANED + space_count))
      FAILED=$((FAILED - space_count))
    else
      echo -e "  ${RED}✗${NC} Failed to move .next directory"
    fi
  fi
fi

# If cdk.out has space-containing directories, move it
if [ -d "infrastructure/cdk.out" ]; then
  space_count=$(find infrastructure/cdk.out -type d -name "* *" 2>/dev/null | wc -l)
  if [ "$space_count" -gt 0 ]; then
    echo -e "  ${YELLOW}⚠${NC}  Moving problematic cdk.out directory..."
    timestamp=$(date +%s)
    if sudo mv infrastructure/cdk.out "infrastructure/cdk.out.broken-$timestamp" 2>/dev/null; then
      mkdir -p infrastructure/cdk.out
      echo -e "  ${GREEN}✓${NC} Moved to cdk.out.broken-$timestamp and created new cdk.out"
      CLEANED=$((CLEANED + space_count))
      FAILED=$((FAILED - space_count))
    else
      echo -e "  ${RED}✗${NC} Failed to move cdk.out directory"
    fi
  fi
fi

echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Summary${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo -e "Directories found:   ${FOUND}"
echo -e "Directories cleaned: ${GREEN}${CLEANED}${NC}"
echo -e "Directories failed:  ${RED}${FAILED}${NC}"
echo ""

if [ "$FAILED" -gt 0 ]; then
  echo -e "${RED}❌ Cleanup incomplete${NC}"
  echo -e "${YELLOW}Manual intervention required${NC}"
  echo ""
  echo -e "Remaining space-containing directories:"
  find apps/web/.next infrastructure/cdk.out -type d -name "* *" 2>/dev/null | head -10
  exit 1
elif [ "$FOUND" -eq 0 ]; then
  echo -e "${GREEN}✅ No space-containing directories found${NC}"
  exit 0
else
  echo -e "${GREEN}✅ All space-containing directories cleaned${NC}"
  exit 0
fi
