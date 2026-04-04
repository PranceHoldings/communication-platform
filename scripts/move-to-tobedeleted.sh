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

# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# Project root
PROJECT_ROOT="/workspaces/prance-communication-platform"
TOBEDELETED_DIR="${PROJECT_ROOT}/tobedeleted"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create tobedeleted directory if it doesn't exist
if [ ! -d "$TOBEDELETED_DIR" ]; then
    log_info "Creating tobedeleted directory..."
    mkdir -p "$TOBEDELETED_DIR"
    log_success "Created: $TOBEDELETED_DIR"
fi

# Check if arguments provided
if [ $# -eq 0 ]; then
    log_error "No paths provided"
    log_warning "Usage: $0 <path1> [path2] [path3] ..."
    log_warning "Example: $0 apps/web/.next infrastructure/cdk.out"
    exit 1
fi

# Success counter
SUCCESS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

log_section "Moving items to tobedeleted"

# Process each argument
for target in "$@"; do
    # Convert to absolute path if relative
    if [[ "$target" != /* ]]; then
        target="${PROJECT_ROOT}/${target}"
    fi

    # Check if target exists
    if [ ! -e "$target" ]; then
        log_warning "Skip: $target (does not exist)"
        ((SKIP_COUNT++))
        continue
    fi

    # Get basename and create unique name
    basename=$(basename "$target")
    unique_name="${basename}_${TIMESTAMP}"
    destination="${TOBEDELETED_DIR}/${unique_name}"

    log_info "Processing: $target"

    # Ensure tobedeleted directory exists (safety check)
    if [ ! -d "$TOBEDELETED_DIR" ]; then
        log_warning "tobedeleted directory not found, creating..."
        mkdir -p "$TOBEDELETED_DIR"
    fi

    # Try to move
    if mv "$target" "$destination" 2>/dev/null; then
        log_success "Moved to: ${unique_name}"
        ((SUCCESS_COUNT++))
    elif sudo mv "$target" "$destination" 2>/dev/null; then
        log_success "Moved to: ${unique_name} (with sudo)"
        ((SUCCESS_COUNT++))
    else
        log_error "Failed to move: $target"
        ((FAIL_COUNT++))
    fi

    echo ""
done

# Summary
log_section "Summary"
echo -e "Successfully moved: ${GREEN}${SUCCESS_COUNT}${NC}"
echo -e "Failed:            ${RED}${FAIL_COUNT}${NC}"
echo -e "Skipped:           ${YELLOW}${SKIP_COUNT}${NC}"
echo ""

# List tobedeleted contents
if [ -d "$TOBEDELETED_DIR" ] && [ "$(ls -A $TOBEDELETED_DIR 2>/dev/null)" ]; then
    log_warning "Items in tobedeleted ($(du -sh $TOBEDELETED_DIR | cut -f1)):"
    ls -lh "$TOBEDELETED_DIR" | tail -n +2 | awk '{printf "  - %s (%s)\n", $9, $5}'
    echo ""
    log_warning "To permanently delete tobedeleted:"
    echo -e "  ${BLUE}sudo rm -rf $TOBEDELETED_DIR${NC}"
fi

# Exit with appropriate code
if [ $FAIL_COUNT -gt 0 ]; then
    exit 1
else
    exit 0
fi
