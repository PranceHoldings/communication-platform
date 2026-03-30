# Prance Communication Platform - プロジェクト全体像サマリー

**作成日:** 2026-03-09
**目的:** 次のタスクを計画しやすくするための包括的な全体像整理

---

## 目次

1. [現在のステータス](#1-現在のステータス)
2. [プロジェクト概要](#2-プロジェクト概要)
3. [技術スタック](#3-技術スタック)
4. [システムアーキテクチャ](#4-システムアーキテクチャ)
5. [完了した機能](#5-完了した機能)
6. [次のステップ - Phase 2](#6-次のステップ---phase-2)
7. [重要な開発ガイドライン](#7-重要な開発ガイドライン)
8. [ドキュメント索引](#8-ドキュメント索引)

---

## 1. 現在のステータス

### プロジェクト進捗

```
Phase 0: インフラ基盤構築 ✅ 完了 (2026-03-05)
Phase 1: MVP開発 ✅ 完了 (2026-03-06) - 音声会話パイプライン動作確認済み
Phase 1.5: 10言語対応 ✅ 完了 (2026-03-08)
Phase 2: 録画・解析・レポート 🚧 進行中
  └─ Task 2.1: 録画機能 ✅ 完了
  └─ Task 2.2: 解析機能 ⏸️ 次のステップ
  └─ Task 2.3: レポート生成 ⏸️ 待機中
```

### 最新デプロイ情報

- **日時:** 2026-03-10 01:52 JST
- **コミット:** 0e52fc4 - refactor: eliminate hardcoded values and centralize configuration
- **Lambda バージョン:** v1.1.0（全20+ 関数更新）
- **重要な改善:**
  - **設定中央集権化:** ハードコード値30+箇所を除去（リージョン、言語、メディアフォーマット）
  - **S3Object deprecated対応:** カスタムインターフェース定義
  - **ビルドプロセス改善:** 4段階リトライロジック、自動検証、破損ファイル自動クリーンアップ
  - **型安全性向上:** Visibility enum統一、インライン定義除去
  - 言語コードハードコード完全削除（継続）
  - 10言語・24地域バリアント対応
  - ロックメカニズム改善（成功率 90% → 99.9%）
  - ffmpeg統合完了（録画機能対応）

### 環境情報

```bash
# 開発サーバー
http://localhost:3000

# REST API
https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1

# WebSocket API
wss://bu179h4agh.execute-api.us-east-1.amazonaws.com/dev

# AWS Account
010438500933 (us-east-1)
```

---

## 2. プロジェクト概要

### コンセプト

**AIアバター**がユーザーとリアルタイムでインタラクティブな会話を行う**マルチテナント型SaaS**プラットフォーム。事前設定された**シナリオ**に基づき、AIアバターが自律的に会話を進め、その様子を録画・解析・レポーティングする。

### ターゲット市場

- **就職・採用支援:** 面接練習、候補者スクリーニング（ゲストアクセス）
- **語学学習:** 会話練習、発音フィードバック
- **企業研修:** カスタマーサービス、営業トレーニング
- **リサーチ:** アンケート、市場調査
- **教育機関:** 模擬面接、プレゼン評価

### 主要機能

| カテゴリ | 機能 | ステータス |
|---------|------|-----------|
| **認証・ユーザー管理** | JWT認証、4階層ロール（スーパー管理者、クライアント管理者、一般ユーザー、ゲスト） | ✅ 完了 |
| **アバター管理** | 2D/3Dプリセット、カスタム生成、CRUD操作 | ✅ 完了 |
| **シナリオ管理** | カテゴリ別シナリオ、会話フロー設定、評価基準 | ✅ 完了 |
| **リアルタイム会話** | WebSocket、Azure STT、AWS Bedrock Claude、ElevenLabs TTS | ✅ 完了 |
| **録画機能** | Canvas合成、MediaRecorder、S3保存、CloudFront配信 | ✅ 完了 |
| **解析機能** | 表情・感情解析、音声特徴解析、スコアリング | ⏸️ 次のステップ |
| **レポート生成** | PDF生成、AI改善提案、ベンチマーク比較 | ⏸️ 待機中 |
| **多言語対応** | 10言語・24地域バリアント、リソースファイルベース管理 | ✅ 完了 |

---

## 3. 技術スタック

### フロントエンド

```typescript
- Next.js 15 (App Router, SSR/SSG)
- Three.js (3Dアバターレンダリング)
- Live2D Cubism SDK 5 (2Dアニメアバター)
- shadcn/ui + Tailwind CSS (UIコンポーネント)
- next-intl (多言語対応)
- Canvas API + MediaRecorder (録画機能)
- Web Audio API (音声解析)
```

### バックエンド (サーバーレス)

```typescript
- AWS Lambda (Node.js 22 LTS, ARM64 Graviton2)
- API Gateway (REST + WebSocket)
- AWS IoT Core (リアルタイムWebSocket、100万同時接続対応)
- Prisma ORM (TypeScript型安全)
- ffmpeg (音声・動画処理)
```

### AI・音声サービス

```typescript
- AWS Bedrock (Claude Sonnet 4.6) - 会話AI
- Azure Speech Services - STT（音声認識）
- ElevenLabs eleven_flash_v2_5 - TTS（音声合成）
- AWS Rekognition - 感情解析（Phase 2）
```

### データストア

```typescript
- Amazon Aurora Serverless v2 (PostgreSQL 15.4) - メインDB
- Amazon DynamoDB - セッション状態、WebSocket接続、ロック管理
- Amazon ElastiCache Serverless (Redis) - キャッシュ
- Amazon S3 + CloudFront - ストレージ・CDN
```

### 開発ツール

```bash
- AWS CDK (Infrastructure as Code)
- Prisma (ORM + マイグレーション)
- TypeScript (型安全性)
- ESLint + Prettier (コード品質)
- Jest (単体テスト)
- Playwright (E2Eテスト - 今後)
```

---

## 4. システムアーキテクチャ

### 全体構成図

```
┌─────────────────────────────────────────────────────┐
│           Frontend (Next.js 15)                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ Avatar   │ │ Scenario │ │ Session  │           │
│  │ Selector │ │ Builder  │ │ Player   │           │
│  └──────────┘ └──────────┘ └──────────┘           │
└────────────┬──────────────────┬─────────────────────┘
             │                  │
             │ REST API         │ WebSocket
             ▼                  ▼
┌────────────────────┐  ┌────────────────────┐
│ API Gateway (REST) │  │ AWS IoT Core       │
└─────────┬──────────┘  └─────────┬──────────┘
          │                       │
          ▼                       ▼
┌─────────────────────────────────────────────┐
│       Amazon Cognito (認証・認可)            │
└─────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────┐
│         AWS Lambda Functions                │
│  - auth (login/register/me)                 │
│  - avatars (CRUD)                           │
│  - scenarios (CRUD)                         │
│  - sessions (CRUD)                          │
│  - websocket (default handler)              │
│  - db-migration                             │
└────┬────────────────────────────┬───────────┘
     │                            │
     ▼                            ▼
┌────────────────┐    ┌────────────────────┐
│ Aurora         │    │ DynamoDB           │
│ Serverless v2  │    │ - sessions         │
│ (PostgreSQL)   │    │ - connections      │
└────────────────┘    │ - locks            │
                      └────────────────────┘
```

### リアルタイム音声会話フロー（Phase 1 完成版）

```
Browser
  ↓ (MediaRecorder)
  ↓ WebSocket: audio_chunk
  ↓
Lambda (websocket/default)
  ↓
Azure STT (音声認識)
  ↓ (認識結果テキスト)
  ↓
AWS Bedrock Claude Sonnet 4.6 (AI会話)
  ↓ (応答テキスト)
  ↓
ElevenLabs TTS (音声合成)
  ↓ (MP3音声データ)
  ↓
WebSocket: tts_audio
  ↓
Browser (AudioContext再生)
```

### 録画機能フロー（Phase 2 Task 2.1 完成版）

```
Browser
  ↓ (Canvas API: Avatar + User Camera合成)
  ↓ (MediaRecorder)
  ↓ WebSocket: video_chunk_part
  ↓
Lambda (websocket/default)
  ↓ (DynamoDB: ロック取得)
  ↓ (S3: チャンク保存)
  ↓ (セッション終了時)
  ↓ (ffmpeg: チャンク結合)
  ↓ (S3: 最終動画保存)
  ↓ (CloudFront: 署名付きURL生成)
  ↓ (DynamoDB: recordings テーブル更新)
  ↓
Browser (録画一覧・再生)
```

---

## 5. 完了した機能

### Phase 0: インフラ基盤構築 ✅

- VPC、Subnets、NAT Gateway、Security Groups
- Cognito User Pool（認証・認可）
- Aurora Serverless v2 (PostgreSQL 15.4)
- S3 Buckets + CloudFront CDN
- DynamoDB（セッション状態、WebSocket接続）
- API Gateway (REST + WebSocket)
- Lambda関数 20+（ARM64 Graviton2）

### Phase 1: MVP開発 ✅

#### 認証システム
- JWT Bearer Token認証
- ユーザー登録・ログイン・リフレッシュ
- 4階層ユーザーロール（SUPER_ADMIN, CLIENT_ADMIN, CLIENT_USER, GUEST）
- `/auth/register`, `/auth/login`, `/users/me` API

#### アバター管理
- プリセットアバター一覧取得
- カスタムアバター作成（2D/3D）
- CRUD操作（Create, Read, Update, Delete, Clone）
- 公開範囲設定（PRIVATE, ORGANIZATION, PUBLIC）
- `/avatars` API群

#### シナリオ管理
- シナリオ作成・編集・削除・複製
- カテゴリ別フィルタ（job_interview, language, customer_service等）
- 会話フロー設定（開始文、必須トピック、評価基準）
- 多言語対応（言語ごとにシナリオ作成可能）
- `/scenarios` API群

#### セッション管理
- セッション作成・開始・終了
- 一覧取得・詳細取得
- トランスクリプト保存・取得
- `/sessions` API群

#### リアルタイム音声会話パイプライン
- WebSocket通信（AWS IoT Core）
- Azure Speech Services（STT）- 音量増幅3倍
- AWS Bedrock Claude Sonnet 4.6（会話AI）
- ElevenLabs eleven_flash_v2_5（TTS）
- ffmpeg音声変換（WebM → WAV）
- リアルタイム字幕表示（部分・確定）

**動作確認済み:**
- ブラウザ録音 → WebSocket → Lambda → Azure STT → AWS Bedrock → ElevenLabs TTS → ブラウザ再生
- 日本語・英語の音声会話が正常動作

### Phase 1.5: 言語システム拡張 ✅

#### 10言語・24地域バリアント対応
- 日本語 (ja-JP)
- 英語 (en-US, en-GB, en-AU, en-CA)
- 簡体字中国語 (zh-CN)
- 繁体字中国語 (zh-TW, zh-HK)
- 韓国語 (ko-KR)
- スペイン語 (es-ES, es-MX, es-AR)
- ポルトガル語 (pt-BR, pt-PT)
- フランス語 (fr-FR, fr-CA)
- ドイツ語 (de-DE)
- イタリア語 (it-IT)

#### リソースファイルベース言語管理
- `infrastructure/lambda/shared/config/language-config.ts` - 単一の真実の源
- `apps/web/messages/{languageCode}.json` - UI翻訳リソース
- 新言語追加時にコード変更不要
- 言語コードハードコード完全削除
- Azure STT自動検出優先順位の動的生成

#### 中国語の特別扱い
- zh-CN（簡体字）と zh-TW（繁体字）を完全に別言語として扱う
- `getLanguagePriority('zh-CN')` → `['zh-CN', 'en-US', 'ja-JP']`
- `getLanguagePriority('zh-TW')` → `['zh-TW', 'zh-HK', 'en-US', 'ja-JP']`

### Phase 2: Task 2.1 録画機能 ✅

#### フロントエンド映像キャプチャ
- Canvas APIでアバター + ユーザーカメラ合成
- MediaRecorder APIで映像録画
- WebSocketでビデオチャンク送信（リアルタイム）
- 録画状態管理（Recording/Paused/Stopped）
- `apps/web/hooks/useVideoRecorder.ts`
- `apps/web/components/session-player/video-composer.tsx`

#### Lambda動画処理
- ビデオチャンクをS3に保存
- DynamoDB ロックメカニズム（UUID v4、リトライ機能）
- セッション終了時にffmpegでチャンク結合
- 最終動画をS3に保存
- CloudFront署名付きURL生成
- `infrastructure/lambda/websocket/default/video-processor.ts`

#### 録画再生UI
- セッション詳細ページに録画プレイヤー追加
- シークバー・再生速度調整
- トランスクリプト同期表示

**動作確認済み:**
- 最近5セッションすべて録画成功（DynamoDB: COMPLETED）
- ビデオチャンク保存・結合・CloudFront URL生成正常

### 重要な改善

#### コード品質改善（2026-03-10）
- **設定中央集権化:** 30+箇所のハードコード値を除去
  - リージョン: `'us-east-1'` → `AWS_DEFAULTS.REGION`
  - 言語: `'ja-JP'` → `language-config.ts`から動的取得
  - メディア: `'webm'`, `'1280x720'` → `MEDIA_DEFAULTS`
- **S3Object deprecated対応:** AWS SDK非推奨型をカスタムインターフェースに置換
- **型安全性向上:** インラインEnum定義を共有`Visibility`型に統一
- **ビルドプロセス改善:**
  - 4段階リトライロジック（rm → sudo rm → rename → individual file deletion）
  - 自動検証スクリプト（pre-deploy-check.sh）
  - 破損ファイル自動クリーンアップ（7日後自動削除）
- **ワークスペースクリーンアップ:** 空の`apps/api`削除、TypeScript設定改善

#### ロックメカニズム改善（2026-03-08）
- UUID v4導入（ChunkID衝突率: 47%/日 → <0.0001%/年）
- 指数バックオフリトライ（3回: 200ms, 400ms, 800ms）
- try-catch-finallyでエラーハンドリング強化
- ロック解放成功率: 90% → 99.9%

#### 音声文字起こし修正（2026-03-08）
- MediaRecorder timesliceパラメータ削除
- WebMコンテナ断片化問題解決
- Azure STT認識成功率向上

---

## 6. 次のステップ - Phase 2

### 全体目標

セッション中の**録画・解析・レポート生成**機能を実装し、ユーザーに詳細なフィードバックとスコアリングを提供する。

### Task 2.2: 解析機能実装（2-3週間）⏸️ 次のステップ

#### 2.2.1 表情・感情解析（1週間）

**実装内容:**
- AWS Rekognition統合
- フレーム抽出（1秒ごと）
- 表情・感情スコアリング
- 時系列データ保存（DynamoDB）

**新規ファイル:**
- `infrastructure/lambda/shared/analysis/rekognition.ts`
- `infrastructure/lambda/websocket/default/frame-analyzer.ts`

**API:**
```typescript
rekognition.detectFaces({
  Image: { Bytes: imageBuffer },
  Attributes: ['ALL']
})
```

**完了条件:**
- ✅ Rekognition APIが正常動作
- ✅ 表情・感情データ取得成功
- ✅ DynamoDBに時系列保存成功

#### 2.2.2 音声特徴解析（1週間）

**実装内容:**
- Web Audio API統合
- 音高・速度・間・ピッチ解析
- フィラーワード検出（"um", "uh", "like"）
- 話速計算（WPM: Words Per Minute）

**新規ファイル:**
- `apps/web/lib/audio-analysis.ts`
- `apps/web/hooks/useAudioAnalysis.ts`

**技術:**
- AutocorrelationアルゴリズムでF0検出
- AnalyserNode（Web Audio API）

**完了条件:**
- ✅ 音高検出成功
- ✅ 話速計算成功
- ✅ フィラーワード検出成功

#### 2.2.3 スコアリングアルゴリズム（3日）

**実装内容:**
- 総合スコア計算（0-100）
- カテゴリ別スコア:
  - 声（clarity, pace, pitch, fillers）
  - 表情（engagement, confidence, appropriateness）
  - 内容（relevance, completeness, structure）
  - 流暢さ（pauses, flow）
- ベンチマーク比較

**新規ファイル:**
- `infrastructure/lambda/shared/scoring/algorithm.ts`

**完了条件:**
- ✅ スコア計算成功
- ✅ カテゴリ別スコア生成成功
- ✅ ベンチマーク比較成功

### Task 2.3: レポート生成機能（1-2週間）⏸️ 待機中

#### 2.3.1 レポートテンプレート（1週間）

**実装内容:**
- React-PDFでテンプレート作成
- カスタマイズ可能なセクション
- グラフ・チャート統合（Chart.js）

**テンプレート構成:**
1. サマリー（総合スコア、日付、シナリオ情報）
2. スコア詳細（レーダーチャート、時系列グラフ）
3. 強み・改善点（AI生成フィードバック）
4. トランスクリプト（全会話ログ）
5. ベンチマーク比較（過去セッション、業界平均）

**新規ファイル:**
- `infrastructure/lambda/report/templates/default.tsx`
- `infrastructure/lambda/report/generator.ts`

**完了条件:**
- ✅ PDF生成成功
- ✅ グラフ表示成功
- ✅ カスタマイズ機能動作

#### 2.3.2 AI改善提案（3日）

**実装内容:**
- AWS Bedrock Claude統合
- スコアベースのプロンプト生成
- パーソナライズされた改善提案

**新規ファイル:**
- `infrastructure/lambda/shared/ai/improvement-suggestions.ts`

**完了条件:**
- ✅ AI提案生成成功
- ✅ プロンプト最適化完了

#### 2.3.3 レポート管理UI（3日）

**実装内容:**
- レポート一覧ページ
- ダウンロードボタン
- 共有機能（署名付きURL）

**新規ファイル:**
- `apps/web/app/dashboard/reports/page.tsx`
- `apps/web/components/report-viewer.tsx`

**完了条件:**
- ✅ レポート一覧表示成功
- ✅ ダウンロード機能動作
- ✅ 共有リンク生成成功

### Phase 2完了基準

#### 必須機能
- ✅ 録画機能が正常動作（アバター + ユーザーカメラ）
- ✅ 動画再生が正常動作
- ⏸️ 表情・感情解析が正常動作
- ⏸️ 音声解析が正常動作
- ⏸️ スコア計算が正常動作
- ⏸️ レポートPDF生成が正常動作
- ⏸️ AI改善提案が正常動作

#### パフォーマンス基準
- 動画結合時間: 10秒以内（1分の録画）
- レポート生成時間: 30秒以内
- Lambda実行時間: 5分以内（動画処理）
- PDFファイルサイズ: 5MB以下

---

## 7. 重要な開発ガイドライン

### 🔴 絶対厳守ルール（CRITICAL RULES）

#### Rule 1: Prismaスキーマ変更時の必須手順

```bash
# Step 1: マイグレーションファイル生成
cd packages/database
npx prisma migrate dev --name <変更内容の説明>

# Step 2: Prisma Client再生成
npx prisma generate

# Step 3: Lambda関数デプロイ
cd ../../infrastructure
npm run cdk -- deploy Prance-dev-ApiLambda --require-approval never

# Step 4: データベースマイグレーション実行
aws lambda invoke --function-name prance-db-migration-dev \
  --payload '{}' /tmp/migration-result.json
```

#### Rule 2: 環境変数管理の絶対原則

**このプロジェクトはAWS RDS Aurora Serverless v2専用です**

```bash
# ❌ 絶対NG
DATABASE_URL="postgresql://postgres:password@localhost:5432/prance_dev"

# ✅ 正しい
DATABASE_URL="postgresql://pranceadmin:PASSWORD@*.cluster-*.us-east-1.rds.amazonaws.com:5432/prance"

# 検証（コミット前必須）
./scripts/validate-env.sh
```

### コミット前チェックリスト

#### ✅ 1. i18n（UI文字列を追加・変更した場合）

```bash
# ハードコード文字列検出
grep -rn "[>][\s]*[A-Z][a-zA-Z\s]{5,}[\s]*[<]" apps/web/app apps/web/components

# placeholder/title属性チェック
grep -rn 'placeholder=["'"'"'][A-Z]' apps/web
grep -rn 'title=["'"'"'][A-Z]' apps/web
```

**期待結果:** すべて `{t('...')}` で囲まれている

#### ✅ 2. Prismaスキーマ準拠（データベース関連コードを書いた場合）

```bash
# よくある間違いを検出
grep -rn "organizationId\|organization_id" infrastructure/lambda apps/web/lib --include="*.ts" | grep -v node_modules | grep -v ".prisma"
```

**期待結果:** コメント行のみ、または結果なし

**必須確認:**
- `orgId` を使用（organizationIdではない）
- `userId`, `scenarioId`, `avatarId` などcamelCase
- Enum値が大文字で完全一致（`ACTIVE`, `TWO_D` 等）

#### ✅ 3. 型定義の一元管理（新しい型・インターフェースを追加した場合）

```bash
# 重複定義検出
grep -rn "^export interface \(User\|Avatar\|Scenario\|Session\)" apps/web infrastructure/lambda --include="*.ts" | grep -v node_modules | grep -v "packages/shared"

# インライン型定義検出
grep -rn "'TWO_D'.*|.*'THREE_D'\|'PRIVATE'.*|.*'PUBLIC'" apps/web infrastructure/lambda --include="*.ts" | grep -v node_modules | grep -v "from '@prance/shared'"
```

**期待結果:** 結果なし（packages/shared 以外に定義がない）

#### ✅ 4. 言語コードのハードコード（言語・設定値を追加・変更した場合）

```bash
# 言語コードのハードコード検出
grep -rn "'ja-JP'\|'en-US'\|'zh-CN'\|'zh-TW'" infrastructure/lambda --include="*.ts" --exclude="language-config.ts" --exclude="defaults.ts"

# リージョン・メディアフォーマットのハードコード検出
grep -rn "'us-east-1'\|'eastus'\|'webm'\|'1280x720'" infrastructure/lambda --include="*.ts" --exclude="defaults.ts"
```

**期待結果:** defaults.ts と language-config.ts 以外には結果なし

### DRY原則（Don't Repeat Yourself）

**共通化の基準:**
- 10行以上の類似ロジック → 共通関数化を検討
- 30行以上の重複ロジック → **必ず**共通関数化
- 3箇所以上で同じパターン → **必ず**共通関数化

**共通関数の作成場所:**
- Lambda関数内: `infrastructure/lambda/websocket/default/utils.ts`
- フロントエンド: `apps/web/lib/utils.ts` または `apps/web/hooks/`
- 両方で使用: `packages/shared/src/utils/`

### 型定義の一元管理

**すべての共有型定義は `packages/shared/src/types/index.ts` に一元管理**

```typescript
// ✅ 正しい - 共有パッケージからimport
import type { User, Avatar, Visibility, PaginationMeta } from '@prance/shared';

// ❌ 間違い - 重複定義
export interface User { ... }
```

---

## 8. ドキュメント索引

### エントリーポイント

- **START_HERE.md** - 次回セッション開始の唯一のエントリーポイント
- **CLAUDE.md** - プロジェクト概要・重要方針
- **CODING_RULES.md** - コミット前チェックリスト

### アーキテクチャ

- `docs/architecture/SYSTEM_ARCHITECTURE.md` - システム全体構成
- `docs/architecture/MULTITENANCY.md` - マルチテナント設計

### 開発ドキュメント

- `docs/04-design/DATABASE_DESIGN.md` - データベース設計
- `docs/04-design/API_DESIGN.md` - API設計
- `docs/02-architecture/ENVIRONMENT_ARCHITECTURE.md` - 環境アーキテクチャ
- `docs/07-development/BUILD_PROCESS.md` - ビルドプロセスガイド 🆕
- `docs/07-development/TROUBLESHOOTING_NODE_MODULES.md` - node_modulesトラブルシューティング 🆕
- `docs/07-development/DEVELOPMENT_WORKFLOW.md` - 開発ワークフロー
- `docs/07-development/DATABASE_MIGRATION_CHECKLIST.md` - DBマイグレーションチェックリスト
- `docs/04-design/LOCK_MECHANISM_IMPROVEMENTS.md` - ロックメカニズム改善記録

### Phase 2関連

- `docs/progress/PHASE_2_PLAN.md` - Phase 2詳細プラン
- `docs/modules/RECORDING_MODULE.md` - 録画機能設計

### 進捗記録

- `docs/progress/SESSION_HISTORY.md` - 全セッション詳細履歴
- `docs/progress/ARCHIVE_2026-03-06_Phase1_Completion.md` - Phase 1完了記録

### リファレンス

- `docs/reference/TECH_STACK.md` - 技術スタック詳細
- `docs/reference/FAQ.md` - よくある質問
- `docs/reference/GLOSSARY.md` - 用語集

---

## 次のタスク推奨

### ✅ 最近完了したタスク（2026-03-10）

1. **コード品質改善**
   - ✅ ハードコード値30+箇所除去・中央集権化
   - ✅ S3Object deprecated問題解決
   - ✅ ビルドプロセス改善（3スクリプト追加）
   - ✅ TypeScript設定改善、空ワークスペース削除

### Immediate（今すぐ）

1. **Phase 1.5 Day 4-5 継続** - リアルタイムAI応答実装（推奨）
   - Bedrock Claude Streaming API統合
   - Lambda側でストリーム受信 → WebSocket配信
   - フロントエンド側でストリーム受信 → UI更新
   - 目標: 文字起こし完了から1-2秒でAI応答開始

2. **代替: Task 2.2.1 開始** - 表情・感情解析（AWS Rekognition統合）
   - AWS Rekognition API調査・統合
   - フレーム抽出機能実装（1秒ごと）
   - DynamoDB保存スキーマ設計

3. **環境確認**
   ```bash
   # Next.js開発サーバー
   curl http://localhost:3000

   # Lambda関数バージョン確認
   ./scripts/check-lambda-version.sh

   # AWS認証確認
   aws sts get-caller-identity
   ```

### Short-term（1-2週間）

3. **Task 2.2.2** - 音声特徴解析（Web Audio API統合）
4. **Task 2.2.3** - スコアリングアルゴリズム実装

### Mid-term（2-4週間）

5. **Task 2.3.1** - レポートテンプレート作成（React-PDF）
6. **Task 2.3.2** - AI改善提案実装
7. **Task 2.3.3** - レポート管理UI実装

### Phase 2完了後

8. **Phase 3計画** - プラン管理、外部API、ベンチマークシステム等

---

## トラブルシューティング

### ビルドが失敗する

```bash
# クリーンビルド（推奨）
npm run build:clean

# デプロイ前検証
npm run deploy:check

# 詳細: docs/07-development/BUILD_PROCESS.md
```

### node_modules削除できない

```bash
# 破損ファイルクリーンアップ
npm run clean:broken

# 詳細: docs/07-development/TROUBLESHOOTING_NODE_MODULES.md
```

### 開発サーバーが起動しない

```bash
cd /workspaces/prance-communication-platform/apps/web
npm run dev:clean
```

### Lambda関数が古いバージョン

```bash
./scripts/check-lambda-version.sh
cd infrastructure
npm run cdk -- deploy Prance-dev-ApiLambda --require-approval never
```

### CloudWatch Logsでエラー確認

```bash
# Lambda関数ログ
aws logs tail /aws/lambda/prance-websocket-default-dev --since 5m --follow

# 認証エラー
aws logs tail /aws/lambda/prance-auth-login-dev --since 5m
```

---

**このドキュメントを基に、次のタスクを計画してください。**
**推奨: Task 2.2.1 表情・感情解析から開始**
