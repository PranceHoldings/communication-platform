#!/bin/bash
set -e

echo "🚀 WebSocket Lambda Simple Deploy"
echo "===================================="

# 1. TypeScriptソースを直接アップロード（Lambdaランタイムで処理）
echo "📦 Creating deployment package..."

# 必要なファイルのみをzip
zip -r /tmp/websocket-lambda.zip \
  index.ts \
  audio-processor.ts \
  chunk-utils.ts \
  frame-analyzer.ts \
  video-processor.ts \
  analysis-orchestrator.ts \
  ../../shared/ \
  package.json \
  -x "*/test/*" "*/tests/*" "*/.git/*" "*/node_modules/*" \
  -q

# node_modulesは別途追加（サイズ制限対策）
cd node_modules && zip -r /tmp/websocket-lambda.zip . -q && cd ..

echo "✅ Package created: $(ls -lh /tmp/websocket-lambda.zip | awk '{print $5}')"

# 2. Lambda関数更新
echo "🔄 Updating Lambda function..."
aws lambda update-function-code \
  --function-name prance-websocket-default-dev \
  --zip-file fileb:///tmp/websocket-lambda.zip \
  | jq -r '{FunctionName, LastModified, CodeSize, Runtime}'

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Wait 10 seconds for deployment to propagate"
echo "   2. Test WebSocket connection"
echo "   3. Check CloudWatch Logs: aws logs tail /aws/lambda/prance-websocket-default-dev --follow"
