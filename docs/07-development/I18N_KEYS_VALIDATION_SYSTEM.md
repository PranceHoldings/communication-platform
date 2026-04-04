# i18n Translation Keys Validation System

**作成日:** 2026-03-22
**目的:** 翻訳キーの欠落を100%防止する自動検証システム
**関連:** [MULTILINGUAL_SYSTEM.md](../05-modules/MULTILINGUAL_SYSTEM.md)

---

## 🎯 概要

このシステムは、翻訳キーが全言語で同期されていることを**ビルド時・コミット時に自動検証**し、欠落を100%防止します。

## 🔴 問題の背景

**以前の問題:**
- 開発者がen/common.jsonに新しいキー（例: `connectionStatus.reconnectFailed`）を追加
- 他の9言語（ja, zh-CN, zh-TW, ko, es, pt, fr, de, it）への追加を忘れる
- UIで `connectionStatus.reconnectFailed` がそのまま表示される（翻訳されない）
- ドキュメントだけでは防げない（人間のミスは必ず発生する）

**解決策:**
- ビルドプロセス・pre-commit hookで自動検証
- 欠落キーを自動検出・自動修正
- コミット・デプロイをブロック

---

## 📦 システム構成

### 1. 検証スクリプト

**ファイル:** `scripts/validate-i18n-keys.js`

**機能:**
- ベース言語（英語）と全言語のキーを比較
- 欠落キーを検出・レポート
- `--fix` フラグでプレースホルダーを自動生成

**使用方法:**

```bash
# 検証のみ（エラーがあれば exit 1）
node scripts/validate-i18n-keys.js

# 自動修正（プレースホルダー生成）
node scripts/validate-i18n-keys.js --fix
```

**出力例:**

```
[INFO] Starting i18n keys validation...
[INFO] Base language: en
[INFO] Found 10 languages: de, en, es, fr, it, ja, ko, pt, zh-CN, zh-TW

[INFO] Validating de...
[ERROR]   common.json: 6 missing keys
    - connectionStatus.disconnected
    - connectionStatus.connecting
    - connectionStatus.connected
    - connectionStatus.reconnecting
    - connectionStatus.reconnectFailed
    - connectionStatus.error

[INFO] Applying fixes...
[SUCCESS]   Fixed: de/common.json
[SUCCESS]   Fixed: es/common.json
...

[WARN] IMPORTANT: Auto-generated placeholders need proper translations!
Please update the following files with correct translations:
  - de/common.json
  - es/common.json
  ...
```

### 2. ビルドプロセス統合

**ファイル:** `apps/web/package.json`

```json
{
  "scripts": {
    "prebuild": "node ../../scripts/validate-i18n-keys.js",
    "build": "next build",
    "i18n:validate": "node ../../scripts/validate-i18n-keys.js",
    "i18n:fix": "node ../../scripts/validate-i18n-keys.js --fix"
  }
}
```

**効果:**
- `pnpm run build` 実行時、自動的に i18n 検証が実行される
- 欠落キーがあればビルドが失敗（CI/CDで検出）

### 3. Pre-commit Hook統合

**ファイル:** `scripts/git-hooks/pre-commit`

```bash
# Check 7: i18n Translation Keys Sync (CRITICAL - 2026-03-22)
echo -e "${YELLOW}[7/7]${NC} Validating i18n translation keys sync..."
STAGED_I18N_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E 'apps/web/messages/.*\.json$' || true)

if [ -n "$STAGED_I18N_FILES" ]; then
  if node scripts/validate-i18n-keys.js > /dev/null 2>&1; then
    echo -e "${GREEN}✅ All translation keys are synchronized${NC}"
  else
    echo -e "${RED}❌ Translation keys are not synchronized${NC}"
    echo "Run: cd apps/web && pnpm run i18n:validate"
    echo "Auto-fix: cd apps/web && pnpm run i18n:fix"
    CHECKS_FAILED=1
  fi
else
  echo -e "${GREEN}✅ No translation files modified${NC}"
fi
```

**効果:**
- 翻訳ファイルを変更してコミットしようとした時、自動検証
- 欠落キーがあればコミットがブロックされる

---

## 🚀 開発ワークフロー

### シナリオ1: 新しい翻訳キーを追加

**Step 1: 英語（ベース言語）に追加**

```json
// apps/web/messages/en/common.json
{
  "connectionStatus": {
    "disconnected": "Disconnected",
    "connecting": "Connecting...",
    "connected": "Connected",
    "reconnecting": "Reconnecting... ({attempt}/{maxAttempts})",
    "reconnectFailed": "Failed to reconnect after {attempts} attempts. Please refresh the page.",  // 新規追加
    "error": "Connection Error"
  }
}
```

**Step 2: 自動修正を実行**

```bash
cd apps/web
pnpm run i18n:fix
```

**結果:**
- 全言語にプレースホルダーが自動生成される
- 例: `"reconnectFailed": "[ZH-CN: reconnectFailed]"`

**Step 3: 適切な翻訳を追加**

```json
// apps/web/messages/ja/common.json
{
  "connectionStatus": {
    ...
    "reconnectFailed": "{attempts}回の再接続試行後に失敗しました。ページを更新してください。"
  }
}

// apps/web/messages/zh-CN/common.json
{
  "connectionStatus": {
    ...
    "reconnectFailed": "经过{attempts}次重试后连接失败。请刷新页面。"
  }
}
```

**Step 4: 検証**

```bash
pnpm run i18n:validate
```

**Step 5: コミット**

```bash
git add apps/web/messages
git commit -m "feat(i18n): add reconnectFailed translation key"
```

- Pre-commit hookが自動実行
- 全言語が同期されていれば、コミット成功

### シナリオ2: コミット時に欠落キーを検出

**状況:**
- en/common.json に新キーを追加
- 他言語への追加を忘れてコミット

**実行:**

```bash
git add apps/web/messages/en/common.json
git commit -m "feat(i18n): add new key"
```

**結果:**

```
[7/7] Validating i18n translation keys sync...
❌ Translation keys are not synchronized
Run: cd apps/web && pnpm run i18n:validate
Auto-fix: cd apps/web && pnpm run i18n:fix

❌ Pre-commit checks failed
Fix the issues before committing.
```

**対処:**

```bash
cd apps/web
pnpm run i18n:fix
# プレースホルダーが生成される

# 適切な翻訳を追加
vim messages/ja/common.json
vim messages/zh-CN/common.json
...

# 再度コミット
git add apps/web/messages
git commit -m "feat(i18n): add new key with translations"
```

### シナリオ3: ビルド時に欠落キーを検出（CI/CD）

**GitHub Actions等のCI/CD環境:**

```yaml
- name: Build Frontend
  run: |
    cd apps/web
    pnpm run build  # prebuild で自動検証
```

**欠落キーがある場合:**
- ビルドが失敗
- CI/CDパイプラインがブロック
- プルリクエストがマージできない

---

## 🛠️ トラブルシューティング

### 問題1: スクリプトが実行されない

**症状:**

```bash
bash: scripts/validate-i18n-keys.js: Permission denied
```

**解決:**

```bash
chmod +x scripts/validate-i18n-keys.js
```

### 問題2: プレースホルダーが残ったままコミットされる

**症状:**
- `[ZH-CN: reconnectFailed]` などがコミットされる

**原因:**
- `pnpm run i18n:fix` 実行後、適切な翻訳を追加していない

**解決:**
- 全言語に適切な翻訳を追加
- `pnpm run i18n:validate` で検証（プレースホルダーは検出されない）
- コードレビューで検出

**推奨:**
- プレースホルダー検出スクリプトの追加（将来の改善）

### 問題3: 特定言語のキーが重複している

**症状:**

```json
{
  "connectionStatus": {
    "error": "Error 1",
    "error": "Error 2"  // 重複
  }
}
```

**原因:**
- 手動編集時のミス
- JSON構文エラー

**解決:**
- JSONファイルのバリデーション（ESLint/Prettier）
- 重複キー検出スクリプトの追加（将来の改善）

---

## 📊 検証統計

**現在の状態（2026-03-22時点）:**

| 言語   | common.json | scenarios.json | sessions.json | 総キー数 |
| ------ | ----------- | -------------- | ------------- | -------- |
| en     | 70          | 35             | 42            | 147      |
| ja     | 70          | 35             | 42            | 147      |
| zh-CN  | 70          | 35             | 42            | 147      |
| zh-TW  | 70          | 35             | 42            | 147      |
| ko     | 70          | 35             | 42            | 147      |
| es     | 70          | 35             | 42            | 147      |
| pt     | 70          | 35             | 42            | 147      |
| fr     | 70          | 35             | 42            | 147      |
| de     | 70          | 35             | 42            | 147      |
| it     | 70          | 35             | 42            | 147      |
| **合計** | **700**     | **350**        | **420**       | **1470** |

**同期率:** 100% ✅

---

## 🔮 将来の改善

### 1. プレースホルダー検出

**目的:** `[ZH-CN: key]` 形式のプレースホルダーが残っていないか検出

**実装:**

```bash
grep -r "\[.*: .*\]" apps/web/messages --include="*.json"
```

### 2. 翻訳品質チェック

**目的:** 機械翻訳を検出、または翻訳の一貫性をチェック

**実装案:**
- Google Translate API統合
- 翻訳メモリ（TM）システム

### 3. 動的プレースホルダー検証

**目的:** `{attempt}`, `{maxAttempts}` などのプレースホルダーが全言語で一致するか検証

**実装:**

```javascript
const enText = "Reconnecting... ({attempt}/{maxAttempts})";
const jaText = "再接続中... ({attempt}/{maxAttempts})";

// Extract placeholders
const enPlaceholders = enText.match(/\{[^}]+\}/g); // ['{attempt}', '{maxAttempts}']
const jaPlaceholders = jaText.match(/\{[^}]+\}/g); // ['{attempt}', '{maxAttempts}']

// Validate
if (JSON.stringify(enPlaceholders.sort()) !== JSON.stringify(jaPlaceholders.sort())) {
  console.error('Placeholder mismatch');
}
```

### 4. VSCode拡張

**目的:** リアルタイムで翻訳キーの欠落を検出

**機能:**
- i18n キー補完
- 欠落キーのハイライト
- 翻訳プレビュー

---

## 📚 関連ドキュメント

- [MULTILINGUAL_SYSTEM.md](../05-modules/MULTILINGUAL_SYSTEM.md) - 多言語対応システム全体
- [I18N_SYSTEM_GUIDELINES.md](I18N_SYSTEM_GUIDELINES.md) - i18n実装ガイドライン
- [CODING_RULES.md](../../CODING_RULES.md) - コミット前チェックリスト

---

**最終更新:** 2026-03-22
**次回レビュー:** 新規言語追加時
