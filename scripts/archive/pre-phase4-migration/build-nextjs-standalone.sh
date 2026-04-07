#!/bin/bash

# Build Next.js Standalone for Lambda Deployment
# This script builds Next.js app with standalone output mode

set -e

echo "========================================="
echo "Building Next.js Standalone for Lambda"
echo "========================================="

# Change to project root
cd "$(dirname "$0")/.."

# Clean previous builds
echo "Cleaning previous builds..."
rm -rf apps/web/.next

# Install dependencies (if not already installed)
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  pnpm install --frozen-lockfile
fi

# Build Next.js app
echo "Building Next.js app..."
cd apps/web
pnpm run build

# Verify standalone build
if [ ! -d ".next/standalone" ]; then
  echo "❌ ERROR: Standalone build not found!"
  echo "Make sure next.config.js has: output: 'standalone'"
  exit 1
fi

echo "✅ Next.js Standalone build completed successfully"
echo ""
echo "Build output:"
echo "  - Standalone server: apps/web/.next/standalone"
echo "  - Static assets: apps/web/.next/static"
echo "  - Public files: apps/web/public"
echo ""
echo "Next step: Deploy with 'pnpm run deploy:nextjs' from infrastructure/"
