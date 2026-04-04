#!/bin/bash
#
# Tailwind CSS Build Script - Run on Host Mac (outside Docker)
#
# Purpose: Build Tailwind CSS on Mac to avoid Docker filesystem issues
# Usage: bash scripts/build-tailwind-host.sh [--watch]
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$(dirname "$SCRIPT_DIR")"

INPUT_CSS="$WEB_DIR/app/globals.css"
OUTPUT_CSS="$WEB_DIR/styles/tailwind.output.css"

echo "🎨 Tailwind CSS Build (Host Mac)"
echo "================================"
echo "Input:  $INPUT_CSS"
echo "Output: $OUTPUT_CSS"
echo ""

# Check if input file exists
if [ ! -f "$INPUT_CSS" ]; then
    echo "❌ Error: Input file not found: $INPUT_CSS"
    exit 1
fi

# Create output directory if not exists
mkdir -p "$WEB_DIR/styles"

# Check for --watch flag
if [ "$1" = "--watch" ]; then
    echo "👀 Watch mode enabled (Press Ctrl+C to stop)"
    echo ""
    npx tailwindcss -i "$INPUT_CSS" -o "$OUTPUT_CSS" --watch
else
    echo "🔨 Building once..."
    echo ""
    npx tailwindcss -i "$INPUT_CSS" -o "$OUTPUT_CSS" --minify
    echo ""
    echo "✅ Tailwind CSS built successfully!"
    echo "📦 Output: $OUTPUT_CSS"
fi
