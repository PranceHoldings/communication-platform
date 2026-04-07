#!/bin/bash
#
# Check if Tailwind CSS has been built on Mac
#

TAILWIND_OUTPUT="$(dirname "$0")/../styles/tailwind.output.css"

# Check if file exists and is not just the placeholder
if [ ! -f "$TAILWIND_OUTPUT" ]; then
    echo ""
    echo "⚠️  WARNING: Tailwind CSS has not been built yet!"
    echo ""
    echo "To enable full styling, run the following on your Mac (outside Docker):"
    echo ""
    echo "  cd apps/web"
    echo "  bash scripts/build-tailwind-host.sh --watch"
    echo ""
    echo "See DOCKER_TAILWIND_SETUP.md for details."
    echo ""
    echo "Continuing with minimal fallback styles..."
    echo ""
    return 0
fi

# Check if it's just the placeholder (small file size)
FILESIZE=$(wc -c < "$TAILWIND_OUTPUT")
if [ "$FILESIZE" -lt 5000 ]; then
    echo ""
    echo "⚠️  WARNING: Tailwind CSS file is a placeholder!"
    echo ""
    echo "To enable full styling, run the following on your Mac (outside Docker):"
    echo ""
    echo "  cd apps/web"
    echo "  bash scripts/build-tailwind-host.sh --watch"
    echo ""
    echo "See DOCKER_TAILWIND_SETUP.md for details."
    echo ""
fi
