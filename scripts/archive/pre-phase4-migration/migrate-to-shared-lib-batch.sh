#!/bin/bash
# ==============================================================================
# Batch Migration Script to Shared Library
# ==============================================================================
# Purpose: Migrate multiple scripts to use shared library in one pass
# Usage: bash scripts/migrate-to-shared-lib-batch.sh script1.sh script2.sh ...
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check if scripts provided
if [ $# -eq 0 ]; then
  echo "Usage: $0 script1.sh script2.sh ..."
  exit 1
fi

for script in "$@"; do
  echo "Migrating: $script"

  # Skip if doesn't exist
  if [ ! -f "$script" ]; then
    echo "  ✗ File not found: $script"
    continue
  fi

  # Create backup
  cp "$script" "${script}.bak"

  # Create temp file
  temp_file=$(mktemp)

  # Step 1: Add shared library source at the top (after shebang and comments)
  awk '
    BEGIN { lib_added = 0 }
    /^#!/ { print; next }
    /^#/ && !lib_added { print; next }
    /^$/ && !lib_added { print; next }
    !lib_added && !/^#/ && !/^$/ {
      print ""
      print "# Load shared library"
      print "SCRIPT_DIR=\"$(cd \"$(dirname \"${BASH_SOURCE[0]}\")\" && pwd)\""
      print "source \"$SCRIPT_DIR/lib/common.sh\""
      print ""
      lib_added = 1
      print
      next
    }
    { print }
  ' "$script" > "$temp_file"

  # Step 2: Remove old color definitions
  sed -i '/^RED=/d' "$temp_file"
  sed -i '/^GREEN=/d' "$temp_file"
  sed -i '/^YELLOW=/d' "$temp_file"
  sed -i '/^BLUE=/d' "$temp_file"
  sed -i '/^MAGENTA=/d' "$temp_file"
  sed -i '/^CYAN=/d' "$temp_file"
  sed -i '/^WHITE=/d' "$temp_file"
  sed -i '/^BOLD=/d' "$temp_file"
  sed -i "/^NC=/d" "$temp_file"

  # Step 3: Replace echo -e patterns with log functions
  # Green success messages
  sed -i 's/echo -e "\${GREEN}✅ \(.*\)\${NC}"/log_success "\1"/g' "$temp_file"
  sed -i 's/echo -e "\${GREEN}✓ \(.*\)\${NC}"/log_success "\1"/g' "$temp_file"

  # Red error messages
  sed -i 's/echo -e "\${RED}❌ \(.*\)\${NC}"/log_error "\1"/g' "$temp_file"
  sed -i 's/echo -e "\${RED}✗ \(.*\)\${NC}"/log_error "\1"/g' "$temp_file"
  sed -i 's/echo -e "\${RED}\(.*\)\${NC}"/log_error "\1"/g' "$temp_file"

  # Yellow warning messages
  sed -i 's/echo -e "\${YELLOW}⚠️  \(.*\)\${NC}"/log_warning "\1"/g' "$temp_file"
  sed -i 's/echo -e "\${YELLOW}⚠ \(.*\)\${NC}"/log_warning "\1"/g' "$temp_file"
  sed -i 's/echo -e "\${YELLOW}\(.*\)\${NC}"/log_warning "\1"/g' "$temp_file"

  # Blue/Cyan info messages
  sed -i 's/echo -e "\${BLUE}ℹ️  \(.*\)\${NC}"/log_info "\1"/g' "$temp_file"
  sed -i 's/echo -e "\${CYAN}ℹ️  \(.*\)\${NC}"/log_info "\1"/g' "$temp_file"
  sed -i 's/echo -e "\${BLUE}\(.*\)\${NC}"/log_info "\1"/g' "$temp_file"
  sed -i 's/echo -e "\${CYAN}\(.*\)\${NC}"/log_info "\1"/g' "$temp_file"

  # Step 4: Replace manual counter increments
  sed -i 's/((PASSED++))/increment_counter PASSED/g' "$temp_file"
  sed -i 's/((FAILED++))/increment_counter FAILED/g' "$temp_file"
  sed -i 's/((ERRORS++))/increment_counter ERRORS/g' "$temp_file"
  sed -i 's/((WARNINGS++))/increment_counter WARNINGS/g' "$temp_file"
  sed -i 's/((SKIPPED++))/increment_counter SKIPPED/g' "$temp_file"

  # More complex patterns
  sed -i 's/PASSED=$((PASSED + 1))/increment_counter PASSED/g' "$temp_file"
  sed -i 's/FAILED=$((FAILED + 1))/increment_counter FAILED/g' "$temp_file"
  sed -i 's/ERRORS=$((ERRORS + 1))/increment_counter ERRORS/g' "$temp_file"
  sed -i 's/WARNINGS=$((WARNINGS + 1))/increment_counter WARNINGS/g' "$temp_file"

  # Replace counter initialization with reset_counters
  sed -i 's/^PASSED=0$/# Counters managed by shared library (reset_counters)/g' "$temp_file"
  sed -i 's/^FAILED=0$/# Counters managed by shared library (reset_counters)/g' "$temp_file"
  sed -i 's/^ERRORS=0$/# Counters managed by shared library (reset_counters)/g' "$temp_file"
  sed -i 's/^WARNINGS=0$/# Counters managed by shared library (reset_counters)/g' "$temp_file"
  sed -i 's/^SKIPPED=0$/# Counters managed by shared library (reset_counters)/g' "$temp_file"

  # Move temp to original
  mv "$temp_file" "$script"

  # Validate syntax
  if bash -n "$script" 2>&1; then
    echo "  ✓ Migrated successfully"
    rm -f "${script}.bak"
  else
    echo "  ✗ Syntax error, restoring backup"
    mv "${script}.bak" "$script"
  fi
done

echo ""
echo "Migration complete!"
