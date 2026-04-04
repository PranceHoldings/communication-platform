#!/bin/bash

# Fix authentication issues in guest session Lambda functions
# 1. Add extractTokenFromHeader import
# 2. Extract token from Authorization header before verification
# 3. Replace userData.sub with userData.userId

set -e

GUEST_SESSIONS_DIR="/workspaces/prance-communication-platform/infrastructure/lambda/guest-sessions"

echo "🔧 Fixing authentication issues in guest session Lambda functions..."

# List of Lambda function directories to fix
FUNCTIONS=(
  "update"
  "delete"
  "complete"
  "get"
  "logs"
  "batch"
  "list"
)

for func in "${FUNCTIONS[@]}"; do
  FILE="$GUEST_SESSIONS_DIR/$func/index.ts"

  if [ ! -f "$FILE" ]; then
    echo "⚠️  Skipping $func: File not found"
    continue
  fi

  echo "📝 Fixing $func/index.ts..."

  # 1. Add extractTokenFromHeader import if not present
  if grep -q "extractTokenFromHeader" "$FILE"; then
    echo "   ✓ extractTokenFromHeader already imported"
  else
    # Add to existing import from jwt
    sed -i 's/import { verifyToken } from/import { verifyToken, extractTokenFromHeader } from/' "$FILE"
    echo "   ✓ Added extractTokenFromHeader import"
  fi

  # 2. Extract token before verification
  if grep -q "const token = extractTokenFromHeader(authHeader);" "$FILE"; then
    echo "   ✓ Token extraction already present"
  else
    # Replace verifyToken(authHeader) with token extraction
    sed -i '/const userData = verifyToken(authHeader);/i\    const token = extractTokenFromHeader(authHeader);' "$FILE"
    sed -i 's/const userData = verifyToken(authHeader);/const userData = verifyToken(token);/' "$FILE"
    echo "   ✓ Fixed token extraction"
  fi

  # 3. Replace userData.sub with userData.userId
  if grep -q "userData\.sub" "$FILE"; then
    sed -i 's/userData\.sub/userData.userId/g' "$FILE"
    echo "   ✓ Replaced userData.sub with userData.userId"
  else
    echo "   ✓ No userData.sub references found"
  fi

  echo "   ✅ $func/index.ts fixed"
done

echo ""
echo "✅ All guest session Lambda functions fixed!"
echo ""
echo "📋 Summary:"
echo "   - Added extractTokenFromHeader import"
echo "   - Fixed Bearer token extraction"
echo "   - Replaced userData.sub with userData.userId"
echo ""
echo "🚀 Next steps:"
echo "   1. Run: pnpm run deploy:lambda"
echo "   2. Test the guest session APIs"
