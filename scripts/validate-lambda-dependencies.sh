#!/bin/bash
# ==============================================================================
# Lambda Dependencies Validation Script (v2 - Using Shared Library)
# ==============================================================================
# Purpose: Verify all required SDKs are installed in Lambda functions
# CRITICAL: Missing SDKs cause 500 errors in production
# Usage: bash scripts/validate-lambda-dependencies-v2.sh
# ==============================================================================

# Source shared libraries
source "$(dirname "$0")/lib/common.sh"
source "$(dirname "$0")/lib/validate.sh"

log_section "Lambda依存関係検証スクリプト"

MISSING_DEPS=()

# ==============================================================================
# Check Lambda function dependencies
# ==============================================================================

check_lambda_deps() {
  local lambda_dir="$1"
  local lambda_name="$2"
  shift 2
  local required_deps=("$@")

  echo -e "${BLUE}[CHECK]${NC} $lambda_name"

  # Check if package.json exists
  if [ ! -f "$lambda_dir/package.json" ]; then
    log_error "  package.json not found"
    increment_counter ERRORS
    return
  fi

  # Check if node_modules exists
  if [ ! -d "$lambda_dir/node_modules" ]; then
    log_error "  node_modules not found (not installed)"
    log_info "  → Run: cd $lambda_dir && pnpm install"
    increment_counter ERRORS
    MISSING_DEPS+=("$lambda_name")
    return
  fi

  # Check each required dependency
  local missing_count=0
  for dep in "${required_deps[@]}"; do
    if [ -d "$lambda_dir/node_modules/$dep" ]; then
      log_success "  $dep"
      increment_counter PASSED

      # If @prisma/client, also check for generated client
      if [ "$dep" = "@prisma/client" ]; then
        if [ -d "$lambda_dir/node_modules/.prisma/client" ]; then
          log_success "  .prisma/client (generated)"
          increment_counter PASSED
        else
          log_error "  .prisma/client (NOT GENERATED)"
          log_info "  → Run: cd $lambda_dir && pnpm exec prisma generate"
          missing_count=$((missing_count + 1))
          increment_counter ERRORS
        fi
      fi
    else
      log_error "  $dep (MISSING)"
      missing_count=$((missing_count + 1))
      increment_counter ERRORS
    fi
  done

  if [ $missing_count -gt 0 ]; then
    MISSING_DEPS+=("$lambda_name")
    log_warning "  Missing $missing_count dependencies"
    increment_counter WARNINGS
  fi

  echo ""
}

# ==============================================================================
# WebSocket Lambda Functions
# ==============================================================================

log_section "WebSocket Lambda Functions"

# WebSocket Default Handler (CRITICAL - Real-time processing)
check_lambda_deps \
  "infrastructure/lambda/websocket/default" \
  "WebSocket Default Handler" \
  "@prisma/client" \
  "microsoft-cognitiveservices-speech-sdk" \
  "@aws-sdk/client-bedrock-runtime" \
  "@aws-sdk/client-s3" \
  "@aws-sdk/client-apigatewaymanagementapi" \
  "ffmpeg-static"

# WebSocket Connect Handler
check_lambda_deps \
  "infrastructure/lambda/websocket/connect" \
  "WebSocket Connect Handler" \
  "@aws-sdk/client-dynamodb" \
  "@aws-sdk/lib-dynamodb"

# WebSocket Disconnect Handler
check_lambda_deps \
  "infrastructure/lambda/websocket/disconnect" \
  "WebSocket Disconnect Handler" \
  "@aws-sdk/client-dynamodb" \
  "@aws-sdk/lib-dynamodb"

# ==============================================================================
# REST API Lambda Functions (Sample checks)
# ==============================================================================

log_section "REST API Lambda Functions"

# Sessions Analysis (CRITICAL - Rekognition processing)
if [ -d "infrastructure/lambda/sessions/analysis" ]; then
  check_lambda_deps \
    "infrastructure/lambda/sessions/analysis" \
    "Sessions Analysis Handler" \
    "@aws-sdk/client-s3" \
    "@aws-sdk/client-rekognition"
fi

# ==============================================================================
# Summary
# ==============================================================================

log_section "検証結果"

print_counter_summary

if [ $ERRORS -eq 0 ]; then
  log_success "全ての Lambda 依存関係が検証されました"
  exit 0
else
  log_error "Lambda 依存関係の検証に失敗しました"
  echo ""
  log_warning "依存関係が不足している Lambda 関数:"
  for lambda in "${MISSING_DEPS[@]}"; do
    echo "  - $lambda"
  done
  echo ""
  log_info "修正手順:"
  echo "  1. Run: ./scripts/fix-lambda-node-modules.sh"
  echo "  2. Or manually: cd <lambda-dir> && pnpm install"
  echo "  3. Redeploy Lambda functions"
  echo ""
  exit 1
fi
