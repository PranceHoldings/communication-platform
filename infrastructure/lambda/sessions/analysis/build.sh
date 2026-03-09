#!/bin/bash
set -e

echo "Building Session Analysis Lambda..."

# Install dependencies
npm install --production

# Copy Prisma client from shared location
if [ -d "../../node_modules/.prisma/client" ]; then
  echo "Copying Prisma client..."
  mkdir -p node_modules/.prisma
  cp -r ../../node_modules/.prisma/client node_modules/.prisma/
fi

echo "Build complete!"
