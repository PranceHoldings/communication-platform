#!/bin/bash
#
# Lambda node_modules Repair Script
# Purpose: Fix broken/missing node_modules in Lambda functions
# Handles: Corrupted directories, missing dependencies, space-suffixed names
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

# Timestamp for backup
TIMESTAMP=$(date +%s)

# =============================================================================
# Robust node_modules removal function (same as clean-build.sh)
# =============================================================================

fix_space_in_directory_names() {
  local target="$1"

  if [ ! -d "$target" ]; then
    return 0
  fi

  cd "$target" 2>/dev/null || return 1

  for item in *" 2" *" 3" *" 4"; do
    if [ -e "$item" ]; then
      new_name=$(echo "$item" | sed 's/ [0-9]$//')
      if [ "$item" != "$new_name" ] && [ -n "$new_name" ]; then
        log_info "Fixing directory name: '$item' → '$new_name'"
        sudo mv "$item" "$new_name" 2>/dev/null || true
      fi
    fi
  done

  cd - > /dev/null
  return 0
}

remove_node_modules_robust() {
  local target="$1"
  local description="$2"

  if [ ! -e "$target" ]; then
    return 0
  fi

  log_info "Removing: $description ($target)"

  # Strategy 1: First fix any space-suffixed directory names
  fix_space_in_directory_names "$(dirname "$target")"

  # Strategy 2: Normal removal
  if rm -rf "$target" 2>/dev/null; then
    log_success "  ✓ Removed successfully"
    return 0
  fi

  # Strategy 3: sudo removal
  log_warning "  → Trying with sudo..."
  if sudo rm -rf "$target" 2>/dev/null; then
    log_success "  ✓ Removed with sudo"
    return 0
  fi

  # Strategy 4: Rename to .broken-*
  log_warning "  → Cannot remove, renaming to .broken-*..."
  broken_name="${target}.broken-${TIMESTAMP}"
  if sudo mv "$target" "$broken_name" 2>/dev/null; then
    log_warning "  ⚠ Renamed to: $broken_name"
    return 1
  fi

  # Strategy 5: chmod + remove
  log_warning "  → Trying chmod + rm..."
  if sudo chmod -R 777 "$target" 2>/dev/null && sudo rm -rf "$target" 2>/dev/null; then
    log_success "  ✓ Removed after chmod"
    return 0
  fi

  log_error "  ✗ Failed to remove: $target"
  return 1
}

# =============================================================================
# Main Script
# =============================================================================

log_section "Lambda node_modules Repair"

echo ""
log_warning "This script will remove and reinstall node_modules in Lambda functions"
echo ""

# Step 1: Scan for broken node_modules
log_section "Step 1: Scanning for issues"

LAMBDA_DIRS=()
BROKEN_DIRS=()

# Find all Lambda function directories (exclude shared/)
while IFS= read -r dir; do
  relative_path=${dir#infrastructure/lambda/}
  if [[ "$relative_path" != shared* ]]; then
    LAMBDA_DIRS+=("$dir")

    # Check for issues
    if [ -d "$dir/node_modules" ]; then
      # Check if node_modules is broken
      if [ ! -d "$dir/node_modules/@aws-sdk" ] || [ ! -d "$dir/node_modules/@prisma" ]; then
        BROKEN_DIRS+=("$dir")
        log_warning "  ⚠ Broken: $relative_path"
      fi
    else
      BROKEN_DIRS+=("$dir")
      log_warning "  ⚠ Missing: $relative_path"
    fi
  fi
done < <(find infrastructure/lambda -mindepth 1 -maxdepth 2 -type d | grep -E '(scenarios|avatars|sessions|users|auth|guest-sessions|organizations|websocket)/' | grep -v '/node_modules' | sort)

echo ""
log_info "Total Lambda functions: ${#LAMBDA_DIRS[@]}"
log_info "Functions with issues: ${#BROKEN_DIRS[@]}"
echo ""

if [ ${#BROKEN_DIRS[@]} -eq 0 ]; then
  log_success "No issues found!"
  exit 0
fi

# Step 2: Remove broken node_modules
log_section "Step 2: Removing broken node_modules"

for dir in "${BROKEN_DIRS[@]}"; do
  relative_path=${dir#infrastructure/lambda/}
  remove_node_modules_robust "$dir/node_modules" "$relative_path/node_modules"
done

# Step 3: Reinstall dependencies
log_section "Step 3: Reinstalling dependencies"

cd infrastructure
log_info "Running: pnpm install --frozen-lockfile"
pnpm install --frozen-lockfile

cd ..

# Step 4: Verification
log_section "Step 4: Verification"

FIXED_COUNT=0
STILL_BROKEN_COUNT=0

for dir in "${BROKEN_DIRS[@]}"; do
  relative_path=${dir#infrastructure/lambda/}

  if [ -d "$dir/node_modules/@aws-sdk" ] && [ -d "$dir/node_modules/@prisma" ]; then
    log_success "  ✓ Fixed: $relative_path"
    ((FIXED_COUNT++))
  else
    log_error "  ✗ Still broken: $relative_path"
    ((STILL_BROKEN_COUNT++))
  fi
done

# Summary
echo ""
log_section "Summary"
echo ""
log_info "Fixed: $FIXED_COUNT"
if [ $STILL_BROKEN_COUNT -gt 0 ]; then
  log_error "Still broken: $STILL_BROKEN_COUNT"
  echo ""
  log_warning "If issues persist, try:"
  echo "  1. bash scripts/clean-build.sh infrastructure"
  echo "  2. pnpm install --frozen-lockfile"
  echo ""
  exit 1
else
  log_success "All node_modules repaired successfully!"
  echo ""
  log_info "Next steps:"
  echo "  1. pnpm run build"
  echo "  2. pnpm run deploy:lambda"
  echo ""
  exit 0
fi
