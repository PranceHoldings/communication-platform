#!/bin/bash
#
# Extract Missing Translation Keys (English Only)
# Purpose: Extract missing keys from English language files only
#

# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [ -z "$PROJECT_ROOT" ]; then
  log_error "Not in a git repository"
  exit 1
fi

cd "$PROJECT_ROOT" || exit 1

log_section "Extract Missing Keys - English Only"

# Step 1: Extract all translation keys used in code
log_step 1 "Extracting translation keys from code..."

TEMP_KEYS="/tmp/i18n-keys-used-$$.txt"
find apps/web/app apps/web/components apps/web/lib -name "*.tsx" -o -name "*.ts" 2>/dev/null | \
  xargs grep -oh "t(['\"][^'\"]*['\"])" 2>/dev/null | \
  sed -E "s/t\(['\"]//g" | \
  sed -E "s/['\"]\\)//g" | \
  grep -E "^[a-z]+\.[a-zA-Z0-9._-]+" | \
  sort -u > "$TEMP_KEYS" || touch "$TEMP_KEYS"

KEYS_COUNT=$(wc -l < "$TEMP_KEYS" | tr -d ' ')
log_info "Found $KEYS_COUNT unique translation keys in code"
echo ""

# Step 2: Extract keys from English translation files
log_step 2 "Extracting keys from English translation files..."

TEMP_EN_KEYS="/tmp/i18n-keys-en-$$.txt"
> "$TEMP_EN_KEYS"

EN_DIR="apps/web/messages/en"
TRANSLATION_FILES=$(find "$EN_DIR" -name "*.json" 2>/dev/null)

for json_file in $TRANSLATION_FILES; do
  category=$(basename "$json_file" .json)

  if [ -f "$json_file" ]; then
    # Extract all keys from JSON file and add category prefix (filename-based)
    jq -r 'paths(scalars) as $p | "\($p | map(tostring) | join("."))"' "$json_file" 2>/dev/null | \
      sed "s/^/$category./" >> "$TEMP_EN_KEYS" || true
  fi
done

EN_KEYS_COUNT=$(wc -l < "$TEMP_EN_KEYS" | tr -d ' ')
log_info "Found $EN_KEYS_COUNT keys in English translation files"
echo ""

# Step 3: Find missing keys
log_step 3 "Finding missing keys in English..."

MISSING_KEYS=()
MISSING_BY_CATEGORY=()

while IFS= read -r key; do
  if [ -z "$key" ]; then
    continue
  fi

  # Check if key exists in English translations
  if ! grep -Fxq "$key" "$TEMP_EN_KEYS" 2>/dev/null; then
    MISSING_KEYS+=("$key")

    # Extract category from key (first part before .)
    category=$(echo "$key" | cut -d. -f1)
    MISSING_BY_CATEGORY+=("$category|$key")
  fi
done < "$TEMP_KEYS"

echo ""
log_section "Missing Keys Summary"
echo "  Total keys used: $KEYS_COUNT"
echo "  Total keys in English: $EN_KEYS_COUNT"
echo "  Missing keys: ${#MISSING_KEYS[@]}"
echo ""

if [ ${#MISSING_KEYS[@]} -eq 0 ]; then
  log_success "All keys found in English translation files"
else
  log_error "Missing ${#MISSING_KEYS[@]} keys in English:"
  echo ""

  # Group by category (simpler approach without associative arrays)
  CATEGORIES=$(printf '%s\n' "${MISSING_KEYS[@]}" | cut -d. -f1 | sort -u)

  # Print grouped by category
  for category in $CATEGORIES; do
    category_keys=$(printf '%s\n' "${MISSING_KEYS[@]}" | grep "^$category\.")
    count=$(echo "$category_keys" | wc -l | tr -d ' ')
    log_warning "[$category] - $count keys:"
    echo "$category_keys" | sed 's/^/  /'
    echo ""
  done

  # Save to file
  OUTPUT_FILE="/tmp/missing-keys-english.txt"
  > "$OUTPUT_FILE"
  echo "Missing Translation Keys - English" >> "$OUTPUT_FILE"
  echo "Generated: $(date)" >> "$OUTPUT_FILE"
  echo "==========================================" >> "$OUTPUT_FILE"
  echo "" >> "$OUTPUT_FILE"

  for key in "${MISSING_KEYS[@]}"; do
    echo "$key" >> "$OUTPUT_FILE"
  done

  log_success "Saved to: $OUTPUT_FILE"
fi

# Cleanup
rm -f "$TEMP_KEYS" "$TEMP_EN_KEYS"

exit 0
