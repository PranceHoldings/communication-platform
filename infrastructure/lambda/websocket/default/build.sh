#!/bin/bash
set -e

echo "Building Lambda function..."

# 1. Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# 2. Compile TypeScript
echo "Compiling TypeScript..."
npx tsc --outDir dist

# 3. Copy node_modules and package.json to dist
echo "Copying dependencies..."
cp -r node_modules dist/
cp package.json dist/

# 4. Create deployment package
echo "Creating deployment package..."
cd dist
zip -r ../lambda-deploy.zip . -q
cd ..

echo "✅ Build complete: lambda-deploy.zip"
ls -lh lambda-deploy.zip
