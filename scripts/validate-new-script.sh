#!/bin/bash
# ==============================================================================
# New Script Validation
# ==============================================================================
# Purpose: Validate that new scripts use shared library system
# Usage: bash scripts/validate-new-script.sh <script-file>
# ==============================================================================

# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# ==============================================================================
# Configuration
# ==============================================================================

SCRIPT_FILE="$1"

if [ -z "$SCRIPT_FILE" ]; then
  die "Usage: $0 <script-file>"
fi

if [ ! -f "$SCRIPT_FILE" ]; then
  die "File not found: $SCRIPT_FILE"
fi

# ==============================================================================
# Validation
# ==============================================================================

log_section "New Script Validation"
log_info "Checking: $SCRIPT_FILE"
echo ""

reset_counters

# Check 1: Has shebang
log_info "[1/7] Checking shebang..."
if head -1 "$SCRIPT_FILE" | grep -q '^#!/bin/bash'; then
  log_success "Shebang found"
  increment_counter PASSED
else
  log_error "Missing or incorrect shebang (must be #!/bin/bash)"
  increment_counter FAILED
fi

# Check 2: Sources shared library
log_info "[2/7] Checking shared library source..."
if grep -q 'source.*lib/common\.sh' "$SCRIPT_FILE"; then
  log_success "Shared library is sourced"
  increment_counter PASSED
else
  log_error "Shared library not sourced"
  echo "  Add: source \"\$SCRIPT_DIR/lib/common.sh\""
  increment_counter FAILED
fi

# Check 3: Has SCRIPT_DIR definition
log_info "[3/7] Checking SCRIPT_DIR definition..."
if grep -q 'SCRIPT_DIR=.*dirname.*BASH_SOURCE' "$SCRIPT_FILE"; then
  log_success "SCRIPT_DIR is defined"
  increment_counter PASSED
else
  log_error "SCRIPT_DIR not defined"
  echo "  Add: SCRIPT_DIR=\"\$(cd \"\$(dirname \"\${BASH_SOURCE[0]}\")\" && pwd)\""
  increment_counter FAILED
fi

# Check 4: No hardcoded colors
log_info "[4/7] Checking for hardcoded colors..."
if grep -qE '(RED|GREEN|YELLOW|BLUE|NC)=.*\\033\[' "$SCRIPT_FILE"; then
  log_error "Hardcoded color definitions found"
  echo "  Remove color definitions and use shared library"
  increment_counter FAILED
else
  log_success "No hardcoded colors"
  increment_counter PASSED
fi

# Check 5: Uses log functions (if has output)
log_info "[5/7] Checking log function usage..."
if grep -q 'echo -e "\${' "$SCRIPT_FILE"; then
  log_warning "Found echo -e with color variables"
  echo "  Consider using log_success(), log_error(), log_warning(), log_info()"
  increment_counter WARNINGS
else
  log_success "Using recommended patterns"
  increment_counter PASSED
fi

# Check 6: No manual counter increments
log_info "[6/7] Checking counter management..."
if grep -qE '\(\((PASSED|FAILED|ERRORS|WARNINGS|SKIPPED)\+\+\)\)' "$SCRIPT_FILE"; then
  log_error "Manual counter increments found"
  echo "  Use: increment_counter PASSED/FAILED/ERRORS/WARNINGS/SKIPPED"
  increment_counter FAILED
else
  log_success "Using shared counter management"
  increment_counter PASSED
fi

# Check 7: Syntax validation
log_info "[7/7] Checking bash syntax..."
if bash -n "$SCRIPT_FILE" 2>&1; then
  log_success "Syntax is valid"
  increment_counter PASSED
else
  log_error "Syntax errors detected"
  bash -n "$SCRIPT_FILE"
  increment_counter FAILED
fi

echo ""
print_counter_summary

# Exit with appropriate code
if [ "$FAILED" -gt 0 ]; then
  exit 1
else
  exit 0
fi
