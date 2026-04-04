#!/bin/bash

###############################################################################
# Move to Tobedeleted - Safe Deletion Alternative
#
# Purpose: Move files/directories that cannot be deleted to a tobedeleted folder
#
# Usage:
#   bash scripts/move-to-tobedeleted.sh <path1> [path2] [path3] ...
#   bash scripts/move-to-tobedeleted.sh apps/web/.next infrastructure/cdk.out
#   bash scripts/move-to-tobedeleted.sh "apps/web/.next 2"
#
# Features:
#   - Creates tobedeleted folder if it doesn't exist
#   - Moves files/directories instead of deleting
#   - Handles paths with spaces correctly
#   - Timestamps moved items to avoid conflicts
#   - Returns success even if original deletion would fail
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Project root
PROJECT_ROOT="/workspaces/prance-communication-platform"
TOBEDELETED_DIR="${PROJECT_ROOT}/tobedeleted"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create tobedeleted directory if it doesn't exist
if [ ! -d "$TOBEDELETED_DIR" ]; then
    echo -e "${BLUE}Creating tobedeleted directory...${NC}"
    mkdir -p "$TOBEDELETED_DIR"
    echo -e "${GREEN}✓ Created: $TOBEDELETED_DIR${NC}"
fi

# Check if arguments provided
if [ $# -eq 0 ]; then
    echo -e "${RED}Error: No paths provided${NC}"
    echo -e "${YELLOW}Usage: $0 <path1> [path2] [path3] ...${NC}"
    echo -e "${YELLOW}Example: $0 apps/web/.next infrastructure/cdk.out${NC}"
    exit 1
fi

# Success counter
SUCCESS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Moving items to tobedeleted${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Process each argument
for target in "$@"; do
    # Convert to absolute path if relative
    if [[ "$target" != /* ]]; then
        target="${PROJECT_ROOT}/${target}"
    fi

    # Check if target exists
    if [ ! -e "$target" ]; then
        echo -e "${YELLOW}⚠ Skip: $target (does not exist)${NC}"
        ((SKIP_COUNT++))
        continue
    fi

    # Get basename and create unique name
    basename=$(basename "$target")
    unique_name="${basename}_${TIMESTAMP}"
    destination="${TOBEDELETED_DIR}/${unique_name}"

    echo -e "${BLUE}Processing: $target${NC}"

    # Ensure tobedeleted directory exists (safety check)
    if [ ! -d "$TOBEDELETED_DIR" ]; then
        echo -e "${YELLOW}⚠ tobedeleted directory not found, creating...${NC}"
        mkdir -p "$TOBEDELETED_DIR"
    fi

    # Try to move
    if mv "$target" "$destination" 2>/dev/null; then
        echo -e "${GREEN}✓ Moved to: ${unique_name}${NC}"
        ((SUCCESS_COUNT++))
    elif sudo mv "$target" "$destination" 2>/dev/null; then
        echo -e "${GREEN}✓ Moved to: ${unique_name} (with sudo)${NC}"
        ((SUCCESS_COUNT++))
    else
        echo -e "${RED}✗ Failed to move: $target${NC}"
        ((FAIL_COUNT++))
    fi

    echo ""
done

# Summary
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Summary${NC}"
echo -e "${BLUE}============================================${NC}"
echo -e "Successfully moved: ${GREEN}${SUCCESS_COUNT}${NC}"
echo -e "Failed:            ${RED}${FAIL_COUNT}${NC}"
echo -e "Skipped:           ${YELLOW}${SKIP_COUNT}${NC}"
echo ""

# List tobedeleted contents
if [ -d "$TOBEDELETED_DIR" ] && [ "$(ls -A $TOBEDELETED_DIR 2>/dev/null)" ]; then
    echo -e "${YELLOW}Items in tobedeleted ($(du -sh $TOBEDELETED_DIR | cut -f1)):${NC}"
    ls -lh "$TOBEDELETED_DIR" | tail -n +2 | awk '{printf "  - %s (%s)\n", $9, $5}'
    echo ""
    echo -e "${YELLOW}To permanently delete tobedeleted:${NC}"
    echo -e "  ${BLUE}sudo rm -rf $TOBEDELETED_DIR${NC}"
fi

# Exit with appropriate code
if [ $FAIL_COUNT -gt 0 ]; then
    exit 1
else
    exit 0
fi
