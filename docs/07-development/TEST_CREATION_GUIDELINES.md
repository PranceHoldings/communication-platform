# テスト作成ガイドライン

**作成日:** 2026-03-11
**カテゴリ:** 開発ガイドライン
**重要度:** 🔴 CRITICAL

---

## 🎯 目的

このドキュメントは、Day 12 E2Eテスト作成時の失敗から学んだ教訓をまとめたものです。
推測によるテスト作成を防ぎ、実装に基づいた正確なテストを作成するためのガイドラインを提供します。

---

## 🔴 絶対厳守ルール

### Rule 1: 推測禁止

**❌ 禁止事項:**
- URLパス・ルート構造を**推測**でテスト作成
- APIエンドポイントを「一般的な慣習」だけで決定
- 実装を読まずにコード作成
- ドキュメントに曖昧な表現（「Scenariosページに移動」等）

**✅ 必須事項:**
- **実装を確認してから**テスト作成
- コードベースが唯一の真実の源
- ドキュメントには具体的なパス・URLを明記

---

## 📋 テスト作成の必須手順

### Step 1: 実装の確認

テストを書く前に、必ず実装を確認します。

```bash
# Next.jsルート確認
find apps/web/app -name "page.tsx" | grep -v node_modules

# 出力例:
# apps/web/app/dashboard/scenarios/page.tsx
# apps/web/app/dashboard/avatars/page.tsx
# apps/web/app/dashboard/sessions/page.tsx
```

```bash
# APIエンドポイント確認
grep -r "router\\.get\|router\\.post" infrastructure/lambda --include="*.ts"

# 出力例:
# router.get('/api/v1/scenarios', ...)
# router.post('/api/v1/scenarios', ...)
```

```bash
# コンポーネント確認
find apps/web/components -name "*.tsx" | grep -i "indicator\|waveform"

# 出力例:
# apps/web/components/session-player/ProcessingIndicator.tsx
# apps/web/components/audio-visualizer/WaveformDisplay.tsx
```

### Step 2: フレームワーク構造の理解

使用しているフレームワークの慣習・パターンを理解します。

#### Next.js App Router の例

**ディレクトリ構造とURL対応:**
```
apps/web/app/
├── (auth)/              → グループ（URLに影響しない）
│   ├── login/
│   │   └── page.tsx    → /login
│   └── register/
│       └── page.tsx    → /register
├── dashboard/
│   ├── page.tsx        → /dashboard
│   ├── scenarios/
│   │   ├── page.tsx    → /dashboard/scenarios
│   │   ├── new/
│   │   │   └── page.tsx → /dashboard/scenarios/new
│   │   └── [id]/
│   │       ├── page.tsx → /dashboard/scenarios/[id]
│   │       └── edit/
│   │           └── page.tsx → /dashboard/scenarios/[id]/edit
│   ├── avatars/        → /dashboard/avatars
│   └── sessions/       → /dashboard/sessions
└── page.tsx            → /
```

**重要な慣習:**
- 認証が必要なページは `/dashboard/` 配下にグループ化
- `(auth)` のような括弧付きディレクトリはURLに影響しない（ルートグループ）
- `[id]` は動的ルート（パラメータ）

### Step 3: テストパスの取得

実装から直接パスを取得します。

```bash
# ルート一覧を生成
find apps/web/app -name "page.tsx" | \
  sed 's|apps/web/app||' | \
  sed 's|/page.tsx||' | \
  sed 's|(auth)/||' | \
  sed 's|^|/|' | \
  sort

# 出力:
# /
# /dashboard
# /dashboard/avatars
# /dashboard/avatars/[id]
# /dashboard/avatars/[id]/edit
# /dashboard/avatars/new
# /dashboard/scenarios
# /dashboard/scenarios/[id]
# /dashboard/scenarios/[id]/edit
# /dashboard/scenarios/new
# /dashboard/sessions
# /dashboard/sessions/[id]
# /dashboard/sessions/new
# /login
# /register
```

### Step 4: ドキュメントへの明記

テストドキュメントには具体的なパスを明記します。

**❌ 悪い例:**
```markdown
1. Scenariosページに移動
2. Avatarsページに移動
```

**✅ 良い例:**
```markdown
### URLパス一覧

- ダッシュボード: `/dashboard`
- シナリオ一覧: `/dashboard/scenarios`
- アバター一覧: `/dashboard/avatars`
- セッション一覧: `/dashboard/sessions`

### テスト手順

1. `/dashboard/scenarios` に移動
2. `/dashboard/avatars` に移動
```

---

## 📚 過去の失敗例と教訓

### Case 1: Day 12 E2Eテスト（2026-03-11）

#### 問題

E2Eテストで以下のパスを使用し、全て404エラー：
- `/scenarios`
- `/avatars`
- `/sessions`

#### 原因

1. **推測による決定**
   - RESTful APIの一般的慣習から推測
   - 実装を確認せずにテストパス決定

2. **ドキュメントの不備**
   - DAY_12_E2E_TEST_REPORT.md に「Scenariosに移動」と曖昧に記載
   - 具体的なURLパスが明記されていない

3. **フレームワーク理解不足**
   - Next.js App Routerの慣習を理解していなかった
   - 認証必要ページは `/dashboard/` 配下にグループ化される設計

#### 正解

実装を確認した結果、正しいパスは：
- `/dashboard/scenarios`
- `/dashboard/avatars`
- `/dashboard/sessions`

#### 確認方法

```bash
find apps/web/app -name "page.tsx" | grep scenarios
# → apps/web/app/dashboard/scenarios/page.tsx
```

#### 教訓

1. **推測は必ず失敗する** - コードが唯一の真実
2. **実装確認を最初に行う** - テスト作成の第一歩
3. **ドキュメントに具体的パスを明記** - 曖昧な表現は禁止
4. **フレームワークの慣習を理解** - 設計パターンを学ぶ

---

## 🛠️ 実践的なワークフロー

### 新規E2Eテスト作成時

```bash
# 1. プロジェクト構造を理解
tree -L 3 apps/web/app

# 2. ルート一覧を生成
find apps/web/app -name "page.tsx" | sed 's|apps/web/app||' | sed 's|/page.tsx||'

# 3. テストドキュメントにパス一覧を追加
echo "## URLパス一覧" > test-paths.md
find apps/web/app -name "page.tsx" | \
  sed 's|apps/web/app||' | \
  sed 's|/page.tsx||' | \
  sed 's|(auth)/||' | \
  sed 's|^|- `|' | \
  sed 's|$|`|' >> test-paths.md

# 4. テストスクリプト作成
# （上記パス一覧を参照してテスト作成）

# 5. 実行前の最終確認
grep -o '"/[^"]*"' test-script.js | \
  xargs -I {} sh -c 'curl -s -o /dev/null -w "{}  HTTP %{http_code}\n" http://localhost:3000{}'
```

### 新規APIテスト作成時

```bash
# 1. Lambda関数のルート確認
grep -rn "router\\.get\|router\\.post\|router\\.put\|router\\.delete" \
  infrastructure/lambda --include="*.ts" -A 2

# 2. エンドポイント一覧を生成
grep -rh "router\\." infrastructure/lambda --include="*.ts" | \
  grep -o "'/api/[^']*'" | \
  sort -u > api-endpoints.txt

# 3. 実際のエンドポイントテスト
cat api-endpoints.txt | while read path; do
  echo "Testing $path"
  curl -s -w "HTTP %{http_code}\n" "https://your-api.com$path"
done
```

---

## ✅ チェックリスト

テスト作成時に以下を確認してください：

### 実装確認
- [ ] `find` コマンドでルート/エンドポイントを確認した
- [ ] 実際のファイルパスを確認した
- [ ] フレームワークの構造を理解した

### テスト作成
- [ ] 実装に基づいてテストパスを決定した
- [ ] 推測でパスを決定していない
- [ ] 動的ルート（`[id]`）の扱いを理解した

### ドキュメント
- [ ] 具体的なURLパスを明記した
- [ ] 曖昧な表現を使用していない
- [ ] パス一覧セクションを追加した

### 検証
- [ ] テスト実行前にパスをブラウザで確認した
- [ ] 404エラーが発生しないことを確認した
- [ ] 認証が必要なページの扱いを理解した

---

## 📖 参考資料

### 内部ドキュメント
- [CLAUDE.md - Rule 4: テスト・実装確認の原則](../../CLAUDE.md)
- [MEMORY.md - Rule 1: テスト・実装確認の原則](/home/vscode/.claude/projects/-workspaces-prance-communication-platform/memory/MEMORY.md)
- [DAY_12_E2E_TEST_REPORT.md](../09-progress/phases/DAY_12_E2E_TEST_REPORT.md)

### フレームワークドキュメント
- [Next.js App Router - Routing](https://nextjs.org/docs/app/building-your-application/routing)
- [Next.js App Router - Route Groups](https://nextjs.org/docs/app/building-your-application/routing/route-groups)
- [Next.js App Router - Dynamic Routes](https://nextjs.org/docs/app/building-your-application/routing/dynamic-routes)

---

## 🔄 継続的改善

このガイドラインは、新しい失敗例や教訓が発見されたら随時更新します。

**更新履歴:**
- 2026-03-11: 初版作成（Day 12 E2Eテストの教訓）

**次回更新予定:**
- APIテスト作成時の追加事例
- WebSocketテスト特有の注意点
- パフォーマンステスト作成ガイドライン

---

**最終更新:** 2026-03-11
**次回レビュー:** Day 13 テスト作成時
