#!/bin/bash
# ==============================================================================
# Fix Mixed Usage Scripts - Remove old echo -e patterns
# ==============================================================================
# Purpose: Scripts already use shared library but still have old echo -e patterns
# Usage: bash scripts/fix-mixed-usage.sh script1.sh script2.sh ...
# ==============================================================================

if [ $# -eq 0 ]; then
  echo "Usage: $0 script1.sh script2.sh ..."
  exit 1
fi

for script in "$@"; do
  echo "Fixing: $script"

  if [ ! -f "$script" ]; then
    echo "  ✗ File not found: $script"
    continue
  fi

  # Create backup
  cp "$script" "${script}.bak"

  # Replace old echo -e patterns (be more permissive with patterns)
  # Green messages
  sed -i 's/echo -e "\${GREEN}✅[[:space:]]*\([^"]*\)\${NC}"/log_success "\1"/g' "$script"
  sed -i 's/echo -e "\${GREEN}✓[[:space:]]*\([^"]*\)\${NC}"/log_success "\1"/g' "$script"
  sed -i "s/echo -e '\${GREEN}✅[[:space:]]*\([^']*\)\${NC}'/log_success \"\1\"/g" "$script"
  sed -i "s/echo -e '\${GREEN}✓[[:space:]]*\([^']*\)\${NC}'/log_success \"\1\"/g" "$script"

  # Red messages
  sed -i 's/echo -e "\${RED}❌[[:space:]]*\([^"]*\)\${NC}"/log_error "\1"/g' "$script"
  sed -i 's/echo -e "\${RED}✗[[:space:]]*\([^"]*\)\${NC}"/log_error "\1"/g' "$script"
  sed -i "s/echo -e '\${RED}❌[[:space:]]*\([^']*\)\${NC}'/log_error \"\1\"/g" "$script"
  sed -i "s/echo -e '\${RED}✗[[:space:]]*\([^']*\)\${NC}'/log_error \"\1\"/g" "$script"

  # Yellow messages
  sed -i 's/echo -e "\${YELLOW}⚠️[[:space:]]*\([^"]*\)\${NC}"/log_warning "\1"/g' "$script"
  sed -i 's/echo -e "\${YELLOW}⚠[[:space:]]*\([^"]*\)\${NC}"/log_warning "\1"/g' "$script"
  sed -i "s/echo -e '\${YELLOW}⚠️[[:space:]]*\([^']*\)\${NC}'/log_warning \"\1\"/g" "$script"
  sed -i "s/echo -e '\${YELLOW}⚠[[:space:]]*\([^']*\)\${NC}'/log_warning \"\1\"/g" "$script"

  # Blue/Cyan messages
  sed -i 's/echo -e "\${BLUE}ℹ️[[:space:]]*\([^"]*\)\${NC}"/log_info "\1"/g' "$script"
  sed -i 's/echo -e "\${CYAN}ℹ️[[:space:]]*\([^"]*\)\${NC}"/log_info "\1"/g' "$script"
  sed -i "s/echo -e '\${BLUE}ℹ️[[:space:]]*\([^']*\)\${NC}'/log_info \"\1\"/g" "$script"
  sed -i "s/echo -e '\${CYAN}ℹ️[[:space:]]*\([^']*\)\${NC}'/log_info \"\1\"/g" "$script"

  # Generic color patterns (no emoji)
  sed -i 's/echo -e "\${GREEN}\([^$}]*\)\${NC}"/echo -e "${GREEN}\1${NC}"/g' "$script"
  sed -i 's/echo -e "\${RED}\([^$}]*\)\${NC}"/echo -e "${RED}\1${NC}"/g' "$script"
  sed -i 's/echo -e "\${YELLOW}\([^$}]*\)\${NC}"/echo -e "${YELLOW}\1${NC}"/g' "$script"
  sed -i 's/echo -e "\${BLUE}\([^$}]*\)\${NC}"/echo -e "${BLUE}\1${NC}"/g' "$script"

  # Validate syntax
  if bash -n "$script" 2>&1; then
    echo "  ✓ Fixed successfully"
    rm -f "${script}.bak"
  else
    echo "  ✗ Syntax error, restoring backup"
    mv "${script}.bak" "$script"
  fi
done

echo ""
echo "Fix complete!"
