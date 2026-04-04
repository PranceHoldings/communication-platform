#!/bin/bash
# ==============================================================================
# Shared Library Usage Validation Script
# ==============================================================================
# Purpose: Verify all scripts use the shared library system (scripts/lib/common.sh)
# Usage: bash scripts/validate-shared-lib-usage.sh
# ==============================================================================

# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# ==============================================================================
# Configuration
# ==============================================================================

# Patterns to detect old-style implementations
OLD_COLOR_PATTERN='(RED|GREEN|YELLOW|BLUE|MAGENTA|CYAN|WHITE|BOLD|NC)='"'"'\\033\['
OLD_COUNTER_PATTERN='\(\((PASSED|FAILED|ERRORS|WARNINGS|SKIPPED)\+\+\)\)'
OLD_DIE_PATTERN='function die\(\)|^die\(\) \{'

# Note: echo -e with ${COLOR} variables is OK when using shared library
# Only flag if color variables are DEFINED (not just used)

# Patterns to detect shared library usage
SHARED_LIB_SOURCE_PATTERN='source.*lib/common\.sh'

# Exclusion patterns
EXCLUDE_PATTERNS=(
  "archive/"
  "lib/"
  ".broken-"
  "node_modules/"
  ".git/"
)

# ==============================================================================
# Helper Functions
# ==============================================================================

should_exclude() {
  local file=$1
  for pattern in "${EXCLUDE_PATTERNS[@]}"; do
    if [[ "$file" == *"$pattern"* ]]; then
      return 0
    fi
  done
  return 1
}

check_shared_lib_usage() {
  local file=$1

  if grep -qE "$SHARED_LIB_SOURCE_PATTERN" "$file"; then
    return 0
  else
    return 1
  fi
}

check_old_patterns() {
  local file=$1
  local has_issues=0
  local issues=()

  # Check for old color definitions (hard-coded ANSI codes)
  if grep -qE "$OLD_COLOR_PATTERN" "$file"; then
    issues+=("Old color definitions")
    has_issues=1
  fi

  # Check for old counter patterns (manual increment)
  if grep -qE "$OLD_COUNTER_PATTERN" "$file"; then
    issues+=("Old manual counter increment")
    has_issues=1
  fi

  # Check for old die function (custom definition instead of shared lib)
  if grep -qE "$OLD_DIE_PATTERN" "$file"; then
    issues+=("Old die() function definition")
    has_issues=1
  fi

  if [ $has_issues -eq 1 ]; then
    echo "${issues[*]}"
    return 1
  fi
  return 0
}

# ==============================================================================
# Main Validation
# ==============================================================================

log_section "Shared Library Usage Validation"

log_info "Scanning scripts/ directory (excluding archive/)"
echo ""

# Arrays to track results
declare -a scripts_using_lib=()
declare -a scripts_not_using_lib=()
declare -a scripts_with_old_patterns=()
declare -a special_scripts=()

# Find all shell scripts (excluding archive)
while IFS= read -r script; do
  # Skip excluded patterns
  if should_exclude "$script"; then
    continue
  fi

  # Get relative path for display
  rel_path="${script#$SCRIPT_DIR/}"

  # Special scripts that don't need shared library
  if [[ "$rel_path" == "lib/"* ]]; then
    special_scripts+=("$rel_path (library file)")
    continue
  fi

  # Check if it's a minimal script (< 20 lines, wrapper only)
  line_count=$(wc -l < "$script")
  if [ "$line_count" -lt 20 ]; then
    # Check if it's just a wrapper
    if grep -q "exec\|source" "$script" && ! grep -q "echo -e" "$script"; then
      special_scripts+=("$rel_path (minimal wrapper, $line_count lines)")
      continue
    fi
  fi

  # Check shared library usage
  if check_shared_lib_usage "$script"; then
    # Check for old patterns
    old_pattern_issues=$(check_old_patterns "$script")
    if [ $? -eq 0 ]; then
      scripts_using_lib+=("$rel_path")
    else
      scripts_with_old_patterns+=("$rel_path: $old_pattern_issues")
      log_warning "Mixed usage: $rel_path"
      echo "  Issues: $old_pattern_issues"
    fi
  else
    # Not using shared library
    old_pattern_issues=$(check_old_patterns "$script")
    if [ $? -ne 0 ]; then
      scripts_not_using_lib+=("$rel_path (has old patterns: $old_pattern_issues)")
      log_error "Not using shared library: $rel_path"
      echo "  Old patterns: $old_pattern_issues"
    else
      scripts_not_using_lib+=("$rel_path (no shared lib, no old patterns)")
      log_warning "Not using shared library: $rel_path"
    fi
  fi
done < <(find "$SCRIPT_DIR" -name "*.sh" -type f ! -path "*/archive/*")

# ==============================================================================
# Summary Report
# ==============================================================================

echo ""
log_section "Summary Report"

total_scripts=$((${#scripts_using_lib[@]} + ${#scripts_not_using_lib[@]} + ${#scripts_with_old_patterns[@]} + ${#special_scripts[@]}))

echo "Total scripts analyzed: $total_scripts"
echo ""

# Scripts using shared library correctly
log_success "Scripts using shared library (${#scripts_using_lib[@]}):"
for script in "${scripts_using_lib[@]}"; do
  echo "  ✓ $script"
done
echo ""

# Special scripts (excluded from check)
if [ ${#special_scripts[@]} -gt 0 ]; then
  log_info "Special scripts (${#special_scripts[@]}):"
  for script in "${special_scripts[@]}"; do
    echo "  • $script"
  done
  echo ""
fi

# Scripts with mixed usage (using lib but still has old patterns)
if [ ${#scripts_with_old_patterns[@]} -gt 0 ]; then
  log_warning "Scripts with mixed usage (${#scripts_with_old_patterns[@]}):"
  for script in "${scripts_with_old_patterns[@]}"; do
    echo "  ⚠ $script"
  done
  echo ""
fi

# Scripts not using shared library
if [ ${#scripts_not_using_lib[@]} -gt 0 ]; then
  log_error "Scripts not using shared library (${#scripts_not_using_lib[@]}):"
  for script in "${scripts_not_using_lib[@]}"; do
    echo "  ✗ $script"
  done
  echo ""
fi

# ==============================================================================
# Check package.json and Configuration Files
# ==============================================================================

log_section "Configuration Files Check"

log_info "Checking package.json scripts..."
if [ -f "package.json" ]; then
  # Extract script paths from package.json
  invalid_paths=()
  while IFS= read -r script_path; do
    # Remove quotes and extract just the script path
    clean_path=$(echo "$script_path" | sed 's/"//g' | awk '{print $1}')

    # Check if it's a scripts/ reference
    if [[ "$clean_path" == scripts/* ]]; then
      if [ ! -f "$clean_path" ]; then
        invalid_paths+=("$clean_path")
      fi
    fi
  done < <(grep -o '"scripts/[^"]*"' package.json | sed 's/"//g')

  if [ ${#invalid_paths[@]} -eq 0 ]; then
    log_success "All package.json script paths are valid"
  else
    log_error "Invalid paths in package.json:"
    for path in "${invalid_paths[@]}"; do
      echo "  ✗ $path"
    done
  fi
else
  log_warning "package.json not found"
fi
echo ""

# Check GitHub Actions workflows
log_info "Checking GitHub Actions workflows..."
if [ -d ".github/workflows" ]; then
  workflow_script_issues=()
  for workflow in .github/workflows/*.yml .github/workflows/*.yaml; do
    [ -f "$workflow" ] || continue

    # Extract script references
    while IFS= read -r script_ref; do
      clean_ref=$(echo "$script_ref" | sed 's/.*scripts\//scripts\//' | awk '{print $1}')
      if [ ! -f "$clean_ref" ]; then
        workflow_script_issues+=("$workflow: $clean_ref")
      fi
    done < <(grep -o 'scripts/[a-zA-Z0-9_-]*\.sh' "$workflow" 2>/dev/null || true)
  done

  if [ ${#workflow_script_issues[@]} -eq 0 ]; then
    log_success "All GitHub Actions workflow script paths are valid"
  else
    log_error "Invalid script paths in workflows:"
    for issue in "${workflow_script_issues[@]}"; do
      echo "  ✗ $issue"
    done
  fi
else
  log_info "No .github/workflows directory found"
fi
echo ""

# ==============================================================================
# Final Result
# ==============================================================================

log_section "Validation Result"

total_issues=$((${#scripts_not_using_lib[@]} + ${#scripts_with_old_patterns[@]}))

if [ $total_issues -eq 0 ]; then
  log_success "All scripts are using the shared library system correctly! 🎉"
  echo ""
  echo "Statistics:"
  echo "  • Scripts using shared lib: ${#scripts_using_lib[@]}"
  echo "  • Special scripts (excluded): ${#special_scripts[@]}"
  echo "  • Total analyzed: $total_scripts"
  exit 0
else
  log_error "Found $total_issues script(s) with issues"
  echo ""
  echo "Action required:"
  echo "  1. Migrate scripts not using shared library"
  echo "  2. Remove old patterns from scripts with mixed usage"
  echo "  3. Run this validation again"
  exit 1
fi
