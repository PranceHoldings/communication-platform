#!/bin/bash
set -e

echo "🔧 Simple Lambda deployment script"

# 1. Clean old builds
rm -f *.js lambda-deploy.zip

# 2. Compile main file to CommonJS manually
echo "📦 Creating CommonJS wrapper..."
cat > index.js << 'WRAPPER'
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;

// Import compiled TypeScript
const indexTs = require('./index-compiled');

// Export handler
exports.handler = indexTs.handler;
WRAPPER

# 3. Transpile TypeScript (without bundling)
echo "🔨 Transpiling TypeScript..."
npx tsc --target ES2020 --module CommonJS --outDir . index.ts --skipLibCheck --esModuleInterop || {
  echo "❌ TypeScript compilation failed"
  exit 1
}

# Rename to avoid conflict
mv index.js index-wrapper.js
mv index-compiled.js index.js 2>/dev/null || true

# 4. Create minimal package
echo "📦 Creating deployment package..."
zip -r lambda-deploy.zip index.js ../../shared/ node_modules/ -x "*/test/*" "*/tests/*" "*/__pycache__/*" -q

echo "✅ Package created: $(ls -lh lambda-deploy.zip | awk '{print $5}')"
