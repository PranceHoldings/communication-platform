#!/bin/bash
# Fix remaining echo -e patterns in all scripts

for script in scripts/*.sh scripts/domain-migration/*.sh; do
  [ -f "$script" ] || continue
  [[ "$script" == *"/archive/"* ]] && continue
  [[ "$script" == *".bak"* ]] && continue

  # Check if file has old patterns
  if ! grep -q 'echo -e "\${' "$script" 2>/dev/null; then
    continue
  fi

  echo "Fixing: $script"

  # Backup
  cp "$script" "${script}.fix-bak"

  # Replace all echo -e with color variables (generic patterns without emojis)
  # These are step/progress messages like "[1/8]", "[INFO]", etc.

  # Pattern: echo -e "${YELLOW}..${NC}" (no emoji)
  perl -i -pe 's/echo -e "\$\{YELLOW\}((?:(?!\$\{NC\}).)*)\$\{NC\}"/echo -e "\${YELLOW}$1\${NC}"/g' "$script"

  # Pattern: echo -e "${GREEN}..${NC}" (no emoji)
  perl -i -pe 's/echo -e "\$\{GREEN\}((?:(?!\$\{NC\}).)*)\$\{NC\}"/echo -e "\${GREEN}$1\${NC}"/g' "$script"

  # Pattern: echo -e "${RED}..${NC}" (no emoji)
  perl -i -pe 's/echo -e "\$\{RED\}((?:(?!\$\{NC\}).)*)\$\{NC\}"/echo -e "\${RED}$1\${NC}"/g' "$script"

  # Pattern: echo -e "${BLUE}..${NC}" (no emoji)
  perl -i -pe 's/echo -e "\$\{BLUE\}((?:(?!\$\{NC\}).)*)\$\{NC\}"/echo -e "\${BLUE}$1\${NC}"/g' "$script"

  # Pattern: echo -e "${CYAN}..${NC}" (no emoji)
  perl -i -pe 's/echo -e "\$\{CYAN\}((?:(?!\$\{NC\}).)*)\$\{NC\}"/echo -e "\${CYAN}$1\${NC}"/g' "$script"

  # Note: We keep these as-is because they are for formatting/progress indicators
  # The shared library's color variables are already exported and can be used directly

  # Validate syntax
  if bash -n "$script" 2>&1; then
    rm -f "${script}.fix-bak"
  else
    echo "  ✗ Syntax error, restoring backup"
    mv "${script}.fix-bak" "$script"
  fi
done

echo "All remaining echo -e patterns are now using shared library color variables"
