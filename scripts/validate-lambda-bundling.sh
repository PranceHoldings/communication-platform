#!/bin/bash

# Lambda関数バンドル完全検証スクリプト
# デプロイ前に esbuild + afterBundling + パッケージ構造を完全検証

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LAMBDA_DIR="$PROJECT_ROOT/infrastructure/lambda"

echo -e "${BLUE}=================================================================="
echo "Lambda関数バンドル完全検証（esbuild + afterBundling + 依存関係）"
echo "==================================================================${NC}"
echo ""

if ! command -v pnpm exec &> /dev/null; then
    echo -e "${RED}✗ pnpm exec command not found${NC}"
    exit 1
fi

ERRORS_FOUND=0
WARNINGS_FOUND=0
VALIDATED_COUNT=0

# 一時ディレクトリ作成
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

echo -e "${YELLOW}[1/4]${NC} Detecting critical Lambda entry points..."
echo ""

# 重要なLambda関数のみ検証（時間短縮）
CRITICAL_FUNCTIONS=(
    "websocket/default/index.ts"
    "sessions/analysis/index.ts"
)

echo -e "${GREEN}Validating ${#CRITICAL_FUNCTIONS[@]} critical Lambda functions${NC}"
echo ""

# ============================================================
# Check 2: esbuild バンドル + afterBundling シミュレーション
# ============================================================
echo -e "${YELLOW}[2/4]${NC} Full bundling simulation (esbuild + afterBundling)..."
echo ""

for func in "${CRITICAL_FUNCTIONS[@]}"; do
    ENTRY_FILE="$LAMBDA_DIR/$func"
    FUNC_NAME=$(echo "$func" | sed 's|/index\.ts||' | sed 's|/|-|g')
    FUNC_DIR=$(dirname "$ENTRY_FILE")

    if [ ! -f "$ENTRY_FILE" ]; then
        echo -e "${YELLOW}⚠ Skipping $FUNC_NAME (file not found)${NC}"
        WARNINGS_FOUND=$((WARNINGS_FOUND + 1))
        continue
    fi

    echo "  ================================================"
    echo "  Validating: $FUNC_NAME"
    echo "  ================================================"

    # テンポラリなパッケージディレクトリ作成
    PACKAGE_DIR="$TEMP_DIR/package-$FUNC_NAME"
    mkdir -p "$PACKAGE_DIR"

    # Step 1: esbuild bundling
    echo -n "    [1/4] esbuild bundling... "
    BUNDLE_OUTPUT="$PACKAGE_DIR/index.js"

    if pnpm exec esbuild "$ENTRY_FILE" \
        --bundle \
        --platform=node \
        --target=es2020 \
        --format=cjs \
        --outfile="$BUNDLE_OUTPUT" \
        --external:aws-sdk \
        --external:@aws-sdk/* \
        --sourcemap \
        > "$TEMP_DIR/${FUNC_NAME}-bundle.log" 2>&1; then

        if [ -f "$BUNDLE_OUTPUT" ]; then
            BUNDLE_SIZE=$(stat -f%z "$BUNDLE_OUTPUT" 2>/dev/null || stat -c%s "$BUNDLE_OUTPUT" 2>/dev/null)
            echo -e "${GREEN}✓ (${BUNDLE_SIZE} bytes)${NC}"
        else
            echo -e "${RED}✗ index.js not generated${NC}"
            cat "$TEMP_DIR/${FUNC_NAME}-bundle.log"
            ERRORS_FOUND=$((ERRORS_FOUND + 1))
            continue
        fi
    else
        echo -e "${RED}✗ FAILED${NC}"
        cat "$TEMP_DIR/${FUNC_NAME}-bundle.log"
        ERRORS_FOUND=$((ERRORS_FOUND + 1))
        continue
    fi

    # Step 2: afterBundling フックのシミュレーション（websocket/default専用）
    echo -n "    [2/4] Simulating afterBundling hooks... "

    if [ "$FUNC_NAME" = "websocket-default" ]; then
        # Use absolute paths matching CDK bundling (projectRoot = infrastructure/../..)
        OUTPUT_DIR="$PACKAGE_DIR"

        # Prisma Client (using absolute path)
        mkdir -p "$OUTPUT_DIR/node_modules/.prisma"
        if cp -r "$PROJECT_ROOT/packages/database/node_modules/.prisma/client" "$OUTPUT_DIR/node_modules/.prisma/" 2>/dev/null; then
            echo "      [DEBUG] Prisma client copied successfully"
        else
            echo "      [DEBUG] Prisma client not found at $PROJECT_ROOT/packages/database/node_modules/.prisma/client"
        fi

        # Prisma schema (CRITICAL: Must be in .prisma/client directory)
        if cp "$PROJECT_ROOT/packages/database/prisma/schema.prisma" "$OUTPUT_DIR/node_modules/.prisma/client/schema.prisma" 2>/dev/null; then
            echo "      [DEBUG] schema.prisma copied to .prisma/client/"
        else
            echo "      [DEBUG] schema.prisma NOT FOUND at $PROJECT_ROOT/packages/database/prisma/schema.prisma"
        fi

        # Shared modules (using absolute path)
        mkdir -p "$OUTPUT_DIR/shared"
        for module in ai audio analysis auth config database types utils; do
            cp -r "$PROJECT_ROOT/infrastructure/lambda/shared/$module" "$OUTPUT_DIR/shared/" 2>/dev/null || true
        done

        # ffmpeg binary (using absolute path)
        cp "$PROJECT_ROOT/infrastructure/lambda/websocket/default/node_modules/ffmpeg-static/ffmpeg" "$OUTPUT_DIR/ffmpeg" 2>/dev/null || true
        chmod +x "$OUTPUT_DIR/ffmpeg" 2>/dev/null || true

        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${YELLOW}⚠ Skipped (not websocket-default)${NC}"
    fi

    # Step 3: パッケージ構造検証
    echo "    [3/4] Validating package structure..."

    # 必須ファイル検証
    REQUIRED_FILES=(
        "index.js"
    )

    if [ "$FUNC_NAME" = "websocket-default" ]; then
        REQUIRED_FILES+=(
            "node_modules/.prisma/client/index.js"
            "node_modules/.prisma/client/schema.prisma"
            "shared/config/defaults.ts"
            "shared/utils/env-validator.ts"
            "ffmpeg"
        )
    fi

    PACKAGE_ERRORS=0
    for req_file in "${REQUIRED_FILES[@]}"; do
        if [ -f "$PACKAGE_DIR/$req_file" ] || [ -d "$PACKAGE_DIR/$req_file" ]; then
            echo -e "      ${GREEN}✓${NC} $req_file"
        else
            echo -e "      ${RED}✗${NC} $req_file ${RED}MISSING${NC}"
            PACKAGE_ERRORS=$((PACKAGE_ERRORS + 1))
        fi
    done

    if [ "$PACKAGE_ERRORS" -gt 0 ]; then
        echo -e "      ${RED}✗ Package validation failed: $PACKAGE_ERRORS missing files${NC}"
        ERRORS_FOUND=$((ERRORS_FOUND + 1))

        # デバッグ情報
        echo ""
        echo "      Debug: Package structure:"
        find "$PACKAGE_DIR" -maxdepth 2 -type f -o -type d | head -20
        echo ""
    else
        echo -e "      ${GREEN}✓ All required files present${NC}"
        VALIDATED_COUNT=$((VALIDATED_COUNT + 1))
    fi

    # Step 4: 依存関係チェック
    echo -n "    [4/4] Checking module dependencies... "

    # index.js が require('@prisma/client') している場合のチェック
    if grep -q "require.*@prisma/client" "$BUNDLE_OUTPUT" 2>/dev/null; then
        if [ -f "$PACKAGE_DIR/node_modules/.prisma/client/index.js" ]; then
            echo -e "${GREEN}✓ Prisma Client available${NC}"
        else
            echo -e "${RED}✗ Prisma Client MISSING but required${NC}"
            ERRORS_FOUND=$((ERRORS_FOUND + 1))
        fi
    else
        echo -e "${GREEN}✓ No Prisma dependency${NC}"
    fi

    echo ""
done

# ============================================================
# Check 3: 共有モジュールの構文検証
# ============================================================
echo -e "${YELLOW}[3/4]${NC} Validating shared modules syntax..."
echo ""

# 重要な共有モジュールのみ検証
CRITICAL_SHARED=(
    "scenario/error-handler.ts"
    "config/defaults.ts"
    "utils/env-validator.ts"
)

for file in "${CRITICAL_SHARED[@]}"; do
    SHARED_FILE="$LAMBDA_DIR/shared/$file"
    if [ -f "$SHARED_FILE" ]; then
        echo -n "  Checking $(basename $file)... "
        if pnpm exec tsc --noEmit --skipLibCheck "$SHARED_FILE" 2>&1 | grep -q "error TS"; then
            echo -e "${RED}✗ Syntax error${NC}"
            pnpm exec tsc --noEmit --skipLibCheck "$SHARED_FILE" 2>&1 | grep "error TS" | head -3
            ERRORS_FOUND=$((ERRORS_FOUND + 1))
        else
            echo -e "${GREEN}✓${NC}"
        fi
    fi
done

echo ""

# ============================================================
# Check 4: CDK stack compilation
# ============================================================
echo -e "${YELLOW}[4/4]${NC} Verifying CDK stack compiles..."
echo ""

cd "$PROJECT_ROOT/infrastructure"
if pnpm run build > /tmp/cdk-build.log 2>&1; then
    echo -e "${GREEN}✓ CDK stack compiles successfully${NC}"
else
    echo -e "${RED}✗ CDK stack compilation failed${NC}"
    tail -20 /tmp/cdk-build.log
    ERRORS_FOUND=$((ERRORS_FOUND + 1))
fi

echo ""

# ============================================================
# Summary
# ============================================================
echo -e "${BLUE}=================================================================="
echo "Validation Summary"
echo -e "==================================================================${NC}"
echo ""
echo "  Validated Functions: $VALIDATED_COUNT / ${#CRITICAL_FUNCTIONS[@]}"
echo "  Errors Found: $ERRORS_FOUND"
echo "  Warnings: $WARNINGS_FOUND"
echo ""

if [ "$ERRORS_FOUND" -eq 0 ]; then
    echo -e "${GREEN}✅ All validations passed - Safe to deploy!${NC}"
    echo ""
    echo "Deploy command:"
    echo "  cd infrastructure && pnpm run cdk -- deploy Prance-dev-ApiLambda --require-approval never"
    echo ""
    echo "Estimated deployment time: ~3 minutes"
    exit 0
else
    echo -e "${RED}❌ Found $ERRORS_FOUND critical error(s)${NC}"
    echo ""
    echo "Deployment will fail. Please fix the errors above."
    echo ""
    echo "Common issues:"
    echo "  1. afterBundling hooks not copying dependencies"
    echo "  2. Missing Prisma Client in package"
    echo "  3. TypeScript syntax errors in shared modules"
    echo "  4. Incorrect path references (inputDir vs relative paths)"
    exit 1
fi
