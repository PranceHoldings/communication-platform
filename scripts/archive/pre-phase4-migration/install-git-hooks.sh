#!/bin/bash
#
# Install Git Hooks
#
# Git hooksを自動的にインストールする
#

set -e

echo "🔧 Installing Git hooks..."

# Check if .git directory exists
if [ ! -d ".git" ]; then
  echo "❌ Error: .git directory not found. Run this script from the repository root."
  exit 1
fi

# Create hooks directory if it doesn't exist
mkdir -p .git/hooks

# Install pre-commit hook
if [ -f "scripts/git-hooks/pre-commit" ]; then
  ln -sf ../../scripts/git-hooks/pre-commit .git/hooks/pre-commit
  chmod +x .git/hooks/pre-commit
  echo "✅ pre-commit hook installed"
else
  echo "❌ Error: scripts/git-hooks/pre-commit not found"
  exit 1
fi

echo ""
echo "✅ Git hooks installed successfully"
echo ""
echo "The following checks will run on every commit:"
echo "  1. Hardcoded values detection"
echo "  2. Environment variable consistency"
echo "  3. ESLint on staged files"
echo ""
echo "To bypass hooks (not recommended):"
echo "  git commit --no-verify"
echo ""
