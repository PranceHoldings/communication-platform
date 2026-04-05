#!/bin/bash
# ==============================================================================
# Common Library - Shared Functions for All Scripts
# ==============================================================================
# Purpose: Centralize color output, logging, error handling, and counter management
# Usage: source "$(dirname "$0")/lib/common.sh"
# ==============================================================================

# ==============================================================================
# Color Definitions
# ==============================================================================
# ANSI color codes for terminal output
export RED='\033[0;31m'
export GREEN='\033[0;32m'
export YELLOW='\033[1;33m'
export BLUE='\033[0;34m'
export MAGENTA='\033[0;35m'
export CYAN='\033[0;36m'
export WHITE='\033[1;37m'
export BOLD='\033[1m'
export NC='\033[0m' # No Color

# ==============================================================================
# Counter Management
# ==============================================================================
# Initialize global counters
export PASSED=0
export FAILED=0
export ERRORS=0
export WARNINGS=0
export SKIPPED=0

# Reset all counters
reset_counters() {
  PASSED=0
  FAILED=0
  ERRORS=0
  WARNINGS=0
  SKIPPED=0
}

# Increment counter by name
increment_counter() {
  local counter_name=$1
  case "$counter_name" in
    PASSED|passed)
      PASSED=$((PASSED + 1))
      ;;
    FAILED|failed)
      FAILED=$((FAILED + 1))
      ;;
    ERRORS|errors)
      ERRORS=$((ERRORS + 1))
      ;;
    WARNINGS|warnings)
      WARNINGS=$((WARNINGS + 1))
      ;;
    SKIPPED|skipped)
      SKIPPED=$((SKIPPED + 1))
      ;;
    *)
      echo -e "${RED}Unknown counter: $counter_name${NC}" >&2
      return 1
      ;;
  esac
}

# Print counter summary
print_counter_summary() {
  echo ""
  echo "=========================================="
  echo "  Summary"
  echo "=========================================="
  [ "$PASSED" -gt 0 ] && echo -e "${GREEN}✅ Passed:   $PASSED${NC}"
  [ "$FAILED" -gt 0 ] && echo -e "${RED}❌ Failed:   $FAILED${NC}"
  [ "$ERRORS" -gt 0 ] && echo -e "${RED}🔴 Errors:   $ERRORS${NC}"
  [ "$WARNINGS" -gt 0 ] && echo -e "${YELLOW}⚠️  Warnings: $WARNINGS${NC}"
  [ "$SKIPPED" -gt 0 ] && echo -e "${CYAN}⏭️  Skipped:  $SKIPPED${NC}"
  echo "=========================================="

  # Return exit code based on failures
  if [ "$FAILED" -gt 0 ] || [ "$ERRORS" -gt 0 ]; then
    return 1
  fi
  return 0
}

# ==============================================================================
# Logging Functions
# ==============================================================================
# Standardized logging with colors and timestamps

# Log with timestamp (optional)
log() {
  local message=$1
  local timestamp=${2:-false}

  if [ "$timestamp" = true ]; then
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $message"
  else
    echo "$message"
  fi
}

# Success message (green checkmark)
log_success() {
  local message=$1
  echo -e "${GREEN}✅ $message${NC}"
  increment_counter PASSED
}

# Error message (red X)
log_error() {
  local message=$1
  echo -e "${RED}❌ $message${NC}" >&2
  increment_counter ERRORS
}

# Warning message (yellow warning)
log_warning() {
  local message=$1
  echo -e "${YELLOW}⚠️  $message${NC}" >&2
  increment_counter WARNINGS
}

# Info message (blue info)
log_info() {
  local message=$1
  echo -e "${CYAN}ℹ️  $message${NC}"
}

# Step message (for multi-step processes)
log_step() {
  local step_num=$1
  local message=$2
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}Step $step_num: $message${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Section header (for major sections)
log_section() {
  local title=$1
  echo ""
  echo "=========================================="
  echo "  $title"
  echo "=========================================="
}

# Debug message (only shown if DEBUG=true)
log_debug() {
  local message=$1
  if [ "${DEBUG:-false}" = true ]; then
    echo -e "${MAGENTA}[DEBUG] $message${NC}"
  fi
}

# Retry message (for retry attempts)
log_retry() {
  local attempt=$1
  local max_attempts=$2
  local message=$3
  echo -e "${YELLOW}🔄 Retry $attempt/$max_attempts: $message${NC}"
}

# ==============================================================================
# Error Handling
# ==============================================================================

# Exit with error message
die() {
  local message=$1
  local exit_code=${2:-1}
  log_error "$message"
  exit "$exit_code"
}

# Check if command exists
require_command() {
  local cmd=$1
  local install_hint=${2:-""}

  if ! command -v "$cmd" &> /dev/null; then
    log_error "$cmd is not installed"
    if [ -n "$install_hint" ]; then
      log_info "Install with: $install_hint"
    fi
    return 1
  fi
  return 0
}

# Check if file exists
require_file() {
  local file=$1
  local hint=${2:-""}

  if [ ! -f "$file" ]; then
    log_error "Required file not found: $file"
    if [ -n "$hint" ]; then
      log_info "$hint"
    fi
    return 1
  fi
  return 0
}

# Check if directory exists
require_directory() {
  local dir=$1
  local hint=${2:-""}

  if [ ! -d "$dir" ]; then
    log_error "Required directory not found: $dir"
    if [ -n "$hint" ]; then
      log_info "$hint"
    fi
    return 1
  fi
  return 0
}

# Check if environment variable is set
require_env() {
  local var_name=$1
  local hint=${2:-""}

  if [ -z "${!var_name}" ]; then
    log_error "Required environment variable not set: $var_name"
    if [ -n "$hint" ]; then
      log_info "$hint"
    fi
    return 1
  fi
  return 0
}

# ==============================================================================
# Utility Functions
# ==============================================================================

# Confirm action with user
confirm() {
  local message=$1
  local default=${2:-"n"}

  local prompt
  if [ "$default" = "y" ]; then
    prompt="[Y/n]"
  else
    prompt="[y/N]"
  fi

  echo -n -e "${YELLOW}$message $prompt ${NC}"
  read -r response

  # Use default if empty
  if [ -z "$response" ]; then
    response=$default
  fi

  case "$response" in
    [yY][eE][sS]|[yY])
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

# Print separator line
print_separator() {
  local char=${1:-"="}
  local length=${2:-50}
  printf '%*s\n' "$length" '' | tr ' ' "$char"
}

# Get script directory (useful for sourcing)
get_script_dir() {
  echo "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
}

# Check if script is sourced or executed
is_sourced() {
  [ "${BASH_SOURCE[0]}" != "${0}" ]
}

# ==============================================================================
# Initialization
# ==============================================================================

# Set error handling if not sourced
if ! is_sourced; then
  set -e  # Exit on error
  set -u  # Exit on undefined variable
  set -o pipefail  # Exit on pipe failure
fi

# Export functions for subshells
export -f log log_success log_error log_warning log_info log_step log_section log_debug log_retry
export -f die require_command require_file require_directory require_env
export -f confirm print_separator get_script_dir is_sourced
export -f reset_counters increment_counter print_counter_summary
