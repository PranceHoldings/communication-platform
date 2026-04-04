#!/bin/bash
#
# Install Git Hooks
#
# Git hooksを自動的にインストールする
#

# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

log_info "Installing Git hooks..."

# Check if .git directory exists
if [ ! -d ".git" ]; then
  log_error ".git directory not found. Run this script from the repository root."
  exit 1
fi

# Create hooks directory if it doesn't exist
mkdir -p .git/hooks

# Install pre-commit hook
if [ -f "scripts/git-hooks/pre-commit" ]; then
  ln -sf ../../scripts/git-hooks/pre-commit .git/hooks/pre-commit
  chmod +x .git/hooks/pre-commit
  log_success "pre-commit hook installed"
else
  log_error "scripts/git-hooks/pre-commit not found"
  exit 1
fi

echo ""
log_success "Git hooks installed successfully"
echo ""
echo "The following checks will run on every commit:"
echo "  1. Hardcoded values detection"
echo "  2. Environment variable consistency"
echo "  3. ESLint on staged files"
echo ""
echo "To bypass hooks (not recommended):"
echo "  git commit --no-verify"
echo ""
