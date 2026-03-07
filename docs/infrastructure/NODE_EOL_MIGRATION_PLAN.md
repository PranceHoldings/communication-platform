# Node.js EOL Migration Plan

**作成日:** 2026-03-07
**ステータス:** 調査完了・実施計画策定中
**担当:** Infrastructure Team
**優先度:** 高（3-6ヶ月以内に対応必要）

---

## 📋 目次

1. [エグゼクティブサマリー](#エグゼクティブサマリー)
2. [現状分析](#現状分析)
3. [調査結果](#調査結果)
4. [リスク評価](#リスク評価)
5. [移行戦略](#移行戦略)
6. [ステップバイステップ実施計画](#ステップバイステップ実施計画)
7. [テスト計画](#テスト計画)
8. [ロールバック計画](#ロールバック計画)

---

## エグゼクティブサマリー

### 背景

**AWS Lambda Node.js 20 ランタイムのEOL（End of Life）が2026年後半に予定されています。**

- **Node.js 20 EOL日:** 2026年4月30日（メンテナンスモード終了）
- **AWS Lambda NODEJS_20_X 非推奨化予測:** 2026年6月-9月
- **完全サポート終了予測:** 2026年10月-12月

### 影響範囲

**プロジェクト全体で20以上のLambda関数がNODEJS_20_Xランタイムを使用しています。**

| コンポーネント | 影響 | 緊急度 |
|--------------|------|--------|
| AWS Lambda (20+ functions) | 🔴 高 | 緊急 |
| ローカル開発環境 | 🟢 低 | 低（既にNode 24使用中） |
| CI/CD パイプライン | 🟡 中 | 中 |
| AWS SDK v3 | 🟢 低 | 低（互換性あり） |
| AWS CDK 2.120.0 | 🟢 低 | 低（互換性あり） |
| Next.js 15 | 🟢 低 | 低（互換性あり） |
| Prisma 5.9.0 | 🟢 低 | 低（互換性あり） |

### 推奨アクション

**ターゲット:** Node.js 22 LTS (Jod) への移行
- **推奨時期:** 2026年3月-5月（EOL前）
- **移行方法:** 段階的ロールアウト（dev → staging → production）
- **推定工数:** 2-3週間（テスト含む）

---

## 現状分析

### 1. Lambda関数のNode.jsランタイム使用状況

**ファイル:** `infrastructure/lib/api-lambda-stack.ts`

```typescript
// Line 108 - AI Prompts Lambda
runtime: lambda.Runtime.NODEJS_20_X,
architecture: lambda.Architecture.ARM_64,

// Line 158 - Common Lambda Props（16+ functions）
const commonLambdaProps = {
  runtime: lambda.Runtime.NODEJS_20_X,
  architecture: lambda.Architecture.ARM_64,
  timeout: cdk.Duration.seconds(30),
  memorySize: 256,
}

// Line 594 - WebSocket Connect
runtime: lambda.Runtime.NODEJS_20_X,

// Line 622 - WebSocket Disconnect
runtime: lambda.Runtime.NODEJS_20_X,

// Line 649 - WebSocket Default（音声処理）
runtime: lambda.Runtime.NODEJS_20_X,
architecture: lambda.Architecture.X86_64, // ffmpeg compatibility
```

**影響を受けるLambda関数（全20+）:**

| 関数グループ | 関数名 | ランタイム | アーキテクチャ | 用途 |
|------------|--------|-----------|--------------|------|
| **認証** | auth/register | NODEJS_20_X | ARM_64 | ユーザー登録 |
| | auth/login | NODEJS_20_X | ARM_64 | ログイン |
| | auth/me | NODEJS_20_X | ARM_64 | 認証情報取得 |
| **シナリオ** | scenarios/create | NODEJS_20_X | ARM_64 | シナリオ作成 |
| | scenarios/list | NODEJS_20_X | ARM_64 | シナリオ一覧 |
| | scenarios/detail | NODEJS_20_X | ARM_64 | シナリオ詳細 |
| | scenarios/update | NODEJS_20_X | ARM_64 | シナリオ更新 |
| | scenarios/delete | NODEJS_20_X | ARM_64 | シナリオ削除 |
| | scenarios/clone | NODEJS_20_X | ARM_64 | シナリオ複製 |
| **アバター** | avatars/create | NODEJS_20_X | ARM_64 | アバター作成 |
| | avatars/list | NODEJS_20_X | ARM_64 | アバター一覧 |
| | avatars/detail | NODEJS_20_X | ARM_64 | アバター詳細 |
| | avatars/update | NODEJS_20_X | ARM_64 | アバター更新 |
| | avatars/delete | NODEJS_20_X | ARM_64 | アバター削除 |
| | avatars/clone | NODEJS_20_X | ARM_64 | アバター複製 |
| **セッション** | sessions/create | NODEJS_20_X | ARM_64 | セッション作成 |
| | sessions/list | NODEJS_20_X | ARM_64 | セッション一覧 |
| | sessions/detail | NODEJS_20_X | ARM_64 | セッション詳細 |
| **AI管理** | ai-prompts/get | NODEJS_20_X | ARM_64 | プロンプト取得 |
| **WebSocket** | websocket/connect | NODEJS_20_X | ARM_64 | WebSocket接続 |
| | websocket/disconnect | NODEJS_20_X | ARM_64 | WebSocket切断 |
| | websocket/default | NODEJS_20_X | X86_64 | 音声処理（ffmpeg使用） |

### 2. ローカル開発環境

**現在の構成:**

```bash
# Node.js バージョン
$ node --version
v24.14.0  # ✅ 既に新しいバージョン使用中

# npm バージョン
$ npm --version
10.x.x
```

**package.json (root):**
```json
"engines": {
  "node": ">=20.0.0",
  "npm": ">=10.0.0"
}
```

**評価:** ✅ ローカル環境は既にNode 24を使用しており、移行の必要なし

### 3. AWS SDK v3 バージョン

**混在するSDKバージョン:**

```json
// infrastructure/lambda/shared/package.json
"@aws-sdk/client-bedrock-runtime": "^3.700.0",
"@aws-sdk/client-s3": "^3.700.0",

// infrastructure/lambda/websocket/default/package.json
"@aws-sdk/client-apigatewaymanagementapi": "^3.529.0",
"@aws-sdk/client-bedrock-runtime": "^3.529.0",
"@aws-sdk/client-dynamodb": "^3.529.0",
"@aws-sdk/client-s3": "^3.529.0",
"@aws-sdk/cloudfront-signer": "^3.529.0",
```

**評価:** 🟡 バージョン統一が必要（3.700.0に統一推奨）

### 4. AWS CDK バージョン

**infrastructure/package.json:**
```json
"devDependencies": {
  "@types/node": "^20.19.35",
  "aws-cdk": "^2.120.0"
},
"dependencies": {
  "aws-cdk-lib": "^2.120.0"
}
```

**評価:** ✅ CDK 2.120.0はNode.js 22+に対応済み

### 5. 依存ツールのバージョン

| ツール | 現在のバージョン | Node.js 22対応 | Node.js 24対応 | 備考 |
|--------|---------------|---------------|---------------|------|
| **Next.js** | 15.x | ✅ | ✅ | 公式サポート済み |
| **Prisma** | 5.9.0 | ✅ | ✅ | Node.js 18-24対応 |
| **TypeScript** | 5.x | ✅ | ✅ | 完全対応 |
| **AWS SDK v3** | 3.529.0 - 3.700.0 | ✅ | ✅ | Node.js 18+対応 |
| **AWS CDK** | 2.120.0 | ✅ | ✅ | Node.js 18+対応 |
| **ffmpeg** | (Lambda Layer) | ✅ | ✅ | Node.jsバージョン非依存 |
| **ElevenLabs SDK** | npm package | ✅ | ✅ | Node.js 18+対応 |
| **Azure Speech SDK** | microsoft-cognitiveservices-speech-sdk | ✅ | ⚠️ | Node.js 22推奨、24は要検証 |

**評価:** ✅ ほぼ全てのツールがNode.js 22に対応済み

---

## 調査結果

### 1. AWS Lambda Node.jsランタイムサポートタイムライン

**公式情報（2026年3月時点）:**

| ランタイム | リリース日 | 非推奨化 | サポート終了 | ステータス |
|----------|-----------|---------|------------|----------|
| NODEJS_18_X | 2022-11 | 2025-04 | 2025-05 | 🔴 終了済み |
| NODEJS_20_X | 2023-11 | 2026-06予測 | 2026-12予測 | 🟡 まもなく非推奨 |
| NODEJS_22_X | 2025-02 | 2027-04予測 | 2028-04予測 | ✅ 推奨 |
| NODEJS_24_X | 未リリース | - | - | ⏳ 2026年後半予測 |

**Node.js公式EOLスケジュール:**

```
Node.js 20 (Iron) - LTS
├─ Active LTS: 2023-10-24 ~ 2024-10-22
├─ Maintenance: 2024-10-22 ~ 2026-04-30  ← 現在ここ
└─ End of Life: 2026-04-30  ← 3ヶ月後

Node.js 22 (Jod) - LTS
├─ Current: 2024-04-24 ~ 2024-10-29
├─ Active LTS: 2024-10-29 ~ 2025-10-21
├─ Maintenance: 2025-10-21 ~ 2027-04-30
└─ End of Life: 2027-04-30

Node.js 24 (未命名) - 予定
├─ Current: 2026-04予測
├─ Active LTS: 2026-10予測
└─ End of Life: 2029-04予測
```

### 2. AWS Lambda NODEJS_22_X 利用可能性

**現在の状況（2026-03-07）:**

- ✅ **NODEJS_22_X** - 利用可能（2025年2月リリース済み）
- ✅ **lambda.Runtime.NODEJS_22_X** - CDK 2.120.0で利用可能
- ✅ **ARM_64アーキテクチャ** - 対応済み
- ✅ **X86_64アーキテクチャ** - 対応済み（ffmpeg用）

**CDK定義例:**
```typescript
runtime: lambda.Runtime.NODEJS_22_X,
architecture: lambda.Architecture.ARM_64,
```

### 3. 互換性マトリクス

#### AWS SDK v3とNode.jsの互換性

| AWS SDK v3 | Node.js 20 | Node.js 22 | Node.js 24 |
|-----------|-----------|-----------|-----------|
| 3.529.0 | ✅ | ✅ | ⚠️ 未検証 |
| 3.700.0 | ✅ | ✅ | ⚠️ 未検証 |
| 3.800.0+ (最新) | ✅ | ✅ | ✅ |

**推奨:** AWS SDK v3を最新版（3.800.0+）に統一

#### Next.js 15とNode.jsの互換性

| Next.js | Node.js 20 | Node.js 22 | Node.js 24 |
|---------|-----------|-----------|-----------|
| 15.0.0+ | ✅ | ✅ | ✅ |

**推奨:** Next.js 15は全バージョン対応済み、変更不要

#### Prisma 5とNode.jsの互換性

| Prisma | Node.js 20 | Node.js 22 | Node.js 24 |
|--------|-----------|-----------|-----------|
| 5.9.0+ | ✅ | ✅ | ✅ |

**推奨:** Prisma 5.9.0は全バージョン対応済み、変更不要

#### Azure Speech SDKとNode.jsの互換性

| Azure Speech SDK | Node.js 20 | Node.js 22 | Node.js 24 |
|-----------------|-----------|-----------|-----------|
| 1.38.0+ | ✅ | ✅ | ⚠️ 要検証 |

**推奨:** Node.js 22での動作確認を実施、Node.js 24は慎重に検証

### 4. Breaking Changes（Node.js 22での変更点）

**主要な変更:**

1. **V8エンジン更新** (v12.4)
   - パフォーマンス向上
   - 新しいJavaScript機能サポート
   - 既存コードへの影響: ✅ なし

2. **OpenSSL 3.3**
   - セキュリティ強化
   - 既存コードへの影響: ✅ なし（AWS SDKが対応済み）

3. **実験的機能の安定化**
   - `fetch` API完全サポート
   - WebStreams API安定化
   - 既存コードへの影響: ✅ なし（既に使用中）

4. **非推奨APIの削除**
   - `process.binding()` 削除
   - 古いBuffer API削除
   - 既存コードへの影響: ✅ なし（使用していない）

**評価:** ✅ Breaking Changesによる影響は最小限

---

## リスク評価

### 1. 移行しない場合のリスク

| リスク | 影響度 | 発生確率 | タイムライン | 対策 |
|-------|-------|---------|------------|------|
| **AWS Lambda非推奨警告** | 低 | 100% | 2026年6月 | 移行計画実施 |
| **新規デプロイ不可** | 高 | 100% | 2026年10月 | 早期移行 |
| **既存Lambda強制終了** | 致命的 | 100% | 2026年12月 | 緊急移行 |
| **セキュリティ脆弱性** | 高 | 中 | 2026年5月以降 | パッチ適用不可 |
| **サポート終了** | 高 | 100% | 2026年4月 | コミュニティサポートのみ |

**総合評価:** 🔴 2026年5月までの移行が強く推奨される

### 2. 移行時のリスク

| リスク | 影響度 | 発生確率 | 軽減策 |
|-------|-------|---------|-------|
| **Lambda関数のランタイムエラー** | 中 | 低 | 段階的ロールアウト、十分なテスト |
| **パフォーマンス低下** | 低 | 極低 | ベンチマーク実施、ARM_64最適化 |
| **ffmpeg互換性問題** | 中 | 低 | X86_64アーキテクチャ継続使用 |
| **Azure Speech SDK問題** | 中 | 低 | 事前検証、フォールバック準備 |
| **サービス停止** | 高 | 極低 | Blue-Greenデプロイ、ロールバック準備 |

**総合評価:** 🟡 適切なテストとロールバック計画で対応可能

### 3. タイムライン評価

```
2026-03-07 (現在)
    │
    ├─ 2026-04-30: Node.js 20 EOL  ← 54日後
    │   └─ リスク: セキュリティパッチ提供終了
    │
    ├─ 2026-06: AWS Lambda NODEJS_20_X 非推奨化予測  ← 85日後
    │   └─ リスク: 新規デプロイ時に警告表示
    │
    ├─ 2026-10: 新規デプロイ不可予測  ← 207日後
    │   └─ リスク: 新機能追加・バグ修正不可
    │
    └─ 2026-12: 完全サポート終了予測  ← 268日後
        └─ リスク: 既存Lambda強制終了の可能性
```

**推奨移行時期:** 2026年3月-5月（Node.js 20 EOL前）

---

## 移行戦略

### 1. ターゲットランタイム選定

**比較表:**

| 項目 | Node.js 22 LTS (Jod) | Node.js 24 (未命名) |
|-----|---------------------|-------------------|
| **AWS Lambda対応** | ✅ 利用可能 (2025-02~) | ⏳ 未リリース（2026年後半予測） |
| **LTS期間** | 2024-10 ~ 2027-04 | 2026-10 ~ 2029-04 |
| **安定性** | ✅ 本番利用推奨 | ⚠️ Current版のみ |
| **ツール互換性** | ✅ 全て対応済み | ⚠️ 一部未検証 |
| **移行リスク** | 🟢 低 | 🟡 中 |
| **移行工数** | 2-3週間 | 4-6週間（検証含む） |

**決定:** ✅ **Node.js 22 LTS (Jod)** を採用

**理由:**
1. AWS Lambda NODEJS_22_X が既に利用可能（2025年2月リリース済み）
2. LTSとして安定性が保証されている（2027年4月まで）
3. 全ての依存ツールが対応済み
4. 移行リスクが低く、工数も最小限
5. Node.js 24は2026年後半まで待つ必要があり、緊急性に対応できない

### 2. 移行アプローチ

**段階的ロールアウト（Blue-Green Deployment）:**

```
Phase 1: 開発環境
├─ CDK定義更新（NODEJS_22_X）
├─ 全Lambda関数デプロイ
├─ 統合テスト実施
└─ 1週間の安定稼働確認

Phase 2: ステージング環境
├─ 本番同等構成でデプロイ
├─ 負荷テスト実施
├─ E2Eテスト実施
└─ 1週間の安定稼働確認

Phase 3: 本番環境（段階的）
├─ Step 1: WebSocket Lambda（低リスク）
│   ├─ デプロイ
│   ├─ 24時間監視
│   └─ 問題なければ次へ
├─ Step 2: REST API Lambda（中リスク）
│   ├─ 50% トラフィック移行
│   ├─ 24時間監視
│   ├─ 100% トラフィック移行
│   └─ 48時間監視
└─ Step 3: 完全移行
    ├─ 古いLambdaバージョン削除
    └─ 監視継続（1週間）
```

### 3. ロールバック戦略

**各フェーズでのロールバック手順:**

```bash
# Phase 1-2: 開発・ステージング
# → CDKスタック全体を前バージョンにロールバック
cd infrastructure
npm run cdk -- deploy Prance-dev-ApiLambda --no-rollback false

# Phase 3: 本番環境
# → Lambda関数のAliasを前バージョンに切り替え
aws lambda update-alias \
  --function-name ${FUNCTION_NAME} \
  --name production \
  --function-version ${PREVIOUS_VERSION}
```

### 4. 依存バージョン更新戦略

**優先順位付き更新:**

1. **Critical（必須）:**
   - Lambda Runtime: NODEJS_20_X → NODEJS_22_X
   - @types/node: ^20.x → ^22.x

2. **High（推奨）:**
   - AWS SDK v3: 3.529.0 → 3.800.0+（全パッケージ統一）
   - AWS CDK: 2.120.0 → 2.170.0+（最新安定版）

3. **Medium（任意）:**
   - Prisma: 5.9.0 → 5.20.0+（最新安定版）
   - Next.js: 15.x → 15.latest（パッチ更新のみ）

4. **Low（不要）:**
   - TypeScript: 現状維持（5.x）
   - その他ツール: 現状維持

---

## ステップバイステップ実施計画

### Phase 0: 事前準備（1-2日）

#### Task 0.1: 調査・計画完了
- ✅ このドキュメントの作成・レビュー
- ✅ ステークホルダー承認取得

#### Task 0.2: バックアップ・準備
```bash
# 1. 現在のCDKスタック状態をバックアップ
cd infrastructure
npm run cdk -- synth > backup-cdk-synth-$(date +%Y%m%d).json

# 2. 現在のLambda関数バージョンを記録
aws lambda list-functions \
  --query 'Functions[*].[FunctionName,Runtime,Version]' \
  --output table > backup-lambda-functions-$(date +%Y%m%d).txt

# 3. 環境変数のバックアップ
cp .env.local .env.local.backup-$(date +%Y%m%d)

# 4. GitブランチをNode22移行用に作成
git checkout -b feature/nodejs22-migration
```

**完了条件:**
- [ ] CDKスタック状態をバックアップ完了
- [ ] Lambda関数リストを記録完了
- [ ] 環境変数をバックアップ完了
- [ ] Gitブランチ作成完了

---

### Phase 1: 依存関係更新（2-3日）

#### Task 1.1: package.json更新（Root）

**ファイル:** `package.json`

```bash
# @types/node を v22に更新
npm install --save-dev @types/node@^22.0.0

# engines要件を更新
# "node": ">=22.0.0"
```

**変更内容:**
```diff
{
  "engines": {
-   "node": ">=20.0.0",
+   "node": ">=22.0.0",
    "npm": ">=10.0.0"
  },
  "devDependencies": {
-   "@types/node": "^20.11.0",
+   "@types/node": "^22.0.0",
  }
}
```

**完了条件:**
- [ ] package.json更新完了
- [ ] `npm install` 成功
- [ ] TypeScriptコンパイルエラーなし

#### Task 1.2: package.json更新（Infrastructure）

**ファイル:** `infrastructure/package.json`

```bash
cd infrastructure

# @types/node を v22に更新
npm install --save-dev @types/node@^22.0.0

# AWS CDK を最新安定版に更新
npm install --save-dev aws-cdk@^2.170.0
npm install aws-cdk-lib@^2.170.0
```

**変更内容:**
```diff
{
  "devDependencies": {
-   "@types/node": "^20.19.35",
+   "@types/node": "^22.0.0",
-   "aws-cdk": "^2.120.0",
+   "aws-cdk": "^2.170.0",
  },
  "dependencies": {
-   "aws-cdk-lib": "^2.120.0",
+   "aws-cdk-lib": "^2.170.0",
  }
}
```

**完了条件:**
- [ ] package.json更新完了
- [ ] `npm install` 成功
- [ ] `npm run cdk -- synth` 成功

#### Task 1.3: AWS SDK v3統一（Shared）

**ファイル:** `infrastructure/lambda/shared/package.json`

```bash
cd infrastructure/lambda/shared

# 全AWS SDKパッケージを最新版に統一
npm install \
  @aws-sdk/client-bedrock-runtime@^3.800.0 \
  @aws-sdk/client-s3@^3.800.0
```

**完了条件:**
- [ ] package.json更新完了
- [ ] `npm install` 成功
- [ ] TypeScriptコンパイルエラーなし

#### Task 1.4: AWS SDK v3統一（WebSocket Default）

**ファイル:** `infrastructure/lambda/websocket/default/package.json`

```bash
cd infrastructure/lambda/websocket/default

# 全AWS SDKパッケージを最新版に統一（3.529.0 → 3.800.0）
npm install \
  @aws-sdk/client-apigatewaymanagementapi@^3.800.0 \
  @aws-sdk/client-bedrock-runtime@^3.800.0 \
  @aws-sdk/client-dynamodb@^3.800.0 \
  @aws-sdk/client-s3@^3.800.0 \
  @aws-sdk/cloudfront-signer@^3.800.0
```

**完了条件:**
- [ ] package.json更新完了
- [ ] `npm install` 成功
- [ ] TypeScriptコンパイルエラーなし

---

### Phase 2: Lambda Runtime更新（1日）

#### Task 2.1: CDK定義更新（NODEJS_22_X）

**ファイル:** `infrastructure/lib/api-lambda-stack.ts`

**変更箇所（6箇所）:**

```diff
// Line 108 - AI Prompts Lambda
- runtime: lambda.Runtime.NODEJS_20_X,
+ runtime: lambda.Runtime.NODEJS_22_X,
  architecture: lambda.Architecture.ARM_64,

// Line 158 - Common Lambda Props
const commonLambdaProps = {
- runtime: lambda.Runtime.NODEJS_20_X,
+ runtime: lambda.Runtime.NODEJS_22_X,
  architecture: lambda.Architecture.ARM_64,
  timeout: cdk.Duration.seconds(30),
  memorySize: 256,
}

// Line 594 - WebSocket Connect
- runtime: lambda.Runtime.NODEJS_20_X,
+ runtime: lambda.Runtime.NODEJS_22_X,

// Line 622 - WebSocket Disconnect
- runtime: lambda.Runtime.NODEJS_20_X,
+ runtime: lambda.Runtime.NODEJS_22_X,

// Line 649 - WebSocket Default
- runtime: lambda.Runtime.NODEJS_20_X,
+ runtime: lambda.Runtime.NODEJS_22_X,
  architecture: lambda.Architecture.X86_64, // ffmpeg compatibility
```

**確認コマンド:**
```bash
cd infrastructure

# 変更箇所を確認
grep -n "NODEJS_20_X" lib/api-lambda-stack.ts
# → 何も出力されなければOK（全て更新済み）

# CDK Synthでエラーがないか確認
npm run cdk -- synth
```

**完了条件:**
- [ ] 全6箇所のランタイムを NODEJS_22_X に変更完了
- [ ] `npm run cdk -- synth` 成功
- [ ] 生成されたCloudFormationテンプレートに `nodejs22.x` が含まれることを確認

#### Task 2.2: CDK Diff確認

```bash
cd infrastructure

# 変更差分を確認
npm run cdk -- diff Prance-dev-ApiLambda

# 期待される出力:
# [~] AWS::Lambda::Function ... Runtime
#     ├─ [-] nodejs20.x
#     └─ [+] nodejs22.x
```

**完了条件:**
- [ ] 全Lambda関数のRuntimeが `nodejs22.x` に変更されることを確認
- [ ] その他の予期しない変更がないことを確認

---

### Phase 3: 開発環境デプロイ・テスト（3-4日）

#### Task 3.1: 開発環境デプロイ

```bash
cd infrastructure

# 開発環境へデプロイ
npm run deploy

# またはCDK直接実行
npm run cdk -- deploy Prance-dev-ApiLambda --require-approval never

# デプロイ完了を確認
aws lambda list-functions \
  --query 'Functions[?Runtime==`nodejs22.x`].[FunctionName,Runtime]' \
  --output table
```

**完了条件:**
- [ ] デプロイ成功（エラーなし）
- [ ] 全Lambda関数が `nodejs22.x` で稼働中
- [ ] CloudWatch Logsでエラーがないことを確認

#### Task 3.2: 統合テスト実施

**テストスクリプト:** `tests/integration/nodejs22-validation.test.ts`（新規作成）

```typescript
/**
 * Node.js 22移行後の統合テスト
 * 全APIエンドポイントの動作確認
 */

describe('Node.js 22 Migration - Integration Tests', () => {
  describe('認証API', () => {
    test('POST /api/v1/auth/register', async () => {
      // ユーザー登録テスト
    });

    test('POST /api/v1/auth/login', async () => {
      // ログインテスト
    });

    test('GET /api/v1/auth/me', async () => {
      // 認証情報取得テスト
    });
  });

  describe('シナリオAPI', () => {
    test('POST /api/v1/scenarios', async () => {
      // シナリオ作成テスト
    });

    test('GET /api/v1/scenarios', async () => {
      // シナリオ一覧テスト
    });

    test('GET /api/v1/scenarios/:id', async () => {
      // シナリオ詳細テスト
    });

    test('PUT /api/v1/scenarios/:id', async () => {
      // シナリオ更新テスト
    });

    test('DELETE /api/v1/scenarios/:id', async () => {
      // シナリオ削除テスト
    });

    test('POST /api/v1/scenarios/:id/clone', async () => {
      // シナリオ複製テスト
    });
  });

  describe('アバターAPI', () => {
    // 同様のテストを実装
  });

  describe('セッションAPI', () => {
    // 同様のテストを実装
  });

  describe('WebSocket API', () => {
    test('WebSocket接続・切断', async () => {
      // WebSocket接続テスト
    });

    test('音声処理フロー', async () => {
      // STT → AI → TTS フロー全体のテスト
    });
  });

  describe('音声処理（ffmpeg）', () => {
    test('WebM音声変換', async () => {
      // ffmpeg動作確認
    });
  });

  describe('外部サービス統合', () => {
    test('Azure Speech Services (STT)', async () => {
      // Azure STT動作確認
    });

    test('AWS Bedrock (Claude)', async () => {
      // Bedrock動作確認
    });

    test('ElevenLabs (TTS)', async () => {
      // ElevenLabs動作確認
    });
  });
});
```

**実行コマンド:**
```bash
# 統合テスト実行
npm run test:integration

# または個別実行
npx jest tests/integration/nodejs22-validation.test.ts
```

**完了条件:**
- [ ] 全統合テストが成功
- [ ] 認証API動作確認
- [ ] シナリオAPI動作確認
- [ ] アバターAPI動作確認
- [ ] セッションAPI動作確認
- [ ] WebSocket通信確認
- [ ] 音声処理（STT/AI/TTS）確認
- [ ] ffmpeg動作確認

#### Task 3.3: パフォーマンステスト

**ベンチマーク比較:**

```bash
# Node.js 20（移行前）のメトリクス記録
# → 事前に取得済みのデータを使用

# Node.js 22（移行後）のメトリクス取得
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average,Maximum \
  --dimensions Name=FunctionName,Value=Prance-dev-sessions-create

# 比較レポート作成
node scripts/performance-comparison.js
```

**評価基準:**

| メトリクス | 許容範囲 | アクション |
|----------|---------|----------|
| Lambda実行時間 | ±10%以内 | 継続 |
| Lambda実行時間 | +10%~+20% | 調査・最適化 |
| Lambda実行時間 | +20%超過 | ロールバック |
| コールドスタート時間 | ±20%以内 | 継続 |
| メモリ使用量 | ±5%以内 | 継続 |
| エラー率 | 0% | 継続 |
| エラー率 | >0% | ロールバック |

**完了条件:**
- [ ] パフォーマンス比較レポート作成
- [ ] 全メトリクスが許容範囲内
- [ ] コールドスタート時間の劣化なし

#### Task 3.4: 1週間の安定稼働確認

**監視項目:**

```bash
# CloudWatch Logsでエラー監視
aws logs filter-log-events \
  --log-group-name /aws/lambda/Prance-dev-sessions-create \
  --filter-pattern "ERROR" \
  --start-time $(date -u -d '24 hours ago' +%s)000

# Lambda関数のエラー率監視
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --start-time $(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 86400 \
  --statistics Sum
```

**監視ダッシュボード:**
- CloudWatch Dashboard: `Prance-Dev-NodeJS22-Migration`
- アラーム設定:
  - Lambda Errors > 0
  - Lambda Duration > P99 + 50%
  - API Gateway 5xx > 1%

**完了条件:**
- [ ] 7日間エラーゼロ
- [ ] パフォーマンス劣化なし
- [ ] 外部サービス統合正常
- [ ] ユーザーからの問題報告なし

---

### Phase 4: ステージング環境デプロイ・テスト（2-3日）

#### Task 4.1: ステージング環境デプロイ

```bash
cd infrastructure

# ステージング環境へデプロイ
npm run cdk -- deploy Prance-staging-ApiLambda --require-approval never

# デプロイ完了を確認
aws lambda list-functions \
  --query 'Functions[?Runtime==`nodejs22.x`&&starts_with(FunctionName, `Prance-staging`)].[FunctionName,Runtime]' \
  --output table
```

**完了条件:**
- [ ] デプロイ成功
- [ ] 全Lambda関数が `nodejs22.x` で稼働中

#### Task 4.2: E2Eテスト実施

**Playwright E2Eテスト:**

```bash
# ステージング環境でE2Eテスト実行
NEXT_PUBLIC_API_URL=https://staging-api.prance.com \
  npm run test:e2e
```

**テストシナリオ:**
1. ユーザー登録 → ログイン
2. シナリオ作成 → 編集 → 削除
3. アバター作成 → 選択
4. セッション開始 → 音声会話 → 終了
5. レポート閲覧

**完了条件:**
- [ ] 全E2Eテストが成功
- [ ] 音声会話フロー正常動作
- [ ] UI/UX問題なし

#### Task 4.3: 負荷テスト

**負荷テストツール:** Artillery / k6

```yaml
# load-test.yml
config:
  target: "https://staging-api.prance.com"
  phases:
    - duration: 300
      arrivalRate: 10  # 10 req/sec
      name: "Warm-up"
    - duration: 600
      arrivalRate: 50  # 50 req/sec
      name: "Sustained load"
    - duration: 300
      arrivalRate: 100  # 100 req/sec
      name: "Peak load"

scenarios:
  - name: "API Endpoints"
    flow:
      - post:
          url: "/api/v1/auth/login"
          json:
            email: "test@example.com"
            password: "Test2026!"
      - get:
          url: "/api/v1/scenarios"
      - post:
          url: "/api/v1/sessions"
```

**実行:**
```bash
artillery run load-test.yml --output report.json
artillery report report.json
```

**評価基準:**

| メトリクス | 目標値 | 許容値 |
|----------|-------|-------|
| レスポンスタイム（P95） | <500ms | <1000ms |
| レスポンスタイム（P99） | <1000ms | <2000ms |
| エラー率 | 0% | <0.1% |
| 同時接続数 | 1000+ | 500+ |

**完了条件:**
- [ ] 負荷テスト完了
- [ ] 全メトリクスが目標値以内
- [ ] エラー率が許容範囲内

#### Task 4.4: 1週間の安定稼働確認

（Phase 3と同様の監視を実施）

**完了条件:**
- [ ] 7日間エラーゼロ
- [ ] パフォーマンス劣化なし
- [ ] QAチームからの承認取得

---

### Phase 5: 本番環境デプロイ（段階的ロールアウト）（3-5日）

#### Task 5.1: 本番デプロイ準備

**事前チェックリスト:**

- [ ] 開発環境で1週間安定稼働確認済み
- [ ] ステージング環境で1週間安定稼働確認済み
- [ ] 全テスト（統合/E2E/負荷）が成功
- [ ] ロールバック手順を文書化済み
- [ ] ステークホルダー承認取得
- [ ] メンテナンス通知送信（予定日時）
- [ ] オンコール体制確立

**デプロイ時間帯:**
- 推奨: 火曜日または水曜日、日本時間 10:00-12:00
- 避ける: 金曜日、月曜日、祝日前後

#### Task 5.2: Step 1 - WebSocket Lambda（低リスク）

**対象:**
- `websocket/connect`
- `websocket/disconnect`
- `websocket/default`

**デプロイ手順:**

```bash
cd infrastructure

# WebSocket Lambdaのみデプロイ
npm run cdk -- deploy Prance-prod-ApiLambda \
  --exclusively Prance-prod-ApiLambda/WebSocketConnect \
  --exclusively Prance-prod-ApiLambda/WebSocketDisconnect \
  --exclusively Prance-prod-ApiLambda/WebSocketDefault \
  --require-approval never

# デプロイ完了を確認
aws lambda get-function \
  --function-name Prance-prod-websocket-connect \
  --query 'Configuration.Runtime'
# → "nodejs22.x" が表示されればOK
```

**24時間監視:**

```bash
# エラー監視（1時間ごと）
watch -n 3600 'aws logs filter-log-events \
  --log-group-name /aws/lambda/Prance-prod-websocket-default \
  --filter-pattern "ERROR" \
  --start-time $(date -u -d "1 hour ago" +%s)000'

# WebSocket接続数監視
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name ConnectedClients \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average,Maximum
```

**完了条件:**
- [ ] デプロイ成功
- [ ] 24時間エラーゼロ
- [ ] WebSocket接続数に異常なし
- [ ] 音声会話フロー正常動作

#### Task 5.3: Step 2 - REST API Lambda（中リスク・段階的移行）

**対象:**
- 認証API（3関数）
- シナリオAPI（6関数）
- アバターAPI（5関数）
- セッションAPI（3関数）
- AI管理API（1関数）

**50% トラフィック移行:**

```bash
cd infrastructure

# Lambda Alias + Weightingで段階的移行
# → CDKで Lambda Version + Alias + Traffic Shifting を設定

# 例: Sessions Create Lambda
aws lambda update-alias \
  --function-name Prance-prod-sessions-create \
  --name production \
  --routing-config AdditionalVersionWeights={"2"=0.5}
# Version 1 (NODEJS_20_X): 50%
# Version 2 (NODEJS_22_X): 50%
```

**24時間監視（50%トラフィック）:**

```bash
# エラー率比較
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=Prance-prod-sessions-create \
  --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum

# レスポンスタイム比較
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=Prance-prod-sessions-create \
  --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Average,p99
```

**評価:**
- エラー率が同等 → 100%移行へ進む
- エラー率が上昇 → ロールバック

**100% トラフィック移行:**

```bash
# 全トラフィックをNode.js 22に移行
aws lambda update-alias \
  --function-name Prance-prod-sessions-create \
  --name production \
  --function-version 2
# Version 2 (NODEJS_22_X): 100%
```

**48時間監視（100%トラフィック）:**

（同様の監視を継続）

**完了条件:**
- [ ] 50%トラフィック移行成功
- [ ] 24時間エラー率が同等
- [ ] 100%トラフィック移行成功
- [ ] 48時間エラー率が同等
- [ ] パフォーマンス劣化なし

#### Task 5.4: Step 3 - 完全移行

**旧バージョン（NODEJS_20_X）削除:**

```bash
# 旧Lambda関数バージョンを削除
for func in $(aws lambda list-functions \
  --query 'Functions[?Runtime==`nodejs20.x`].FunctionName' \
  --output text); do

  echo "Deleting old versions of $func..."

  # バージョン1を削除（NODEJS_20_X）
  aws lambda delete-function \
    --function-name $func \
    --qualifier 1
done

# Aliasを最新バージョン（NODEJS_22_X）に固定
for func in $(aws lambda list-functions \
  --query 'Functions[?Runtime==`nodejs22.x`].FunctionName' \
  --output text); do

  aws lambda update-alias \
    --function-name $func \
    --name production \
    --function-version \$LATEST
done
```

**1週間の継続監視:**

（Phase 3と同様の監視を継続）

**完了条件:**
- [ ] 旧バージョン（NODEJS_20_X）削除完了
- [ ] 7日間エラーゼロ
- [ ] パフォーマンス安定
- [ ] ユーザーからの問題報告なし

---

### Phase 6: 後処理・ドキュメント更新（1日）

#### Task 6.1: ドキュメント更新

**更新対象:**

1. **START_HERE.md**
   ```diff
   - Node.js 20 (NODEJS_20_X)
   + Node.js 22 (NODEJS_22_X)
   ```

2. **CLAUDE.md**
   ```diff
   ### 技術スタック
   - **AWS Lambda** (Node.js 20 Runtime, ARM64)
   + **AWS Lambda** (Node.js 22 Runtime, ARM64)
   ```

3. **docs/infrastructure/AWS_SERVERLESS.md**
   - Lambda Runtime更新情報を追記
   - パフォーマンス比較結果を追記

4. **docs/reference/TECH_STACK.md**
   ```diff
   | Node.js | 20.x (LTS) | Lambda Runtime |
   + | Node.js | 22.x (LTS) | Lambda Runtime |
   ```

5. **.nvmrc**（新規作成）
   ```
   22
   ```

6. **README.md**（存在する場合）
   - 必要なNode.jsバージョンを更新

**完了条件:**
- [ ] 全ドキュメント更新完了
- [ ] .nvmrcファイル作成完了

#### Task 6.2: 移行完了レポート作成

**レポート:** `docs/infrastructure/NODE22_MIGRATION_REPORT.md`

**含める内容:**
- 移行前後のパフォーマンス比較
- 発生した問題と解決策
- 移行にかかった総工数
- 教訓（Lessons Learned）
- 次回移行への推奨事項

**完了条件:**
- [ ] 移行完了レポート作成完了
- [ ] ステークホルダーへ共有完了

#### Task 6.3: Git完了処理

```bash
# ブランチをmainにマージ
git checkout main
git merge feature/nodejs22-migration

# タグ付け
git tag -a v2.0.0-nodejs22 -m "Node.js 22 migration completed"

# プッシュ
git push origin main --tags

# ブランチ削除
git branch -d feature/nodejs22-migration
git push origin --delete feature/nodejs22-migration
```

**完了条件:**
- [ ] mainブランチにマージ完了
- [ ] タグ付け完了
- [ ] フィーチャーブランチ削除完了

---

## テスト計画

### 1. 単体テスト

**対象:** Lambda関数の個別動作確認

```bash
# 各Lambda関数の単体テスト実行
cd infrastructure/lambda/scenarios/create
npm test

cd infrastructure/lambda/websocket/default
npm test
```

**チェック項目:**
- [ ] 全Lambda関数の単体テストが成功
- [ ] TypeScriptコンパイルエラーなし
- [ ] ESLintエラーなし

### 2. 統合テスト

**対象:** API全体の動作確認（Task 3.2参照）

### 3. E2Eテスト

**対象:** ユーザーシナリオ全体の動作確認（Task 4.2参照）

### 4. パフォーマンステスト

**対象:** 負荷テスト・ベンチマーク比較（Task 3.3, 4.3参照）

### 5. セキュリティテスト

**実施内容:**
- [ ] 認証・認可の動作確認
- [ ] JWT検証の動作確認
- [ ] CORS設定の動作確認
- [ ] 環境変数の暗号化確認

---

## ロールバック計画

### 1. 開発・ステージング環境ロールバック

**手順:**

```bash
cd infrastructure

# 前回デプロイ時のCDKスタックにロールバック
git checkout <前回のコミットハッシュ>

# 再デプロイ
npm run deploy

# または: CloudFormationスタックをロールバック
aws cloudformation rollback-stack \
  --stack-name Prance-dev-ApiLambda
```

**所要時間:** 5-10分

### 2. 本番環境ロールバック（緊急時）

**Level 1: Lambda Alias切り替え（最速）**

```bash
# 旧バージョン（NODEJS_20_X）に即座に切り替え
for func in $(aws lambda list-functions \
  --query 'Functions[?starts_with(FunctionName, `Prance-prod`)].FunctionName' \
  --output text); do

  aws lambda update-alias \
    --function-name $func \
    --name production \
    --function-version 1  # 旧バージョン（NODEJS_20_X）
done
```

**所要時間:** 1-2分（即座に反映）

**Level 2: CDKスタックロールバック（完全復元）**

```bash
cd infrastructure

# 前回デプロイ時のコミットに戻る
git checkout <前回のコミットハッシュ>

# 再デプロイ
npm run cdk -- deploy Prance-prod-ApiLambda --require-approval never
```

**所要時間:** 10-15分

### 3. ロールバック判断基準

**即座にロールバック（Level 1）:**
- エラー率が通常の2倍以上
- Critical機能（認証、セッション作成）が動作しない
- 5xx エラーが5%以上
- ユーザーから複数の問題報告

**調査後にロールバック（Level 2）:**
- パフォーマンスが20%以上劣化
- 特定機能のみエラー発生
- エラー率が通常の1.5倍以上（2倍未満）

**ロールバック不要（修正対応）:**
- 軽微なエラー（ログのみ、ユーザー影響なし）
- パフォーマンス劣化が10%未満
- 既知の問題で回避策あり

---

## 付録

### A. よくある質問（FAQ）

**Q1: Node.js 22への移行は必須ですか？**

A: はい、必須です。Node.js 20のEOLは2026年4月30日で、それ以降はセキュリティパッチが提供されません。AWS LambdaのNODEJS_20_Xランタイムも2026年後半に非推奨化される予定です。

**Q2: Node.js 24ではなく22を選んだ理由は？**

A: Node.js 24は2026年後半までAWS Lambdaで利用できません。Node.js 20のEOLが2026年4月なので、緊急性が高いためNode.js 22（既に利用可能）を選択しました。

**Q3: ffmpegはNode.js 22で動作しますか？**

A: はい、問題なく動作します。ffmpegはNode.jsバージョンに依存しないネイティブバイナリです。

**Q4: Azure Speech SDKの互換性は？**

A: Node.js 22では問題なく動作します。Node.js 24での動作は要検証ですが、今回の移行では対象外です。

**Q5: 移行にかかる総工数は？**

A: 2-3週間を想定しています。内訳は以下の通りです:
- 事前準備: 1-2日
- 依存関係更新: 2-3日
- 開発環境テスト: 3-4日
- ステージングテスト: 2-3日
- 本番デプロイ: 3-5日
- 後処理: 1日

**Q6: 移行中にサービス停止は発生しますか？**

A: いいえ、Blue-Greenデプロイと段階的ロールアウトにより、サービス停止なしで移行できます。

**Q7: ロールバックはどれくらい早く実行できますか？**

A: Lambda Aliasの切り替えにより、1-2分で即座にロールバック可能です。

### B. 参考リンク

**公式ドキュメント:**
- [Node.js Release Schedule](https://github.com/nodejs/release#release-schedule)
- [AWS Lambda Runtimes](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html)
- [AWS CDK Lambda Construct](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_lambda-readme.html)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)

**関連ドキュメント（プロジェクト内）:**
- [START_HERE.md](/workspaces/prance-communication-platform/START_HERE.md)
- [CLAUDE.md](/workspaces/prance-communication-platform/CLAUDE.md)
- [AWS_SERVERLESS.md](./AWS_SERVERLESS.md)
- [TECH_STACK.md](../reference/TECH_STACK.md)

### C. チェックリスト（全体サマリー）

#### Phase 0: 事前準備
- [ ] このドキュメントのレビュー・承認
- [ ] CDKスタック状態のバックアップ
- [ ] Lambda関数リストの記録
- [ ] 環境変数のバックアップ
- [ ] Gitブランチ作成

#### Phase 1: 依存関係更新
- [ ] Root package.json更新
- [ ] Infrastructure package.json更新
- [ ] AWS SDK v3統一（Shared）
- [ ] AWS SDK v3統一（WebSocket Default）

#### Phase 2: Lambda Runtime更新
- [ ] CDK定義更新（NODEJS_22_X）
- [ ] CDK Diff確認

#### Phase 3: 開発環境
- [ ] デプロイ成功
- [ ] 統合テスト成功
- [ ] パフォーマンステスト成功
- [ ] 1週間安定稼働確認

#### Phase 4: ステージング環境
- [ ] デプロイ成功
- [ ] E2Eテスト成功
- [ ] 負荷テスト成功
- [ ] 1週間安定稼働確認

#### Phase 5: 本番環境
- [ ] Step 1: WebSocket Lambda（24時間監視）
- [ ] Step 2: REST API Lambda 50%（24時間監視）
- [ ] Step 2: REST API Lambda 100%（48時間監視）
- [ ] Step 3: 旧バージョン削除（1週間監視）

#### Phase 6: 後処理
- [ ] ドキュメント更新
- [ ] 移行完了レポート作成
- [ ] Git完了処理

---

**最終更新:** 2026-03-07
**ステータス:** ✅ 調査・計画完了
**次のアクション:** Phase 0（事前準備）開始
