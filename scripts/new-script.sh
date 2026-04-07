#!/bin/bash
# ==============================================================================
# New Script Generator
# ==============================================================================
# Purpose: Generate a new script from template with shared library integration
# Usage: bash scripts/new-script.sh
# ==============================================================================

# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# ==============================================================================
# Configuration
# ==============================================================================

TEMPLATE_FILE="$SCRIPT_DIR/templates/script-template.sh"
SCRIPTS_DIR="$SCRIPT_DIR"

# ==============================================================================
# Main Logic
# ==============================================================================

log_section "New Script Generator"

log_info "This tool will generate a new script from template."
log_info "The script will automatically use the shared library system."
echo ""

# Step 1: Get script name
echo -n "Enter script name (without .sh extension): "
read -r SCRIPT_NAME

if [ -z "$SCRIPT_NAME" ]; then
  die "Script name is required"
fi

# Add .sh extension if not present
if [[ ! "$SCRIPT_NAME" =~ \.sh$ ]]; then
  SCRIPT_NAME="${SCRIPT_NAME}.sh"
fi

SCRIPT_PATH="$SCRIPTS_DIR/$SCRIPT_NAME"

# Check if file already exists
if [ -f "$SCRIPT_PATH" ]; then
  log_error "Script already exists: $SCRIPT_PATH"
  if ! confirm "Overwrite existing file?" "n"; then
    log_info "Cancelled."
    exit 0
  fi
fi

# Step 2: Get script description
echo -n "Enter brief description: "
read -r SCRIPT_DESC

if [ -z "$SCRIPT_DESC" ]; then
  SCRIPT_DESC="Auto-generated script"
fi

# Step 3: Get detailed purpose
echo -n "Enter detailed purpose (optional, press Enter to skip): "
read -r SCRIPT_PURPOSE

if [ -z "$SCRIPT_PURPOSE" ]; then
  SCRIPT_PURPOSE="$SCRIPT_DESC"
fi

# Step 4: Get section name
echo -n "Enter main section name (default: ${SCRIPT_NAME%.sh}): "
read -r SECTION_NAME

if [ -z "$SECTION_NAME" ]; then
  SECTION_NAME="${SCRIPT_NAME%.sh}"
fi

# Step 5: Generate script
log_info "Generating script..."

cp "$TEMPLATE_FILE" "$SCRIPT_PATH"

# Replace placeholders
CREATION_DATE=$(date '+%Y-%m-%d')
sed -i "s/SCRIPT_NAME/${SCRIPT_NAME}/g" "$SCRIPT_PATH"
sed -i "s/Brief Description/${SCRIPT_DESC}/g" "$SCRIPT_PATH"
sed -i "s/Detailed purpose of this script/${SCRIPT_PURPOSE}/g" "$SCRIPT_PATH"
sed -i "s/CREATION_DATE/${CREATION_DATE}/g" "$SCRIPT_PATH"
sed -i "s/SECTION_NAME/${SECTION_NAME}/g" "$SCRIPT_PATH"

# Make executable
chmod +x "$SCRIPT_PATH"

# Validate syntax
if bash -n "$SCRIPT_PATH" 2>&1; then
  log_success "Script created successfully!"
else
  log_error "Script has syntax errors"
  die "Please check the generated script"
fi

echo ""
log_section "Summary"
echo "  📄 File: $SCRIPT_PATH"
echo "  📝 Description: $SCRIPT_DESC"
echo "  📅 Created: $CREATION_DATE"
echo "  ✅ Executable: Yes"
echo "  📚 Shared Library: Integrated"
echo ""

log_info "Next steps:"
echo "  1. Edit the script: $SCRIPT_PATH"
echo "  2. Implement your logic in the main() function"
echo "  3. Test: bash $SCRIPT_PATH"
echo "  4. Validate: bash scripts/validate-shared-lib-usage.sh"
echo ""

log_success "Ready to use!"
