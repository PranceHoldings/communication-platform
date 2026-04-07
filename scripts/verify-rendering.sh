#!/bin/bash
# ==============================================================================
# Script Name - Verify development server rendering
# ==============================================================================
# Purpose: Verify development server rendering by capturing actual browser screenshots and checking key page elements
# Usage: bash scripts/verify-rendering.sh.sh [options]
# Author: Generated from template
# Created: 2026-04-04
# ==============================================================================

# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# ==============================================================================
# Configuration
# ==============================================================================

# Default values
URL="${URL:-http://localhost:3000}"
OUTPUT_FILE="${OUTPUT_FILE:-/tmp/verify-rendering.png}"
BROWSER="${BROWSER:-chromium}"
TIMEOUT="${TIMEOUT:-30000}"
SKIP_SCREENSHOT="${SKIP_SCREENSHOT:-false}"

# ==============================================================================
# Helper Functions
# ==============================================================================

# Add your helper functions here
# Example:
# validate_input() {
#   local input=$1
#   if [ -z "$input" ]; then
#     die "Input is required"
#   fi
# }

# ==============================================================================
# Main Logic
# ==============================================================================

main() {
  log_section "Rendering Verification"

  # Step 1: Check HTTP response
  log_step 1 "Checking HTTP response"
  HTTP_CODE=$(curl -s --max-time 5 -o /dev/null -w "%{http_code}" "$URL" 2>/dev/null || echo "000")

  if [[ "$HTTP_CODE" == "200" ]]; then
    log_success "HTTP 200 OK"
    increment_counter PASSED
  else
    log_error "Server not responding (HTTP $HTTP_CODE)"
    increment_counter FAILED
    print_counter_summary
    exit 1
  fi

  # Step 2: Check HTML content
  log_step 2 "Checking HTML content"
  HTML_CONTENT=$(curl -s --max-time 5 "$URL" 2>/dev/null || echo "")

  if echo "$HTML_CONTENT" | grep -q "<title>"; then
    TITLE=$(echo "$HTML_CONTENT" | grep -o '<title>[^<]*</title>' | sed 's/<[^>]*>//g')
    log_success "HTML title found: $TITLE"
    increment_counter PASSED
  else
    log_error "No <title> tag found in HTML"
    increment_counter FAILED
    print_counter_summary
    exit 2
  fi

  # Step 3: Skip screenshot if requested
  if [[ "$SKIP_SCREENSHOT" == "true" ]]; then
    log_info "Skipping screenshot capture (--skip-screenshot)"
    print_separator
    log_success "Rendering verification completed (HTTP check only)"
    print_counter_summary
    exit 0
  fi

  # Step 4: Capture screenshot with Playwright
  log_step 3 "Capturing screenshot with Playwright"

  if ! command -v npx &> /dev/null; then
    log_error "npx not found. Please install Node.js"
    increment_counter FAILED
    print_counter_summary
    exit 4
  fi

  # Capture screenshot
  SCREENSHOT_OUTPUT=$(cd "$SCRIPT_DIR/../apps/web" && npx playwright screenshot \
    --browser "$BROWSER" \
    --timeout "$TIMEOUT" \
    "$URL" \
    "$OUTPUT_FILE" 2>&1)

  if [[ $? -eq 0 ]] && [[ -f "$OUTPUT_FILE" ]]; then
    FILE_SIZE=$(stat -f%z "$OUTPUT_FILE" 2>/dev/null || stat -c%s "$OUTPUT_FILE" 2>/dev/null || echo "0")
    log_success "Screenshot saved: $OUTPUT_FILE (${FILE_SIZE} bytes)"
    increment_counter PASSED

    # Verify screenshot content (basic check)
    if [[ "$FILE_SIZE" -lt 1000 ]]; then
      log_warning "Screenshot file size is very small (${FILE_SIZE} bytes) - page may be blank"
    fi
  else
    log_error "Screenshot capture failed"
    increment_counter FAILED
  fi

  # Summary
  print_separator
  log_success "Rendering verification completed"
  print_counter_summary
}

# ==============================================================================
# Entry Point
# ==============================================================================

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)
      echo "Usage: bash scripts/verify-rendering.sh [options]"
      echo ""
      echo "Options:"
      echo "  -h, --help             Show this help message"
      echo "  --url URL              URL to verify (default: http://localhost:3000)"
      echo "  --output FILE          Screenshot output path (default: /tmp/verify-rendering.png)"
      echo "  --browser BROWSER      Browser to use (chromium/firefox/webkit, default: chromium)"
      echo "  --timeout MS           Page load timeout in ms (default: 30000)"
      echo "  --skip-screenshot      Skip screenshot capture, only check HTTP"
      echo "  -v, --verbose          Enable verbose output"
      exit 0
      ;;
    --url)
      URL="$2"
      shift 2
      ;;
    --output)
      OUTPUT_FILE="$2"
      shift 2
      ;;
    --browser)
      BROWSER="$2"
      shift 2
      ;;
    --timeout)
      TIMEOUT="$2"
      shift 2
      ;;
    --skip-screenshot)
      SKIP_SCREENSHOT=true
      shift
      ;;
    -v|--verbose)
      DEBUG=true
      shift
      ;;
    *)
      die "Unknown option: $1"
      ;;
  esac
done

# Run main function
main
