#!/bin/bash
#
# validate-dependency-size.sh (v2 - Shared Library版)
#
# Purpose: Validate that new dependencies are lightweight and justified
# When to run: Before adding dependencies, pre-commit hook, PR checks
# How to run: pnpm run validate:deps-size
#

# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

PROJECT_ROOT="$SCRIPT_DIR/.."

log_section "Validating dependency sizes"

# Thresholds
MAX_DIRECT_DEPS=10
WARNING_DIRECT_DEPS=5
MAX_TRANSITIVE_DEPS=50
WARNING_TRANSITIVE_DEPS=20

# Check if git is available (for detecting new dependencies)
if command -v git &> /dev/null; then
  # Get list of package.json files that changed
  CHANGED_PACKAGE_FILES=$(git diff --name-only HEAD 2>/dev/null | grep "package.json" || echo "")

  if [ -z "$CHANGED_PACKAGE_FILES" ]; then
    log_info "No package.json changes detected (checking all workspaces)"
    CHECK_ALL=true
  else
    echo "📦 Changed package.json files:"
    echo "$CHANGED_PACKAGE_FILES"
    echo ""
    CHECK_ALL=false
  fi
else
  log_info "Git not available, checking all workspaces"
  CHECK_ALL=true
fi

# Function to count dependencies
count_dependencies() {
  local PACKAGE_NAME=$1
  local PACKAGE_JSON=$2

  echo ""
  echo "Checking: $PACKAGE_NAME"
  print_separator

  # Check if package.json has dependencies
  if [ ! -f "$PACKAGE_JSON" ]; then
    log_warning "Package.json not found: $PACKAGE_JSON"
    return
  fi

  # Count direct dependencies (excluding dev dependencies)
  DIRECT_COUNT=$(jq -r '.dependencies // {} | keys | length' "$PACKAGE_JSON" 2>/dev/null || echo "0")
  DEV_COUNT=$(jq -r '.devDependencies // {} | keys | length' "$PACKAGE_JSON" 2>/dev/null || echo "0")

  echo "Direct dependencies: $DIRECT_COUNT"
  echo "Dev dependencies: $DEV_COUNT"

  # Check direct dependencies threshold
  if [ "$DIRECT_COUNT" -gt "$MAX_DIRECT_DEPS" ]; then
    log_error "Direct dependencies ($DIRECT_COUNT) exceed limit ($MAX_DIRECT_DEPS)"
    echo "   Consider:"
    echo "   - Removing unused dependencies: pnpm exec depcheck"
    echo "   - Using lighter alternatives"
    echo "   - Self-implementing small utilities"
    increment_counter ERRORS
  elif [ "$DIRECT_COUNT" -gt "$WARNING_DIRECT_DEPS" ]; then
    log_warning "Direct dependencies ($DIRECT_COUNT) approaching limit ($MAX_DIRECT_DEPS)"
    increment_counter WARNINGS
  else
    log_success "Direct dependencies within acceptable range"
  fi

  # Check individual dependencies
  if [ "$DIRECT_COUNT" -gt 0 ]; then
    echo ""
    echo "Analyzing individual dependencies..."

    DEPS=$(jq -r '.dependencies // {} | keys[]' "$PACKAGE_JSON" 2>/dev/null)

    for DEP in $DEPS; do
      # Skip workspace packages
      if [[ "$DEP" == @prance/* ]]; then
        continue
      fi

      # Get dependency info
      DEP_INFO=$(pnpm info "$DEP" --json 2>/dev/null || echo "{}")

      # Count transitive dependencies (this is approximate)
      # We use pnpm list which shows the full tree
      TRANSITIVE_COUNT=$(pnpm list "$DEP" --depth=5 2>/dev/null | grep -c "─" | tr -d '\n' || echo "0")

      # Get package size
      UNPACKED_SIZE=$(echo "$DEP_INFO" | jq -r '.dist.unpackedSize // 0' 2>/dev/null)
      SIZE_MB=$(echo "scale=2; $UNPACKED_SIZE / 1024 / 1024" | bc 2>/dev/null || echo "0")

      # Check if it's a known heavy package
      if [[ "$DEP" == "moment" ]]; then
        echo -e "  ${RED}❌ $DEP - Deprecated, use date-fns or native Intl${NC}"
        increment_counter ERRORS
      elif [[ "$DEP" == "lodash" ]]; then
        echo -e "  ${YELLOW}⚠️  $DEP - Consider lodash-es (tree-shakeable) or self-implement${NC}"
        increment_counter WARNINGS
      elif [[ "$DEP" == "axios" ]]; then
        echo -e "  ${YELLOW}⚠️  $DEP - Consider native fetch (0 dependencies)${NC}"
        increment_counter WARNINGS
      elif [ "$TRANSITIVE_COUNT" -gt "$MAX_TRANSITIVE_DEPS" ]; then
        echo -e "  ${RED}❌ $DEP - Too many transitive dependencies ($TRANSITIVE_COUNT)${NC}"
        echo "     Consider lighter alternative"
        increment_counter ERRORS
      elif [ "$TRANSITIVE_COUNT" -gt "$WARNING_TRANSITIVE_DEPS" ]; then
        echo -e "  ${YELLOW}⚠️  $DEP - Many transitive dependencies ($TRANSITIVE_COUNT)${NC}"
        increment_counter WARNINGS
      else
        echo -e "  ${GREEN}✅ $DEP - OK (transitive: $TRANSITIVE_COUNT, size: ${SIZE_MB}MB)${NC}"
      fi
    done
  fi
}

# Check workspace packages
echo ""
echo "Checking workspace packages..."
print_separator

# Check apps/web
if [ "$CHECK_ALL" = true ] || echo "$CHANGED_PACKAGE_FILES" | grep -q "apps/web/package.json"; then
  count_dependencies "apps/web" "$PROJECT_ROOT/apps/web/package.json"
fi

# Check infrastructure
if [ "$CHECK_ALL" = true ] || echo "$CHANGED_PACKAGE_FILES" | grep -q "infrastructure/package.json"; then
  count_dependencies "infrastructure" "$PROJECT_ROOT/infrastructure/package.json"
fi

# Check packages/shared
if [ "$CHECK_ALL" = true ] || echo "$CHANGED_PACKAGE_FILES" | grep -q "packages/shared/package.json"; then
  count_dependencies "packages/shared" "$PROJECT_ROOT/packages/shared/package.json"

  # Special check: packages/shared should have minimal runtime dependencies
  SHARED_DEPS=$(jq -r '.dependencies // {} | keys | length' "$PROJECT_ROOT/packages/shared/package.json" 2>/dev/null || echo "0")
  if [ "$SHARED_DEPS" -gt 2 ]; then
    echo ""
    log_error "packages/shared has too many runtime dependencies ($SHARED_DEPS)"
    echo "   Shared package should only have type-related dependencies (e.g., zod)"
    increment_counter ERRORS
  fi
fi

# Check packages/database
if [ "$CHECK_ALL" = true ] || echo "$CHANGED_PACKAGE_FILES" | grep -q "packages/database/package.json"; then
  count_dependencies "packages/database" "$PROJECT_ROOT/packages/database/package.json"
fi

# Summary
log_section "Validation Summary"
print_counter_summary

if [ "$ERRORS" -eq 0 ] && [ "$WARNINGS" -eq 0 ]; then
  echo -e "${GREEN}✅ All dependencies are within acceptable limits${NC}"
  exit 0
elif [ "$ERRORS" -eq 0 ]; then
  echo -e "${YELLOW}⚠️  $WARNINGS warning(s) detected (non-blocking)${NC}"
  echo ""
  echo "Consider:"
  echo "1. Review flagged dependencies"
  echo "2. Check for lighter alternatives"
  echo "3. Self-implement if possible (<100 lines)"
  exit 0
else
  echo -e "${RED}❌ $ERRORS validation error(s) detected${NC}"
  echo ""
  echo "Fix guide:"
  echo "1. Remove heavy dependencies: pnpm remove <package>"
  echo "2. Find lighter alternatives: https://npmtrends.com"
  echo "3. Self-implement small utilities"
  echo "4. Use tree-shakeable versions (e.g., lodash-es)"
  echo ""
  echo "Detailed principles: memory/feedback_dependency_management.md"
  exit 1
fi
