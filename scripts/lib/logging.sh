#!/bin/bash
# ==============================================================================
# Logging Library - Structured Logging Utilities
# ==============================================================================
# Purpose: Advanced logging with levels, timestamps, and JSON output
# Usage: source "$(dirname "$0")/lib/logging.sh"
# Dependencies: common.sh
# ==============================================================================

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

# ==============================================================================
# Logging Configuration
# ==============================================================================
export LOG_LEVEL="${LOG_LEVEL:-INFO}"  # DEBUG, INFO, WARN, ERROR
export LOG_FORMAT="${LOG_FORMAT:-text}"  # text or json
export LOG_FILE="${LOG_FILE:-}"  # Empty = stdout only
export LOG_TIMESTAMP="${LOG_TIMESTAMP:-true}"  # Include timestamps

# Log levels (numeric for comparison)
declare -A LOG_LEVELS=(
  [DEBUG]=0
  [INFO]=1
  [WARN]=2
  [ERROR]=3
)

# ==============================================================================
# Core Logging Functions
# ==============================================================================

# Get current log level value
_get_log_level_value() {
  local level=$1
  echo "${LOG_LEVELS[$level]:-1}"
}

# Check if message should be logged
_should_log() {
  local message_level=$1
  local current_level=$LOG_LEVEL

  local message_value
  local current_value

  message_value=$(_get_log_level_value "$message_level")
  current_value=$(_get_log_level_value "$current_level")

  [ "$message_value" -ge "$current_value" ]
  return $?
}

# Format log message
_format_log_message() {
  local level=$1
  local message=$2
  local extra=${3:-""}

  if [ "$LOG_FORMAT" = "json" ]; then
    # JSON format
    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    local json="{\"timestamp\":\"$timestamp\",\"level\":\"$level\",\"message\":\"$message\""

    if [ -n "$extra" ]; then
      json="$json,\"extra\":$extra"
    fi

    json="$json}"
    echo "$json"
  else
    # Text format
    local output=""

    if [ "$LOG_TIMESTAMP" = "true" ]; then
      output="[$(date +'%Y-%m-%d %H:%M:%S')] "
    fi

    case "$level" in
      DEBUG)
        output="${output}${MAGENTA}[DEBUG]${NC} $message"
        ;;
      INFO)
        output="${output}${CYAN}[INFO]${NC}  $message"
        ;;
      WARN)
        output="${output}${YELLOW}[WARN]${NC}  $message"
        ;;
      ERROR)
        output="${output}${RED}[ERROR]${NC} $message"
        ;;
      *)
        output="${output}[$level] $message"
        ;;
    esac

    if [ -n "$extra" ]; then
      output="$output | $extra"
    fi

    echo -e "$output"
  fi
}

# Write log to file and/or stdout
_write_log() {
  local formatted_message=$1
  local level=$2

  # Write to stdout/stderr
  if [ "$level" = "ERROR" ]; then
    echo "$formatted_message" >&2
  else
    echo "$formatted_message"
  fi

  # Write to log file if specified
  if [ -n "$LOG_FILE" ]; then
    echo "$formatted_message" >> "$LOG_FILE"
  fi
}

# ==============================================================================
# Structured Logging Functions
# ==============================================================================

# Generic log function
log_message() {
  local level=$1
  local message=$2
  local extra=${3:-""}

  if _should_log "$level"; then
    local formatted
    formatted=$(_format_log_message "$level" "$message" "$extra")
    _write_log "$formatted" "$level"
  fi
}

# Debug log (only shown if LOG_LEVEL=DEBUG)
log_debug_v2() {
  log_message "DEBUG" "$1" "${2:-}"
}

# Info log
log_info_v2() {
  log_message "INFO" "$1" "${2:-}"
}

# Warning log
log_warn_v2() {
  log_message "WARN" "$1" "${2:-}"
}

# Error log
log_error_v2() {
  log_message "ERROR" "$1" "${2:-}"
}

# ==============================================================================
# Structured Event Logging
# ==============================================================================

# Log start of operation
log_operation_start() {
  local operation=$1
  local details=${2:-""}

  if [ "$LOG_FORMAT" = "json" ]; then
    local extra="{\"operation\":\"$operation\",\"status\":\"started\""
    if [ -n "$details" ]; then
      extra="$extra,\"details\":\"$details\""
    fi
    extra="$extra}"
    log_info_v2 "Operation started" "$extra"
  else
    log_info_v2 "Starting operation: $operation" "$details"
  fi
}

# Log success of operation
log_operation_success() {
  local operation=$1
  local duration=${2:-""}
  local details=${3:-""}

  if [ "$LOG_FORMAT" = "json" ]; then
    local extra="{\"operation\":\"$operation\",\"status\":\"success\""
    if [ -n "$duration" ]; then
      extra="$extra,\"duration\":\"$duration\""
    fi
    if [ -n "$details" ]; then
      extra="$extra,\"details\":\"$details\""
    fi
    extra="$extra}"
    log_info_v2 "Operation succeeded" "$extra"
  else
    local msg="Operation succeeded: $operation"
    if [ -n "$duration" ]; then
      msg="$msg (${duration}s)"
    fi
    log_success "$msg"
  fi
}

# Log failure of operation
log_operation_failure() {
  local operation=$1
  local error=$2
  local details=${3:-""}

  if [ "$LOG_FORMAT" = "json" ]; then
    local extra="{\"operation\":\"$operation\",\"status\":\"failed\",\"error\":\"$error\""
    if [ -n "$details" ]; then
      extra="$extra,\"details\":\"$details\""
    fi
    extra="$extra}"
    log_error_v2 "Operation failed" "$extra"
  else
    log_error "Operation failed: $operation - $error"
    if [ -n "$details" ]; then
      log_info "$details"
    fi
  fi
}

# ==============================================================================
# Performance Logging
# ==============================================================================

# Start timing
start_timer() {
  echo "$SECONDS"
}

# Calculate elapsed time
elapsed_time() {
  local start=$1
  local end=${2:-$SECONDS}
  echo $((end - start))
}

# Log performance metric
log_performance() {
  local operation=$1
  local duration=$2
  local unit=${3:-"seconds"}

  if [ "$LOG_FORMAT" = "json" ]; then
    local extra="{\"operation\":\"$operation\",\"duration\":$duration,\"unit\":\"$unit\"}"
    log_info_v2 "Performance metric" "$extra"
  else
    log_info "⏱️  $operation: ${duration}${unit}"
  fi
}

# ==============================================================================
# Progress Logging
# ==============================================================================

# Log progress (e.g., 10/100 items processed)
log_progress() {
  local current=$1
  local total=$2
  local operation=${3:-"items"}

  local percentage
  percentage=$((current * 100 / total))

  if [ "$LOG_FORMAT" = "json" ]; then
    local extra="{\"current\":$current,\"total\":$total,\"percentage\":$percentage,\"operation\":\"$operation\"}"
    log_info_v2 "Progress update" "$extra"
  else
    echo -ne "${CYAN}[$current/$total] ${percentage}% $operation processed\r${NC}"

    if [ "$current" -eq "$total" ]; then
      echo ""  # New line when complete
    fi
  fi
}

# ==============================================================================
# Error Context Logging
# ==============================================================================

# Log error with context (file, line, function)
log_error_with_context() {
  local message=$1
  local file="${BASH_SOURCE[2]}"
  local line="${BASH_LINENO[1]}"
  local func="${FUNCNAME[2]}"

  if [ "$LOG_FORMAT" = "json" ]; then
    local extra="{\"file\":\"$file\",\"line\":$line,\"function\":\"$func\"}"
    log_error_v2 "$message" "$extra"
  else
    log_error "$message"
    log_debug "  at $func ($file:$line)"
  fi
}

# ==============================================================================
# File Rotation
# ==============================================================================

# Rotate log file if size exceeds limit
rotate_log_file() {
  local max_size_mb=${1:-10}

  if [ -z "$LOG_FILE" ] || [ ! -f "$LOG_FILE" ]; then
    return 0
  fi

  local size_mb
  size_mb=$(du -m "$LOG_FILE" | cut -f1)

  if [ "$size_mb" -ge "$max_size_mb" ]; then
    local timestamp
    timestamp=$(date +"%Y%m%d-%H%M%S")
    local rotated_file="${LOG_FILE}.${timestamp}"

    mv "$LOG_FILE" "$rotated_file"
    log_info "Log file rotated: $rotated_file"

    # Compress old log
    gzip "$rotated_file" &
  fi
}

# ==============================================================================
# Logging Utilities
# ==============================================================================

# Set log level dynamically
set_log_level() {
  local level=$1

  if [ -z "${LOG_LEVELS[$level]}" ]; then
    log_error "Invalid log level: $level"
    return 1
  fi

  LOG_LEVEL=$level
  log_info "Log level set to: $level"
}

# Enable JSON logging
enable_json_logging() {
  LOG_FORMAT="json"
  log_info "JSON logging enabled"
}

# Enable file logging
enable_file_logging() {
  local file=$1

  LOG_FILE=$file

  # Create log directory if needed
  local log_dir
  log_dir=$(dirname "$file")
  mkdir -p "$log_dir"

  log_info "File logging enabled: $file"
}

# ==============================================================================
# Export Functions
# ==============================================================================
export -f log_message log_debug_v2 log_info_v2 log_warn_v2 log_error_v2
export -f log_operation_start log_operation_success log_operation_failure
export -f start_timer elapsed_time log_performance
export -f log_progress log_error_with_context
export -f rotate_log_file set_log_level enable_json_logging enable_file_logging
