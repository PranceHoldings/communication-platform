#!/bin/bash
# prepare.sh - DEPRECATED: このスクリプトは廃止されました
#
# 理由: npm prepare hookとの循環依存によりinstallが失敗する問題
#
# 代わりに以下を使用してください:
#   - フルビルド + デプロイ: ./deploy.sh dev
#   - クリーンビルド + デプロイ: ./clean-deploy.sh dev
#   - デプロイのみ: ./deploy-simple.sh dev

set -e

# 色付き出力
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${RED}⚠️  警告: prepare.shは廃止されました${NC}"
echo "=============================================="
echo ""
echo -e "${YELLOW}このスクリプトはnpm prepare hookとの循環依存により廃止されました。${NC}"
echo ""
echo "以下のコマンドを使用してください:"
echo ""
echo "  フルビルド + デプロイ:"
echo "    ./deploy.sh dev"
echo ""
echo "  クリーンビルド + デプロイ:"
echo "    ./clean-deploy.sh dev"
echo ""
echo "  デプロイのみ（ビルド済み前提）:"
echo "    ./deploy-simple.sh dev"
echo ""
echo "=============================================="
exit 1
