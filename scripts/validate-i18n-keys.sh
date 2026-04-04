#!/bin/bash
#
# i18n Translation Keys Validation Script
# Purpose: Validate that all translation keys used in code exist in translation files
# Root Cause (2026-03-14): Original script only checked for next-intl, not key existence
#
# Usage:
#   bash validate-i18n-keys.sh          # Fail on missing keys (for CI/CD)
#   bash validate-i18n-keys.sh --warn   # Warn only (for development)
#

set -e

# Check for --warn flag
WARN_ONLY=false
if [ "$1" = "--warn" ]; then
  WARN_ONLY=true
fi

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Get project root (where .git directory is)
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [ -z "$PROJECT_ROOT" ]; then
  echo -e "${RED}Error: Not in a git repository${NC}"
  exit 1
fi

cd "$PROJECT_ROOT" || exit 1

echo "============================================"
echo "i18n Translation Keys Validation"
echo "============================================"
echo ""

ERRORS=0
WARNINGS=0

# Step 1: Extract all translation keys used in code
echo -e "${BLUE}[Step 1/4]${NC} Extracting translation keys from code..."

# Find all t('key') and t("key") patterns
TEMP_KEYS="/tmp/i18n-keys-used-$$.txt"
find apps/web/app apps/web/components apps/web/lib -name "*.tsx" -o -name "*.ts" 2>/dev/null | \
  xargs grep -oh "t(['\"][^'\"]*['\"])" 2>/dev/null | \
  sed -E "s/t\(['\"]//g" | \
  sed -E "s/['\"]\\)//g" | \
  grep -E "^[a-z]+\.[a-zA-Z0-9._-]+" | \
  sort -u > "$TEMP_KEYS" || touch "$TEMP_KEYS"

KEYS_COUNT=$(wc -l < "$TEMP_KEYS" | tr -d ' ')
echo "  Found $KEYS_COUNT unique translation keys in code"
echo ""

# Step 2: Check translation files exist
echo -e "${BLUE}[Step 2/4]${NC} Checking translation files..."

if [ ! -d "apps/web/messages" ]; then
  echo -e "${RED}  ✗ messages/ directory not found${NC}"
  ((ERRORS++))
  exit 1
fi

# Get all language directories
LANG_DIRS=$(find apps/web/messages -mindepth 1 -maxdepth 1 -type d 2>/dev/null)
LANG_COUNT=$(echo "$LANG_DIRS" | wc -l | tr -d ' ')

if [ "$LANG_COUNT" -eq 0 ]; then
  echo -e "${RED}  ✗ No language directories found in messages/${NC}"
  ((ERRORS++))
  exit 1
fi

echo "  Found $LANG_COUNT language(s):"
for lang_dir in $LANG_DIRS; do
  lang=$(basename "$lang_dir")
  echo "    - $lang"
done
echo ""

# Step 3: Validate keys for each language
echo -e "${BLUE}[Step 3/4]${NC} Validating translation keys..."

for lang_dir in $LANG_DIRS; do
  lang=$(basename "$lang_dir")
  echo ""
  echo "  Checking language: $lang"
  echo "  ----------------------------------------"

  LANG_ERRORS=0

  # Collect all translation files for this language
  TRANSLATION_FILES=$(find "$lang_dir" -name "*.json" 2>/dev/null)

  if [ -z "$TRANSLATION_FILES" ]; then
    echo -e "  ${RED}✗ No translation files found${NC}"
    ((ERRORS++))
    continue
  fi

  # Create a temporary file with all keys from this language
  TEMP_LANG_KEYS="/tmp/i18n-keys-lang-$lang-$$.txt"
  > "$TEMP_LANG_KEYS"

  for json_file in $TRANSLATION_FILES; do
    category=$(basename "$json_file" .json)

    # Extract keys from JSON file and add category prefix (filename-based)
    # JSON files use flat structure without category wrapper
    if [ -f "$json_file" ]; then
      # Use jq to extract all leaf keys with their full path, then add category prefix
      jq -r 'paths(scalars) as $p | "\($p | map(tostring) | join("."))"' "$json_file" 2>/dev/null | \
        sed "s/^/$category./" >> "$TEMP_LANG_KEYS" || true
    fi
  done

  # Check each used key against available keys
  MISSING_KEYS=()

  while IFS= read -r key; do
    if [ -z "$key" ]; then
      continue
    fi

    # Check if key exists in language translations
    if ! grep -Fxq "$key" "$TEMP_LANG_KEYS" 2>/dev/null; then
      MISSING_KEYS+=("$key")
    fi
  done < "$TEMP_KEYS"

  # Report results
  if [ ${#MISSING_KEYS[@]} -eq 0 ]; then
    echo -e "  ${GREEN}✓ All keys found ($KEYS_COUNT/$KEYS_COUNT)${NC}"
  else
    echo -e "  ${RED}✗ Missing ${#MISSING_KEYS[@]} keys:${NC}"
    for missing_key in "${MISSING_KEYS[@]}"; do
      echo -e "    ${RED}- $missing_key${NC}"
    done
    ((LANG_ERRORS++))
    ((ERRORS++))
  fi

  # Cleanup
  rm -f "$TEMP_LANG_KEYS"
done

echo ""

# Step 4: Check for unused keys (warnings only)
# Skip this step if SKIP_UNUSED_CHECK is set (it can be slow with many keys)
if [ "${SKIP_UNUSED_CHECK:-0}" = "0" ]; then
  echo -e "${BLUE}[Step 4/4]${NC} Checking for unused translation keys..."

  for lang_dir in $LANG_DIRS; do
  lang=$(basename "$lang_dir")

  # Collect all keys from this language
  TEMP_LANG_KEYS="/tmp/i18n-keys-lang-$lang-$$.txt"
  > "$TEMP_LANG_KEYS"

  TRANSLATION_FILES=$(find "$lang_dir" -name "*.json" 2>/dev/null)
  for json_file in $TRANSLATION_FILES; do
    category=$(basename "$json_file" .json)
    if [ -f "$json_file" ]; then
      jq -r 'paths(scalars) as $p | "\($p | map(tostring) | join("."))"' "$json_file" 2>/dev/null | \
        sed "s/^/$category./" >> "$TEMP_LANG_KEYS" || true
    fi
  done

  # Check for unused keys
  UNUSED_KEYS=()
  while IFS= read -r available_key; do
    if [ -z "$available_key" ]; then
      continue
    fi

    if ! grep -Fxq "$available_key" "$TEMP_KEYS" 2>/dev/null; then
      UNUSED_KEYS+=("$available_key")
    fi
  done < "$TEMP_LANG_KEYS"

  if [ ${#UNUSED_KEYS[@]} -gt 0 ]; then
    echo -e "  ${YELLOW}⚠ $lang: ${#UNUSED_KEYS[@]} unused keys (not an error, but consider cleanup)${NC}"
    ((WARNINGS++))
  fi

  rm -f "$TEMP_LANG_KEYS"
  done
else
  echo -e "${BLUE}[Step 4/4]${NC} Skipping unused key check (SKIP_UNUSED_CHECK=1)"
fi

# Cleanup
rm -f "$TEMP_KEYS"

echo ""
echo "============================================"
echo "Validation Summary"
echo "============================================"
echo "  Translation keys used in code: $KEYS_COUNT"
echo "  Languages checked: $LANG_COUNT"
echo "  Errors: $ERRORS"
echo "  Warnings: $WARNINGS"
echo ""

if [ "$ERRORS" -eq 0 ]; then
  echo -e "${GREEN}✅ All translation keys validated successfully${NC}"
  exit 0
else
  if [ "$WARN_ONLY" = true ]; then
    echo -e "${YELLOW}⚠️  Translation key validation FAILED (--warn mode: not blocking)${NC}"
    echo ""
    echo "Fix steps:"
    echo "  1. Add missing translation keys to the appropriate JSON files in apps/web/messages/"
    echo "  2. Ensure all keys follow the 'category.key' pattern"
    echo "  3. Re-run this script to verify: pnpm run validate:i18n-keys"
    exit 0
  else
    echo -e "${RED}❌ Translation key validation FAILED${NC}"
    echo ""
    echo "Fix steps:"
    echo "  1. Add missing translation keys to the appropriate JSON files in apps/web/messages/"
    echo "  2. Ensure all keys follow the 'category.key' pattern"
    echo "  3. Re-run this script to verify: pnpm run validate:i18n-keys"
    echo ""
    echo "To run in non-blocking mode (for development): bash scripts/validate-i18n-keys.sh --warn"
    exit 1
  fi
fi
