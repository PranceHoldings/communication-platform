#!/bin/bash
# 不整合検出スクリプト
# Claude Code自身が生成したコードの中での不整合を検出

set -e

REPORT_FILE="docs/development/INCONSISTENCY_REPORT.md"
TEMP_DIR="/tmp/inconsistency-detection-$$"
mkdir -p "$TEMP_DIR"
mkdir -p "$(dirname "$REPORT_FILE")"

echo "# 不整合検出レポート" > "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "**生成日時:** $(date '+%Y-%m-%d %H:%M:%S')" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "---" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# カウンター
TOTAL_ISSUES=0

echo "🔍 不整合検出を開始します..."
echo ""

# ============================================================
# 1. ContentType と ファイル拡張子の不整合
# ============================================================
echo "## 1. ContentType と ファイル拡張子の不整合" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "📌 [1/8] ContentType と ファイル拡張子の不整合を検出中..."

# audio/mpeg と .webm の組み合わせ
AUDIO_MPEG_WEBM=$(grep -rn "audio/mpeg.*\.webm\|\.webm.*audio/mpeg" infrastructure/lambda apps/web --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l || echo 0)
if [ "$AUDIO_MPEG_WEBM" -gt 0 ]; then
    echo "### ❌ audio/mpeg と .webm の不整合" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo '```' >> "$REPORT_FILE"
    grep -rn "audio/mpeg.*\.webm\|\.webm.*audio/mpeg" infrastructure/lambda apps/web --include="*.ts" --include="*.tsx" 2>/dev/null >> "$REPORT_FILE" || echo "なし" >> "$REPORT_FILE"
    echo '```' >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    TOTAL_ISSUES=$((TOTAL_ISSUES + AUDIO_MPEG_WEBM))
fi

# video/webm と .mp4 の組み合わせ
VIDEO_WEBM_MP4=$(grep -rn "video/webm.*\.mp4\|\.mp4.*video/webm" infrastructure/lambda apps/web --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l || echo 0)
if [ "$VIDEO_WEBM_MP4" -gt 0 ]; then
    echo "### ❌ video/webm と .mp4 の不整合" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo '```' >> "$REPORT_FILE"
    grep -rn "video/webm.*\.mp4\|\.mp4.*video/webm" infrastructure/lambda apps/web --include="*.ts" --include="*.tsx" 2>/dev/null >> "$REPORT_FILE" || echo "なし" >> "$REPORT_FILE"
    echo '```' >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    TOTAL_ISSUES=$((TOTAL_ISSUES + VIDEO_WEBM_MP4))
fi

if [ "$AUDIO_MPEG_WEBM" -eq 0 ] && [ "$VIDEO_WEBM_MP4" -eq 0 ]; then
    echo "✅ ContentType と拡張子の不整合は検出されませんでした" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
fi

# ============================================================
# 2. Prismaスキーマ と 実装の不整合
# ============================================================
echo "## 2. Prismaスキーマ と 実装の不整合" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "📌 [2/8] Prismaスキーマと実装の不整合を検出中..."

# organizationId の使用（正しくは orgId）
ORG_ID_INCONSISTENCY=$(grep -rn "organizationId\|organization_id" infrastructure/lambda apps/web/lib --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".prisma" | wc -l || echo 0)
if [ "$ORG_ID_INCONSISTENCY" -gt 0 ]; then
    echo "### ❌ organizationId の使用（正しくは orgId）" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "**検出数:** $ORG_ID_INCONSISTENCY 件" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo '```' >> "$REPORT_FILE"
    grep -rn "organizationId\|organization_id" infrastructure/lambda apps/web/lib --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".prisma" | head -20 >> "$REPORT_FILE" || echo "なし" >> "$REPORT_FILE"
    echo '```' >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    TOTAL_ISSUES=$((TOTAL_ISSUES + ORG_ID_INCONSISTENCY))
fi

# snake_case フィールド名の使用（PrismaはcamelCase）
SNAKE_CASE_FIELDS=$(grep -rn "user_id\|scenario_id\|avatar_id\|session_id" infrastructure/lambda apps/web/lib --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".prisma" | grep -v "connection_id" | grep -v "recording_id" | wc -l || echo 0)
if [ "$SNAKE_CASE_FIELDS" -gt 0 ]; then
    echo "### ❌ snake_case フィールド名の使用" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "**検出数:** $SNAKE_CASE_FIELDS 件" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo '```' >> "$REPORT_FILE"
    grep -rn "user_id\|scenario_id\|avatar_id\|session_id" infrastructure/lambda apps/web/lib --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".prisma" | grep -v "connection_id" | grep -v "recording_id" | head -20 >> "$REPORT_FILE" || echo "なし" >> "$REPORT_FILE"
    echo '```' >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    TOTAL_ISSUES=$((TOTAL_ISSUES + SNAKE_CASE_FIELDS))
fi

if [ "$ORG_ID_INCONSISTENCY" -eq 0 ] && [ "$SNAKE_CASE_FIELDS" -eq 0 ]; then
    echo "✅ Prismaスキーマと実装の不整合は検出されませんでした" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
fi

# ============================================================
# 3. ハードコードされた設定値
# ============================================================
echo "## 3. ハードコードされた設定値" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "📌 [3/8] ハードコードされた設定値を検出中..."

# 言語コード
HARDCODED_LANG=$(grep -rn "'en-US'\|'ja-JP'\|'en'\|'ja'" infrastructure/lambda --include="*.ts" --exclude="defaults.ts" --exclude="index.ts" | grep -v "// " | wc -l || echo 0)
if [ "$HARDCODED_LANG" -gt 0 ]; then
    echo "### ❌ ハードコードされた言語コード" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "**検出数:** $HARDCODED_LANG 件" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo '```' >> "$REPORT_FILE"
    grep -rn "'en-US'\|'ja-JP'\|'en'\|'ja'" infrastructure/lambda --include="*.ts" --exclude="defaults.ts" --exclude="index.ts" | grep -v "// " | head -20 >> "$REPORT_FILE" || echo "なし" >> "$REPORT_FILE"
    echo '```' >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    TOTAL_ISSUES=$((TOTAL_ISSUES + HARDCODED_LANG))
fi

# リージョンコード
HARDCODED_REGION=$(grep -rn "'us-east-1'\|'eastus'" infrastructure/lambda --include="*.ts" --exclude="defaults.ts" --exclude="index.ts" | grep -v "// " | wc -l || echo 0)
if [ "$HARDCODED_REGION" -gt 0 ]; then
    echo "### ❌ ハードコードされたリージョン" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "**検出数:** $HARDCODED_REGION 件" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo '```' >> "$REPORT_FILE"
    grep -rn "'us-east-1'\|'eastus'" infrastructure/lambda --include="*.ts" --exclude="defaults.ts" --exclude="index.ts" | grep -v "// " | head -20 >> "$REPORT_FILE" || echo "なし" >> "$REPORT_FILE"
    echo '```' >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    TOTAL_ISSUES=$((TOTAL_ISSUES + HARDCODED_REGION))
fi

# メディアフォーマット
HARDCODED_FORMAT=$(grep -rn "'webm'\|'mp4'\|'1280x720'" infrastructure/lambda --include="*.ts" --exclude="defaults.ts" --exclude="index.ts" | grep -v "// " | wc -l || echo 0)
if [ "$HARDCODED_FORMAT" -gt 0 ]; then
    echo "### ❌ ハードコードされたメディアフォーマット" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "**検出数:** $HARDCODED_FORMAT 件" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo '```' >> "$REPORT_FILE"
    grep -rn "'webm'\|'mp4'\|'1280x720'" infrastructure/lambda --include="*.ts" --exclude="defaults.ts" --exclude="index.ts" | grep -v "// " | head -20 >> "$REPORT_FILE" || echo "なし" >> "$REPORT_FILE"
    echo '```' >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    TOTAL_ISSUES=$((TOTAL_ISSUES + HARDCODED_FORMAT))
fi

if [ "$HARDCODED_LANG" -eq 0 ] && [ "$HARDCODED_REGION" -eq 0 ] && [ "$HARDCODED_FORMAT" -eq 0 ]; then
    echo "✅ ハードコードされた設定値は検出されませんでした" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
fi

# ============================================================
# 4. 型定義の重複
# ============================================================
echo "## 4. 型定義の重複" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "📌 [4/8] 型定義の重複を検出中..."

# Userインターフェースの重複定義
USER_TYPE_DUP=$(grep -rn "^export interface User {" infrastructure/lambda apps/web --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v "packages/shared" | wc -l || echo 0)
if [ "$USER_TYPE_DUP" -gt 0 ]; then
    echo "### ❌ Userインターフェースの重複定義" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "**検出数:** $USER_TYPE_DUP 件" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo '```' >> "$REPORT_FILE"
    grep -rn "^export interface User {" infrastructure/lambda apps/web --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v "packages/shared" >> "$REPORT_FILE" || echo "なし" >> "$REPORT_FILE"
    echo '```' >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    TOTAL_ISSUES=$((TOTAL_ISSUES + USER_TYPE_DUP))
fi

# Avatarインターフェースの重複定義
AVATAR_TYPE_DUP=$(grep -rn "^export interface Avatar {" infrastructure/lambda apps/web --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v "packages/shared" | wc -l || echo 0)
if [ "$AVATAR_TYPE_DUP" -gt 0 ]; then
    echo "### ❌ Avatarインターフェースの重複定義" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "**検出数:** $AVATAR_TYPE_DUP 件" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo '```' >> "$REPORT_FILE"
    grep -rn "^export interface Avatar {" infrastructure/lambda apps/web --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v "packages/shared" >> "$REPORT_FILE" || echo "なし" >> "$REPORT_FILE"
    echo '```' >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    TOTAL_ISSUES=$((TOTAL_ISSUES + AVATAR_TYPE_DUP))
fi

# インラインEnum定義
INLINE_ENUM=$(grep -rn "'PRIVATE'.*|.*'ORGANIZATION'.*|.*'PUBLIC'" apps/web infrastructure/lambda --include="*.ts" | grep -v node_modules | grep -v "from '@prance/shared'" | wc -l || echo 0)
if [ "$INLINE_ENUM" -gt 0 ]; then
    echo "### ❌ インラインEnum定義（共有型を使うべき）" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "**検出数:** $INLINE_ENUM 件" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo '```' >> "$REPORT_FILE"
    grep -rn "'PRIVATE'.*|.*'ORGANIZATION'.*|.*'PUBLIC'" apps/web infrastructure/lambda --include="*.ts" | grep -v node_modules | grep -v "from '@prance/shared'" | head -20 >> "$REPORT_FILE" || echo "なし" >> "$REPORT_FILE"
    echo '```' >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    TOTAL_ISSUES=$((TOTAL_ISSUES + INLINE_ENUM))
fi

if [ "$USER_TYPE_DUP" -eq 0 ] && [ "$AVATAR_TYPE_DUP" -eq 0 ] && [ "$INLINE_ENUM" -eq 0 ]; then
    echo "✅ 型定義の重複は検出されませんでした" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
fi

# ============================================================
# 5. 多言語対応の不整合
# ============================================================
echo "## 5. 多言語対応の不整合" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "📌 [5/8] 多言語対応の不整合を検出中..."

# ハードコード文字列（JSX内）
HARDCODED_TEXT=$(grep -rn "[>][\s]*[A-Z][a-zA-Z\s]{5,}[\s]*[<]" apps/web/app apps/web/components --include="*.tsx" 2>/dev/null | grep -v "{t('" | wc -l || echo 0)
if [ "$HARDCODED_TEXT" -gt 0 ]; then
    echo "### ❌ ハードコード文字列（多言語化されていない）" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "**検出数:** $HARDCODED_TEXT 件" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo '```' >> "$REPORT_FILE"
    grep -rn "[>][\s]*[A-Z][a-zA-Z\s]{5,}[\s]*[<]" apps/web/app apps/web/components --include="*.tsx" 2>/dev/null | grep -v "{t('" | head -20 >> "$REPORT_FILE" || echo "なし" >> "$REPORT_FILE"
    echo '```' >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    TOTAL_ISSUES=$((TOTAL_ISSUES + HARDCODED_TEXT))
fi

# placeholder属性のハードコード
HARDCODED_PLACEHOLDER=$(grep -rn 'placeholder=["'"'"'][A-Z]' apps/web --include="*.tsx" 2>/dev/null | grep -v "{t('" | wc -l || echo 0)
if [ "$HARDCODED_PLACEHOLDER" -gt 0 ]; then
    echo "### ❌ placeholder属性のハードコード" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "**検出数:** $HARDCODED_PLACEHOLDER 件" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo '```' >> "$REPORT_FILE"
    grep -rn 'placeholder=["'"'"'][A-Z]' apps/web --include="*.tsx" 2>/dev/null | grep -v "{t('" | head -20 >> "$REPORT_FILE" || echo "なし" >> "$REPORT_FILE"
    echo '```' >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    TOTAL_ISSUES=$((TOTAL_ISSUES + HARDCODED_PLACEHOLDER))
fi

if [ "$HARDCODED_TEXT" -eq 0 ] && [ "$HARDCODED_PLACEHOLDER" -eq 0 ]; then
    echo "✅ 多言語対応の不整合は検出されませんでした" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
fi

# ============================================================
# 6. 環境変数の不整合
# ============================================================
echo "## 6. 環境変数の不整合" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "📌 [6/8] 環境変数の不整合を検出中..."

# .env.local の存在確認
if [ -f ".env.local" ]; then
    # ローカルPostgreSQL接続文字列
    LOCAL_DB=$(grep -n "localhost:5432\|localhost/prance" .env.local 2>/dev/null | wc -l || echo 0)
    if [ "$LOCAL_DB" -gt 0 ]; then
        echo "### ❌ ローカルPostgreSQL接続文字列（AWS RDS専用プロジェクト）" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
        echo '```' >> "$REPORT_FILE"
        grep -n "localhost:5432\|localhost/prance" .env.local 2>/dev/null | sed 's/:.*/: <REDACTED>/' >> "$REPORT_FILE" || echo "なし" >> "$REPORT_FILE"
        echo '```' >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
        TOTAL_ISSUES=$((TOTAL_ISSUES + LOCAL_DB))
    fi

    # 必須環境変数の欠落チェック
    MISSING_VARS=""
    for VAR in DATABASE_URL AZURE_SPEECH_KEY ELEVENLABS_API_KEY JWT_SECRET; do
        if ! grep -q "^$VAR=" .env.local 2>/dev/null; then
            MISSING_VARS="$MISSING_VARS\n- $VAR"
        fi
    done

    if [ -n "$MISSING_VARS" ]; then
        echo "### ⚠️ 必須環境変数の欠落" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
        echo -e "$MISSING_VARS" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
    fi
else
    echo "### ⚠️ .env.local ファイルが存在しません" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
fi

if [ "$LOCAL_DB" -eq 0 ]; then
    echo "✅ 環境変数の不整合は検出されませんでした" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
fi

# ============================================================
# 7. API型定義の不整合
# ============================================================
echo "## 7. API型定義の不整合" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "📌 [7/8] API型定義の不整合を検出中..."

# Request/Response型の命名不整合
INCONSISTENT_API_TYPES=$(grep -rn "interface.*Request\|interface.*Response" infrastructure/lambda/*/index.ts apps/web/lib --include="*.ts" 2>/dev/null | grep -v "CreateAvatarRequest\|ListAvatarsResponse\|GetAvatarResponse" | wc -l || echo 0)

if [ "$INCONSISTENT_API_TYPES" -gt 0 ]; then
    echo "### ⚠️ API型定義の命名パターンを確認" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "**検出数:** $INCONSISTENT_API_TYPES 件" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo '```' >> "$REPORT_FILE"
    grep -rn "interface.*Request\|interface.*Response" infrastructure/lambda/*/index.ts apps/web/lib --include="*.ts" 2>/dev/null | head -20 >> "$REPORT_FILE" || echo "なし" >> "$REPORT_FILE"
    echo '```' >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
fi

# ============================================================
# 8. Import文の不整合
# ============================================================
echo "## 8. Import文の不整合" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "📌 [8/8] Import文の不整合を検出中..."

# 共有型を使わず直接定義している箇所
MISSING_SHARED_IMPORT=$(grep -rn "interface User\|interface Avatar\|interface Session" apps/web/lib infrastructure/lambda --include="*.ts" 2>/dev/null | grep -v "from '@prance/shared'" | grep -v "from '../shared/types'" | wc -l || echo 0)

if [ "$MISSING_SHARED_IMPORT" -gt 0 ]; then
    echo "### ❌ 共有型を使わず直接定義" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "**検出数:** $MISSING_SHARED_IMPORT 件" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo '```' >> "$REPORT_FILE"
    grep -rn "interface User\|interface Avatar\|interface Session" apps/web/lib infrastructure/lambda --include="*.ts" 2>/dev/null | grep -v "from '@prance/shared'" | grep -v "from '../shared/types'" | head -20 >> "$REPORT_FILE" || echo "なし" >> "$REPORT_FILE"
    echo '```' >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    TOTAL_ISSUES=$((TOTAL_ISSUES + MISSING_SHARED_IMPORT))
fi

if [ "$MISSING_SHARED_IMPORT" -eq 0 ]; then
    echo "✅ Import文の不整合は検出されませんでした" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
fi

# ============================================================
# サマリー
# ============================================================
echo "" >> "$REPORT_FILE"
echo "---" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "## 📊 サマリー" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "**検出された不整合の総数:** $TOTAL_ISSUES 件" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

if [ "$TOTAL_ISSUES" -eq 0 ]; then
    echo "✅ **不整合は検出されませんでした！**" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "✅ 不整合は検出されませんでした！"
else
    echo "⚠️ **$TOTAL_ISSUES 件の不整合が検出されました。修正が必要です。**" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "⚠️ $TOTAL_ISSUES 件の不整合が検出されました"
fi

echo "### 次のアクション" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "1. このレポートを確認し、優先順位を決定" >> "$REPORT_FILE"
echo "2. 各不整合を修正（自動修正スクリプト利用可能）" >> "$REPORT_FILE"
echo "3. CI/CDパイプラインにこのチェックを統合" >> "$REPORT_FILE"
echo "4. 今後の開発で不整合を防ぐためのガイドライン策定" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# クリーンアップ
rm -rf "$TEMP_DIR"

echo ""
echo "✅ レポートを生成しました: $REPORT_FILE"
echo ""
cat "$REPORT_FILE"
