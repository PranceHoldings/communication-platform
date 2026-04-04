#!/bin/bash

# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

log_info "Rolling back from pnpm to npm..."

# pnpmファイル削除
rm -f pnpm-workspace.yaml
rm -f pnpm-lock.yaml
rm -rf node_modules
rm -rf packages/*/node_modules
rm -rf apps/*/node_modules
rm -rf infrastructure/node_modules

# npmrcを元に戻す
cat > .npmrc << 'EOF'
# シンボリックリンク無効化（DevContainer環境で推奨）
package-lock=true
prefer-dedupe=true

# キャッシュ設定
cache=/tmp/npm-cache

# ログレベル
loglevel=warn
EOF

# package.jsonを元に戻す（overrides, engines）
log_info "Restoring package.json..."

python3 << 'PYTHON_EOF'
import json

with open('package.json', 'r') as f:
    data = json.load(f)

# pnpm.overrides → overrides
if 'pnpm' in data and 'overrides' in data['pnpm']:
    data['overrides'] = data['pnpm']['overrides']
    del data['pnpm']

# engines.pnpm → engines.npm
if 'engines' in data and 'pnpm' in data['engines']:
    data['engines']['npm'] = '>=10.0.0'
    del data['engines']['pnpm']

# packageManagerを削除
if 'packageManager' in data:
    del data['packageManager']

with open('package.json', 'w') as f:
    json.dump(data, f, indent=2)

print("✅ package.json restored")
PYTHON_EOF

# npmに戻す
if [ -f "package-lock.json.backup-before-pnpm" ]; then
    cp package-lock.json.backup-before-pnpm package-lock.json
    log_success "package-lock.json restored from backup"
else
    log_warning "No backup found, running npm install..."
fi

npm install

log_success "Rollback complete. npm restored."
