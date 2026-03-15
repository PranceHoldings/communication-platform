#!/bin/bash
#
# UI設定項目とデータベース同期検証スクリプト
#
# Usage:
#   bash scripts/validate-ui-settings-sync.sh                    # 全フィールド検証
#   bash scripts/validate-ui-settings-sync.sh --field <name>     # 特定フィールド検証
#
# Exit codes:
#   0: 全ての検証に合格
#   1: 検証エラーあり

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

# Project root
PROJECT_ROOT="/workspaces/prance-communication-platform"

# Parse arguments
FIELD_NAME=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --field)
      FIELD_NAME="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--field <fieldName>]"
      exit 1
      ;;
  esac
done

echo "========================================"
echo "UI Settings Database Sync Validation"
echo "========================================"
echo ""

if [ -n "$FIELD_NAME" ]; then
  echo "🔍 Validating field: $FIELD_NAME"
else
  echo "🔍 Validating all UI settings fields"
fi
echo ""

# Function to check if a field exists in a file
check_field() {
  local file="$1"
  local field="$2"
  local description="$3"
  local pattern="$4"

  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

  if [ ! -f "$file" ]; then
    echo -e "${RED}❌ $description: File not found${NC}"
    echo "   File: $file"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
    return 1
  fi

  if grep -q "$pattern" "$file"; then
    echo -e "${GREEN}✅ $description${NC}"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
    return 0
  else
    echo -e "${RED}❌ $description${NC}"
    echo "   File: $file"
    echo "   Pattern: $pattern"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
    return 1
  fi
}

# Define fields to check
# Format: "fieldName:entityType:hasOrgDefault"
# entityType: scenario, avatar, session, etc.
# hasOrgDefault: true/false (whether it should be in OrganizationSettings)
FIELDS=(
  "showSilenceTimer:scenario:true"
  "enableSilencePrompt:scenario:true"
  "silenceTimeout:scenario:true"
  "silenceThreshold:scenario:true"
  "minSilenceDuration:scenario:true"
  "initialGreeting:scenario:false"
)

# If specific field is requested, filter
if [ -n "$FIELD_NAME" ]; then
  FIELDS=($(printf '%s\n' "${FIELDS[@]}" | grep "^$FIELD_NAME:"))
  if [ ${#FIELDS[@]} -eq 0 ]; then
    echo -e "${YELLOW}⚠️  Field '$FIELD_NAME' not found in known fields${NC}"
    echo "   This might be a new field. Manual verification recommended."
    exit 0
  fi
fi

# Iterate over fields
for FIELD_SPEC in "${FIELDS[@]}"; do
  IFS=':' read -r FIELD ENTITY HAS_ORG_DEFAULT <<< "$FIELD_SPEC"

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Field: $FIELD (Entity: $ENTITY)"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""

  # Convert to different naming conventions
  SNAKE_CASE=$(echo "$FIELD" | sed 's/\([A-Z]\)/_\L\1/g' | sed 's/^_//')
  CAMEL_CASE="$FIELD"

  # 1. Check Prisma Schema
  echo "1. Checking Prisma Schema..."
  check_field \
    "$PROJECT_ROOT/packages/database/prisma/schema.prisma" \
    "$FIELD" \
    "Prisma Schema: $FIELD field exists" \
    "$CAMEL_CASE.*@map(\"$SNAKE_CASE\")"

  # 2. Check GET API
  echo ""
  echo "2. Checking GET API..."
  case $ENTITY in
    scenario)
      check_field \
        "$PROJECT_ROOT/infrastructure/lambda/scenarios/get/index.ts" \
        "$FIELD" \
        "scenarios/get: $FIELD in select" \
        "$CAMEL_CASE: true"
      ;;
    avatar)
      check_field \
        "$PROJECT_ROOT/infrastructure/lambda/avatars/get/index.ts" \
        "$FIELD" \
        "avatars/get: $FIELD in select" \
        "$CAMEL_CASE: true"
      ;;
    session)
      check_field \
        "$PROJECT_ROOT/infrastructure/lambda/sessions/get/index.ts" \
        "$FIELD" \
        "sessions/get: $FIELD in select" \
        "$CAMEL_CASE: true"
      ;;
  esac

  # 3. Check LIST API
  echo ""
  echo "3. Checking LIST API..."
  case $ENTITY in
    scenario)
      check_field \
        "$PROJECT_ROOT/infrastructure/lambda/scenarios/list/index.ts" \
        "$FIELD" \
        "scenarios/list: $FIELD in select" \
        "$CAMEL_CASE: true"
      ;;
    avatar)
      check_field \
        "$PROJECT_ROOT/infrastructure/lambda/avatars/list/index.ts" \
        "$FIELD" \
        "avatars/list: $FIELD in select" \
        "$CAMEL_CASE: true"
      ;;
    session)
      check_field \
        "$PROJECT_ROOT/infrastructure/lambda/sessions/list/index.ts" \
        "$FIELD" \
        "sessions/list: $FIELD in select" \
        "$CAMEL_CASE: true"
      ;;
  esac

  # 4. Check UPDATE API - body extraction
  echo ""
  echo "4. Checking UPDATE API - body extraction..."
  case $ENTITY in
    scenario)
      check_field \
        "$PROJECT_ROOT/infrastructure/lambda/scenarios/update/index.ts" \
        "$FIELD" \
        "scenarios/update: $FIELD in body extraction" \
        "$CAMEL_CASE,"
      ;;
    avatar)
      check_field \
        "$PROJECT_ROOT/infrastructure/lambda/avatars/update/index.ts" \
        "$FIELD" \
        "avatars/update: $FIELD in body extraction" \
        "$CAMEL_CASE,"
      ;;
  esac

  # 5. Check UPDATE API - updateData
  echo ""
  echo "5. Checking UPDATE API - updateData..."
  case $ENTITY in
    scenario)
      check_field \
        "$PROJECT_ROOT/infrastructure/lambda/scenarios/update/index.ts" \
        "$FIELD" \
        "scenarios/update: $FIELD in updateData" \
        "updateData.$CAMEL_CASE"
      ;;
    avatar)
      check_field \
        "$PROJECT_ROOT/infrastructure/lambda/avatars/update/index.ts" \
        "$FIELD" \
        "avatars/update: $FIELD in updateData" \
        "updateData.$CAMEL_CASE"
      ;;
  esac

  # 6. Check UPDATE API - select (response)
  echo ""
  echo "6. Checking UPDATE API - select (response)..."
  case $ENTITY in
    scenario)
      check_field \
        "$PROJECT_ROOT/infrastructure/lambda/scenarios/update/index.ts" \
        "$FIELD" \
        "scenarios/update: $FIELD in select (response)" \
        "$CAMEL_CASE: true"
      ;;
    avatar)
      check_field \
        "$PROJECT_ROOT/infrastructure/lambda/avatars/update/index.ts" \
        "$FIELD" \
        "avatars/update: $FIELD in select (response)" \
        "$CAMEL_CASE: true"
      ;;
  esac

  # 7. Check Frontend Types
  echo ""
  echo "7. Checking Frontend Types..."
  case $ENTITY in
    scenario)
      check_field \
        "$PROJECT_ROOT/apps/web/lib/api/scenarios.ts" \
        "$FIELD" \
        "Frontend types: $FIELD in Scenario interface" \
        "$CAMEL_CASE\?"

      check_field \
        "$PROJECT_ROOT/apps/web/lib/api/scenarios.ts" \
        "$FIELD" \
        "Frontend types: $FIELD in UpdateScenarioRequest" \
        "$CAMEL_CASE\?"
      ;;
    avatar)
      check_field \
        "$PROJECT_ROOT/apps/web/lib/api/avatars.ts" \
        "$FIELD" \
        "Frontend types: $FIELD in Avatar interface" \
        "$CAMEL_CASE\?"
      ;;
  esac

  # 8. Check Organization Settings DEFAULT_SETTINGS (if applicable)
  if [ "$HAS_ORG_DEFAULT" = "true" ]; then
    echo ""
    echo "8. Checking Organization Settings..."
    check_field \
      "$PROJECT_ROOT/infrastructure/lambda/organizations/settings/index.ts" \
      "$FIELD" \
      "Organization settings: $FIELD in DEFAULT_SETTINGS" \
      "$CAMEL_CASE:"
  fi
done

# Summary
echo ""
echo "========================================"
echo "Validation Summary"
echo "========================================"
echo ""
echo "Total checks: $TOTAL_CHECKS"
echo -e "${GREEN}Passed: $PASSED_CHECKS${NC}"

if [ $FAILED_CHECKS -gt 0 ]; then
  echo -e "${RED}Failed: $FAILED_CHECKS${NC}"
  echo ""
  echo "❌ Validation FAILED"
  echo ""
  echo "Please fix the issues above and re-run this script."
  echo ""
  echo "For detailed guidance, see:"
  echo "  docs/07-development/UI_SETTINGS_DATABASE_SYNC_RULES.md"
  echo ""
  exit 1
else
  echo ""
  echo "✅ All validations PASSED"
  echo ""
  exit 0
fi
