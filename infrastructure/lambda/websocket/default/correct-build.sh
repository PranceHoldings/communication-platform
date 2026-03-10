#!/bin/bash
set -e

echo "🔨 Correct Build Process"
echo "========================="

# 1. Clean
rm -f *.js *.d.ts

# 2. Install esbuild locally if needed
if [ ! -f node_modules/.bin/esbuild ]; then
  echo "📦 Installing esbuild..."
  npm install --save-dev esbuild
fi

# 3. Bundle with esbuild (CommonJS format)
echo "📦 Bundling with esbuild..."
node_modules/.bin/esbuild index.ts \
  --bundle \
  --platform=node \
  --target=node22 \
  --format=cjs \
  --outfile=index.js \
  --external:aws-sdk \
  --external:@aws-sdk/* \
  --external:@prisma/client \
  --sourcemap

echo "✅ Build complete"
ls -lh index.js

# 4. Verify handler export
echo ""
echo "🔍 Verifying handler export..."
if grep -q "exports.handler" index.js; then
  echo "✅ Handler export found"
else
  echo "❌ Handler export NOT found - adding manual export..."
  echo "" >> index.js
  echo "// Manual export for Lambda" >> index.js
  echo "if (typeof module !== 'undefined' && module.exports) {" >> index.js
  echo "  module.exports = { handler };" >> index.js
  echo "}" >> index.js
fi

# 5. Create deployment package
echo ""
echo "📦 Creating deployment package..."
zip -r /tmp/websocket-lambda-correct.zip \
  index.js \
  index.js.map \
  ../../shared/ \
  package.json \
  -q

echo "✅ Package created: $(ls -lh /tmp/websocket-lambda-correct.zip | awk '{print $5}')"

# 6. Deploy
echo ""
echo "🚀 Deploying to Lambda..."
aws lambda update-function-code \
  --function-name prance-websocket-default-dev \
  --zip-file fileb:///tmp/websocket-lambda-correct.zip \
  | jq -r '{FunctionName, LastModified, CodeSize}'

echo ""
echo "✅ Deployment complete!"
