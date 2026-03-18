#!/bin/bash
# Pre-deployment cleanup script (Enhanced)
# Purpose: Remove ALL auto-generated files before deployment
#
# Root Cause (2026-03-14):
#   Old design copied pre-compiled .js files from source directory.
#   When old .js files existed in source, they were deployed instead of fresh TypeScript transpilation.
#
# Solution:
#   1. Remove all auto-generated files (.js, .js.map, .d.ts) from Lambda source directories
#   2. Remove old build artifacts (dist/, deploy/ directories)
#   3. Remove CDK cache (cdk.out/)
#
# Usage: Run before CDK deployment
#   bash infrastructure/scripts/pre-deploy-clean.sh

# Note: set -e is NOT used to allow cleanup to continue even if some files cannot be removed

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LAMBDA_DIR="$PROJECT_ROOT/infrastructure/lambda"
INFRA_DIR="$PROJECT_ROOT/infrastructure"

echo "============================================"
echo "Pre-Deployment Cleanup (Enhanced)"
echo "============================================"
echo ""
echo "Project Root: $PROJECT_ROOT"
echo "Lambda Directory: $LAMBDA_DIR"
echo ""

# Step 1: Remove auto-generated TypeScript compilation artifacts
echo "🧹 [Step 1/3] Removing auto-generated files (.js, .js.map, .d.ts)..."
echo ""

file_count=0

# Find and remove .js, .js.map, .d.ts files (excluding node_modules)
while IFS= read -r file; do
  if [ -f "$file" ]; then
    echo "  Removing: $file"
    rm -f "$file" 2>/dev/null || true
    ((file_count++))
  fi
done < <(find "$LAMBDA_DIR" -type f \( -name "*.js" -o -name "*.js.map" -o -name "*.d.ts" \) ! -path "*/node_modules/*" 2>/dev/null || true)

echo ""
echo "  ✅ Removed $file_count auto-generated files"
echo ""

# Step 2: Remove old build artifact directories
echo "🧹 [Step 2/3] Removing old build directories (dist/, deploy/)..."
echo ""

dir_count=0

# Remove dist/ directories
while IFS= read -r dir; do
  if [ -d "$dir" ]; then
    echo "  Removing: $dir"
    rm -rf "$dir"
    ((dir_count++))
  fi
done < <(find "$LAMBDA_DIR" -type d -name "dist" ! -path "*/node_modules/*")

# Remove deploy/ directories
while IFS= read -r dir; do
  if [ -d "$dir" ]; then
    echo "  Removing: $dir"
    rm -rf "$dir"
    ((dir_count++))
  fi
done < <(find "$LAMBDA_DIR" -type d -name "deploy" ! -path "*/node_modules/*")

echo ""
echo "  ✅ Removed $dir_count build artifact directories"
echo ""

# Step 3: Remove CDK cache
echo "🧹 [Step 3/3] Removing CDK cache (cdk.out/)..."
echo ""

if [ -d "$INFRA_DIR/cdk.out" ]; then
  # Remove nested node_modules first to avoid "Directory not empty" errors
  find "$INFRA_DIR/cdk.out" -type d -name node_modules -exec rm -rf {} + 2>/dev/null || true

  # Remove cdk.out
  if rm -rf "$INFRA_DIR/cdk.out" 2>/dev/null; then
    echo "  ✅ Removed cdk.out/"
  else
    echo "  ⚠️  Warning: Could not remove cdk.out/ (may be in use)"
  fi
else
  echo "  ℹ️  cdk.out/ does not exist (already clean)"
fi

echo ""
echo "============================================"
echo "✅ Pre-deployment cleanup completed"
echo "============================================"
echo ""
echo "Summary:"
echo "  - Auto-generated files removed: $file_count"
echo "  - Build directories removed: $dir_count"
echo "  - CDK cache cleared: Yes"
echo ""
echo "Next steps:"
echo "  1. Run CDK deployment: npm run deploy:dev"
echo "  2. Or deploy specific stack: npm run cdk -- deploy Prance-dev-ApiLambda --require-approval never"
echo ""
