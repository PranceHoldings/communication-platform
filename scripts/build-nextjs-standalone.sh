#!/bin/bash

# Build Next.js Standalone for Lambda Deployment
# This script builds Next.js app with standalone output mode

# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

log_section "Building Next.js Standalone for Lambda"

# Change to project root
cd "$(dirname "$0")/.."

# Clean previous builds
log_info "Cleaning previous builds..."
rm -rf apps/web/.next

# Install dependencies (if not already installed)
if [ ! -d "node_modules" ]; then
  log_info "Installing dependencies..."
  pnpm install --frozen-lockfile
fi

# Build Next.js app
log_info "Building Next.js app..."
cd apps/web
pnpm run build

# Verify standalone build
if [ ! -d ".next/standalone" ]; then
  log_error "Standalone build not found!"
  log_info "Make sure next.config.js has: output: 'standalone'"
  exit 1
fi

log_success "Next.js Standalone build completed successfully"
echo ""
echo "Build output:"
echo "  - Standalone server: apps/web/.next/standalone"
echo "  - Static assets: apps/web/.next/static"
echo "  - Public files: apps/web/public"
echo ""
echo "Next step: Deploy with 'pnpm run deploy:nextjs' from infrastructure/"
