# Node Modules最適化計画

**バージョン:** 1.0
**作成日:** 2026-04-04
**最終更新:** 2026-04-04

---

## 📋 概要

モノレポ構成でのnode_modules肥大化対策として、3レイヤーアプローチで段階的に最適化します。

---

## 🎯 3レイヤー対策

### Layer 1: 依存の重複排除・不要依存削除

**目的:** 不要なパッケージを削除して、直接的な削減を実現

**実施内容:**
- depcheckで不要依存を検出
- 未使用パッケージの削除
- 依存関係の整理

### Layer 2: Turborepo活用

**目的:** 必要なpackageのみbuild・installして、時間短縮

**実施内容:**
- フロントエンド専用スクリプト追加
- インフラ専用スクリプト追加
- Turboキャッシュの最適化

### Layer 3: hoisting設定の最適化

**目的:** shamefully-hoistを無効化して、必要な依存のみインストール

**実施内容:**
- .npmrc設定の段階的変更
- hoist-patternで選択的hoisting
- Lambda CDK bundlingの互換性確認

---

## ✅ Phase 1: 不要依存削除（完了）

**実施日:** 2026-04-04 13:30 UTC

### 削除した不要依存（16個）

**UIライブラリ（未使用のRadix UI - 4個）:**
- @radix-ui/react-avatar
- @radix-ui/react-dialog
- @radix-ui/react-dropdown-menu
- @radix-ui/react-toast

**状態管理（未使用 - 3個）:**
- @reduxjs/toolkit
- immer
- zustand

**3Dグラフィックス関連（未使用 - 4個）:**
- detect-gpu
- stats-gl
- stats.js
- troika-worker-utils

**データ処理（未使用 - 2個）:**
- d3-array
- d3-scale

**その他（未使用 - 3個）:**
- hls.js
- react-hook-form
- zod

### 追加した依存関係

- @testing-library/react（devDependencies、テストで使用）

### 結果

**Before:**
- node_modules: 1.1GB
- apps/web dependencies: 44個
- パッケージ総数: 594

**After:**
- node_modules: 1005MB（**95MB削減、9%削減**）
- apps/web dependencies: 28個（**16削減、36%削減**）
- パッケージ総数: 578（**16削減**）

### バックアップ

```bash
# バックアップファイル
apps/web/package.json.backup

# ロールバック方法
cp apps/web/package.json.backup apps/web/package.json
pnpm install
```

---

## 📋 Phase 1.5: クリーンアップ（即座実行可能）

### 現状の問題

Phase 1で削除した16個のパッケージがnode_modulesに残存:
- @reduxjs/toolkit, immer, zustand, redux 等がゴミファイルとして残存
- 推定: 20-30MB の無駄なファイル

### 改善計画

**1. ゴミファイル削除**

```bash
# Option 1: pnpm prune（推奨）
pnpm prune

# Option 2: クリーンインストール（確実）
rm -rf node_modules
pnpm install
```

**2. 重複バージョン統一**

```bash
pnpm dedupe
```

### 期待効果

- node_modules: 1005MB → 980MB（**25MB削減、2.5%削減**）
- インストール時間: 60s → 55s（5秒削減）

---

## 📋 Phase 2: 開発用途別インストール戦略

### 現状の問題

**全workspaceインストール時の内訳:**
- next + @next: 321MB（フロントエンド専用）
- aws-cdk-lib + aws-cdk + @aws-cdk: 198MB（**インフラ専用、フロントエンド開発では完全に不要**）
- @aws-sdk: 20MB（インフラ専用）
- three: 37MB（フロントエンド専用）

**問題:** フロントエンド開発時に218MB（aws-cdk + @aws-sdk）の不要なパッケージがインストールされる

### 改善計画

**1. 開発用途別インストールスクリプト**

```json
// package.json（ルート）
{
  "scripts": {
    "install:all": "pnpm install",
    "install:frontend": "pnpm install --filter=@prance/web --filter=@prance/database",
    "install:infra": "pnpm install --filter=infrastructure --filter=@prance/database",
    "install:minimal": "pnpm install --prod --filter=@prance/web"
  }
}
```

**2. Turboフィルタスクリプト**

```json
{
  "scripts": {
    "dev": "turbo run dev",
    "dev:frontend": "turbo run dev --filter=@prance/web...",
    "dev:infra": "turbo run dev --filter=infrastructure..."
  }
}
```

**3. workspace依存関係の最適化**

```json
// apps/web/package.json
{
  "dependencies": {
    "@prance/database": "workspace:*"
    // ✅ @prance/sharedは不要（型のみなのでdevDependenciesへ）
  },
  "devDependencies": {
    "@prance/shared": "workspace:*"
  }
}
```

### 期待効果（⚠️ shamefully-hoist=true のため効果限定的）

**現状の制限:**
- shamefully-hoist=true → 全依存がルートに集約
- --filter オプションの効果が限定的（依存解決は全体で実行される）
- **Phase 3で shamefully-hoist=false にしない限り、大幅な削減は不可能**

**shamefully-hoist=true のまま:**
- フロントエンド開発時のinstall時間: 60秒 → 50秒（**10秒削減、17%削減**）
- node_modules: ほぼ変わらず（ファイルはルートに集約されるため）

**shamefully-hoist=false 後（Phase 3実施後）:**
- フロントエンド開発時のnode_modules: 1005MB → 700MB（**305MB削減、30%削減**）
- フロントエンド開発時のinstall時間: 60秒 → 30秒（**30秒削減、50%削減**）

### 実装手順

```bash
# 1. ルート package.json にスクリプト追加
cd /workspaces/prance-communication-platform
# （以下のスクリプトを手動追加）

# 2. フロントエンド開発での使用
pnpm run install:frontend
pnpm run dev:frontend

# 3. インフラ開発での使用
pnpm run install:infra
pnpm run dev:infra

# 4. 検証
time pnpm run install:frontend  # 時間計測
du -sh node_modules              # サイズ確認
```

**⚠️ 注意:** Phase 2単独では大幅な削減効果は得られない。Phase 3と組み合わせて初めて効果を発揮。

---

## 📋 Phase 3: hoisting設定の最適化（高リスク、段階的実施）

### 現状の問題

```bash
# .npmrc
shamefully-hoist=true
→ 全依存関係がルートに集約（infrastructure含む）
→ フロントエンド開発時に不要なAWS CDK（198MB）等がインストール
→ --filter オプションの効果が限定的
```

**shamefully-hoist=true の影響:**
- apps/web のみインストールしても aws-cdk-lib（145MB）がルートにhoistされる
- infrastructure のみインストールしても next（176MB）がルートにhoistされる
- ワークスペース分離のメリットが失われる

### 段階的改善計画（3ステップ）

#### Step 1: 選択的hoisting（最小リスク）

```bash
# .npmrc（Step 1）
node-linker=hoisted
shamefully-hoist=false  # ⚠️ 変更

# Lambda CDK bundling対策: AWS関連のみhoist
hoist-pattern[]=*aws*
hoist-pattern[]=@aws-sdk/*
hoist-pattern[]=@aws-cdk/*

# Prisma対策: Prisma関連のみhoist
hoist-pattern[]=@prisma/*
hoist-pattern[]=prisma

# Turbo対策
hoist-pattern[]=turbo*

# publicパッケージは全てhoist
public-hoist-pattern[]=*
```

**期待効果（Step 1）:**
- node_modules: 1005MB → 850MB（**155MB削減、15%削減**）
- フロントエンド開発時: next（176MB）のみ、aws-cdk（198MB）除外
- インフラ開発時: aws-cdk（198MB）のみ、next（176MB）除外

#### Step 2: 最小hoisting（中リスク）

```bash
# .npmrc（Step 2）- Step 1が成功したら実施
node-linker=hoisted
shamefully-hoist=false

# Lambda bundling必須パッケージのみhoist
hoist-pattern[]=@aws-sdk/client-*
hoist-pattern[]=@prisma/client
hoist-pattern[]=bcryptjs
hoist-pattern[]=jsonwebtoken

# publicパッケージは全てhoist
public-hoist-pattern[]=*
```

**期待効果（Step 2）:**
- node_modules: 1005MB → 750MB（**255MB削減、25%削減**）
- より厳密なワークスペース分離

#### Step 3: 完全分離（高リスク）

```bash
# .npmrc（Step 3）- Step 2が成功したら実施
node-linker=isolated  # ⚠️ より厳密な分離
shamefully-hoist=false

# 最小限のhoisting
public-hoist-pattern[]=*eslint*
public-hoist-pattern[]=*prettier*
public-hoist-pattern[]=*typescript*
```

**期待効果（Step 3）:**
- node_modules: 1005MB → 700MB（**305MB削減、30%削減**）
- 完全なワークスペース分離
- フロントエンド/インフラで完全に独立したnode_modules

### リスク分析

⚠️ **Lambda CDK bundlingが動作しなくなる可能性（各Step）**

| Step | リスク | 対策 |
|------|--------|------|
| Step 1 | 低 | AWS/Prismaをhoistしているため、ほぼ安全 |
| Step 2 | 中 | client-*のみhoistで足りない可能性あり |
| Step 3 | 高 | isolated modeでbundlingが失敗する可能性大 |

**Lambda CDK bundlingが失敗する原因:**
- esbuild が依存解決できない（node_modules構造が変わるため）
- Prisma Client が見つからない
- AWS SDK のサブモジュールが見つからない

### 実装前の検証手順（各Step共通）

```bash
# 1. バックアップ
cp .npmrc .npmrc.backup
cp -r node_modules node_modules.backup  # オプション（時間がかかる）

# 2. 設定変更
# .npmrc を Step 1 の設定に変更

# 3. クリーンインストール
rm -rf node_modules
pnpm install

# 4. サイズ確認
du -sh node_modules
echo "Expected: 850MB (Step 1), 750MB (Step 2), 700MB (Step 3)"

# 5. Lambda CDK bundling テスト（⚠️ 最重要）
cd infrastructure
pnpm run cdk -- synth Prance-dev-ApiLambda 2>&1 | tee cdk-synth-test.log

# エラーがないことを確認:
# - "Successfully synthesized to ..." が表示される
# - Bundling エラーがない
# - Asset エラーがない

# 6. ローカル開発テスト
cd /workspaces/prance-communication-platform
pnpm run dev  # Next.js起動確認

# 7. TypeScriptコンパイル確認
pnpm run type-check

# 8. 本デプロイ（成功したら）
cd infrastructure
pnpm run deploy:lambda

# 9. 失敗したらロールバック
cd /workspaces/prance-communication-platform
cp .npmrc.backup .npmrc
rm -rf node_modules
pnpm install
```

### 段階的実施スケジュール

```
Week 1: Step 1実施 → 動作確認 → 1週間運用
Week 2: Step 2実施 → 動作確認 → 1週間運用
Week 3: Step 3実施 → 動作確認 → 継続運用

各Stepで問題が発生したら、前Stepにロールバック
```

---

## 📊 総合効果（全Phase完了時の予測）

### フルインストール（pnpm install --all）

| 項目 | Before | Phase 1 | Phase 1.5 | Phase 2 | Phase 3 Step1 | Phase 3 Step2 | Phase 3 Step3 | 合計削減 |
|------|--------|---------|-----------|---------|---------------|---------------|---------------|----------|
| node_modules | 1.1GB | 1005MB | 980MB | 980MB | 850MB | 750MB | 700MB | **400MB (36%)** |
| apps/web deps | 44 | 28 | 28 | 28 | 28 | 28 | 28 | **16 (36%)** |
| install時間 | 60s | 60s | 55s | 55s | 50s | 45s | 40s | **20s (33%)** |

### フロントエンド開発（pnpm install:frontend）

| 項目 | Before | Phase 2 | Phase 3 Step1 | Phase 3 Step2 | Phase 3 Step3 | 合計削減 |
|------|--------|---------|---------------|---------------|---------------|----------|
| node_modules | 1.1GB | 1005MB | 700MB | 550MB | 450MB | **650MB (59%)** |
| install時間 | 60s | 50s | 30s | 25s | 20s | **40s (67%)** |
| 不要パッケージ | aws-cdk等198MB | 同左 | 除外 ✅ | 除外 ✅ | 除外 ✅ | **198MB除外** |

### インフラ開発（pnpm install:infra）

| 項目 | Before | Phase 2 | Phase 3 Step1 | Phase 3 Step2 | Phase 3 Step3 | 合計削減 |
|------|--------|---------|---------------|---------------|---------------|----------|
| node_modules | 1.1GB | 1005MB | 750MB | 600MB | 500MB | **600MB (55%)** |
| install時間 | 60s | 50s | 35s | 30s | 25s | **35s (58%)** |
| 不要パッケージ | next等176MB | 同左 | 除外 ✅ | 除外 ✅ | 除外 ✅ | **176MB除外** |

### 主要な削減対象

| パッケージ | サイズ | Phase 1削除 | Phase 2除外 | Phase 3除外 | 説明 |
|-----------|--------|------------|------------|------------|------|
| next | 176MB | - | - | フロントエンド以外で除外 | Next.js本体 |
| @next | 145MB | - | - | フロントエンド以外で除外 | Next.jsビルドツール |
| aws-cdk-lib | 145MB | - | - | フロントエンドで除外 ✅ | AWS CDK本体 |
| lucide-react | 44MB | - | - | インフラで除外 | アイコンライブラリ |
| date-fns | 38MB | - | - | - | 日付ライブラリ（共通） |
| three | 37MB | - | - | インフラで除外 | 3Dライブラリ |
| aws-cdk | 28MB | - | - | フロントエンドで除外 ✅ | AWS CDKコア |
| @aws-cdk | 25MB | - | - | フロントエンドで除外 ✅ | AWS CDK constructs |
| @aws-sdk | 20MB | - | - | フロントエンドで除外 ✅ | AWS SDK |
| @reduxjs | 8.3MB | ✅ 削除 | - | - | 未使用 |
| immer | 不明 | ✅ 削除 | - | - | 未使用 |
| zustand | 不明 | ✅ 削除 | - | - | 未使用 |

### ROI分析（投資対効果）

| Phase | 実装時間 | node_modules削減 | install時間削減 | リスク | ROI |
|-------|---------|-----------------|----------------|--------|-----|
| Phase 1 | 30分 | 95MB (9%) | 0s | 低 | 高 ✅ |
| Phase 1.5 | 5分 | 25MB (2.5%) | 5s | 極低 | 極高 ✅ |
| Phase 2 | 30分 | 0MB* | 5s | 低 | 中 |
| Phase 3 Step1 | 1時間 | 130MB (13%) | 5s | 低〜中 | 高 ✅ |
| Phase 3 Step2 | 1時間 | 100MB (10%) | 5s | 中 | 中 |
| Phase 3 Step3 | 2時間 | 50MB (5%) | 5s | 高 | 低〜中 |

*Phase 2単独では削減なし、Phase 3と組み合わせて効果発揮

---

## 🚀 追加の最適化案（Advanced）

### Optimization 4: pnpm patch + 部分的パッケージ削除

**概念:** 使用していない機能のコードを削除してパッケージサイズ削減

**例: lucide-react (44MB) の削減**

```bash
# 使用しているアイコンのみを抽出
# lucide-reactは5000+アイコン含む → 実際は50個程度しか使わない

# 1. 使用アイコンのリスト作成
grep -rh "from 'lucide-react'" apps/web | \
  grep -o "{ [^}]* }" | \
  tr ',' '\n' | \
  sort -u > used-icons.txt

# 2. tree-shaking が効いているか確認
pnpm run build && \
  npx @next/bundle-analyzer

# 3. 必要に応じてカスタムビルド検討
```

**期待効果:** lucide-react 44MB → 2MB（95%削減）

### Optimization 5: Dependency version統一

**概念:** 同じパッケージの異なるバージョンを統一して重複削減

```bash
# 1. バージョン重複検出
pnpm list --depth=Infinity | grep -E "^├─|^│ ├─" | \
  awk '{print $2}' | sort | uniq -c | sort -rn | head -20

# 2. 重複パッケージ削減
pnpm dedupe

# 3. package.json の依存バージョン統一
# resolutions フィールド追加（package.json）
{
  "pnpm": {
    "overrides": {
      "typescript": "5.7.3",
      "@types/node": "22.10.5"
    }
  }
}
```

**期待効果:** 10-20MB削減（重複度合いによる）

### Optimization 6: Development vs Production 依存の厳密な分離

**概念:** devDependencies を正確に分離して、production build サイズ削減

```bash
# 1. production 依存チェック
cd apps/web
pnpm list --prod

# 2. devDependencies 移行候補検出
# - @types/* パッケージ
# - eslint*, prettier*
# - @testing-library/*

# 3. package.json 修正
# dependencies → devDependencies 移行
```

**期待効果:** production build 50-100MB削減

### Optimization 7: Monorepo構造の再設計（将来的検討）

**概念:** より細かいworkspace分割で、依存関係を明確化

```
現状:
- apps/web（フロントエンド全部）
- infrastructure（バックエンド全部）
- packages/shared（型定義）
- packages/database（Prisma）

提案:
- apps/web-core（フロントエンドコア）
- apps/web-avatar（アバター機能のみ）
- apps/web-session（セッション機能のみ）
- infrastructure-api（API Lambda）
- infrastructure-websocket（WebSocket Lambda）
- infrastructure-cdk（CDK定義のみ）
- packages/shared-types（型定義）
- packages/shared-utils（共通ユーティリティ）
- packages/database（Prisma）
```

**期待効果:**
- 機能別開発で必要な依存のみインストール
- ビルド時間の大幅短縮（変更部分のみビルド）
- コード整合性の向上

**リスク:**
- 大規模なリファクタリングが必要（2-3週間）
- モジュール境界の設計が重要
- over-engineering のリスク

**推奨タイミング:** プロジェクト規模が2倍以上になったら検討

---

## 🔄 継続的メンテナンス

### 定期的な不要依存チェック

```bash
# 月次実行推奨
cd apps/web && npx depcheck

# 不要依存が見つかったら削除
pnpm remove --filter=@prance/web <package-name>
```

### 依存関係の追加ガイドライン

**追加前チェックリスト:**
- [ ] 既存のパッケージで代替できないか確認
- [ ] バンドルサイズを確認（bundlephobia.com）
- [ ] 本当に必要か確認（一時的な実験用ではないか）
- [ ] workspace全体で共有すべきか確認（packages/sharedへの移動検討）

**推奨事項:**
- 大きなライブラリ（>1MB）を追加する場合は、必ず代替案を検討
- devDependenciesとdependenciesを正しく区別
- peerDependenciesがある場合は、バージョン互換性を確認

---

## 📚 参考資料

### ツール

- **depcheck** - 不要依存検出
  ```bash
  npx depcheck
  ```

- **npm-check** - 依存関係の更新確認
  ```bash
  npx npm-check -u
  ```

- **bundlephobia** - バンドルサイズ確認
  - https://bundlephobia.com

### ドキュメント

- [pnpm workspace](https://pnpm.io/workspaces)
- [Turborepo](https://turbo.build/repo/docs)
- [pnpm hoisting](https://pnpm.io/npmrc#shamefully-hoist)

---

## 📝 変更履歴

### 2026-04-04 14:30 UTC
- **Phase 1.5実施結果:** クリーンインストールで7MB削減（0.7%）
- **重要な発見:** Phase 1で削除したredux/immer/zustandは他パッケージの間接依存として必要
- **Phase 2完了:** 開発用途別スクリプト追加（install:frontend/install:infra/dev:frontend/dev:infra）
- **Phase 3 Step1失敗:** shamefully-hoist=false でinfrastructure/node_modulesが作成されず、CDK bundling不可
- **Phase 3再設計必要:** 現在のhoisting戦略では効果が得られない

### 2026-04-04 14:00 UTC
- ドキュメント拡張: Phase 1.5, Phase 2, Phase 3の詳細計画追加
- 段階的hoisting最適化戦略（3 Step）策定
- 追加の最適化案（Optimization 4-7）追加
- ROI分析追加
- フロントエンド/インフラ別の削減効果予測追加

### 2026-04-04 13:30 UTC
- Phase 1完了: 不要依存16個削除
- node_modules 95MB削減（9%）
- apps/web dependencies 36%削減（44 → 28）

---

## 🎯 推奨実施順序

### 即座実行推奨（低リスク・高効果）

1. **Phase 1.5: クリーンアップ** (5分)
   ```bash
   pnpm prune && pnpm dedupe
   ```
   効果: 25MB削減

2. **Phase 2: 開発用途別スクリプト追加** (30分)
   ```bash
   # package.json にスクリプト追加
   ```
   効果: install時間5秒削減、将来のPhase 3で効果発揮

### 慎重に実施（中〜高リスク・高効果）

3. **Phase 3 Step1: 選択的hoisting** (1時間 + 1週間検証)
   ```bash
   # .npmrc 変更 → Lambda CDK bundling検証
   ```
   効果: 130MB削減（フロントエンド開発時はaws-cdk 198MB除外）

4. **Phase 3 Step2: 最小hoisting** (1時間 + 1週間検証)
   効果: さらに100MB削減

5. **Phase 3 Step3: 完全分離** (2時間 + 1週間検証)
   効果: さらに50MB削減

### 将来的検討（高コスト）

6. **Optimization 4-6:** 個別パッケージ最適化
7. **Optimization 7:** Monorepo構造再設計（大規模リファクタリング）

---

**最終更新:** 2026-04-04 14:00 UTC
**次回レビュー:** Phase 1.5実施時
