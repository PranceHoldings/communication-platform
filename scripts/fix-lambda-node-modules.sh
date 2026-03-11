#!/bin/bash
#
# Lambda node_modules Repair Script
# Purpose: Fix broken/missing node_modules in Lambda functions
# Handles: Corrupted directories, missing dependencies, space-suffixed names
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m'

log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
  echo ""
  echo -e "${GREEN}============================================${NC}"
  echo -e "${GREEN}$1${NC}"
  echo -e "${GREEN}============================================${NC}"
}

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

  # Fix space-suffixed directory names
  fix_space_in_directory_names "$target"

  # Strategy 1: Normal removal
  if rm -rf "$target" 2>/dev/null; then
    log_success "  ✓ Normal removal succeeded"
    return 0
  fi

  log_warning "  Normal removal failed, trying sudo..."

  # Strategy 2: sudo removal
  if sudo rm -rf "$target" 2>/dev/null; then
    log_success "  ✓ Sudo removal succeeded"
    return 0
  fi

  log_warning "  Sudo removal failed, renaming to backup..."

  # Strategy 3: Rename to backup
  local backup_name="${target}.broken-${TIMESTAMP}"
  if sudo mv "$target" "$backup_name" 2>/dev/null; then
    log_success "  ✓ Renamed to backup: $backup_name"
    return 0
  fi

  # All strategies failed
  log_error "  ✗ All removal strategies failed: $target"
  return 1
}

# =============================================================================
# Fix Lambda function dependencies
# =============================================================================

fix_lambda_function() {
  local lambda_dir="$1"
  local lambda_name="$2"

  log_step "Fixing: $lambda_name"

  if [ ! -f "$lambda_dir/package.json" ]; then
    log_warning "package.json not found in $lambda_dir"
    return 0
  fi

  cd "$lambda_dir" || {
    log_error "Cannot cd to $lambda_dir"
    return 1
  }

  # Remove node_modules if exists
  if [ -d "node_modules" ]; then
    log_info "Removing node_modules..."
    remove_node_modules_robust "node_modules" "$lambda_name node_modules"
  fi

  # Remove package-lock.json
  if [ -f "package-lock.json" ]; then
    log_info "Removing package-lock.json..."
    rm -f package-lock.json
  fi

  # Install dependencies
  log_info "Installing dependencies..."
  npm install --omit=dev

  if [ $? -eq 0 ]; then
    log_success "$lambda_name dependencies installed"
  else
    log_error "$lambda_name dependency installation failed"
    cd - > /dev/null
    return 1
  fi

  cd - > /dev/null
  return 0
}

# =============================================================================
# Main execution
# =============================================================================

log_step "Lambda node_modules Repair"

echo ""
log_info "This script will:"
log_info "  1. Remove broken node_modules directories"
log_info "  2. Clean package-lock.json files"
log_info "  3. Reinstall all dependencies"
echo ""

# Array of Lambda functions to fix
declare -a LAMBDA_FUNCTIONS=(
  "infrastructure/lambda/websocket/default:WebSocket Default Handler"
  "infrastructure/lambda/websocket/connect:WebSocket Connect Handler"
  "infrastructure/lambda/websocket/disconnect:WebSocket Disconnect Handler"
)

# Optional: Add more Lambda functions
if [ -d "infrastructure/lambda/sessions/analysis" ]; then
  LAMBDA_FUNCTIONS+=("infrastructure/lambda/sessions/analysis:Sessions Analysis Handler")
fi

FIXED_COUNT=0
FAILED_COUNT=0

for entry in "${LAMBDA_FUNCTIONS[@]}"; do
  IFS=':' read -r lambda_dir lambda_name <<< "$entry"

  if fix_lambda_function "$lambda_dir" "$lambda_name"; then
    FIXED_COUNT=$((FIXED_COUNT + 1))
  else
    FAILED_COUNT=$((FAILED_COUNT + 1))
  fi
done

# =============================================================================
# Summary
# =============================================================================

log_step "Summary"

echo ""
echo -e "${GREEN}Fixed:  $FIXED_COUNT${NC}"
echo -e "${RED}Failed: $FAILED_COUNT${NC}"
echo ""

if [ "$FAILED_COUNT" -eq 0 ]; then
  log_success "All Lambda dependencies fixed"
  echo ""
  echo -e "${BLUE}Next steps:${NC}"
  echo -e "  1. Validate: ${GREEN}./scripts/validate-lambda-dependencies.sh${NC}"
  echo -e "  2. Deploy:   ${GREEN}cd infrastructure && ./deploy.sh dev${NC}"
  echo ""
  exit 0
else
  log_error "Some Lambda functions failed"
  echo ""
  echo -e "${YELLOW}Troubleshooting:${NC}"
  echo -e "  - Check npm registry connectivity"
  echo -e "  - Verify package.json is valid"
  echo -e "  - Try manual install: ${BLUE}cd <lambda-dir> && npm install${NC}"
  echo ""
  exit 1
fi
