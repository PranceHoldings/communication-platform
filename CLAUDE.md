# AI アバターコミュニケーションプラットフォーム 企画書

**バージョン:** 2.0
**作成日:** 2026-02-26
**最終更新:** 2026-03-04
**ステータス:** 詳細設計フェーズ

---

## 目次

1. [プロジェクト概要](#1-プロジェクト概要)
2. [ユースケース](#2-ユースケース)
3. [システムアーキテクチャ](#3-システムアーキテクチャ)
4. [コアモジュール設計](#4-コアモジュール設計)
   - 4.1 [アバターモジュール](#41-アバターモジュール)
   - 4.2 [音声モジュール](#42-音声モジュール)
   - 4.3 [シナリオエンジン](#43-シナリオエンジン)
   - 4.4 [セッション・録画モジュール](#44-セッション録画モジュール)
   - 4.5 [トランスクリプト・同期プレイヤー](#45-トランスクリプト同期プレイヤー)
   - 4.6 [感情・非言語解析モジュール](#46-感情非言語解析モジュール)
   - 4.7 [レポートモジュール](#47-レポートモジュール)
   - 4.8 [AIプロンプト管理](#48-aiプロンプト管理)
   - 4.9 [AIプロバイダ管理](#49-aiプロバイダ管理)
   - 4.10 [プロファイルベンチマークシステム](#410-プロファイルベンチマークシステム)
   - 4.11 [外部連携API](#411-外部連携api)
   - 4.12 [サブスクリプション・プラン管理](#412-サブスクリプションプラン管理)
   - 4.13 [多言語対応システム](#413-多言語対応システム)
   - 4.14 [ATS連携システム](#414-ats連携システム)
   - 4.15 [プラグインシステム](#415-プラグインシステム)
5. [マルチテナント・権限設計](#5-マルチテナント権限設計)
6. [データベース設計](#6-データベース設計)
7. [API設計](#7-api設計)
8. [技術スタック](#8-技術スタック)
9. [インフラ構成（AWSサーバーレス）](#9-インフラ構成awsサーバーレス)
10. [実装フェーズ](#10-実装フェーズ)
11. [外部サービス・ライセンス](#11-外部サービスライセンス)
12. [セキュリティ・プライバシー](#12-セキュリティプライバシー)

---

## 1. プロジェクト概要

### コンセプト

AIアバターがユーザーとリアルタイムでインタラクティブな会話を行う**マルチテナント型SaaS**プラットフォーム。事前設定されたシナリオに基づき、AIアバターが自律的に会話を進め、その様子を録画・解析・レポーティングする。

**マルチテナント型SaaSの特徴:**
- 単一のインフラで複数の組織（テナント）を完全分離して管理
- 各組織は独立したデータ領域・設定・ユーザー管理を保有
- スケーラブルなアーキテクチャで数千組織の同時利用に対応
- テナント間のデータ完全分離（Row Level Security）
- 組織ごとのカスタマイズ（ブランディング、AI設定、レポートテンプレート）

### 主要機能サマリー

| カテゴリ | 機能 |
|----------|------|
| **アーキテクチャ** | マルチテナント型SaaS、3階層ユーザーロール、AWSサーバーレス ★ |
| **サブスクリプション** | プラン管理（Free/Pro/Enterprise）、UIからの柔軟な設定、Stripe統合準備 ★ |
| **アバター** | 2D/3Dプリセット、ユーザー画像からの生成、アニメ/リアル系、UI選択システム ★ |
| **音声** | プリセット選択、音声ファイルアップロード、リアルタイム録音、音声クローニング |
| **会話AI** | シナリオベース自律会話、マルチプロバイダ対応（Claude/GPT-4/Gemini等）★ |
| **AI管理** | プロンプトテンプレート管理、プロバイダ切り替え、コスト管理（管理者専用）★ |
| **録画** | アバター映像＋ユーザーカメラの同時録画・合成・再生 |
| **トランスクリプト** | タイムスタンプ付き、動画と同期したクリッカブルトランスクリプト |
| **解析** | 表情・感情・非言語行動解析、音声特徴解析 |
| **レポート** | カスタマイズ可能なテンプレートによる自動レポート生成 |
| **ベンチマーク** | プロファイル比較、成長トラッキング、パーソナライズド改善提案 ★ |
| **外部連携API** | APIキー管理、階層的レート制限、Webhook、OpenAPI仕様 ★ |
| **多言語対応** | 日本語・英語（初期）、将来的に多言語拡張、UI/シナリオ/レポート対応 ★ |
| **ATS連携** | 国内外主要6社対応、候補者同期、結果エクスポート、Webhook連携 ★ |
| **プラグインシステム** | 拡張可能なアーキテクチャ、SDK提供、マーケットプレイス（将来）★ |
| **プラットフォーム管理** | テナント管理、グローバル設定、全体監視（スーパー管理者）★ |

★ = v2.0 新機能・強化機能

### ターゲット市場

- **就職・採用支援:** 面接練習、採用プロセスの標準化、候補者評価の定量化
- **語学学習:** 会話練習、発音・表現フィードバック、多言語対応
- **企業研修:** カスタマーサービス、営業、クレーム対応トレーニング、スキル評価
- **リサーチ:** アンケート、市場調査、ユーザーインタビュー自動化
- **教育機関:** 複数学校・学科での統一プラットフォーム利用、学生ベンチマーク
- **採用代行・人材企業:** 複数クライアント管理、標準化された評価基準

### マルチテナントSaaSの利点

**組織（テナント）にとって:**
- 初期投資不要（インフラ構築・保守コスト削減）
- 即座に利用開始可能（セットアップ時間 < 1時間）
- 自動スケール（10名 → 10,000名まで対応）
- 常に最新バージョン利用可能（自動アップデート）
- データ完全分離によるセキュリティ

**プラットフォーム運営者にとって:**
- 単一インフラで数千組織を管理
- 運用コスト最適化（リソース共有）
- データ駆動の機能改善（全テナント横断分析）
- スケールメリット（契約数増加に伴うコスト逓減）

### 展開形態

**大規模マルチテナントSaaS（500名以上、数千組織対応）**

- **アーキテクチャ:** AWSサーバーレス（Lambda、Aurora Serverless v2、DynamoDB）
- **テナント管理:** 単一インフラで数千組織を完全分離管理
- **スケーラビリティ:** 自動スケール（10ユーザー → 10万ユーザー対応）
- **可用性:** 99.9% SLA、マルチAZ配置、自動フェイルオーバー
- **コスト効率:** 使用量ベース課金、アイドル時コスト最小化
- **メンテナンス:** フルマネージド、サーバー管理不要
- **グローバル展開:** CloudFront CDN、マルチリージョン対応可能
- **多言語:** 初期は日本語・英語、拡張容易な設計
- **サブスクリプション:** 柔軟なプラン管理、Stripe統合準備完了
- **拡張性:** プラグインシステムによる容易な機能拡張

---

## 2. ユースケース

### 2.1 就職・採用面接練習

```
ユーザー → シナリオ選択（業種・職種・難易度）
         → AIアバター面接官と模擬面接（30分）
         → 録画・トランスクリプト生成
         → 感情・非言語解析レポート取得
         → 改善点フィードバック確認
```

### 2.2 語学学習・会話練習

```
ユーザー → 言語・レベル設定
         → ネイティブアバターと自由会話または特定場面設定での練習
         → 発話速度・語彙・流暢さの評価レポート
         → ハイライトシーン（良い表現・改善箇所）確認
```

### 2.3 カスタマーサービス研修

```
管理者  → クレームシナリオ・評価基準を設定・配布
受講者  → クレーム顧客役アバターと対話練習
管理者  → 全受講者のレポートを一覧で確認・比較
```

### 2.4 アンケート・市場調査

```
調査設計者 → 質問シナリオ・インタラクション方法を設定
回答者    → アバターと自然な会話形式でアンケートに回答
調査設計者 → 会話ログ・感情データ・要約レポートを取得
```

---

## 3. システムアーキテクチャ

### 全体構成図（サーバーレスアーキテクチャ）

```
┌───────────────────────────────────────────────────────────────────┐
│                   Frontend (Next.js 15 + AWS Amplify)             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐│
│  │ Avatar   │ │ Scenario │ │ Session  │ │ Report   │ │  Admin  ││
│  │ Selector │ │ Builder  │ │ Player   │ │ Viewer   │ │  Panel  ││
│  │          │ │          │ │          │ │          │ │ (Prompt/││
│  │          │ │          │ │          │ │          │ │Provider)││
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └─────────┘│
└────────────────┬──────────────────────┬───────────────────────────┘
                 │                      │
                 │ REST API             │ WebSocket (IoT Core)
                 ▼                      ▼
┌────────────────────────────┐ ┌────────────────────────────┐
│   API Gateway (REST)       │ │   AWS IoT Core             │
│   - Lambda Authorizer      │ │   - WebSocket API          │
│   - Usage Plans            │ │   - リアルタイム通信        │
│   - レート制限              │ │   - 100万同時接続対応       │
└──────────┬─────────────────┘ └───────────┬────────────────┘
           │                               │
           ▼                               ▼
┌──────────────────────────────────────────────────────────────┐
│              Amazon Cognito (認証・認可・ユーザー管理)         │
│              - User Pools, Identity Pools                     │
│              - OAuth2, SAML SSO, MFA                          │
└──────────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────┐
│                     AWS Lambda Functions                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ Avatar   │ │ Scenario │ │ Session  │ │ AI Prompt│       │
│  │ CRUD     │ │ CRUD     │ │ Manager  │ │ Manager  │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ AI       │ │ WebSocket│ │ Recording│ │ Report   │       │
│  │ Provider │ │ Handler  │ │ Upload   │ │ Generator│       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
└────┬───────────────────────────────────────────┬─────────────┘
     │                                           │
     ▼                                           ▼
┌────────────────────┐              ┌────────────────────────┐
│ Aurora Serverless  │              │     DynamoDB           │
│ v2 (PostgreSQL)    │              │  - セッション状態      │
│ - マスターデータ   │              │  - WebSocket接続管理   │
│ - ユーザー・組織   │              │  - リアルタイムデータ  │
│ - プロンプト設定   │              │  - TTL自動削除         │
└────────────────────┘              └────────────────────────┘
     │                                           │
     └───────────────────┬───────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│              EventBridge + Step Functions                     │
│              (非同期処理オーケストレーション)                  │
│                                                               │
│  セッション完了イベント                                        │
│    ↓                                                          │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Step Functions Workflow                              │    │
│  │  1. 録画検証 (Lambda)                                │    │
│  │  2. 動画合成 (MediaConvert)                          │    │
│  │  3. サムネイル生成 (Lambda) [並列]                   │    │
│  │  4. トランスクリプト再生成 (Lambda) [並列]           │    │
│  │  5. 感情解析 (Lambda → Azure Face API)              │    │
│  │  6. 音声解析 (Lambda → Azure Speech)                │    │
│  │  7. AIレポート生成 (Lambda → Claude API)            │    │
│  │  8. PDF生成 (Lambda + Puppeteer Layer)              │    │
│  │  9. 通知送信 (SNS)                                   │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│              Amazon S3 + CloudFront CDN                       │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐              │
│  │  Recordings│ │  Avatars   │ │  Reports   │              │
│  │  (動画・音声)│ │  (モデル)  │ │  (PDF)     │              │
│  └────────────┘ └────────────┘ └────────────┘              │
│                                                               │
│  - 暗号化 (SSE-KMS)                                          │
│  - Lifecycle Policy (自動削除・移行)                         │
│  - CloudFront 署名付きURL (セキュア配信)                     │
└──────────────────────────────────────────────────────────────┘
```

### サーバーレスアーキテクチャの特徴

**1. 完全マネージド・自動スケール**
- Lambda: リクエスト数に応じて自動スケール（0 → 1000+ 同時実行）
- Aurora Serverless v2: 負荷に応じてACU自動調整（0.5 → 16 ACU）
- DynamoDB: オンデマンドモードで無制限スケール
- IoT Core: 100万同時WebSocket接続対応

**2. コスト効率**
- 使用量ベース課金（アイドル時のコスト最小化）
- Lambda ARM64 (Graviton2): 20%コスト削減
- S3 Intelligent-Tiering: 自動コスト最適化
- 予測コスト（月間1000セッション）: $500-800

**3. 高可用性・スケーラビリティ**
- マルチAZ配置（Aurora, Lambda）
- 自動フェイルオーバー（RTO < 1分）
- グローバルCDN配信（CloudFront）
- 99.9% SLA

**4. メンテナンサビリティ**
- サーバー管理不要（パッチ適用・OS更新自動）
- IaC（AWS CDK）によるインフラコード管理
- 分散トレーシング（X-Ray）で問題の迅速な特定
- CloudWatch統合監視

### リアルタイム通信フロー（サーバーレス）

```
ブラウザ                 IoT Core + Lambda              外部API
   │                           │                            │
   │── WebSocket接続 ─────────>│                            │
   │   (wss://iot-endpoint)    │                            │
   │                           │← Lambda (onConnect)        │
   │                           │  - DynamoDB: 接続情報保存  │
   │                           │  - Cognito: 認証確認       │
   │<─ 接続確立 ───────────────│                            │
   │                           │                            │
   │── セッション開始 ─────────>│← Lambda (sessionStart)     │
   │   { type: "start",        │  - Aurora: セッション作成  │
   │     scenario_id: "..." }  │  - DynamoDB: 状態初期化    │
   │                           │                            │
   │                           │── Claude API ─────────────>│
   │                           │   (システムプロンプト読込)  │
   │<─ 冒頭発話テキスト ────────│<─ AIレスポンス ────────────│
   │                           │                            │
   │                           │── ElevenLabs TTS ─────────>│
   │<─ 音声ストリーム ──────────│<─ 音声 + Visemeデータ ─────│
   │  + Viseme データ          │   (ストリーミング)         │
   │  (アバター口パク開始)      │                            │
   │                           │                            │
   │── ユーザー発話(音声) ──────>│← Lambda (audioChunk)       │
   │   ArrayBuffer chunks      │  - S3: 一時保存            │
   │                           │  - Azure STT呼び出し ──────>│
   │<─ リアルタイム字幕 ────────│<─ テキスト(逐次) ───────────│
   │   (逐次更新)              │                            │
   │                           │                            │
   │── 発話終了 ───────────────>│← Lambda (speechEnd)        │
   │   { type: "speech_end" }  │  - DynamoDB: 発話記録      │
   │                           │  - Claude API ─────────────>│
   │                           │    (コンテキスト含む)       │
   │                           │<─ 応答テキスト ─────────────│
   │                           │                            │
   │                           │── ElevenLabs TTS ─────────>│
   │<─ 音声 + Viseme ───────────│<─ 音声データ ───────────────│
   │                           │                            │
   │       [会話繰り返し]       │                            │
   │                           │                            │
   │── セッション終了 ─────────>│← Lambda (sessionEnd)       │
   │                           │  - Aurora: セッション更新  │
   │                           │  - EventBridge: イベント発行│
   │                           │    → Step Functions起動    │
   │<─ 完了通知 ───────────────│                            │
   │                           │                            │
   │── WebSocket切断 ──────────>│← Lambda (onDisconnect)     │
   │                           │  - DynamoDB: 接続削除      │
```

**サーバーレスアーキテクチャの利点:**

1. **自動スケール:** 同時接続数が100 → 10,000に増えても自動対応
2. **低レイテンシ:** Lambda@Edge + IoT Coreでグローバル配置
3. **コスト効率:** 接続時間ベース課金（アイドル時コストゼロ）
4. **高可用性:** マルチAZ自動フェイルオーバー

---

## 4. コアモジュール設計

### 4.1 アバターモジュール

#### アバタータイプと生成方法

| タイプ | ソース | 生成方法 | レンダリング | アクセス権 |
|--------|--------|----------|-------------|-----------|
| 2D アニメ (プリセット) | Live2D既製モデル | ライブラリから選択 | Canvas 2D / Live2D SDK | 全ユーザー |
| 2D アニメ (画像から) | ユーザーアップロード | AnimeGAN スタイル転換 + 顔ランドマーク駆動 | Canvas 2D | Pro以上 |
| 3D リアル (プリセット) | Ready Player Me 標準モデル群 | ライブラリから選択 | Three.js / WebGL | 全ユーザー |
| 3D リアル (画像から) | ユーザーアップロード | RPM Photo Capture API | Three.js / WebGL | Pro以上 |

#### アバター選択UI（一般ユーザー向け）

```
┌──────────────────────────────────────────────────────────────┐
│ アバター選択                                    [マイアバター] │
├──────────────────────────────────────────────────────────────┤
│ 📂 カテゴリフィルタ                                           │
│ [すべて] [2Dアニメ] [3Dリアル] [マイライブラリ]              │
│                                                               │
│ 🎨 スタイルフィルタ                                           │
│ [すべて] [ビジネス] [カジュアル] [フレンドリー] [フォーマル] │
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ プリセットアバター                                       │  │
│ │ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐            │  │
│ │ │ 👩‍💼│ │ 👨‍💼│ │ 🧑‍🎓│ │ 👩‍🏫│ │ 🧑‍💻│ │ 👨‍⚕️│ ...         │  │
│ │ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘            │  │
│ │ Alex   Sarah  Ken    Lisa   Mike   Emma              │  │
│ │ [選択] [選択] [選択] [選択] [選択] [選択]              │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ カスタムアバター作成 (Pro以上)                 [+ 新規]  │  │
│ │ ┌────┐ ┌────┐ ┌────┐                                   │  │
│ │ │ 📷 │ │ 🖼️ │ │ 🎨 │                                   │  │
│ │ └────┘ └────┘ └────┘                                   │  │
│ │ 写真    画像    AI生成                                   │  │
│ │ アップロード    2D/3D                                    │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                               │
│ 選択中: Alex (3D リアル・ビジネス)            [プレビュー]  │
│                                               [この設定で開始] │
└──────────────────────────────────────────────────────────────┘
```

**選択フロー:**

1. **ユーザーがセッション開始前にアバター選択画面にアクセス**
2. **カテゴリ・スタイルでフィルタリング**
3. **アバターカードをクリックしてプレビュー表示**
   - リアルタイムで3D/2Dモデルが動作する様子を確認
   - サンプル音声で口パクテスト再生
4. **「この設定で開始」をクリックしてセッション設定に進む**

**プリセットアバター管理（管理者）:**

- 管理者は組織専用のカスタムプリセットアバターを追加可能
- アバターごとにタグ・カテゴリ・公開範囲を設定
- アバターライブラリのバージョン管理

#### 画像からのアバター生成パイプライン

```
ユーザー画像アップロード
        │
        ▼
   顔検出・品質チェック (MediaPipe)
   ├── 顔未検出 → エラー返却
   └── 品質不足 → 再アップロード要求
        │
        ├──[2D アニメ風]──────────────────────────────────┐
        │   1. 背景除去 (Remove.bg API)                   │
        │   2. アニメ化 (AnimeGANv2)                      │
        │   3. 顔パーツマスク生成 (目/口/眉)              │
        │   4. MediaPipe 顔ランドマーク → パーツ変形      │
        │   5. リップシンク: Viseme → 口形状マッピング    │
        │                                                  │
        └──[3D リアル風]──────────────────────────────────┘
            1. Ready Player Me Photo Capture API
            2. GLB形式3Dモデル取得
            3. ARKit 52 Blendshapes でリップシンク
            4. Three.js でレンダリング
```

#### リップシンク実装

- **2D:** 音声波形から Viseme (口の形) を推定、Live2D / Canvas パラメータにマッピング
- **3D:** ARKit 52 Blendshapes (jawOpen, mouthFunnel 等) を TTS の Visemeデータから制御
- **ElevenLabs:** `/v1/text-to-speech` のレスポンスに含まれる Alignment データを活用

#### 表情システム

```typescript
// 感情状態 → アバター表情パラメータマッピング例
const emotionToExpression: Record<string, AvatarParams> = {
  neutral:   { mouthSmile: 0.0, eyeWide: 0.0, browRaise: 0.0 },
  happy:     { mouthSmile: 0.8, eyeWide: 0.3, browRaise: 0.1 },
  confused:  { mouthSmile: 0.0, eyeWide: 0.2, browRaise: 0.5 },
  serious:   { mouthSmile: 0.0, eyeWide: 0.0, browRaise: -0.3 },
  surprised: { mouthSmile: 0.2, eyeWide: 0.9, browRaise: 0.8 },
};
```

---

### 4.2 音声モジュール

#### 音声ソースと処理フロー

```
[プリセット]                [ファイルアップロード]         [ブラウザ録音]
     │                              │                           │
     │                    WAV/MP3/M4A受信              MediaRecorder API
     │                    品質チェック                  (推奨: 30秒〜2分)
     │                    (SNR / 長さ / クリッピング)          │
     └──────────────────────┴───────────────────────────────────┘
                                    │
                           ElevenLabs Voice
                           Cloning API
                           → voice_id 生成・DB保存
                                    │
                           ユーザー音声ライブラリに登録
```

#### STT (音声認識)

- **エンジン:** Azure Cognitive Services Speech-to-Text
- **モード:** リアルタイムストリーミング認識
- **対応言語:** 40言語以上
- **出力:** テキスト + タイムスタンプ + 信頼度スコア

#### TTS (音声合成)

- **エンジン:** ElevenLabs API
- **出力形式:** MP3 / PCM (ストリーミング)
- **付加データ:** Alignment (文字ごとのタイムスタンプ) → Viseme変換に使用

#### 音声クローニング利用規約

音声クローニング利用時は以下の同意フローを必須とする：

```
┌─────────────────────────────────────────────────────┐
│  音声クローニングについての確認                       │
│                                                      │
│  アップロードまたは録音する音声について:             │
│  ☑ 自分自身の声である、または使用権を保有している   │
│  ☑ 第三者の権利を侵害しないことを確認している       │
│  ☑ 本サービスの利用規約に同意する                   │
│                                                      │
│                    [同意して続ける]                   │
└─────────────────────────────────────────────────────┘
```

---

### 4.3 シナリオエンジン

#### シナリオ設定スキーマ

```yaml
scenario:
  id: "scenario_uuid"
  title: "エンジニア採用面接 - 中級"
  category: "job_interview"       # job_interview / language / customer_service / survey
  language: "ja"
  max_duration_min: 30
  visibility: "private"           # private / organization / public

  avatar_persona:
    role: "採用担当者"
    personality: "professional"   # friendly / professional / strict / casual
    pressure_level: 3             # 1-5
    background: |
      IT企業のHR Manager、経験10年。
      技術職採用を専門とし、論理的思考を重視する。

  conversation_flow:
    opening: "本日はよろしくお願いします。まず自己紹介をお願いできますか？"
    required_topics:
      - "自己紹介・経歴"
      - "技術スキル確認"
      - "チームワーク経験"
      - "志望動機"
      - "キャリアビジョン"
    follow_up_questions: true
    transition_style: "natural"   # natural / structured

  interaction_params:
    style: "structured"           # structured / free / mixed
    response_wait_sec: 30         # ユーザー回答待機上限
    interruption: false           # 割り込み発話

  evaluation_criteria:
    - metric: "論理的説明力"
      weight: 0.30
      rubric: "具体例を用いて筋道立てて説明できているか"
    - metric: "アイコンタクト"
      weight: 0.20
      rubric: "視線がカメラ方向に向いている時間の割合"
    - metric: "話速・間合い"
      weight: 0.20
      rubric: "適切なWPM（120-160）を維持しているか"
    - metric: "語彙・表現力"
      weight: 0.30
      rubric: "職種に適した語彙を使用しているか"

  report_template_id: "tpl_interview_standard"
```

#### シナリオビルダー UI 構成

```
┌──────────────────────────────────────────────────────────┐
│ シナリオビルダー                      [プレビュー] [保存] │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  ① 基本設定                                              │
│     タイトル / カテゴリ / 言語 / 制限時間 / 公開範囲      │
│                                                           │
│  ② アバターキャラクター設定                              │
│     役割 / 性格スタイル / 圧力レベル / 背景設定           │
│                                                           │
│  ③ 会話フロー設定                                        │
│     開始の一言 / 必須トピック (ドラッグ並び替え可)        │
│     深掘り質問 ON/OFF / 移行スタイル                      │
│                                                           │
│  ④ 評価基準設定                                          │
│     評価項目 / 重み付け (合計100%) / 採点ルーブリック      │
│                                                           │
│  ⑤ レポートテンプレート選択                              │
│     プリセット選択 または カスタムテンプレート指定         │
│                                                           │
│  ⑥ プレビュー & テスト実行                               │
│     設定内容で実際にAIアバターと短時間テスト会話           │
└──────────────────────────────────────────────────────────┘
```

#### System Prompt 生成ロジック

```typescript
function buildSystemPrompt(scenario: Scenario, remainingTopics: string[]): string {
  return `
あなたは${scenario.avatarPersona.role}です。

【キャラクター設定】
性格: ${scenario.avatarPersona.personality}
背景: ${scenario.avatarPersona.background}
圧力レベル: ${scenario.avatarPersona.pressureLevel}/5

【会話の目標】
以下のトピックを自然な流れでカバーすること:
${remainingTopics.map(t => `- ${t}`).join('\n')}

【インタラクション規則】
- 深掘り質問: ${scenario.interactionParams.followUpQuestions ? '積極的に行う' : '最小限にする'}
- 制限時間: ${scenario.maxDurationMin}分を意識すること
- 言語: ${scenario.language}で話すこと
- ユーザーの回答に対して自然に反応し、次トピックへ誘導すること
- 一度に複数の質問をしないこと

【注意】
残り未カバートピック: ${remainingTopics.join(', ')}
  `.trim();
}
```

---

### 4.4 セッション・録画モジュール

#### セッション実行フロー

```
ユーザー操作                フロントエンド                バックエンド
    │                            │                              │
    │── セッション開始 ──────────>│                              │
    │                            │── POST /sessions ────────── >│
    │                            │<─ session_id + WS URL ────── │
    │                            │── WebSocket 接続 ──────────> │
    │                            │                              │
    │   ┌── 録画開始 ──────────────────────────────────────────┐│
    │   │   ユーザーカメラ/マイク → MediaRecorder (WebM)        ││
    │   │   アバター Canvas → captureStream() → MediaRecorder   ││
    │   └──────────────────────────────────────────────────────┘│
    │                            │                              │
    │                            │── 冒頭発話リクエスト ────── >│
    │                            │<─ TTS音声 + Visemeデータ ─── │
    │   アバター発話              │                              │
    │   (音声再生 + リップシンク) │                              │
    │                            │                              │
    │── マイクで発話 ────────────>│── 音声ストリーム ──────────>│
    │   (Azure STT リアルタイム)  │<─ テキスト(逐次) ───────── │
    │   字幕リアルタイム表示       │                              │
    │── 発話終了 ────────────────>│                              │
    │                            │   Claude API 呼び出し        │
    │                            │<─ アバター応答テキスト ───── │
    │                            │   ElevenLabs TTS 生成        │
    │                            │<─ 音声 + Visemeデータ ────── │
    │   アバター応答              │                              │
    │       [会話繰り返し]        │                              │
    │                            │                              │
    │── セッション終了 ──────────>│                              │
    │                            │── 録画ファイル S3アップロード>│
    │                            │                              │
    │                            │   [非同期処理キュー投入]      │
    │                            │   ① FFmpeg 映像合成          │
    │                            │   ② Whisper 再トランスクリプ  │
    │                            │   ③ Azure Face API 感情解析  │
    │                            │   ④ Claude レポート生成       │
    │<─ 処理完了 Push通知 ─────── │<─ 完了イベント ─────────── │
```

#### セッション実行中のUI表示（リアルタイム）

本システムでは、**ユーザーカメラ映像**、**AIアバター映像**、**リアルタイム文字起こし**の3要素を同時にブラウザUI上に表示します。

**画面レイアウト:**

```
┌──────────────────────────────────────────────────────────────────────┐
│ セッション実行中 - エンジニア採用面接   [⚙️設定] [録画中 ●] [終了] │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  【映像表示エリア】                                                   │
│  ┌──────────────────────────┐  ┌───────────────────────────┐        │
│  │   AIアバター（面接官）     │  │  あなた（カメラ映像）      │        │
│  │   Three.js/Live2D         │  │  getUserMedia API         │        │
│  │                           │  │                           │        │
│  │                           │  │                           │        │
│  │      👤                   │  │      📹                   │        │
│  │   リアルタイム             │  │   リアルタイム             │        │
│  │   レンダリング             │  │   カメラ映像              │        │
│  │   60fps                   │  │   30fps (Pro設定)         │        │
│  │                           │  │                           │        │
│  │   💬 話しています          │  │   🎤 聞いています         │        │
│  │   (口パク・表情変化)       │  │   (MediaPipe顔検出中)     │        │
│  │                           │  │                           │        │
│  │   1280x720 (Pro)          │  │   1280x720 (Pro)          │        │
│  └──────────────────────────┘  └───────────────────────────┘        │
│                                                                       │
│  【デバイス制御】                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ 🎤 マイク: [ON ▼]  📹 カメラ: [ON ▼]  [デバイス設定]        │   │
│  │ 🔊 スピーカー音量: ▓▓▓▓▓▓▓▓░░ 80%                           │   │
│  │ 📊 通信状態: 良好 (レイテンシ: 120ms)                        │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  【リアルタイム文字起こし（会話履歴）】                              │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ 00:12 AI: 本日はよろしくお願いします。                       │   │
│  │          まず、簡単に自己紹介をお願いできますか？             │   │
│  │                                                              │   │
│  │ 00:18 YOU: よろしくお願いします。私は山田太郎と申します。    │   │
│  │           現在、Web開発を5年ほど経験しています。             │   │
│  │                                                              │   │
│  │ 00:34 AI: ありがとうございます。具体的にどのような           │   │
│  │          技術スタックをお使いですか？                         │   │
│  │                                                              │   │
│  │ 00:41 YOU: 主にReactとNode.jsを使っています。バックエンド   │   │
│  │           ではExpressやNestJSを... (認識中💭)               │   │
│  │           ↑ 暫定テキスト（グレー表示、リアルタイム更新）     │   │
│  │                                                              │   │
│  │ [自動スクロール：最新の発話を常に表示]                       │   │
│  └──────────────────────────────────────────────────────────────┘   │
│  ▲ スクロールして過去の会話を確認可能                             │
│                                                                       │
│  【セッション情報】                                                   │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ ⏱️  経過時間: 08:34 / 30:00                                  │   │
│  │ 📋 トピック進捗: ██████░░░░ 3/5                             │   │
│  │    ✓ 自己紹介  ✓ 技術スキル  ✓ 経験  □ 志望動機  □ 質問     │   │
│  │ 💾 録画中: 562 MB (user), 558 MB (avatar)                   │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

**3要素の統合構成:**

| 要素 | 技術 | 表示位置 | 更新頻度 | 説明 |
|------|------|---------|---------|------|
| **AIアバター映像** | Three.js / Live2D | 画面左側 | 60fps | リアルタイムレンダリング、口パク・表情変化 |
| **ユーザーカメラ映像** | getUserMedia API | 画面右側 | 30fps (Pro) | リアルタイムカメラ映像、MediaPipe顔検出 |
| **リアルタイム文字起こし** | Azure STT | 画面下部 | リアルタイム | 話者別表示、認識中テキスト（暫定）と確定テキスト |

**UI機能:**

1. **リアルタイム映像表示**
   - **左側: AIアバター**
     - Three.js/Live2D リアルタイムレンダリング（60fps）
     - ElevenLabs Visemeデータに基づく口パク
     - 感情に応じた表情変化
     - 話している/聞いている状態表示

   - **右側: ユーザーカメラ映像**
     - getUserMedia APIによるリアルタイム取得・表示
     - MediaPipe顔検出（表情解析用）
     - 解像度: 640x480 (Free) / 1280x720 (Pro) / 1920x1080 (Enterprise)
     - カメラOFF時はプレースホルダー表示

   - **同時録画**: 両方の映像を同時にMediaRecorderで録画（WebM形式）

2. **リアルタイム文字起こし（会話履歴）**
   - **Azure STT ストリーミング認識**
     - `recognizing` イベント: 暫定テキスト（認識中💭、グレー表示）
     - `recognized` イベント: 確定テキスト（通常表示）

   - **話者別表示**
     - `AI`: アバターの発話（ElevenLabs TTS → Claude応答テキスト）
     - `YOU`: ユーザーの発話（Azure STT → リアルタイム認識）

   - **タイムスタンプ付き**
     - 各発話の開始時刻を表示（00:12, 00:18等）
     - 後の動画再生時に該当箇所へジャンプ可能

   - **自動スクロール**
     - 最新の発話が常に見える位置に自動スクロール
     - 手動スクロールで過去の会話を確認可能

3. **デバイス制御**
   - **マイク**: ON/OFF切り替え、デバイス選択、音量レベル表示
   - **カメラ**: ON/OFF切り替え、デバイス選択、プレビュー表示
   - **スピーカー**: 音量調整（AIアバターの音声）
   - **通信状態**: WebSocketレイテンシ、接続品質表示

4. **セッション情報表示**
   - **経過時間**: 現在時刻 / 制限時間
   - **トピック進捗**: シナリオの必須トピックの達成状況
   - **録画状態**: 録画中インジケーター、ファイルサイズ表示
   - **プライバシー**: カメラOFF時も文字起こしと録画は継続

#### リアルタイム文字起こし実装詳細

**1. Azure STT ストリーミング認識**

```typescript
// hooks/useRealtimeTranscription.ts
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

export function useRealtimeTranscription(sessionId: string) {
  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([]);
  const [currentRecognizing, setCurrentRecognizing] = useState<string>('');

  useEffect(() => {
    // Azure STT設定
    const speechConfig = sdk.SpeechConfig.fromSubscription(
      process.env.AZURE_SPEECH_KEY!,
      process.env.AZURE_SPEECH_REGION!
    );
    speechConfig.speechRecognitionLanguage = 'ja-JP';

    const audioConfig = sdk.AudioConfig.fromDefaultMicrophone();
    const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

    // 認識中（暫定テキスト）→ リアルタイム表示
    recognizer.recognizing = (s, e) => {
      if (e.result.reason === sdk.ResultReason.RecognizingSpeech) {
        console.log(`認識中: ${e.result.text}`);
        setCurrentRecognizing(e.result.text);  // UIに暫定テキスト表示（グレー）
      }
    };

    // 認識完了（確定テキスト）→ 会話履歴に追加
    recognizer.recognized = (s, e) => {
      if (e.result.reason === sdk.ResultReason.RecognizedSpeech) {
        const confirmedText = e.result.text;
        console.log(`確定: ${confirmedText}`);

        // 会話履歴に追加
        const entry: TranscriptEntry = {
          id: generateId(),
          speaker: 'USER',
          text: confirmedText,
          timestampStart: Date.now() / 1000,
          timestampEnd: Date.now() / 1000,
          confidence: 0.95,
          isConfirmed: true
        };

        setTranscriptEntries(prev => [...prev, entry]);
        setCurrentRecognizing('');  // 暫定テキストをクリア

        // WebSocket経由でバックエンドに送信
        sendToBackend({
          type: 'user_speech',
          text: confirmedText,
          timestamp: entry.timestampStart
        });
      }
    };

    // 認識開始
    recognizer.startContinuousRecognitionAsync();

    return () => {
      recognizer.stopContinuousRecognitionAsync();
    };
  }, [sessionId]);

  return { transcriptEntries, currentRecognizing };
}

interface TranscriptEntry {
  id: string;
  speaker: 'AI' | 'USER';
  text: string;
  timestampStart: number;
  timestampEnd: number;
  confidence: number;
  isConfirmed: boolean;  // 確定テキストか暫定テキストか
}
```

**2. アバター発話の文字起こし表示**

```typescript
// WebSocketメッセージハンドラー
useEffect(() => {
  if (!wsClient) return;

  wsClient.onMessage((message: ServerMessage) => {
    switch (message.type) {
      case 'avatar_response':
        // Claude APIからの応答テキスト
        const aiEntry: TranscriptEntry = {
          id: generateId(),
          speaker: 'AI',
          text: message.text,
          timestampStart: Date.now() / 1000,
          timestampEnd: Date.now() / 1000 + estimateDuration(message.text),
          confidence: 1.0,
          isConfirmed: true
        };

        setTranscriptEntries(prev => [...prev, aiEntry]);
        break;

      case 'tts_audio':
        // ElevenLabs音声再生開始（口パク開始）
        playAudio(message.data);
        applyVisemes(message.visemes);
        break;
    }
  });
}, [wsClient]);

// 発話時間推定（文字数から）
function estimateDuration(text: string): number {
  const charCount = text.length;
  const wpm = 140;  // 日本語の平均話速（文字/分）
  return (charCount / wpm) * 60;
}
```

**3. UI表示コンポーネント**

```typescript
// components/RealtimeTranscript.tsx
export function RealtimeTranscript({
  entries,
  currentRecognizing
}: {
  entries: TranscriptEntry[];
  currentRecognizing: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // 新しい発話時に自動スクロール
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries, currentRecognizing]);

  return (
    <div className="transcript-container" ref={scrollRef}>
      <h3>リアルタイム文字起こし（会話履歴）</h3>

      {/* 確定した会話履歴 */}
      {entries.map(entry => (
        <div key={entry.id} className={`transcript-entry ${entry.speaker}`}>
          <span className="timestamp">
            {formatTime(entry.timestampStart)}
          </span>
          <span className="speaker">
            {entry.speaker === 'AI' ? 'AI' : 'YOU'}:
          </span>
          <span className="text">{entry.text}</span>
        </div>
      ))}

      {/* 認識中の暫定テキスト（ユーザー発話） */}
      {currentRecognizing && (
        <div className="transcript-entry USER recognizing">
          <span className="timestamp">
            {formatTime(Date.now() / 1000)}
          </span>
          <span className="speaker">YOU:</span>
          <span className="text provisional">
            {currentRecognizing}
            <span className="indicator"> 💭 (認識中)</span>
          </span>
        </div>
      )}

      {/* 空状態 */}
      {entries.length === 0 && !currentRecognizing && (
        <div className="empty-state">
          会話を開始してください...
        </div>
      )}
    </div>
  );
}
```

**4. スタイリング（話者別色分け）**

```css
/* styles/transcript.css */
.transcript-container {
  max-height: 300px;
  overflow-y: auto;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
}

.transcript-entry {
  margin-bottom: 0.75rem;
  padding: 0.5rem;
  border-radius: 4px;
  animation: fadeIn 0.3s ease-in;
}

/* AI発話: 青系背景 */
.transcript-entry.AI {
  background: #e3f2fd;
  border-left: 3px solid #2196f3;
}

/* ユーザー発話: 緑系背景 */
.transcript-entry.USER {
  background: #e8f5e9;
  border-left: 3px solid #4caf50;
}

/* 認識中（暫定テキスト）: グレー、イタリック */
.transcript-entry.recognizing {
  background: #f5f5f5;
  border-left: 3px dashed #9e9e9e;
}

.transcript-entry .text.provisional {
  color: #757575;
  font-style: italic;
}

.transcript-entry .indicator {
  color: #9e9e9e;
  font-size: 0.875rem;
}

.transcript-entry .timestamp {
  color: #616161;
  font-size: 0.75rem;
  margin-right: 0.5rem;
}

.transcript-entry .speaker {
  font-weight: 600;
  margin-right: 0.5rem;
}

/* AI発話の話者名: 青 */
.transcript-entry.AI .speaker {
  color: #1976d2;
}

/* ユーザー発話の話者名: 緑 */
.transcript-entry.USER .speaker {
  color: #388e3c;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

**5. データフロー（文字起こし）**

```
【ユーザー発話】
ユーザーがマイクで発話
  ↓
getUserMedia → Azure STT（ストリーミング）
  ↓
recognizing イベント（0.1秒ごと）
  ↓
UI: 暫定テキスト表示（グレー、💭認識中）
  ↓
recognized イベント（発話終了時）
  ↓
UI: 確定テキスト表示（通常色）
  ↓
WebSocket → Lambda → Claude API（AI応答生成）

【AI発話】
Claude API応答テキスト
  ↓
WebSocket → ブラウザ
  ↓
UI: AI発話として表示（青背景）
  ↓
ElevenLabs TTS生成
  ↓
音声再生 + アバター口パク
```

#### 録画ファイル構成

| ファイル | 形式 | 保存先 | 説明 |
|----------|------|--------|------|
| `user_{session_id}.webm` | WebM (VP9) | S3 | ユーザーカメラ映像 |
| `avatar_{session_id}.webm` | WebM (VP9) | S3 | アバター映像 |
| `combined_{session_id}.mp4` | MP4 (H.264) | S3 + CDN | サイドバイサイド合成済み |
| `audio_{session_id}.wav` | WAV 16kHz | S3 | 解析用音声 |
| `thumbnail_{session_id}.jpg` | JPEG | S3 + CDN | サムネイル |
| `transcript_{session_id}.json` | JSON | Aurora DB | リアルタイム文字起こし全履歴 |
| `transcript_{session_id}.vtt` | WebVTT | S3 + CDN | 動画字幕ファイル |

#### 録画技術的実装詳細

**1. ユーザーカメラ録画**

```typescript
// ユーザーカメラ取得
const userStream = await navigator.mediaDevices.getUserMedia({
  video: {
    width: { ideal: 1280, max: 1920 },
    height: { ideal: 720, max: 1080 },
    frameRate: { ideal: 30, max: 60 },
    facingMode: 'user'
  },
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 48000,
    channelCount: 1
  }
});

// ユーザー映像を<video>に表示
userVideoElement.srcObject = userStream;

// MediaRecorder で録画
const userRecorder = new MediaRecorder(userStream, {
  mimeType: 'video/webm;codecs=vp9,opus',
  videoBitsPerSecond: 2500000, // 2.5 Mbps
  audioBitsPerSecond: 128000   // 128 kbps
});

const userChunks: Blob[] = [];
userRecorder.ondataavailable = (e) => userChunks.push(e.data);
userRecorder.start(1000); // 1秒ごとにチャンク生成
```

**2. アバターCanvas録画**

```typescript
// Three.js レンダラーからストリーム取得
const avatarCanvas = renderer.domElement;
const avatarStream = avatarCanvas.captureStream(60); // 60fps

// 音声トラック追加（ElevenLabsからの音声）
const audioContext = new AudioContext();
const destination = audioContext.createMediaStreamDestination();
// ... ElevenLabs音声を destination に接続
avatarStream.addTrack(destination.stream.getAudioTracks()[0]);

// MediaRecorder で録画
const avatarRecorder = new MediaRecorder(avatarStream, {
  mimeType: 'video/webm;codecs=vp9,opus',
  videoBitsPerSecond: 2500000,
  audioBitsPerSecond: 128000
});

const avatarChunks: Blob[] = [];
avatarRecorder.ondataavailable = (e) => avatarChunks.push(e.data);
avatarRecorder.start(1000);
```

**3. S3アップロード（セッション終了時）**

```typescript
// セッション終了時
async function uploadRecordings(sessionId: string) {
  // ユーザー録画をBlobに変換
  const userBlob = new Blob(userChunks, { type: 'video/webm' });
  const avatarBlob = new Blob(avatarChunks, { type: 'video/webm' });

  // 署名付きURLを取得（Lambda経由）
  const { userUploadUrl, avatarUploadUrl } = await fetch(
    `/api/sessions/${sessionId}/upload-urls`
  ).then(res => res.json());

  // S3に直接アップロード（並列）
  await Promise.all([
    fetch(userUploadUrl, {
      method: 'PUT',
      body: userBlob,
      headers: { 'Content-Type': 'video/webm' }
    }),
    fetch(avatarUploadUrl, {
      method: 'PUT',
      body: avatarBlob,
      headers: { 'Content-Type': 'video/webm' }
    })
  ]);

  // バックエンドに完了通知 → Step Functions起動
  await fetch(`/api/sessions/${sessionId}/recording-complete`, {
    method: 'POST'
  });
}
```

#### 録画品質設定

| 設定項目 | Free | Pro | Enterprise | 説明 |
|---------|------|-----|------------|------|
| 解像度（ユーザー） | 640x480 | 1280x720 (HD) | 1920x1080 (Full HD) | カメラ映像解像度 |
| 解像度（アバター） | 640x480 | 1280x720 (HD) | 1920x1080 (Full HD) | Canvas解像度 |
| フレームレート | 24fps | 30fps | 60fps | 滑らかさ |
| ビットレート（映像） | 1.5 Mbps | 2.5 Mbps | 5 Mbps | 映像品質 |
| ビットレート（音声） | 64 kbps | 128 kbps | 192 kbps | 音声品質 |
| 最大セッション時間 | 10分 | 30分 | 60分 | 録画時間上限 |

#### ストレージ管理

**ファイルサイズ見積もり（30分セッション、Pro設定）:**

```
ユーザー録画: 2.5 Mbps × 30分 × 60秒 = 562.5 MB
アバター録画: 2.5 Mbps × 30分 × 60秒 = 562.5 MB
合成動画 (H.264): 3 Mbps × 30分 × 60秒 = 675 MB
音声 (WAV 16kHz): 16,000 × 2 bytes × 30 × 60 = 57.6 MB
─────────────────────────────────────────────────
合計: 約 1.86 GB / セッション
```

**ライフサイクルポリシー:**

```yaml
S3 Lifecycle Rules:
  # 生録画ファイル（user/avatar .webm）
  user_recordings/:
    - 7日後: Standard-IA (コスト削減)
    - 90日後: Glacier Instant Retrieval
    - 365日後: 削除（Free/Pro）、保持（Enterprise）

  # 合成動画ファイル（combined .mp4）
  combined_recordings/:
    - 30日間: Standard (頻繁にアクセス)
    - 90日後: Standard-IA
    - 保持期間: プラン別設定に従う
      - Free: 7日
      - Pro: 90日
      - Enterprise: 無制限またはカスタム

  # サムネイル・レポート
  thumbnails/:
    - 永続保持（軽量）

  reports/:
    - 永続保持（軽量）
```

**コスト最適化:**

- **S3 Intelligent-Tiering**: 自動的にアクセス頻度に応じてストレージクラス変更
- **CloudFront 署名付きURL**: 直接S3アクセスを防ぎ、コスト削減
- **ユーザー制御**: ユーザーが不要なセッションを手動削除可能

#### プライバシー・ユーザー制御

**セッション前設定:**

```
┌─────────────────────────────────────────────────────────┐
│ セッション開始前の確認                                   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ 📹 カメラ設定                                            │
│ ○ カメラをONにする（録画・解析に使用）                   │
│ ○ カメラをOFFにする（音声のみ）                         │
│                                                          │
│ 🎤 マイク設定                                            │
│ デバイス: [Built-in Microphone ▼]                       │
│ テスト: ▓▓▓▓▓▓░░░░ (音量確認)                           │
│                                                          │
│ ⚙️ 録画品質                                              │
│ [標準 (720p)] [高品質 (1080p)]  (Pro以上)               │
│                                                          │
│ ℹ️  録画データの取り扱い                                 │
│ • 録画は暗号化してサーバーに保存されます                 │
│ • あなたのみがアクセス可能です                           │
│ • いつでも削除できます                                   │
│ • 詳細: プライバシーポリシー                             │
│                                                          │
│ [✓] 録画・解析に同意する                                │
│                                                          │
│                    [キャンセル]        [セッション開始]  │
└─────────────────────────────────────────────────────────┘
```

**セッション中の制御:**

- **カメラON/OFF切り替え**: いつでも可能（録画は継続、映像のみブランク）
- **マイクミュート**: 一時的にミュート可能
- **緊急停止**: セッション即座に終了、録画停止

**録画後の管理:**

- **閲覧制限**: 本人と組織管理者のみ（権限設定による）
- **削除**: ユーザーがいつでも削除可能
- **ダウンロード**: ローカルに保存可能（Pro以上）
- **共有**: 限定的な共有リンク生成可能（有効期限付き）

#### 合成動画レイアウト

```
┌─────────────────────────────────────────┐
│  ┌──────────────┬──────────────┐        │
│  │  AIアバター  │  ユーザー    │        │
│  │    映像      │   カメラ映像 │        │
│  └──────────────┴──────────────┘        │
│  │████████░░░░░░░░░░│ 12:34 / 30:00│    │
│  [◀◀] [▶] [▶▶]  🔊  ────────────────   │
└─────────────────────────────────────────┘
```

---

### 4.5 トランスクリプト・同期プレイヤー

#### トランスクリプトデータ構造

```typescript
interface TranscriptEntry {
  id: string;
  session_id: string;
  speaker: 'AI' | 'USER';
  text: string;
  timestamp_start: number;   // 秒 (例: 8.34)
  timestamp_end: number;     // 秒 (例: 15.21)
  confidence: number;        // 0.0 - 1.0
  highlight?: 'positive' | 'negative' | 'important' | null;
  emotion_snapshot?: EmotionData;  // その瞬間の感情データ
}
```

#### 同期プレイヤー実装

```typescript
// トランスクリプト ↔ 動画の双方向同期
videoElement.addEventListener('timeupdate', () => {
  const currentTime = videoElement.currentTime;
  const activeEntry = transcript.find(
    e => currentTime >= e.timestamp_start && currentTime <= e.timestamp_end
  );
  if (activeEntry) {
    highlightTranscriptEntry(activeEntry.id);
    scrollTranscriptToEntry(activeEntry.id);
  }
});

// トランスクリプトクリック → 動画シーク
transcriptEntry.addEventListener('click', () => {
  videoElement.currentTime = entry.timestamp_start;
  videoElement.play();
});
```

#### プレイヤー画面構成

```
┌──────────────────────────────────────────────────────────────┐
│  ┌────────────────────────┐  ┌────────────────────────────┐  │
│  │     AIアバター映像      │  │      ユーザー映像          │  │
│  └────────────────────────┘  └────────────────────────────┘  │
│  │████████████░░░░░░░░░░░│  12:34 / 30:00    [×0.75][×1][×1.5]│
│  [◀10s] [▶/⏸] [10s▶]   🔊─────                              │
├──────────────────────────────────────────────────────────────┤
│  トランスクリプト          感情グラフ                         │
│  ┌──────────────────────┐  ┌──────────────────────────────┐  │
│  │00:03 AI  本日はよろし│  │自信度 ──▄▄▄▄▄▂▂▄▄▄▄▄▄▄▃▃──→│  │
│  │         くお願いしま │  │緊張度 ──▃▃▂▂▂▄▄▂▂▂▂▂▂▃▃▂──→│  │
│  │         す。まず...  │  │       0分  10分  20分  30分   │  │
│  │                      │  └──────────────────────────────┘  │
│  │▶ 00:08 YOU よろしく  │  ハイライト                        │
│  │         お願いします │  ┌──────────────────────────────┐  │
│  │                      │  │ ★ 08:23 技術説明が具体的     │  │
│  │  00:15 AI まず自己紹 │  │ ▲ 15:41 視線が外れる傾向     │  │
│  │         介をお願いで │  │ ★ 22:09 志望動機が明確       │  │
│  └──────────────────────┘  └──────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

### 4.6 感情・非言語解析モジュール

#### 解析パイプライン

```
録画完了 (非同期キュー投入)
        │
        ├──[映像解析]────────────────────────────────────────┐
        │   FFmpeg でフレーム抽出 (1fps)                      │
        │   Azure Face API (バッチリクエスト)                 │
        │   出力 per frame:                                   │
        │   {                                                  │
        │     happiness, sadness, anger, surprise,            │
        │     fear, disgust, contempt, neutral: 0.0-1.0,      │
        │     headPose: { roll, pitch, yaw },                 │
        │     eyeGaze: { x, y }   (視線方向)                  │
        │   }                                                  │
        │                                                      │
        ├──[音声解析]────────────────────────────────────────┤
        │   Azure Speech Analytics                            │
        │   出力:                                             │
        │   - 発話速度 WPM (Words Per Minute)                 │
        │   - ピッチ変動 (Hz)                                 │
        │   - 無音区間 (秒・頻度)                             │
        │   - 感情トーン (confident/nervous/enthusiastic)     │
        │                                                      │
        └──[会話内容解析]────────────────────────────────────┘
            トランスクリプト全文 → Claude API
            → 評価基準ごとのスコア (0-100)
            → ハイライト発言の抽出 + タイムスタンプ
            → 改善提案テキスト生成
                       │
                       ▼
               解析結果をDBに保存
               レポート自動生成キュー投入
```

#### 評価ルーブリック設定例

```yaml
# シナリオに設定可能な評価基準
evaluation_rubric:
  eye_contact:
    source: "azure_face"
    metric: "headPose.yaw between -15 and 15"
    scoring:
      excellent: "> 80%"   # 80%以上の時間で正面向き
      good:      "> 60%"
      poor:      "< 60%"

  confidence_score:
    source: "composite"
    formula: "(avg_happiness * 0.4) + (1 - avg_fear) * 0.3 + (speech_tone_confident * 0.3)"

  speaking_pace:
    source: "azure_speech"
    metric: "words_per_minute"
    ideal_range: [120, 160]
    scoring_formula: "gaussian_score(wpm, mean=140, std=20)"

  emotional_stability:
    source: "azure_face"
    metric: "emotion_variance_over_time"
    description: "感情変動の標準偏差が低いほど安定"
```

---

### 4.7 レポートモジュール

#### レポートテンプレート構造

```typescript
interface ReportTemplate {
  id: string;
  name: string;
  sections: ReportSection[];
}

interface ReportSection {
  type: 'summary' | 'score_chart' | 'emotion_timeline'
      | 'highlights' | 'feedback' | 'transcript_excerpt' | 'custom';
  title: string;
  config: {
    ai_prompt?: string;          // Claude への生成指示
    data_source?: string;        // 使用するデータ
    chart_type?: string;         // グラフ種別
    max_items?: number;          // ハイライト最大件数
  };
}
```

#### 標準レポートテンプレート（面接評価）

```
┌──────────────────────────────────────────────────────────┐
│ 面接評価レポート                         2026-02-26      │
│ セッション: エンジニア採用面接 (28分12秒)                │
├──────────────────────────────────────────────────────────┤
│ 総合スコア                                               │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░  73/100                          │
├──────────────────────────────────────────────────────────┤
│ 項目別スコア                                             │
│ 論理的説明力    ████████░░  78  良好                     │
│ アイコンタクト  ██████░░░░  61  要改善                   │
│ 話速・間合い   █████████░  85  優秀                     │
│ 語彙・表現力   ██████░░░░  65  普通                     │
├──────────────────────────────────────────────────────────┤
│ 感情推移グラフ (時系列)                                   │
│  自信度  ──▄▄▄▄▄▂▂▄▄▄▄▄▄▄▃▃▃▃▃──→                     │
│  緊張度  ──▃▃▂▂▂▄▄▂▂▂▂▂▂▃▃▃▃▂──→                     │
│          0分   10分   20分   28分                        │
├──────────────────────────────────────────────────────────┤
│ ハイライトシーン                                          │
│ ★ 00:08:23  Reactのパフォーマンス最適化について...  [▶]  │
│ ▲ 00:15:41  チームでの衝突解決に関して...           [▶]  │
│ ★ 00:22:09  今後のキャリアビジョンについては...     [▶]  │
├──────────────────────────────────────────────────────────┤
│ AIフィードバック                                          │
│ 技術説明は具体的で論理的でした。一方、14分頃からアイコン  │
│ タクトが減少する傾向が見られました。緊張が高まった場面で  │
│ も話速を安定して維持できており、これは強みです。志望動機  │
│ については具体性が高く、好印象でした。                    │
├──────────────────────────────────────────────────────────┤
│ 改善提案                                                  │
│ 1. カメラを意識した練習でアイコンタクトを改善する         │
│ 2. 「えー」「あー」等のフィラーを減らす (計14回検出)      │
│ 3. STAR法を用いた具体的エピソード記述を練習する           │
└──────────────────────────────────────────────────────────┘
```

#### レポート出力形式

- **Web表示:** インタラクティブ (グラフホバー・動画リンク)
- **PDF:** Puppeteer による自動生成
- **CSV:** 数値データのエクスポート
- **JSON:** 外部連携用 API レスポンス

---

### 4.8 AIプロンプト管理

管理者はUI上でAIアバターの会話ロジックを制御するシステムプロンプトとユーザープロンプトをカスタマイズ可能。

#### プロンプト管理画面構成

```
┌──────────────────────────────────────────────────────────────┐
│ AIプロンプト管理 (管理者専用)              [+ 新規テンプレート] │
├──────────────────────────────────────────────────────────────┤
│ 📋 プロンプトテンプレート一覧                                 │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ ✏️ Default Interview Template           [編集] [複製] [削除]│ │
│ │    シナリオ: job_interview | 更新: 2026-03-01            │ │
│ │    使用中: 15セッション                                   │ │
│ ├──────────────────────────────────────────────────────────┤ │
│ │ ✏️ Language Learning Template           [編集] [複製] [削除]│ │
│ │    シナリオ: language | 更新: 2026-02-28                │ │
│ │    使用中: 8セッション                                    │ │
│ └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ プロンプトテンプレート編集: Default Interview Template         │
├──────────────────────────────────────────────────────────────┤
│ 基本情報                                                      │
│ テンプレート名: [Default Interview Template            ]     │
│ 対象シナリオ: [job_interview ▼] 言語: [日本語 ▼]            │
│ 説明: [面接官として自然で専門的な会話を行う            ]     │
│                                                               │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                               │
│ 📝 システムプロンプト                                         │
│ ┌───────────────────────────────────────────────────────┐    │
│ │ あなたは{{role}}です。                                 │    │
│ │                                                        │    │
│ │ 【キャラクター設定】                                   │    │
│ │ 性格: {{personality}}                                 │    │
│ │ 背景: {{background}}                                  │    │
│ │ 圧力レベル: {{pressure_level}}/5                      │    │
│ │                                                        │    │
│ │ 【会話の目標】                                         │    │
│ │ 以下のトピックを自然な流れでカバーすること:            │    │
│ │ {{#each required_topics}}                             │    │
│ │ - {{this}}                                            │    │
│ │ {{/each}}                                             │    │
│ │                                                        │    │
│ │ 【インタラクション規則】                               │    │
│ │ - 深掘り質問: {{follow_up_questions}}                │    │
│ │ - 制限時間: {{max_duration_min}}分を意識すること      │    │
│ │ - 言語: {{language}}で話すこと                        │    │
│ │ - 一度に複数の質問をしないこと                         │    │
│ │ - ユーザーの回答を待ってから次の質問に進むこと         │    │
│ │                                                        │    │
│ │ [変数一覧を表示] [プレビュー] [バリデーション]         │    │
│ └───────────────────────────────────────────────────────┘    │
│                                                               │
│ 💬 ユーザープロンプトテンプレート                             │
│ ┌───────────────────────────────────────────────────────┐    │
│ │ ユーザーの発言: "{{user_message}}"                     │    │
│ │                                                        │    │
│ │ 現在の会話フェーズ: {{conversation_phase}}             │    │
│ │ カバー済みトピック: {{covered_topics}}                 │    │
│ │ 未カバートピック: {{remaining_topics}}                 │    │
│ │ 経過時間: {{elapsed_time}}分                          │    │
│ │                                                        │    │
│ │ 上記を踏まえて、自然で適切な応答を生成してください。   │    │
│ └───────────────────────────────────────────────────────┘    │
│                                                               │
│ 🧪 テスト実行                                                 │
│ サンプルシナリオ: [エンジニア採用面接 ▼]                     │
│ テストメッセージ: [私は5年間バックエンド開発を...    ]       │
│                                                [実行] [結果]  │
│                                                               │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                               │
│ 📊 パフォーマンス設定                                         │
│ Temperature: [0.7    ] (0.0-1.0)                             │
│ Max Tokens:  [2000   ]                                       │
│ Top P:       [0.9    ]                                       │
│                                                               │
│ [キャンセル]                               [保存して適用]    │
└──────────────────────────────────────────────────────────────┘
```

#### プロンプト管理機能

**変数システム:**

- **動的変数:** シナリオ設定から自動的に値が注入される（`{{role}}`, `{{personality}}`, `{{required_topics}}`等）
- **コンテキスト変数:** セッション実行時の状態を反映（`{{elapsed_time}}`, `{{covered_topics}}`等）
- **カスタム変数:** 管理者が独自の変数を定義・マッピング可能

**バージョン管理:**

- プロンプトテンプレートの変更履歴を自動保存
- 過去バージョンへのロールバック機能
- 変更差分の可視化

**テスト機能:**

- プロンプトテンプレート編集中にリアルタイムでAI応答をテスト
- サンプルシナリオと任意のユーザーメッセージで動作確認
- レスポンス品質の評価（文字数、トーン、適切性）

**エクスポート/インポート:**

- JSON/YAML形式でプロンプトテンプレートをエクスポート
- 他組織や環境へのインポート
- プロンプトライブラリの共有

---

### 4.9 AIプロバイダ管理

管理者はUI上で会話AI、TTS、STT等のプロバイダを切り替え・設定可能。マルチプロバイダ対応により、コスト最適化と柔軟性を実現。

#### プロバイダ管理画面構成

```
┌──────────────────────────────────────────────────────────────┐
│ AIプロバイダ管理 (管理者専用)                    [設定保存]  │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│ 🤖 会話AI (Conversation AI)                                  │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ アクティブプロバイダ: [Anthropic Claude ▼]      [変更]  │ │
│ │                                                          │ │
│ │ 利用可能なプロバイダ:                                    │ │
│ │  ● Anthropic Claude (claude-opus-4)        ✓ 設定済み   │ │
│ │  ○ OpenAI GPT-4 Turbo                      ⚙️ 未設定    │ │
│ │  ○ Google Gemini Pro                       ⚙️ 未設定    │ │
│ │  ○ AWS Bedrock (Claude)                    ⚙️ 未設定    │ │
│ │                                                          │ │
│ │ 設定:                                                    │ │
│ │ API Key: [●●●●●●●●●●●●●●●●●●●●]         [更新]        │ │
│ │ Model:   [claude-opus-4 ▼]                              │ │
│ │ Region:  [us-east-1 ▼]                                  │ │
│ │ Endpoint: [https://api.anthropic.com/v1/messages]      │ │
│ │                                              [接続テスト] │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                               │
│ 🔊 音声合成 (TTS)                                             │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ アクティブプロバイダ: [ElevenLabs ▼]            [変更]  │ │
│ │                                                          │ │
│ │ 利用可能なプロバイダ:                                    │ │
│ │  ● ElevenLabs                              ✓ 設定済み   │ │
│ │  ○ Azure Cognitive Services TTS            ⚙️ 未設定    │ │
│ │  ○ Google Cloud TTS                        ⚙️ 未設定    │ │
│ │  ○ AWS Polly                               ⚙️ 未設定    │ │
│ │                                                          │ │
│ │ 設定:                                                    │ │
│ │ API Key: [●●●●●●●●●●●●●●●●●●●●]         [更新]        │ │
│ │ Model:   [eleven_multilingual_v2 ▼]                    │ │
│ │ Output Format: [mp3_44100_128 ▼]                       │ │
│ │                                              [接続テスト] │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                               │
│ 🎤 音声認識 (STT)                                             │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ アクティブプロバイダ: [Azure Speech ▼]          [変更]  │ │
│ │                                                          │ │
│ │ 利用可能なプロバイダ:                                    │ │
│ │  ● Azure Cognitive Services Speech         ✓ 設定済み   │ │
│ │  ○ Google Cloud Speech-to-Text             ⚙️ 未設定    │ │
│ │  ○ AWS Transcribe                          ⚙️ 未設定    │ │
│ │  ○ OpenAI Whisper API                      ⚙️ 未設定    │ │
│ │                                                          │ │
│ │ 設定:                                                    │ │
│ │ Subscription Key: [●●●●●●●●●●●●●●●●●]    [更新]        │ │
│ │ Region:  [eastus ▼]                                     │ │
│ │ Language: [ja-JP ▼] (デフォルト)                        │ │
│ │                                              [接続テスト] │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                               │
│ 😊 感情解析 (Emotion Analysis)                                │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ アクティブプロバイダ: [Azure Face API ▼]        [変更]  │ │
│ │                                                          │ │
│ │ 利用可能なプロバイダ:                                    │ │
│ │  ● Azure Face API                          ✓ 設定済み   │ │
│ │  ○ AWS Rekognition                         ⚙️ 未設定    │ │
│ │  ○ Google Cloud Vision AI                  ⚙️ 未設定    │ │
│ │  ○ MediaPipe (セルフホスト)                ⚙️ 未設定    │ │
│ │                                                          │ │
│ │ 設定:                                                    │ │
│ │ Subscription Key: [●●●●●●●●●●●●●●●●●]    [更新]        │ │
│ │ Endpoint: [https://eastus.api.cognitive.microsoft.com]  │ │
│ │                                              [接続テスト] │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                               │
│ 📊 使用状況ダッシュボード                                     │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ 今月のAPI使用量                                          │ │
│ │                                                          │ │
│ │ 会話AI:    12,450 tokens  ($8.73)   ████████░░ 82%      │ │
│ │ TTS:       8,320 characters ($4.16)  ████░░░░░░ 45%      │ │
│ │ STT:       152 minutes ($1.52)       ██░░░░░░░░ 15%      │ │
│ │ 感情解析:  3,450 images ($13.80)     ██████░░░░ 68%      │ │
│ │                                                          │ │
│ │ 月次予算上限: $100.00 | 使用額: $28.21 | 残り: $71.79   │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                               │
│ [キャンセル]                                    [保存]       │
└──────────────────────────────────────────────────────────────┘
```

#### プロバイダ統合アーキテクチャ

```typescript
// プロバイダ抽象化レイヤー
interface AIProvider {
  type: 'conversation' | 'tts' | 'stt' | 'emotion';
  name: string;

  initialize(config: ProviderConfig): Promise<void>;
  validateConfig(config: ProviderConfig): ValidationResult;
  testConnection(): Promise<boolean>;

  getUsageMetrics(): Promise<UsageMetrics>;
  estimateCost(usage: Usage): Cost;
}

// 会話AIプロバイダインターフェース
interface ConversationAIProvider extends AIProvider {
  generateResponse(
    prompt: string,
    context: ConversationContext,
    options: GenerationOptions
  ): Promise<AIResponse>;
}

// TTSプロバイダインターフェース
interface TTSProvider extends AIProvider {
  synthesizeSpeech(
    text: string,
    voiceId: string,
    options: TTSOptions
  ): Promise<AudioStream>;

  getAvailableVoices(): Promise<Voice[]>;
  cloneVoice?(audioSample: Buffer): Promise<string>;
}

// プロバイダマネージャー
class ProviderManager {
  private providers: Map<string, AIProvider>;

  async switchProvider(
    type: ProviderType,
    providerName: string
  ): Promise<void> {
    // プロバイダの切り替えロジック
    // - 新プロバイダの初期化
    // - 既存セッションへの影響評価
    // - グレースフルな移行
  }

  async executeWithFallback<T>(
    type: ProviderType,
    operation: (provider: AIProvider) => Promise<T>
  ): Promise<T> {
    // フォールバックロジック
    // - プライマリプロバイダで実行
    // - 失敗時は設定されたフォールバックプロバイダで再試行
  }
}
```

#### プロバイダ管理機能

**動的切り替え:**

- リアルタイムでプロバイダを変更可能
- 既存セッションへの影響を最小化
- A/Bテストによる品質・コスト比較

**フォールバック設定:**

- プライマリプロバイダ障害時の自動フォールバック
- 優先順位付けによるカスケード方式

**コスト管理:**

- プロバイダごとの使用量・コストのリアルタイム追跡
- 月次予算上限設定とアラート
- コスト最適化レコメンデーション

**マルチリージョン対応:**

- プロバイダのリージョン選択
- レイテンシ最適化
- データレジデンシー要件への対応

---

### 4.10 プロファイルベンチマークシステム

ユーザーの会話パフォーマンスを全体データと比較し、自身の位置づけや成長を可視化するシステム。

#### プロファイルベンチマーク画面構成

```
┌──────────────────────────────────────────────────────────────┐
│ マイプロファイル・ベンチマーク                    [期間: 3ヶ月▼]│
├──────────────────────────────────────────────────────────────┤
│                                                               │
│ 📊 総合スコア                                                 │
│ ┌────────────────────────────────────────────────────────┐   │
│ │         あなた                全体平均                  │   │
│ │  ┌─────────────┐        ┌─────────────┐              │   │
│ │  │     78      │        │     65      │              │   │
│ │  │   ▲ +5pt   │        │             │              │   │
│ │  └─────────────┘        └─────────────┘              │   │
│ │                                                        │   │
│ │  あなたは全ユーザーの上位 23% に位置しています         │   │
│ │  前月比: +5pt (向上中 📈)                             │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ 📈 項目別ベンチマーク                                         │
│ ┌────────────────────────────────────────────────────────┐   │
│ │                          あなた  平均  上位10%         │   │
│ │ 論理的説明力    ████████░░  78    65    85            │   │
│ │ アイコンタクト  ██████████  90    72    88  ⭐優秀      │   │
│ │ 話速・間合い    █████░░░░░  58    68    80  ⚠要改善   │   │
│ │ 語彙・表現力    ███████░░░  72    63    82            │   │
│ │ 自信度         ███████░░░  70    60    78            │   │
│ │ 感情安定性      ████████░░  82    70    85            │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ 🎯 あなたのプロファイルタイプ                                 │
│ ┌────────────────────────────────────────────────────────┐   │
│ │  「自信と安定感のあるコミュニケーター」                 │   │
│ │                                                        │   │
│ │  類似プロファイル: 全ユーザーの 12%                    │   │
│ │  特徴: 非言語コミュニケーションが強く、安定したトーン  │   │
│ │        で話す傾向。話速の調整で更なる向上が期待。     │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ 📊 成長トラッキング                                           │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ 総合スコア推移 (過去6ヶ月)                             │   │
│ │                                                        │   │
│ │  90 ┤                                            ●     │   │
│ │  80 ┤                                   ●──────●      │   │
│ │  70 ┤                     ●────●───●                  │   │
│ │  60 ┤        ●────●───●                               │   │
│ │  50 ┤  ●──●                                           │   │
│ │     └────┬────┬────┬────┬────┬────┬──→              │   │
│ │         1月  2月  3月  4月  5月  6月                  │   │
│ │                                                        │   │
│ │  🎉 過去6ヶ月で +28pt 向上！                          │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ 💡 パーソナライズド改善提案                                   │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ 1. 話速の改善 (優先度: 高)                             │   │
│ │    現在平均 180 WPM → 目標 140-160 WPM                │   │
│ │    推奨シナリオ: 「ゆっくり話す練習」                   │   │
│ │                                         [練習する]     │   │
│ │                                                        │   │
│ │ 2. 語彙の多様性向上 (優先度: 中)                       │   │
│ │    業界用語の使用率を上げることで+10pt期待              │   │
│ │    推奨シナリオ: 「技術面接 - 上級」                   │   │
│ │                                         [練習する]     │   │
│ │                                                        │   │
│ │ 3. 強みの維持 (優先度: 低)                             │   │
│ │    アイコンタクトは上位10%水準。この強みを活かして    │   │
│ │    他の項目も向上させましょう。                        │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ 🏆 達成バッジ                                                 │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ 🥇 連続10セッション達成                                │   │
│ │ ⭐ 総合スコア75超え                                    │   │
│ │ 📈 1ヶ月で+10pt向上                                    │   │
│ │ 👁️  アイコンタクトマスター (90+)                       │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ [詳細レポートをダウンロード (PDF)]  [全セッション履歴を見る] │
└──────────────────────────────────────────────────────────────┘
```

#### ベンチマーク算出ロジック

```typescript
interface UserProfile {
  user_id: string;
  org_id: string;

  // 総合スコア
  overall_score: number;            // 0-100
  overall_percentile: number;       // 0-100 (パーセンタイル順位)

  // 項目別スコア
  metrics: {
    logical_explanation: number;
    eye_contact: number;
    speaking_pace: number;
    vocabulary: number;
    confidence: number;
    emotional_stability: number;
  };

  // プロファイルタイプ
  profile_type: string;             // クラスタリング結果
  profile_description: string;
  similar_users_percentage: number;

  // 成長データ
  growth_trend: 'improving' | 'stable' | 'declining';
  monthly_change: number;           // 前月比
  six_month_change: number;         // 6ヶ月前比

  // 推奨
  recommendations: Recommendation[];
  achievements: Achievement[];

  last_updated: Date;
}

interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  category: string;
  current_value: number;
  target_value: number;
  description: string;
  suggested_scenarios: string[];
}

// ベンチマーク計算
async function calculateBenchmark(
  userId: string,
  timeframe: 'month' | 'quarter' | 'year'
): Promise<UserProfile> {
  // 1. ユーザーの全セッションデータ取得
  const userSessions = await getSessionsByUser(userId, timeframe);

  // 2. 組織全体のベンチマークデータ取得
  const orgBenchmark = await getOrgBenchmark(user.org_id, timeframe);

  // 3. プラットフォーム全体のベンチマークデータ取得（オプション）
  const globalBenchmark = await getGlobalBenchmark(timeframe);

  // 4. ユーザースコア算出
  const userMetrics = aggregateMetrics(userSessions);

  // 5. パーセンタイル計算
  const percentile = calculatePercentile(
    userMetrics.overall_score,
    orgBenchmark.score_distribution
  );

  // 6. プロファイルタイプ判定（K-means クラスタリング）
  const profileType = classifyProfile(userMetrics, orgBenchmark.clusters);

  // 7. 改善提案生成（Claude API）
  const recommendations = await generateRecommendations(
    userMetrics,
    orgBenchmark,
    userSessions
  );

  return {
    user_id: userId,
    overall_score: userMetrics.overall_score,
    overall_percentile: percentile,
    metrics: userMetrics,
    profile_type: profileType.name,
    profile_description: profileType.description,
    recommendations,
    // ...
  };
}
```

#### ベンチマークデータ集約（非同期処理）

```
EventBridge Schedule (日次 02:00 UTC)
        │
        ▼
┌──────────────────────────────────────┐
│ Lambda: aggregateBenchmarkData       │
│                                      │
│ 1. 全セッションデータ取得 (前日分)   │
│ 2. メトリクス集計（組織別）          │
│ 3. パーセンタイル分布計算            │
│ 4. クラスタリング更新（月次）        │
│ 5. DynamoDB: benchmark_cache 更新   │
└──────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────┐
│ DynamoDB: benchmark_cache テーブル   │
│                                      │
│ PK: org_id#timeframe                 │
│ SK: metric_type                      │
│ TTL: 30日                            │
│                                      │
│ 属性:                                │
│ - score_distribution: [...]          │
│ - percentile_thresholds: {...}       │
│ - clusters: [...]                    │
│ - avg_metrics: {...}                 │
│ - updated_at: timestamp              │
└──────────────────────────────────────┘
```

#### プライバシー・データ保護

**匿名化:**
- ベンチマークデータは統計的に集約され、個人は特定不可
- 最低10ユーザー以上のデータがある場合のみ表示
- 組織内での比較はオプトイン方式

**データ範囲設定（管理者）:**
```
組織設定 > ベンチマーク設定
  ├─ ベンチマーク機能を有効化 [ON/OFF]
  ├─ 比較範囲
  │  ├─ [✓] 組織内のみ
  │  ├─ [ ] 同業界（匿名化）
  │  └─ [ ] 全プラットフォーム（匿名化）
  ├─ 表示項目
  │  └─ ユーザーが閲覧できる項目を選択
  └─ オプトアウト設定
     └─ ユーザーは自身のデータを集計から除外可能
```

---

### 4.11 外部連携API

管理者が発行したAPIキーを使用して、外部システムからプラットフォーム機能にアクセス可能。

#### API管理画面（クライアント管理者）

```
┌──────────────────────────────────────────────────────────────┐
│ API管理 (管理者専用)                         [+ 新しいAPIキー] │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│ 📊 API使用状況サマリー (今月)                                 │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ 総コール数: 45,230 / 100,000  ████████░░  45%         │   │
│ │ 今日:       1,245  / 10,000   ███░░░░░░░  12%         │   │
│ │ 今時間:       124  / 1,000    ███░░░░░░░  12%         │   │
│ │ 成功率:     98.5% (44,551 / 45,230)                   │   │
│ │ エラー:     1.5% (679) [詳細を見る]                   │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ 🔑 APIキー一覧                                                │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ ✅ Production API Key                    [詳細] [編集] │   │
│ │    sk_live_xxxxxxxxxxxxxxxxxxx●●●●●●●●   [無効化]    │   │
│ │    作成日: 2026-01-15 | 最終使用: 2分前               │   │
│ │    権限: 読み取り・書き込み | 制限: 10,000/日         │   │
│ │    使用量: 45,230コール (今月)                         │   │
│ ├────────────────────────────────────────────────────────┤   │
│ │ ✅ Development API Key                   [詳細] [編集] │   │
│ │    sk_test_xxxxxxxxxxxxxxxxxxx●●●●●●●●    [無効化]    │   │
│ │    作成日: 2026-02-01 | 最終使用: 1時間前             │   │
│ │    権限: 読み取りのみ | 制限: 1,000/日                │   │
│ │    使用量: 8,450コール (今月)                          │   │
│ ├────────────────────────────────────────────────────────┤   │
│ │ ⏸️  Staging API Key (無効)                [詳細] [編集] │   │
│ │    sk_test_xxxxxxxxxxxxxxxxxxx●●●●●●●●    [有効化]    │   │
│ │    作成日: 2025-12-20 | 最終使用: 30日前              │   │
│ │    権限: 読み取り・書き込み | 制限: 5,000/日          │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ ⚙️  グローバルAPI設定                                         │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ 組織全体のレート制限 (スーパー管理者設定)              │   │
│ │ 月間上限:     100,000 コール                           │   │
│ │ 日次上限:      10,000 コール                           │   │
│ │ 時間あたり:     1,000 コール                           │   │
│ │                                                        │   │
│ │ 超過時の動作:                                          │   │
│ │ ○ リクエスト拒否 (HTTP 429)                           │   │
│ │ ○ アラート通知                                         │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ 📈 API使用状況グラフ (過去7日間)                              │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ 10k┤                                            ●      │   │
│ │ 8k ┤                                   ●──────●       │   │
│ │ 6k ┤                     ●────●───●                   │   │
│ │ 4k ┤        ●────●───●                                │   │
│ │ 2k ┤  ●──●                                            │   │
│ │    └────┬────┬────┬────┬────┬────┬────┬──→          │   │
│ │        1日  2日  3日  4日  5日  6日  7日             │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ 📚 ドキュメント・サンプルコード                               │
│ [API リファレンス] [クイックスタート] [サンプル集]           │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ 新しいAPIキーを作成                                           │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│ キー名:        [Production API Key                    ]      │
│ 説明:          [本番環境での外部連携用                ]      │
│                                                               │
│ 環境:          ○ 本番 (Live)   ○ テスト (Test)              │
│                                                               │
│ 権限スコープ:                                                 │
│   [✓] sessions.read       セッション読み取り                 │
│   [✓] sessions.write      セッション作成・更新               │
│   [✓] scenarios.read      シナリオ読み取り                   │
│   [ ] scenarios.write     シナリオ作成・更新                 │
│   [✓] reports.read        レポート読み取り                   │
│   [ ] reports.write       レポート生成                       │
│   [✓] avatars.read        アバター読み取り                   │
│   [ ] avatars.write       アバター作成・更新                 │
│   [ ] admin.*             管理者権限 (全アクセス)             │
│                                                               │
│ レート制限 (個別設定):                                        │
│   月間上限:   [50000      ] コール                           │
│   日次上限:   [5000       ] コール                           │
│   時間あたり: [500        ] コール                           │
│                                                               │
│ 有効期限:                                                     │
│   ○ 無期限                                                   │
│   ○ 期限あり: [2026-12-31] まで                             │
│                                                               │
│ IPアドレス制限 (オプション):                                  │
│   [ ] 有効化                                                 │
│   許可リスト: [192.168.1.100, 10.0.0.0/8          ]          │
│                                                               │
│ Webhook URL (オプション):                                     │
│   [https://api.example.com/webhook                ]          │
│   └─ APIキー使用時の通知先                                   │
│                                                               │
│ [キャンセル]                                    [キーを作成]  │
└──────────────────────────────────────────────────────────────┘
```

#### API認証・認可フロー

```typescript
// 1. APIキー認証
POST /api/v1/sessions HTTP/1.1
Host: api.prance-platform.com
Authorization: Bearer sk_live_[YOUR_API_KEY]
Content-Type: application/json

{
  "scenario_id": "scenario_12345",
  "avatar_id": "avatar_67890"
}

// 2. サーバー側認証処理
async function authenticateAPIKey(apiKey: string): Promise<APIKeyContext> {
  // 2.1. APIキー検証
  const keyRecord = await db.api_keys.findOne({
    key_hash: hashAPIKey(apiKey),
    is_active: true,
    expires_at: { $gt: new Date() }
  });

  if (!keyRecord) {
    throw new UnauthorizedError('Invalid or expired API key');
  }

  // 2.2. レート制限チェック
  const rateLimitOk = await checkRateLimit(keyRecord.id, {
    monthly: keyRecord.rate_limit_monthly,
    daily: keyRecord.rate_limit_daily,
    hourly: keyRecord.rate_limit_hourly,
  });

  if (!rateLimitOk) {
    throw new RateLimitExceededError('Rate limit exceeded');
  }

  // 2.3. スコープ検証
  const requiredScope = getRequiredScope(request.endpoint, request.method);
  if (!keyRecord.scopes.includes(requiredScope)) {
    throw new ForbiddenError('Insufficient permissions');
  }

  // 2.4. IPアドレス制限チェック（設定されている場合）
  if (keyRecord.ip_whitelist && keyRecord.ip_whitelist.length > 0) {
    if (!keyRecord.ip_whitelist.includes(request.ip)) {
      throw new ForbiddenError('IP address not allowed');
    }
  }

  // 2.5. 使用状況記録
  await recordAPIUsage(keyRecord.id, {
    endpoint: request.endpoint,
    method: request.method,
    timestamp: new Date(),
  });

  return {
    org_id: keyRecord.org_id,
    user_id: keyRecord.created_by,
    scopes: keyRecord.scopes,
  };
}
```

#### レート制限実装（Redis + Sliding Window）

```typescript
// レート制限チェック（Sliding Window アルゴリズム）
async function checkRateLimit(
  apiKeyId: string,
  limits: RateLimits
): Promise<boolean> {
  const now = Date.now();
  const redis = getRedisClient();

  // 1. 時間あたり制限チェック
  const hourlyKey = `ratelimit:${apiKeyId}:hourly`;
  const hourlyCount = await redis.zcount(
    hourlyKey,
    now - 3600000, // 1時間前
    now
  );

  if (hourlyCount >= limits.hourly) {
    return false;
  }

  // 2. 日次制限チェック
  const dailyKey = `ratelimit:${apiKeyId}:daily`;
  const dailyCount = await redis.zcount(
    dailyKey,
    now - 86400000, // 24時間前
    now
  );

  if (dailyCount >= limits.daily) {
    return false;
  }

  // 3. 月次制限チェック（DynamoDBで管理）
  const monthlyUsage = await getMonthlyUsage(apiKeyId);
  if (monthlyUsage >= limits.monthly) {
    return false;
  }

  // 4. リクエスト記録
  await redis
    .multi()
    .zadd(hourlyKey, now, `${now}-${uuid()}`)
    .expire(hourlyKey, 3600)
    .zadd(dailyKey, now, `${now}-${uuid()}`)
    .expire(dailyKey, 86400)
    .exec();

  return true;
}
```

#### スーパー管理者によるグローバルレート制限設定

```
┌──────────────────────────────────────────────────────────────┐
│ プラットフォームAPI設定 (スーパー管理者専用)                  │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│ グローバルレート制限                                          │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ プラットフォーム全体の上限:                            │   │
│ │ 月間:      [10,000,000  ] コール                       │   │
│ │ 日次:       [500,000    ] コール                       │   │
│ │ 時間あたり:  [50,000    ] コール                       │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ プランごとのデフォルト設定                                    │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ Free プラン:                                           │   │
│ │   月間:    1,000 コール                                │   │
│ │   日次:      100 コール                                │   │
│ │   時間:       10 コール                                │   │
│ │                                                        │   │
│ │ Pro プラン:                                            │   │
│ │   月間:   50,000 コール                                │   │
│ │   日次:    5,000 コール                                │   │
│ │   時間:      500 コール                                │   │
│ │                                                        │   │
│ │ Enterprise プラン:                                     │   │
│ │   月間:  1,000,000 コール                              │   │
│ │   日次:    100,000 コール                              │   │
│ │   時間:     10,000 コール                              │   │
│ │   (カスタム設定可能)                                   │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ テナント別カスタム制限                                        │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ [検索: テナント名またはID]                  [+ 追加]   │   │
│ │                                                        │   │
│ │ Acme Corporation (tenant_12345)             [編集]    │   │
│ │   プラン: Enterprise                                   │   │
│ │   カスタム制限: 月間 5,000,000 コール                  │   │
│ │   現在使用: 2,345,678 (47%)                           │   │
│ │                                                        │   │
│ │ Beta Test Inc (tenant_67890)                [編集]    │   │
│ │   プラン: Free                                         │   │
│ │   カスタム制限: 月間 10,000 コール (特別割当)          │   │
│ │   現在使用: 8,901 (89%) ⚠️                            │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ [保存]                                          [キャンセル]  │
└──────────────────────────────────────────────────────────────┘
```

#### API使用例

```bash
# 1. セッション作成
curl -X POST https://api.prance-platform.com/v1/sessions \
  -H "Authorization: Bearer sk_live_xxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "scenario_id": "scenario_interview_basic",
    "avatar_id": "avatar_preset_001",
    "voice_id": "voice_preset_en_female"
  }'

# Response:
{
  "session_id": "session_abc123",
  "status": "created",
  "websocket_url": "wss://iot.prance-platform.com",
  "connection_token": "conn_token_xyz789"
}

# 2. セッション状態取得
curl -X GET https://api.prance-platform.com/v1/sessions/session_abc123 \
  -H "Authorization: Bearer sk_live_xxxxxxxxxxxxxxxxxxxxx"

# 3. レポート取得
curl -X GET https://api.prance-platform.com/v1/sessions/session_abc123/report \
  -H "Authorization: Bearer sk_live_xxxxxxxxxxxxxxxxxxxxx"

# 4. Webhook通知受信 (APIキー使用時)
POST https://your-server.com/webhook
Content-Type: application/json
X-Prance-Signature: sha256=...

{
  "event": "session.completed",
  "session_id": "session_abc123",
  "timestamp": "2026-03-04T10:30:00Z",
  "data": {
    "overall_score": 78,
    "duration_sec": 1680,
    "report_url": "https://..."
  }
}
```

---

### 4.12 サブスクリプション・プラン管理

スーパー管理者がUIからプラン内容を柔軟に設定可能。将来的にクレジットカード決済に対応。

#### プラン管理画面（スーパー管理者）

```
┌──────────────────────────────────────────────────────────────┐
│ プラン管理 (スーパー管理者専用)                [+ 新規プラン] │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│ 📋 利用可能プラン一覧                                         │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ ✅ Free Plan                              [編集] [複製] │   │
│ │    月額: $0                                            │   │
│ │    アクティブテナント: 1,234                            │   │
│ │    ステータス: 公開中                                   │   │
│ ├────────────────────────────────────────────────────────┤   │
│ │ ✅ Pro Plan                               [編集] [複製] │   │
│ │    月額: $99/月（年間: $999/年 = 16%割引）              │   │
│ │    アクティブテナント: 456                             │   │
│ │    ステータス: 公開中                                   │   │
│ ├────────────────────────────────────────────────────────┤   │
│ │ ✅ Enterprise Plan                        [編集] [複製] │   │
│ │    月額: カスタム見積もり                               │   │
│ │    アクティブテナント: 89                              │   │
│ │    ステータス: 公開中                                   │   │
│ ├────────────────────────────────────────────────────────┤   │
│ │ 📝 Education Plan (Draft)                 [編集] [公開] │   │
│ │    月額: $49/月                                        │   │
│ │    アクティブテナント: 0                               │   │
│ │    ステータス: 非公開（準備中）                         │   │
│ └────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ プラン編集: Pro Plan                                          │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│ 基本情報                                                      │
│ プラン名:        [Pro Plan                            ]      │
│ 内部ID:          [plan_pro_001] (変更不可)                   │
│ 説明:            [プロフェッショナル向けプラン         ]      │
│ 表示順:          [2        ]                                 │
│ ステータス:      ○ 公開   ○ 非公開   ○ 廃止予定             │
│                                                               │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                               │
│ 💰 価格設定                                                   │
│ 通貨:            [USD ▼]                                     │
│ 月額料金:        [$99.00   ]                                 │
│ 年間料金:        [$999.00  ] (月額の [10] ヶ月分)           │
│ セットアップ料金: [$0.00    ]                                │
│ 無料トライアル:   [14      ] 日間                            │
│                                                               │
│ 決済方法: (将来実装)                                          │
│ [ ] Stripe                                                   │
│ [ ] PayPal                                                   │
│ [✓] 請求書払い（Enterprise向け）                             │
│                                                               │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                               │
│ 📊 機能・クォータ設定                                         │
│                                                               │
│ セッション                                                    │
│   月間セッション数:        [50      ] (無制限: [ ])          │
│   録画保存期間:            [90      ] 日 (無制限: [ ])       │
│   同時ユーザー数:          [50      ] (無制限: [ ])          │
│                                                               │
│ アバター                                                      │
│   プリセットアバター数:    [50      ] (無制限: [ ])          │
│   カスタムアバター作成:    [✓] 有効                          │
│   組織専用アバター:        [ ] 有効                          │
│                                                               │
│ 音声                                                          │
│   カスタム音声数:          [10      ] (無制限: [ ])          │
│   音声クローニング:        [✓] 有効                          │
│                                                               │
│ シナリオ                                                      │
│   シナリオ数:              [50      ] (無制限: [ ])          │
│   カスタムシナリオ作成:    [✓] 有効                          │
│                                                               │
│ 解析・レポート                                                │
│   感情解析:                [✓] 有効                          │
│   レポート自動生成:        [✓] 有効                          │
│   カスタムレポート:        [ ] 有効                          │
│                                                               │
│ ベンチマーク                                                  │
│   ベンチマーク機能:        [✓] 有効                          │
│   成長トラッキング期間:    [12      ] ヶ月                   │
│   改善提案レベル:          [詳細 ▼]                          │
│   比較範囲:                [✓] 組織内  [✓] 同業界  [ ] 全体  │
│                                                               │
│ AI管理                                                        │
│   AIプロンプト管理:        [閲覧のみ ▼]                      │
│   AIプロバイダ選択:        [閲覧のみ ▼]                      │
│   マルチプロバイダ:        [ ] 有効                          │
│   コスト管理:              [ ] 有効                          │
│                                                               │
│ 外部連携API                                                   │
│   API アクセス:            [✓] 有効                          │
│   APIキー数:               [3       ] (無制限: [ ])          │
│   月間APIコール数:         [10000   ]                        │
│   日次APIコール数:         [1000    ]                        │
│   時間あたりAPIコール数:   [100     ]                        │
│   Webhook:                 [✓] 有効                          │
│   IPアドレス制限:          [ ] 有効                          │
│                                                               │
│ 統合・連携                                                    │
│   ATS連携:                 [✓] 有効                          │
│   利用可能ATS数:           [3       ] (無制限: [ ])          │
│   カスタムプラグイン:      [ ] 有効                          │
│   データエクスポート:      [✓] 有効                          │
│                                                               │
│ サポート・セキュリティ                                        │
│   SSO/SAML:                [ ] 有効                          │
│   専用サポート:            [メール ▼]                        │
│   SLA保証:                 [ ] 有効 (稼働率: [   ]%)         │
│   監査ログ保持期間:        [90      ] 日 (無制限: [ ])       │
│                                                               │
│ 多言語                                                        │
│   サポート言語数:          [2       ] (標準: 日本語・英語)   │
│   追加言語:                [ ] 有効                          │
│                                                               │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                               │
│ 🎨 プラン表示設定                                             │
│ 推奨バッジ:      [ ] 表示                                    │
│ 強調色:          [#4F46E5] (Indigo)                          │
│ 特徴アイコン:    [⭐] プリセットから選択                     │
│                                                               │
│ マーケティングメッセージ (公開ページ表示用):                  │
│ ┌───────────────────────────────────────────────────────┐    │
│ │ プロフェッショナル向けの充実した機能。                │    │
│ │ 中小企業やチームでの本格的な利用に最適。              │    │
│ └───────────────────────────────────────────────────────┘    │
│                                                               │
│ [キャンセル]    [下書き保存]               [公開して保存]    │
└──────────────────────────────────────────────────────────────┘
```

#### デフォルトプラン設定（初期状態）

```yaml
# Free Plan (デフォルト設定)
free_plan:
  pricing:
    monthly: 0
    annual: 0
    trial_days: 0
  quotas:
    sessions_per_month: 5
    recording_retention_days: 7
    concurrent_users: 3
    preset_avatars: 10
    custom_avatars: false
    org_custom_avatars: false
    custom_voices: 1
    voice_cloning: false
    scenarios: 3
    emotion_analysis: false
    report_generation: false
    custom_reports: false
    benchmark: true
    benchmark_scope: ['org']
    growth_tracking_months: 3
    ai_prompt_management: false
    ai_provider_selection: false
    api_access: false
    api_keys: 0
    ats_integrations: 0
    sso: false
    support_level: 'community'
    languages: 2  # 日本語・英語

# Pro Plan (デフォルト設定)
pro_plan:
  pricing:
    monthly: 99
    annual: 999  # 16% discount
    trial_days: 14
  quotas:
    sessions_per_month: 50
    recording_retention_days: 90
    concurrent_users: 50
    preset_avatars: 50
    custom_avatars: true
    org_custom_avatars: false
    custom_voices: 10
    voice_cloning: true
    scenarios: 50
    emotion_analysis: true
    report_generation: true
    custom_reports: false
    benchmark: true
    benchmark_scope: ['org', 'industry']
    growth_tracking_months: 12
    ai_prompt_management: 'read_only'
    ai_provider_selection: 'read_only'
    api_access: true
    api_keys: 3
    api_monthly_calls: 10000
    api_daily_calls: 1000
    api_hourly_calls: 100
    ats_integrations: 3
    sso: false
    support_level: 'email'
    languages: 2  # 日本語・英語

# Enterprise Plan (デフォルト設定)
enterprise_plan:
  pricing:
    monthly: 'custom'  # カスタム見積もり
    annual: 'custom'
    trial_days: 30
  quotas:
    sessions_per_month: unlimited
    recording_retention_days: unlimited
    concurrent_users: unlimited
    preset_avatars: unlimited
    custom_avatars: true
    org_custom_avatars: true
    custom_voices: unlimited
    voice_cloning: true
    scenarios: unlimited
    emotion_analysis: true
    report_generation: true
    custom_reports: true
    benchmark: true
    benchmark_scope: ['org', 'industry', 'global']
    growth_tracking_months: unlimited
    ai_prompt_management: 'full'
    ai_provider_selection: 'full'
    multi_provider: true
    cost_management: true
    api_access: true
    api_keys: unlimited
    api_monthly_calls: 'custom'
    api_daily_calls: 'custom'
    api_hourly_calls: 'custom'
    webhook: true
    ip_restriction: true
    ats_integrations: unlimited
    custom_plugins: true
    sso: true
    support_level: 'phone_slack'
    sla_guarantee: 99.9
    audit_log_retention_days: unlimited
    languages: 2  # 初期は日本語・英語、追加可能
```

#### 決済システム統合（将来実装）

```typescript
// Stripe統合（将来実装）
interface SubscriptionPayment {
  provider: 'stripe' | 'paypal' | 'invoice';

  // Stripe統合
  stripe?: {
    price_id: string;              // Stripe Price ID
    product_id: string;            // Stripe Product ID
    payment_method_types: string[]; // ['card', 'bank_transfer']
    billing_cycle_anchor?: string; // 請求サイクル
  };

  // 請求書払い（Enterprise向け）
  invoice?: {
    payment_terms: number;         // 支払期限（日数）
    billing_email: string;
    po_number_required: boolean;
  };
}

// サブスクリプションライフサイクル
class SubscriptionManager {
  async createSubscription(
    orgId: string,
    planId: string,
    paymentMethod: PaymentMethod
  ): Promise<Subscription> {
    // 1. プラン情報取得
    const plan = await db.plans.findById(planId);

    // 2. Stripe Subscription作成（将来実装）
    const stripeSubscription = await stripe.subscriptions.create({
      customer: org.stripe_customer_id,
      items: [{ price: plan.stripe_price_id }],
      trial_period_days: plan.trial_days,
      metadata: { org_id: orgId, plan_id: planId }
    });

    // 3. DB記録
    return await db.subscriptions.create({
      org_id: orgId,
      plan_id: planId,
      status: 'active',
      current_period_start: stripeSubscription.current_period_start,
      current_period_end: stripeSubscription.current_period_end,
      stripe_subscription_id: stripeSubscription.id
    });
  }

  async upgradeSubscription(orgId: string, newPlanId: string) {
    // プロレート処理
  }

  async cancelSubscription(orgId: string, cancelAt: 'immediately' | 'period_end') {
    // キャンセル処理
  }
}
```

---

### 4.13 多言語対応システム

初期リリースは日本語・英語対応。将来的に複数言語に拡張可能な設計。

#### サポート言語ロードマップ

```
Phase 1 (初期リリース):
  ✓ 日本語 (ja)
  ✓ 英語 (en)

Phase 2 (3ヶ月後):
  ○ 中国語 簡体字 (zh-CN)
  ○ 中国語 繁体字 (zh-TW) - 台湾
  ○ フランス語 (fr)

Phase 3 (6ヶ月後):
  ○ ドイツ語 (de)
  ○ スペイン語 (es)
  ○ 韓国語 (ko)

Phase 4 (12ヶ月後):
  ○ ポルトガル語 (pt)
  ○ イタリア語 (it)
  ○ その他（需要に応じて）
```

#### 多言語対応の範囲

```
┌──────────────────────────────────────────────────────────────┐
│ 多言語対応コンポーネント                                      │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│ 1. UI/UX                                                      │
│    ├─ フロントエンド全画面                                    │
│    ├─ エラーメッセージ                                        │
│    ├─ バリデーションメッセージ                                │
│    ├─ メール通知                                              │
│    └─ ドキュメント・ヘルプ                                    │
│                                                               │
│ 2. AIアバター会話                                             │
│    ├─ シナリオ（システムプロンプト）                          │
│    ├─ TTS音声（言語ごとに音声選択）                           │
│    ├─ STT音声認識（40言語以上対応）                           │
│    └─ 会話AI（多言語対応モデル）                              │
│                                                               │
│ 3. レポート                                                   │
│    ├─ レポートテンプレート                                    │
│    ├─ AI生成フィードバック                                    │
│    └─ PDF出力                                                 │
│                                                               │
│ 4. データ                                                     │
│    ├─ プリセットアバター名・説明                              │
│    ├─ プリセットシナリオ                                      │
│    ├─ 評価基準・ルーブリック                                  │
│    └─ ベンチマークメッセージ                                  │
│                                                               │
│ 5. API                                                        │
│    ├─ APIドキュメント                                         │
│    ├─ エラーレスポンス                                        │
│    └─ Webhookメッセージ                                       │
└──────────────────────────────────────────────────────────────┘
```

#### 実装アーキテクチャ

```typescript
// フロントエンド: next-intl使用
// app/[locale]/layout.tsx
export default function LocaleLayout({
  children,
  params: { locale }
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider locale={locale}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

// 翻訳ファイル構造
/*
locales/
  ├── ja/
  │   ├── common.json          # 共通UI文言
  │   ├── dashboard.json       # ダッシュボード
  │   ├── scenarios.json       # シナリオ関連
  │   ├── reports.json         # レポート
  │   └── errors.json          # エラーメッセージ
  ├── en/
  │   ├── common.json
  │   ├── dashboard.json
  │   └── ...
  └── zh-CN/
      └── ...
*/

// バックエンド: i18next使用
import i18next from 'i18next';
import Backend from 'i18next-fs-backend';

i18next
  .use(Backend)
  .init({
    lng: 'ja',
    fallbackLng: 'en',
    ns: ['common', 'api', 'email'],
    defaultNS: 'common',
    backend: {
      loadPath: './locales/{{lng}}/{{ns}}.json'
    }
  });

// API レスポンス多言語化
app.get('/api/sessions/:id', async (req, res) => {
  const locale = req.headers['accept-language']?.split(',')[0] || 'en';

  try {
    const session = await getSession(req.params.id);
    res.json(session);
  } catch (error) {
    res.status(404).json({
      error: i18next.t('errors.session_not_found', { lng: locale }),
      code: 'SESSION_NOT_FOUND'
    });
  }
});

// AI会話の多言語対応
interface MultilingualScenario {
  id: string;
  translations: {
    [locale: string]: {
      title: string;
      system_prompt: string;
      opening_message: string;
      required_topics: string[];
    };
  };
}

// TTS音声プロバイダの言語マッピング
const voiceMapping = {
  'ja': { provider: 'elevenlabs', voice_id: 'japanese_female_01' },
  'en': { provider: 'elevenlabs', voice_id: 'english_female_01' },
  'zh-CN': { provider: 'azure', voice_id: 'zh-CN-XiaoxiaoNeural' },
  'zh-TW': { provider: 'azure', voice_id: 'zh-TW-HsiaoChenNeural' },
  'fr': { provider: 'azure', voice_id: 'fr-FR-DeniseNeural' },
  // ...
};
```

#### 言語切り替えUI

```
ヘッダー右上:
  [🌐 日本語 ▼]
    ├─ 日本語 (Japanese)
    ├─ English
    ├─ 中文(简体) - 簡体字中国語
    ├─ 中文(繁體) - 繁体字中国語（台湾）
    ├─ Français
    ├─ Deutsch
    └─ Español

ユーザー設定:
  ├─ インターフェース言語: [日本語 ▼]
  ├─ セッション言語（デフォルト): [日本語 ▼]
  └─ レポート言語: [インターフェースと同じ ▼]
```

---

### 4.14 ATS連携システム

主要ATS（Applicant Tracking System）との連携。国内外それぞれ主要3社をサポート。

#### サポートATS一覧

**国内主要ATS（3社）:**
1. **HRMOS採用** (ビズリーチ)
2. **ジョブカン採用管理**
3. **採用一括かんりくん**

**海外主要ATS（3社）:**
1. **Greenhouse**
2. **Lever**
3. **Workday Recruiting**

#### ATS連携機能

```
┌──────────────────────────────────────────────────────────────┐
│ ATS連携管理 (クライアント管理者)              [+ 新規連携追加] │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│ 🔗 連携中のATS                                                │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ ✅ Greenhouse                          [設定] [テスト]  │   │
│ │    ステータス: 接続中                                   │   │
│ │    最終同期: 2分前                                      │   │
│ │    同期候補者数: 45名                                   │   │
│ │                                                        │   │
│ │    自動同期設定:                                        │   │
│ │    [✓] 候補者情報の自動取得                            │   │
│ │    [✓] セッション結果の自動送信                        │   │
│ │    [ ] レポートPDFの自動添付                           │   │
│ ├────────────────────────────────────────────────────────┤   │
│ │ ⚙️  HRMOS採用                           [設定] [テスト]  │   │
│ │    ステータス: 設定中                                   │   │
│ │    最終同期: -                                          │   │
│ │    認証: OAuth 2.0 (未認証)              [認証する]    │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ 📊 同期統計 (今月)                                            │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ 候補者取得:     152名                                  │   │
│ │ セッション実施: 89セッション                            │   │
│ │ 結果送信:       85件 (成功率: 95%)                     │   │
│ │ エラー:         4件 [詳細]                             │   │
│ └────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ ATS連携設定: Greenhouse                                       │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│ 認証情報                                                      │
│ API Key:     [●●●●●●●●●●●●●●●●●●●●]         [更新]        │
│ エンドポイント: [https://harvest.greenhouse.io/v1/       ]    │
│ 認証方式:    [API Key ▼]                                     │
│                                              [接続テスト]     │
│                                                               │
│ データマッピング                                              │
│ ┌───────────────────────────────────────────────────────┐    │
│ │ Prance           →  Greenhouse                       │    │
│ │ ───────────────────────────────────────────────────  │    │
│ │ user.email       →  candidate.email_addresses[0]    │    │
│ │ user.name        →  candidate.name                  │    │
│ │ session.score    →  scorecard.overall_rating        │    │
│ │ report.pdf_url   →  attachment (note)               │    │
│ │                                                      │    │
│ │ [+ フィールドマッピング追加]                          │    │
│ └───────────────────────────────────────────────────────┘    │
│                                                               │
│ 同期トリガー設定                                              │
│ [✓] 候補者が追加されたとき → Pranceに通知                    │
│ [✓] セッションが完了したとき → ATSに結果送信                 │
│ [✓] レポートが生成されたとき → ATSに添付                     │
│ [ ] 定期同期（日次）                                          │
│                                                               │
│ Webhook設定                                                   │
│ Greenhouse → Prance:                                         │
│   URL: [https://api.prance.com/webhooks/greenhouse    ]      │
│   Secret: [●●●●●●●●●●●●●●●●]                [再生成]       │
│                                                               │
│ [キャンセル]                                    [保存]       │
└──────────────────────────────────────────────────────────────┘
```

#### ATS連携フロー

```
┌─────────────────────────────────────────────────────────────┐
│ 1. 候補者情報取得                                            │
├─────────────────────────────────────────────────────────────┤
│ ATS (Greenhouse)                 Prance Platform            │
│      │                                  │                   │
│      │── Webhook: candidate.created ───>│                   │
│      │   { email, name, job_id }        │                   │
│      │                                  │                   │
│      │                                  ├─ ユーザー作成     │
│      │                                  ├─ 招待メール送信   │
│      │<── 200 OK ───────────────────────│                   │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│ 2. セッション実施                                            │
├─────────────────────────────────────────────────────────────┤
│ 候補者                        Prance Platform               │
│   │                                  │                      │
│   │── ログイン・セッション開始 ─────>│                      │
│   │                                  │                      │
│   │<─ AIアバターと面接 ──────────────│                      │
│   │                                  │                      │
│   │── セッション完了 ────────────────>│                      │
│   │                                  │                      │
│   │                                  ├─ 録画処理            │
│   │                                  ├─ 解析実行            │
│   │                                  ├─ レポート生成        │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│ 3. 結果送信                                                  │
├─────────────────────────────────────────────────────────────┤
│ Prance Platform              ATS (Greenhouse)               │
│      │                                  │                   │
│      │── POST /scorecards ──────────────>│                   │
│      │   {                              │                   │
│      │     candidate_id: "xxx",         │                   │
│      │     interview_id: "yyy",         │                   │
│      │     overall_rating: 4.5,         │                   │
│      │     attributes: [                │                   │
│      │       {name:"論理性", rating:4}, │                   │
│      │       {name:"表現力", rating:5}  │                   │
│      │     ]                            │                   │
│      │   }                              │                   │
│      │<── 201 Created ───────────────────│                   │
│      │                                  │                   │
│      │── POST /attachments ──────────────>│                   │
│      │   { type:"pdf", url:"..." }      │                   │
│      │<── 201 Created ───────────────────│                   │
└─────────────────────────────────────────────────────────────┘
```

#### ATS連携APIアダプター

```typescript
// ATS統合の抽象化レイヤー
interface ATSAdapter {
  provider: 'greenhouse' | 'lever' | 'workday' | 'hrmos' | 'jobkan' | 'kanri';

  // 認証
  authenticate(credentials: ATSCredentials): Promise<void>;
  testConnection(): Promise<boolean>;

  // 候補者データ取得
  getCandidates(filters?: CandidateFilter): Promise<Candidate[]>;
  getCandidate(id: string): Promise<Candidate>;

  // 結果送信
  createScorecard(data: ScorecardData): Promise<string>;
  addAttachment(candidateId: string, file: File): Promise<string>;
  updateCandidateStatus(candidateId: string, status: string): Promise<void>;

  // Webhook
  handleWebhook(payload: any): Promise<WebhookResult>;
}

// Greenhouseアダプター実装例
class GreenhouseAdapter implements ATSAdapter {
  async createScorecard(data: ScorecardData): Promise<string> {
    const response = await fetch(
      `${this.baseUrl}/scorecards`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(this.apiKey + ':')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          application_id: data.applicationId,
          interview_id: data.interviewId,
          submitted_at: new Date().toISOString(),
          overall_recommendation: this.mapScoreToRecommendation(data.overallScore),
          attributes: data.metrics.map(m => ({
            name: m.name,
            type: 'rating',
            value: m.score,
            note: m.feedback
          }))
        })
      }
    );

    const result = await response.json();
    return result.id;
  }

  private mapScoreToRecommendation(score: number): string {
    if (score >= 80) return 'definitely_yes';
    if (score >= 60) return 'yes';
    if (score >= 40) return 'mixed';
    return 'no';
  }
}

// ATSマネージャー
class ATSIntegrationManager {
  private adapters: Map<string, ATSAdapter> = new Map();

  async syncCandidates(orgId: string): Promise<void> {
    const integrations = await db.ats_integrations.find({ org_id: orgId, is_active: true });

    for (const integration of integrations) {
      const adapter = this.getAdapter(integration.provider);
      const candidates = await adapter.getCandidates();

      // Pranceユーザーとして登録
      for (const candidate of candidates) {
        await this.createOrUpdateUser(orgId, candidate);
      }
    }
  }

  async sendSessionResult(sessionId: string): Promise<void> {
    const session = await db.sessions.findById(sessionId);
    const report = await db.reports.findOne({ session_id: sessionId });
    const user = await db.users.findById(session.user_id);

    // ATS連携情報取得
    const integration = await db.ats_integrations.findOne({
      org_id: user.org_id,
      is_active: true
    });

    if (!integration) return;

    const adapter = this.getAdapter(integration.provider);

    // スコアカード送信
    await adapter.createScorecard({
      candidateId: user.ats_candidate_id,
      applicationId: user.ats_application_id,
      overallScore: report.overall_score,
      metrics: report.section_scores,
      feedback: report.ai_feedback
    });

    // PDFレポート添付
    if (report.pdf_url) {
      await adapter.addAttachment(user.ats_candidate_id, report.pdf_url);
    }
  }
}
```

---

### 4.15 プラグインシステム

拡張性の高いプラグインアーキテクチャにより、容易にデータ連携を追加可能。

#### プラグインアーキテクチャ

```
┌──────────────────────────────────────────────────────────────┐
│                   Prance Platform Core                        │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────────────────────────────────────────┐      │
│  │          Plugin Manager                            │      │
│  │  - プラグイン登録・管理                             │      │
│  │  - ライフサイクル管理 (install/enable/disable)     │      │
│  │  - 依存関係解決                                     │      │
│  │  - サンドボックス実行                               │      │
│  └────────────────────────────────────────────────────┘      │
│                          │                                    │
│  ┌───────────────────────┴───────────────────────┐           │
│  │         Plugin Extension Points               │           │
│  │  - Data Export Plugins                        │           │
│  │  - ATS Integration Plugins                    │           │
│  │  - Authentication Plugins (SSO)               │           │
│  │  - Report Generation Plugins                  │           │
│  │  - Webhook Plugins                            │           │
│  └───────────────────────────────────────────────┘           │
└──────────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
   ┌────▼────┐      ┌────▼────┐      ┌────▼────┐
   │ ATS     │      │ HRIS    │      │ Custom  │
   │ Plugin  │      │ Plugin  │      │ Plugin  │
   └─────────┘      └─────────┘      └─────────┘
```

#### プラグインマニフェスト

```yaml
# plugin.yaml
plugin:
  id: "greenhouse-integration"
  name: "Greenhouse ATS Integration"
  version: "1.0.0"
  author: "Prance Team"
  description: "Greenhouse ATSとの双方向連携プラグイン"

  # サポートされるプラットフォームバージョン
  platform_version: ">=2.0.0"

  # プラグインタイプ
  type: "ats_integration"

  # 必要な権限
  permissions:
    - "users.read"
    - "users.write"
    - "sessions.read"
    - "reports.read"
    - "webhooks.receive"

  # 設定スキーマ
  config_schema:
    type: "object"
    required: ["api_key", "endpoint"]
    properties:
      api_key:
        type: "string"
        title: "Greenhouse API Key"
        secret: true
      endpoint:
        type: "string"
        title: "API Endpoint"
        default: "https://harvest.greenhouse.io/v1"
      auto_sync:
        type: "boolean"
        title: "自動同期を有効化"
        default: true

  # エクステンションポイント
  extension_points:
    - name: "ats.candidate.sync"
      description: "候補者データの同期"
    - name: "ats.result.export"
      description: "セッション結果のエクスポート"
    - name: "webhook.receiver"
      description: "Webhookイベントの受信"

  # 依存関係
  dependencies:
    - plugin_id: "oauth2-provider"
      version: "^1.0.0"

  # リソース
  resources:
    icon: "assets/greenhouse-icon.svg"
    documentation: "docs/README.md"
    license: "MIT"
```

#### プラグイン開発SDK

```typescript
// @prance/plugin-sdk

import { Plugin, PluginContext } from '@prance/plugin-sdk';

export class GreenhousePlugin extends Plugin {
  // 初期化
  async onInstall(context: PluginContext): Promise<void> {
    console.log('Greenhouse Plugin installed');

    // データベーステーブル作成
    await context.db.createTable('greenhouse_mappings', {
      prance_user_id: 'string',
      greenhouse_candidate_id: 'string',
      greenhouse_application_id: 'string'
    });
  }

  // プラグイン有効化
  async onEnable(context: PluginContext): Promise<void> {
    // Webhook登録
    await context.webhooks.register({
      event: 'session.completed',
      handler: this.handleSessionCompleted.bind(this)
    });
  }

  // エクステンションポイント実装
  @ExtensionPoint('ats.candidate.sync')
  async syncCandidates(context: PluginContext): Promise<SyncResult> {
    const config = await context.getConfig();
    const client = new GreenhouseClient(config.api_key);

    const candidates = await client.getCandidates();

    for (const candidate of candidates) {
      // Pranceユーザーとして作成
      await context.api.users.create({
        email: candidate.email_addresses[0],
        name: candidate.name,
        org_id: context.org_id,
        metadata: {
          source: 'greenhouse',
          candidate_id: candidate.id
        }
      });

      // マッピング保存
      await context.db.insert('greenhouse_mappings', {
        prance_user_id: user.id,
        greenhouse_candidate_id: candidate.id
      });
    }

    return { synced: candidates.length };
  }

  @ExtensionPoint('ats.result.export')
  async exportResult(context: PluginContext, sessionId: string): Promise<void> {
    const config = await context.getConfig();
    const client = new GreenhouseClient(config.api_key);

    // セッション情報取得
    const session = await context.api.sessions.get(sessionId);
    const report = await context.api.reports.get(sessionId);
    const user = await context.api.users.get(session.user_id);

    // Greenhouse候補者ID取得
    const mapping = await context.db.findOne('greenhouse_mappings', {
      prance_user_id: user.id
    });

    if (!mapping) {
      throw new Error('Greenhouse候補者マッピングが見つかりません');
    }

    // スコアカード送信
    await client.createScorecard({
      candidate_id: mapping.greenhouse_candidate_id,
      application_id: mapping.greenhouse_application_id,
      overall_rating: this.mapScore(report.overall_score),
      attributes: report.section_scores.map(s => ({
        name: s.name,
        rating: s.score,
        note: s.feedback
      }))
    });

    context.logger.info('Greenhouseにスコアカード送信完了', { session_id: sessionId });
  }

  // Webhookハンドラー
  private async handleSessionCompleted(event: WebhookEvent, context: PluginContext) {
    const config = await context.getConfig();

    if (config.auto_sync) {
      await this.exportResult(context, event.data.session_id);
    }
  }

  private mapScore(score: number): number {
    // 0-100 → 1-5 スケール変換
    return Math.ceil(score / 20);
  }
}

// エクスポート
export default GreenhousePlugin;
```

#### プラグインマーケットプレイス（将来構想）

```
┌──────────────────────────────────────────────────────────────┐
│ プラグインマーケットプレイス                  [検索: ATS    ] │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│ カテゴリ:                                                     │
│ [すべて] [ATS連携] [HRIS連携] [認証] [レポート] [分析]      │
│                                                               │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ 🟢 Greenhouse Integration              [公式] [インストール]│
│ │    v1.2.0 | 4.8⭐ (245レビュー)                         │
│ │    Greenhouse ATSとの完全連携                           │
│ │    無料                                                 │
│ ├────────────────────────────────────────────────────────┤   │
│ │ 🟢 Lever ATS Integration               [公式] [インストール]│
│ │    v1.0.5 | 4.5⭐ (89レビュー)                          │
│ │    Lever ATSとのシームレスな統合                        │
│ │    無料                                                 │
│ ├────────────────────────────────────────────────────────┤   │
│ │ 🔵 Workday Integration                 [公式] [インストール]│
│ │    v2.1.0 | 4.9⭐ (412レビュー)                         │
│ │    Workday Recruiting連携                              │
│ │    無料                                                 │
│ ├────────────────────────────────────────────────────────┤   │
│ │ 🟡 Custom HRIS Connector        [コミュニティ] [インストール]│
│ │    v0.9.2 | 4.2⭐ (34レビュー)                          │
│ │    汎用HRIS連携プラグイン                               │
│ │    $29/月                                               │
│ └────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

#### プラグインセキュリティ

```typescript
// プラグインサンドボックス実行
class PluginSandbox {
  async execute(
    plugin: Plugin,
    method: string,
    args: any[],
    context: PluginContext
  ): Promise<any> {
    // 1. 権限チェック
    this.validatePermissions(plugin, method);

    // 2. リソース制限
    const limits = {
      memory: '256MB',
      timeout: 30000, // 30秒
      cpu: '0.5'      // 0.5 CPU
    };

    // 3. Lambda Layerとして実行（隔離環境）
    const result = await this.executeInIsolation(plugin, method, args, limits);

    // 4. 結果検証
    this.validateResult(result);

    return result;
  }

  private validatePermissions(plugin: Plugin, method: string): void {
    const requiredPermissions = this.getRequiredPermissions(method);
    const grantedPermissions = plugin.manifest.permissions;

    for (const perm of requiredPermissions) {
      if (!grantedPermissions.includes(perm)) {
        throw new PluginSecurityError(`Permission denied: ${perm}`);
      }
    }
  }
}
```

---

## 5. マルチテナント・権限設計

### マルチテナントアーキテクチャ概要

```
┌─────────────────────────────────────────────────────────────┐
│           Platform (管理プロバイダ運営)                      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Super Admin (スーパー管理者)                         │  │
│  │  - 全テナント管理                                     │  │
│  │  - グローバル設定・プラン管理                         │  │
│  │  - システム監視・メンテナンス                         │  │
│  │  - API レート制限設定（グローバル）                   │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌──────────────┬──────────────┬──────────────┬──────────┐  │
│  │  Tenant A    │  Tenant B    │  Tenant C    │   ...    │  │
│  └──────────────┴──────────────┴──────────────┴──────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 3階層ユーザーロール設計

#### レベル1: スーパー管理者（管理プロバイダ）★NEW

**役割:** プラットフォーム全体の運営・管理

**権限:**

```
Platform Management
  │
  ├── テナント管理
  │    ├── テナント作成・削除・一時停止
  │    ├── プラン割り当て (Free/Pro/Enterprise)
  │    ├── 契約管理・課金設定
  │    └── テナント別使用状況監視
  │
  ├── グローバルAPI設定 ★NEW
  │    ├── API レート制限（プラットフォーム全体）
  │    │    ├── 全テナント合計コール数上限
  │    │    ├── テナントごとのデフォルト上限設定
  │    │    └── 時間あたりコール数制限（RPM, RPD）
  │    ├── API エンドポイント有効化/無効化
  │    └── API バージョン管理
  │
  ├── システム設定
  │    ├── 利用可能な AI プロバイダ設定
  │    ├── デフォルトプロンプトテンプレート管理
  │    ├── グローバルアバターライブラリ管理
  │    └── セキュリティポリシー設定
  │
  ├── 監視・分析
  │    ├── 全テナントのパフォーマンス監視
  │    ├── コスト分析（プロバイダ別・テナント別）
  │    ├── エラーログ・インシデント管理
  │    └── 利用統計ダッシュボード
  │
  └── メンテナンス
       ├── システムアップデート・メンテナンス
       ├── データバックアップ・リストア
       └── 障害対応・サポート
```

#### レベル2: クライアント管理者（組織管理者）

**役割:** 自組織（テナント）内の管理・運用

**権限:**

```
Organization (Tenant) Management
  │
  ├── 組織設定
  │    ├── 組織プロフィール・ブランディング
  │    ├── 組織内ユーザー招待・管理
  │    ├── 部署・グループ管理
  │    └── SSO設定 (Enterprise)
  │
  ├── コンテンツ管理
  │    ├── 組織共有シナリオ管理
  │    ├── レポートテンプレート管理
  │    ├── 組織専用アバター管理
  │    └── 公開テンプレート承認
  │
  ├── AI設定管理 (Enterprise)
  │    ├── AIプロンプトテンプレート管理
  │    │    ├── システムプロンプト編集
  │    │    ├── 変数定義・マッピング
  │    │    └── プロンプトバージョン管理
  │    ├── AIプロバイダ管理
  │    │    ├── プロバイダ選択・切り替え
  │    │    ├── API認証情報管理
  │    │    ├── フォールバック設定
  │    │    └── コスト管理・予算設定
  │
  ├── 外部連携API管理 ★NEW
  │    ├── API キー発行・管理
  │    │    ├── キー作成（名前・有効期限・スコープ設定）
  │    │    ├── キーの有効化/無効化
  │    │    ├── キーローテーション
  │    │    └── キー使用状況監視
  │    ├── API 権限設定
  │    │    ├── エンドポイント別アクセス制御
  │    │    ├── 読み取り/書き込み権限設定
  │    │    └── IPアドレス制限（オプション）
  │    ├── レート制限設定（組織内）
  │    │    ├── 組織内全APIキー合計上限
  │    │    ├── APIキーごとの上限設定
  │    │    └── 時間あたり制限（RPM, RPH, RPD）
  │    └── API 使用状況ダッシュボード
  │         ├── コール数・成功率・エラー率
  │         ├── レート制限超過アラート
  │         └── コスト追跡
  │
  ├── 分析・レポート
  │    ├── 組織全体のセッション分析
  │    ├── ユーザー別パフォーマンス比較
  │    ├── プロファイルベンチマーク閲覧 ★NEW
  │    └── コスト・使用量レポート
  │
  └── セキュリティ・監査
       ├── アクセスログ閲覧
       ├── 監査ログエクスポート
       └── コンプライアンスレポート
```

#### レベル3: クライアントユーザー（一般ユーザー）

**役割:** セッション実行・自己データ管理

**権限:**

```
User Operations
  │
  ├── セッション実行
  │    ├── シナリオ選択・セッション開始
  │    ├── アバター選択・カスタマイズ (Pro以上)
  │    ├── 音声選択・カスタマイズ
  │    └── リアルタイム会話実行
  │
  ├── コンテンツ作成
  │    ├── 個人シナリオ作成
  │    ├── カスタムアバター作成 (Pro以上)
  │    ├── 音声クローニング (Pro以上)
  │    └── 組織共有提案（管理者承認制）
  │
  ├── データ管理
  │    ├── 自分のセッション閲覧・削除
  │    ├── トランスクリプト確認
  │    ├── レポート閲覧・ダウンロード
  │    └── 録画動画の再生・共有
  │
  ├── プロファイル・ベンチマーク ★NEW
  │    ├── 自分のプロファイル閲覧
  │    ├── 全体ベンチマーク比較
  │    ├── スキル成長トラッキング
  │    └── パーソナライズド改善提案
  │
  └── 設定
       ├── プロフィール編集
       ├── 通知設定
       └── プライバシー設定
```

### ロール権限マトリクス

| 機能 | スーパー管理者 | クライアント管理者 | クライアントユーザー |
|------|---------------|-------------------|-------------------|
| **プラットフォーム管理** |
| テナント作成・削除 | ✓ | - | - |
| グローバルAPI制限設定 | ✓ | - | - |
| システム監視 | ✓ | - | - |
| **組織管理** |
| 組織設定 | ✓（全テナント） | ✓（自組織のみ） | - |
| ユーザー管理 | ✓（全テナント） | ✓（自組織のみ） | - |
| AIプロンプト管理 | ✓（全テナント） | ✓（自組織のみ、Enterprise） | - |
| AIプロバイダ管理 | ✓（全テナント） | ✓（自組織のみ、Enterprise） | - |
| **API管理** ★NEW |
| APIキー発行 | ✓（全テナント） | ✓（自組織のみ） | - |
| API権限設定 | ✓（全テナント） | ✓（自組織のみ） | - |
| レート制限設定（組織内） | ✓（全テナント） | ✓（自組織のみ） | - |
| **コンテンツ管理** |
| シナリオ作成 | ✓（全テナント） | ✓（自組織のみ） | ✓（個人のみ） |
| アバター作成 | ✓（全テナント） | ✓（組織専用） | ✓（個人、Pro以上） |
| レポートテンプレート | ✓（全テナント） | ✓（自組織のみ） | - |
| **セッション実行** |
| セッション実行 | ✓ | ✓ | ✓ |
| 全ユーザーセッション閲覧 | ✓（全テナント） | ✓（自組織のみ） | -（自分のみ） |
| **分析・ベンチマーク** ★NEW |
| 全体ベンチマーク閲覧 | ✓（全データ） | ✓（自組織データ） | ✓（自分のみ） |
| プロファイル比較 | ✓ | ✓ | ✓ |

### プランと制限

| 機能 | Free | Pro | Enterprise |
|------|------|-----|------------|
| **基本機能** | | | |
| 月間セッション数 | 5 | 50 | 無制限 |
| 録画保存期間 | 7日 | 90日 | 無制限 |
| 同時ユーザー数 | 3 | 50 | 無制限 |
| **アバター** | | | |
| プリセットアバター数 | 10種類 | 50種類 | 無制限 |
| カスタムアバター作成 | - | ✓ | ✓ |
| 組織専用アバター | - | - | ✓ |
| **音声** | | | |
| カスタム音声 | 1 | 10 | 無制限 |
| 音声クローニング | - | ✓ | ✓ |
| **シナリオ** | | | |
| シナリオ数 | 3 | 50 | 無制限 |
| カスタムシナリオ作成 | ✓ (制限付き) | ✓ | ✓ |
| **解析・レポート** | | | |
| 感情解析 | - | ✓ | ✓ |
| レポート自動生成 | - | ✓ | ✓ |
| カスタムレポートテンプレート | - | - | ✓ |
| **ベンチマーク** ★NEW | | | |
| プロファイルベンチマーク | ✓ (組織内のみ) | ✓ (組織内のみ) | ✓ (全範囲) |
| 成長トラッキング | 3ヶ月 | 12ヶ月 | 無制限 |
| パーソナライズド改善提案 | 基本 | 詳細 | AI詳細分析 |
| ベンチマーク比較範囲 | 組織内 | 組織内 + 同業界 | 全範囲選択可 |
| **AI管理** ★NEW | | | |
| AIプロンプト管理 | - | 閲覧のみ | ✓ 完全編集 |
| AIプロバイダ選択 | 固定 (Claude) | 閲覧のみ | ✓ 完全管理 |
| マルチプロバイダ対応 | - | - | ✓ |
| コスト管理ダッシュボード | - | - | ✓ |
| **外部連携API** ★NEW | | | |
| API アクセス | - | ✓ (制限付き) | ✓ |
| API キー数 | - | 3 | 無制限 |
| 月間APIコール数 | - | 10,000 | カスタム設定可 |
| 日次APIコール数 | - | 1,000 | カスタム設定可 |
| 時間あたりAPIコール数 | - | 100 | カスタム設定可 |
| Webhook | - | ✓ | ✓ |
| IPアドレス制限 | - | - | ✓ |
| カスタムレート制限 | - | - | ✓ |
| **統合・セキュリティ** | | | |
| SSO サポート | - | - | ✓ |
| 専用サポート | - | メール | 電話・Slack |
| SLA保証 | - | - | 99.9% |
| 監査ログ | - | 90日 | 無制限 |

---

## 6. データベース設計

### 主要テーブル (ERD 概要)

```
# ============== プラットフォーム管理 ==============
platform_settings ★NEW
  id, global_api_rate_limits_json
  plan_default_limits_json, system_config_json
  supported_languages_json ★NEW
  created_at, updated_at

plans ★NEW
  id, internal_id(unique), name, description
  status(public/draft/deprecated)
  display_order, is_recommended, highlight_color
  pricing_json (monthly, annual, trial_days, setup_fee)
  quotas_json (sessions, users, avatars, etc.)
  features_json (enabled features by category)
  stripe_price_id, stripe_product_id (将来実装)
  created_at, updated_at

subscriptions ★NEW
  id, org_id(FK), plan_id(FK)
  status(trial/active/past_due/canceled)
  current_period_start, current_period_end
  trial_end_date, cancel_at_period_end
  stripe_subscription_id (将来実装)
  created_at, updated_at, canceled_at

# ============== 組織・ユーザー管理 ==============
organizations
  id, name, subscription_id(FK) ★NEW
  settings_json, branding_json
  benchmark_settings_json, api_settings_json
  locale(default language), supported_locales_json ★NEW
  stripe_customer_id (将来実装)
  created_at, updated_at

users
  id, org_id(FK), email, name
  role(super_admin/client_admin/client_user) ★UPDATED
  profile_json, preferences_json
  locale(preferred language) ★NEW
  benchmark_opt_in(boolean) ★NEW
  ats_candidate_id, ats_application_id ★NEW
  created_at, last_login_at

# ============== アバター・音声 ==============
avatars
  id, user_id(FK), org_id(FK), name, type(2d/3d), style(anime/real)
  source(preset/generated/org_custom), model_url, thumbnail_url
  config_json, tags, visibility(private/org/public), created_at

voices
  id, user_id(FK), name, source(preset/clone/upload)
  elevenlabs_voice_id, sample_url, created_at

# ============== シナリオ・プロンプト ==============
scenarios
  id, user_id(FK), org_id(FK), title, category, language
  visibility(private/org/public), config_json
  report_template_id(FK), prompt_template_id(FK), created_at

prompt_templates ★NEW
  id, org_id(FK), name, description, category
  system_prompt, user_prompt_template, variables_schema_json
  performance_config_json (temperature, max_tokens, top_p)
  version, parent_version_id(FK), is_active
  created_by(FK), created_at, updated_at

prompt_template_versions ★NEW
  id, prompt_template_id(FK), version_number
  system_prompt, user_prompt_template, variables_schema_json
  change_summary, created_by(FK), created_at

# ============== AIプロバイダ ==============
ai_providers ★NEW
  id, org_id(FK), type(conversation/tts/stt/emotion)
  provider_name, is_active, priority_order
  config_json (api_key_encrypted, endpoint, region, model)
  cost_config_json, usage_limits_json
  created_at, updated_at

ai_provider_usage ★NEW
  id, org_id(FK), provider_id(FK), session_id(FK)
  usage_type(conversation/tts/stt/emotion)
  tokens_used, characters_used, minutes_used, images_processed
  estimated_cost, timestamp

# ============== セッション・録画 ==============
sessions
  id, user_id(FK), scenario_id(FK), avatar_id(FK), voice_id(FK)
  prompt_template_id(FK), provider_snapshot_json
  status(active/processing/completed/error)
  started_at, ended_at, duration_sec

recordings
  id, session_id(FK), type(user/avatar/combined)
  s3_url, cdn_url, thumbnail_url, file_size_bytes, created_at

transcripts
  id, session_id(FK), speaker(AI/USER), text
  timestamp_start, timestamp_end, confidence
  highlight(positive/negative/important/null)

# ============== 解析データ ==============
emotion_data
  id, session_id(FK), frame_number, timestamp_sec
  happiness, sadness, anger, surprise, fear, disgust, neutral
  head_pitch, head_roll, head_yaw, gaze_x, gaze_y

audio_analysis
  id, session_id(FK)
  avg_wpm, pitch_variance, filler_word_count
  silence_ratio, tone_scores_json

# ============== レポート ==============
reports
  id, session_id(FK), template_id(FK)
  overall_score, section_scores_json
  ai_feedback, highlights_json
  pdf_url, generated_at

report_templates
  id, org_id(FK), name, is_default
  sections_json, created_at

# ============== ベンチマーク（新規） ★NEW ==============
user_profiles ★NEW
  id, user_id(FK), org_id(FK)
  overall_score, overall_percentile
  metrics_json (logical_explanation, eye_contact, speaking_pace, etc.)
  profile_type, profile_description
  growth_trend, monthly_change, six_month_change
  recommendations_json, achievements_json
  last_calculated_at, created_at, updated_at

benchmark_aggregates ★NEW
  id, org_id(FK), scope(org/industry/global)
  timeframe(month/quarter/year)
  score_distribution_json, percentile_thresholds_json
  avg_metrics_json, clusters_json
  user_count, calculated_at, expires_at

user_profile_history ★NEW
  id, user_id(FK), snapshot_date
  overall_score, metrics_json
  created_at

achievements ★NEW
  id, user_id(FK), achievement_type, achievement_name
  description, icon_url, earned_at

# ============== 外部API管理（新規） ★NEW ==============
api_keys ★NEW
  id, org_id(FK), key_name, description
  key_hash, key_prefix (表示用: sk_live_xxxx)
  environment(live/test), is_active
  scopes_json (sessions.read, sessions.write, etc.)
  rate_limit_monthly, rate_limit_daily, rate_limit_hourly
  ip_whitelist_json, webhook_url
  expires_at, created_by(FK), created_at, last_used_at

api_key_usage ★NEW
  id, api_key_id(FK), org_id(FK)
  endpoint, method, status_code
  request_id, response_time_ms
  timestamp, ip_address

api_rate_limits ★NEW
  id, api_key_id(FK), org_id(FK)
  window_type(hourly/daily/monthly)
  limit_value, current_count
  window_start, window_end
  last_reset_at

# ============== ATS連携（新規） ★NEW ==============
ats_integrations ★NEW
  id, org_id(FK), provider(greenhouse/lever/workday/hrmos/jobkan/kanri)
  is_active, config_json (api_key_encrypted, endpoint, etc.)
  field_mappings_json, sync_settings_json
  webhook_secret, last_sync_at
  created_by(FK), created_at, updated_at

ats_sync_logs ★NEW
  id, integration_id(FK), org_id(FK)
  sync_type(candidate_import/result_export)
  status(success/failed), records_processed
  error_message, started_at, completed_at

ats_candidate_mappings ★NEW
  id, org_id(FK), integration_id(FK)
  prance_user_id(FK), ats_candidate_id, ats_application_id
  metadata_json, created_at, updated_at

# ============== プラグインシステム（新規） ★NEW ==============
plugins ★NEW
  id, plugin_id(unique), name, version
  author, description, type(ats/hris/auth/report/webhook)
  status(approved/review/deprecated)
  manifest_json, config_schema_json
  icon_url, documentation_url, license
  install_count, rating_avg, review_count
  created_at, updated_at

plugin_installations ★NEW
  id, org_id(FK), plugin_id(FK)
  status(installed/enabled/disabled/uninstalled)
  config_json, permissions_granted_json
  installed_by(FK), installed_at, enabled_at, disabled_at

plugin_execution_logs ★NEW
  id, installation_id(FK), org_id(FK)
  extension_point, method_name
  status(success/failed), execution_time_ms
  error_message, timestamp

# ============== 多言語対応（新規） ★NEW ==============
translations ★NEW
  id, entity_type(scenario/avatar/report_template/etc.)
  entity_id, locale(ja/en/zh-CN/zh-TW/fr/de/es/etc.)
  field_name, translated_value(text)
  created_at, updated_at

  # 例:
  # entity_type='scenario', entity_id='scenario_123'
  # locale='en', field_name='title'
  # translated_value='Job Interview Practice'

language_settings ★NEW
  id, org_id(FK)
  available_languages_json (["ja", "en", "zh-CN"])
  default_language, fallback_language
  auto_translate(boolean), translation_provider
  created_at, updated_at
```

### リレーション図

```
platform_settings (グローバル設定)
       │
       ▼
organizations ────┬──< users
                  ├──< avatars (org_custom)
                  ├──< scenarios
                  ├──< prompt_templates
                  ├──< ai_providers
                  ├──< report_templates
                  ├──< benchmark_aggregates ★NEW
                  └──< api_keys ★NEW

users ──────────┬──< user_profiles ★NEW
                ├──< user_profile_history ★NEW
                ├──< achievements ★NEW
                └──< sessions

prompt_templates ──< prompt_template_versions
                   └──< scenarios

ai_providers ──< ai_provider_usage

api_keys ──────┬──< api_key_usage ★NEW
               └──< api_rate_limits ★NEW

scenarios ──< sessions

sessions ───┬──< recordings
            ├──< transcripts
            ├──< emotion_data
            ├──< audio_analysis
            ├──< reports
            └──< ai_provider_usage

avatars ──< sessions
voices ──< sessions
```

### DynamoDBテーブル（セッション状態・キャッシュ）

```
# セッション状態管理
sessions_state
  PK: session_id
  SK: timestamp
  TTL: 24時間
  attributes: conversation_history, covered_topics, elapsed_time, etc.

# WebSocket接続管理
websocket_connections
  PK: connection_id
  GSI: user_id-index
  TTL: 2時間
  attributes: user_id, session_id, connected_at

# ベンチマークキャッシュ ★NEW
benchmark_cache
  PK: org_id#timeframe
  SK: metric_type
  TTL: 30日
  attributes: score_distribution, percentile_thresholds, clusters, etc.

# APIレート制限カウンター ★NEW
api_rate_limit_counters
  PK: api_key_id#window_type
  SK: window_timestamp
  TTL: 動的（hourly: 1時間, daily: 24時間, monthly: 30日）
  attributes: count, limit, window_start, window_end
```

---

## 7. API設計

### エンドポイント一覧

```
# アバター
POST   /api/avatars                    # アバター新規作成
GET    /api/avatars                    # 一覧取得 (フィルタ: type, style, visibility)
GET    /api/avatars/presets            # プリセットアバター一覧 ★NEW
GET    /api/avatars/:id                # 詳細取得
GET    /api/avatars/:id/preview        # プレビュー用3Dモデル/アニメーション
DELETE /api/avatars/:id                # 削除
POST   /api/avatars/generate-2d        # 画像 → 2Dアバター生成
POST   /api/avatars/generate-3d        # 画像 → 3Dアバター生成 (RPM)

# 音声
POST   /api/voices                     # 音声登録
GET    /api/voices                     # 一覧取得
DELETE /api/voices/:id                 # 削除
POST   /api/voices/clone               # 音声クローニング
POST   /api/voices/record              # ブラウザ録音から登録

# シナリオ
POST   /api/scenarios                  # 新規作成
GET    /api/scenarios                  # 一覧 (自分 + 組織共有 + 公開)
GET    /api/scenarios/:id              # 詳細取得
PUT    /api/scenarios/:id              # 更新
DELETE /api/scenarios/:id              # 削除

# AIプロンプトテンプレート (管理者) ★NEW
GET    /api/admin/prompt-templates                    # 一覧取得
POST   /api/admin/prompt-templates                    # 新規作成
GET    /api/admin/prompt-templates/:id                # 詳細取得
PUT    /api/admin/prompt-templates/:id                # 更新
DELETE /api/admin/prompt-templates/:id                # 削除
POST   /api/admin/prompt-templates/:id/test           # テスト実行
GET    /api/admin/prompt-templates/:id/versions       # バージョン履歴
POST   /api/admin/prompt-templates/:id/rollback       # バージョンロールバック
POST   /api/admin/prompt-templates/:id/export         # エクスポート (JSON/YAML)
POST   /api/admin/prompt-templates/import             # インポート

# AIプロバイダ管理 (管理者) ★NEW
GET    /api/admin/ai-providers                        # 全プロバイダ一覧
GET    /api/admin/ai-providers/available              # 利用可能なプロバイダ一覧
POST   /api/admin/ai-providers                        # プロバイダ設定追加
GET    /api/admin/ai-providers/:id                    # 詳細取得
PUT    /api/admin/ai-providers/:id                    # 設定更新
DELETE /api/admin/ai-providers/:id                    # 削除
POST   /api/admin/ai-providers/:id/activate           # アクティブ化
POST   /api/admin/ai-providers/:id/deactivate         # 非アクティブ化
POST   /api/admin/ai-providers/:id/test               # 接続テスト
GET    /api/admin/ai-providers/:id/usage              # 使用量取得
GET    /api/admin/ai-providers/usage/summary          # 組織全体の使用量サマリー
PUT    /api/admin/ai-providers/priority               # 優先順位更新

# セッション
POST   /api/sessions                   # セッション開始
GET    /api/sessions                   # 一覧取得
GET    /api/sessions/:id               # 詳細取得
DELETE /api/sessions/:id               # 削除
WS     /ws/sessions/:id                # リアルタイム会話 (WebSocket)

# セッション関連リソース
GET    /api/sessions/:id/recording     # 録画URL取得
GET    /api/sessions/:id/transcript    # トランスクリプト全文
GET    /api/sessions/:id/analysis      # 感情・音声解析結果
GET    /api/sessions/:id/report        # レポート取得
POST   /api/sessions/:id/report/pdf    # PDF再生成

# レポートテンプレート
GET    /api/report-templates           # 一覧
POST   /api/report-templates           # 新規作成 (Enterprise)
PUT    /api/report-templates/:id       # 更新
DELETE /api/report-templates/:id       # 削除

# 管理者
GET    /api/admin/users                # ユーザー一覧
POST   /api/admin/users/invite         # 招待
GET    /api/admin/sessions             # 全セッション一覧
GET    /api/admin/analytics            # 組織集計データ
GET    /api/admin/cost-dashboard       # コスト管理ダッシュボード ★NEW

# プロファイル・ベンチマーク ★NEW
GET    /api/users/:id/profile                          # ユーザープロファイル取得
GET    /api/users/:id/profile/benchmark                # ベンチマーク詳細
GET    /api/users/:id/profile/history                  # プロファイル履歴（成長推移）
GET    /api/users/:id/achievements                     # 獲得バッジ一覧
POST   /api/users/:id/profile/opt-out                  # ベンチマーク集計からオプトアウト
GET    /api/benchmarks/org                             # 組織ベンチマーク集計
GET    /api/benchmarks/global                          # グローバルベンチマーク（匿名化）

# 外部連携API管理（クライアント管理者） ★NEW
GET    /api/admin/api-keys                             # APIキー一覧
POST   /api/admin/api-keys                             # APIキー作成
GET    /api/admin/api-keys/:id                         # APIキー詳細
PUT    /api/admin/api-keys/:id                         # APIキー更新
DELETE /api/admin/api-keys/:id                         # APIキー削除
POST   /api/admin/api-keys/:id/rotate                  # APIキーローテーション
POST   /api/admin/api-keys/:id/activate                # APIキー有効化
POST   /api/admin/api-keys/:id/deactivate              # APIキー無効化
GET    /api/admin/api-keys/:id/usage                   # APIキー使用状況
GET    /api/admin/api-usage/summary                    # 組織全体のAPI使用状況
GET    /api/admin/api-usage/logs                       # APIアクセスログ

# スーパー管理者（プラットフォーム管理） ★NEW
GET    /api/super-admin/tenants                        # 全テナント一覧
POST   /api/super-admin/tenants                        # テナント作成
GET    /api/super-admin/tenants/:id                    # テナント詳細
PUT    /api/super-admin/tenants/:id                    # テナント更新
DELETE /api/super-admin/tenants/:id                    # テナント削除
POST   /api/super-admin/tenants/:id/suspend            # テナント一時停止
POST   /api/super-admin/tenants/:id/resume             # テナント再開
GET    /api/super-admin/platform-settings              # プラットフォーム設定取得
PUT    /api/super-admin/platform-settings              # プラットフォーム設定更新
PUT    /api/super-admin/api-rate-limits                # グローバルAPIレート制限設定
GET    /api/super-admin/usage-stats                    # プラットフォーム全体使用統計
GET    /api/super-admin/cost-analysis                  # コスト分析（全テナント）

# プラン管理（スーパー管理者） ★NEW
GET    /api/super-admin/plans                          # プラン一覧
POST   /api/super-admin/plans                          # プラン作成
GET    /api/super-admin/plans/:id                      # プラン詳細
PUT    /api/super-admin/plans/:id                      # プラン更新
DELETE /api/super-admin/plans/:id                      # プラン削除（非推奨化）
POST   /api/super-admin/plans/:id/duplicate            # プラン複製
GET    /api/super-admin/plans/:id/subscribers          # プラン加入者一覧

# サブスクリプション管理 ★NEW
GET    /api/subscriptions/current                      # 現在のサブスクリプション情報
GET    /api/subscriptions/plans                        # 利用可能プラン一覧（公開ページ）
POST   /api/subscriptions/upgrade                      # プランアップグレード
POST   /api/subscriptions/cancel                       # サブスクリプションキャンセル
GET    /api/subscriptions/usage                        # 現在の使用状況とクォータ
GET    /api/subscriptions/invoices                     # 請求書一覧（将来実装）

# ATS連携管理（クライアント管理者） ★NEW
GET    /api/admin/ats-integrations                     # ATS連携一覧
POST   /api/admin/ats-integrations                     # ATS連携追加
GET    /api/admin/ats-integrations/:id                 # ATS連携詳細
PUT    /api/admin/ats-integrations/:id                 # ATS連携更新
DELETE /api/admin/ats-integrations/:id                 # ATS連携削除
POST   /api/admin/ats-integrations/:id/test            # 接続テスト
POST   /api/admin/ats-integrations/:id/sync            # 手動同期実行
GET    /api/admin/ats-integrations/:id/logs            # 同期ログ取得
GET    /api/admin/ats-integrations/:id/mappings        # 候補者マッピング一覧

# プラグイン管理 ★NEW
GET    /api/plugins/marketplace                        # プラグインマーケットプレイス
GET    /api/plugins/marketplace/:id                    # プラグイン詳細
GET    /api/admin/plugins/installed                    # インストール済みプラグイン
POST   /api/admin/plugins/:id/install                  # プラグインインストール
POST   /api/admin/plugins/:id/enable                   # プラグイン有効化
POST   /api/admin/plugins/:id/disable                  # プラグイン無効化
DELETE /api/admin/plugins/:id/uninstall                # プラグインアンインストール
PUT    /api/admin/plugins/:id/config                   # プラグイン設定更新
GET    /api/admin/plugins/:id/logs                     # プラグイン実行ログ

# 多言語対応 ★NEW
GET    /api/locales/supported                          # サポート言語一覧
GET    /api/translations/:entity_type/:entity_id       # エンティティの翻訳取得
PUT    /api/translations/:entity_type/:entity_id       # 翻訳更新（管理者）
POST   /api/translations/auto-translate                # 自動翻訳（将来実装）
```

### WebSocket メッセージ仕様

```typescript
// クライアント → サーバー
type ClientMessage =
  | { type: 'audio_chunk'; data: ArrayBuffer }        // 音声ストリーム
  | { type: 'speech_end' }                             // 発話終了
  | { type: 'session_end' }                            // セッション終了

// サーバー → クライアント
type ServerMessage =
  | { type: 'transcript_partial'; text: string }       // リアルタイム字幕
  | { type: 'transcript_final'; text: string; timestamp: number }
  | { type: 'avatar_response'; text: string }          // AI応答テキスト
  | { type: 'tts_audio'; data: ArrayBuffer; visemes: Viseme[] }
  | { type: 'avatar_emotion'; emotion: string }        // アバター表情変化
  | { type: 'processing_update'; stage: string; progress: number }
  | { type: 'session_complete'; report_id: string }
```

---

## 8. 技術スタック

### フロントエンド

| 用途 | 技術 | 選定理由 |
|------|------|---------|
| フレームワーク | Next.js 15 (App Router) | SSR/SSG、大規模SaaS実績、TypeScript |
| ホスティング | AWS Amplify Hosting | CI/CD統合、Edge最適化、自動スケール |
| UIコンポーネント | shadcn/ui + Tailwind CSS | カスタマイズ性、軽量、アクセシビリティ |
| 3Dレンダリング | Three.js + React Three Fiber | WebGL標準、豊富なエコシステム |
| 2Dアバター | Live2D Cubism Web SDK 5 | ブラウザ対応、高品質アニメーション |
| 顔ランドマーク | MediaPipe Face Mesh | リアルタイム、精度高い、ブラウザ実行 |
| リアルタイム通信 | AWS IoT Core (WebSocket) | スケーラブル、低レイテンシ、フルマネージド |
| 動画録画 | MediaRecorder API + RecordRTC | ブラウザネイティブ、クロスブラウザ対応 |
| グラフ | Recharts | React親和性、カスタマイズ性 |
| 状態管理 | Zustand + TanStack Query | 軽量、TypeScript、サーバー状態管理 |
| 動画プレイヤー | Video.js カスタム拡張 | WebVTT対応、拡張性、カスタマイズ |
| 認証 | AWS Amplify Auth (Cognito) | OAuth2/SAML、MFA、フルマネージド |
| 多言語対応 | next-intl | Next.js App Router対応、型安全、SSR/SSG ★NEW |
| 日付フォーマット | date-fns | 軽量、多言語対応、イミュータブル ★NEW |

### バックエンド (サーバーレス中心)

| 用途 | 技術 | 選定理由 |
|------|------|---------|
| API Gateway | AWS API Gateway (REST/WebSocket) | フルマネージド、自動スケール、統合認証 |
| コンピュート | AWS Lambda (Node.js 20 Runtime) | サーバーレス、オートスケール、コスト効率 |
| フレームワーク | AWS Lambda Powertools (TypeScript) | ベストプラクティス、ロギング、トレーシング |
| ORM | Prisma (Data Proxy) | TypeScript、型安全、コネクションプール |
| 非同期処理 | AWS Step Functions + EventBridge | 複雑ワークフロー、可視化、エラーハンドリング |
| キュー | Amazon SQS + SNS | フルマネージド、スケーラブル、デッドレター対応 |
| 動画処理 | AWS MediaConvert / Lambda (FFmpeg Layer) | マネージド変換 / カスタム処理 |
| 認証・認可 | Amazon Cognito + Lambda Authorizer | OAuth2、SAML、RBAC、トークン管理 |
| API型チェック | tRPC + Zod | エンドツーエンド型安全性、バリデーション |
| 多言語対応 | i18next + i18next-fs-backend | サーバー側i18n、動的言語切り替え ★NEW |
| 決済（将来） | Stripe API | サブスクリプション、請求書、Webhook ★NEW |

### AIサービス (マルチプロバイダ対応)

| 用途 | プライマリ | フォールバック | 統合方法 |
|------|----------|--------------|---------|
| 会話AI | Anthropic Claude (Opus 4) | AWS Bedrock (Claude) | Lambda統合、プロバイダ抽象化レイヤー |
| TTS | ElevenLabs API | Amazon Polly | Lambda統合、ストリーミング対応 |
| STT | Azure Speech Services | AWS Transcribe | WebSocket → Lambda処理 |
| 感情解析 | Azure Face API | AWS Rekognition | Lambda非同期処理 |
| アニメ化 | AnimeGANv2 (Lambda Container) | - | Lambda Container (GPU不要版) |
| 3Dアバター | Ready Player Me API | - | Lambda統合 |
| PDF生成 | AWS Lambda (Puppeteer Layer) | - | Lambda Layer (Chrome Headless) |

### リアルタイム会話機能の外部ツール一覧

本プラットフォームでは、**事前録画されたビデオストリーミングではなく、リアルタイムで3D/2Dアバターをレンダリング**する方式を採用しています。これにより、データ量を最小化（音声データのみ：数KB/秒）し、低レイテンシ（50-200ms）でインタラクティブな会話体験を実現します。

| カテゴリ | ツール | 用途 | 詳細 |
|---------|--------|------|------|
| **ユーザー映像取得** | getUserMedia API | カメラ取得 | ブラウザ標準API、ユーザー映像のリアルタイム取得 |
| | MediaPipe Face Mesh | 顔ランドマーク検出 | 468点の顔ランドマーク、リアルタイム表情解析 |
| | Azure Face API | 感情解析 | 7種類の感情スコア、視線方向（アイコンタクト判定） |
| **音声処理** | getUserMedia API | マイク取得 | ブラウザ標準API、エコーキャンセル・ノイズ抑制対応 |
| | Azure Speech Services | 音声認識（STT） | リアルタイムストリーミング認識、40言語以上対応 |
| | ElevenLabs API | 音声合成（TTS） | 高品質音声生成 + Visemeデータ出力（リップシンク用） |
| **アバターレンダリング** | Three.js + React Three Fiber | 3Dレンダリング | WebGL、60fpsリアルタイムレンダリング |
| | Ready Player Me | 3Dアバターモデル | .glb形式、ARKit 52 Blendshapes対応 |
| | Live2D Cubism SDK 5 | 2Dアニメアバター | Canvas 2D、高品質アニメーション、口パク対応 |
| **リップシンク** | ElevenLabs Viseme | 口形状データ | Viseme → ARKit Blendshape / Canvas パラメータマッピング |
| | ARKit Blendshapes | 3D表情制御 | 52種類の表情パラメータ（jawOpen, mouthFunnel等） |
| **リアルタイム通信** | AWS IoT Core | WebSocket通信 | 100万同時接続対応、低レイテンシ（50-200ms） |
| | MediaRecorder API | ブラウザ録画 | ユーザー映像 + アバター映像の同時録画（WebM形式） |
| **会話AI** | Anthropic Claude (Opus 4) | 自然言語処理 | システムプロンプトベースの会話生成 |
| | AWS Bedrock (Claude) | フォールバック | プライマリ障害時のバックアップ |
| **動画処理** | AWS MediaConvert | 動画合成 | ユーザー映像 + アバター映像のサイドバイサイド合成 |
| | FFmpeg (Lambda Layer) | カスタム処理 | サムネイル生成、フレーム抽出 |

**アーキテクチャの特徴:**
- **軽量**: 音声データのみ送受信（数KB/秒）、ビデオストリーミング（数MB/秒）と比較して圧倒的に軽量
- **低レイテンシ**: AWS IoT Core WebSocketで50-200ms、リアルタイム会話に最適
- **スケーラブル**: Lambda + IoT Coreで自動スケール、10ユーザー → 10万ユーザー対応
- **リアルタイムレンダリング**: ブラウザ内で3D/2Dアバターを動的生成、無限のカスタマイズ可能

### データストア・ストレージ

| 用途 | 技術 | 特徴 |
|------|------|-----|
| RDB | Amazon Aurora Serverless v2 (PostgreSQL) | 自動スケール、コスト最適化、高可用性 |
| NoSQL | Amazon DynamoDB | セッション状態、リアルタイムデータ、低レイテンシ |
| キャッシュ | Amazon ElastiCache (Redis) Serverless | セッション管理、レート制限、リアルタイム同期 |
| オブジェクトストレージ | Amazon S3 (Intelligent-Tiering) | 録画・音声・アバターモデル保存 |
| CDN | Amazon CloudFront + Lambda@Edge | グローバル配信、エッジ処理、署名付きURL |
| 検索 | Amazon OpenSearch Serverless | トランスクリプト全文検索、ログ解析 |

### インフラ・DevOps

| 用途 | 技術 | 特徴 |
|------|------|-----|
| IaC | AWS CDK (TypeScript) | プログラマティック、型安全、再利用性 |
| CI/CD | GitHub Actions + AWS CodePipeline | 自動テスト、デプロイ、ロールバック |
| 監視・ロギング | AWS CloudWatch + X-Ray | 分散トレーシング、メトリクス、アラート |
| エラートラッキング | Sentry | リアルタイムエラー通知、スタックトレース |
| シークレット管理 | AWS Secrets Manager | 自動ローテーション、暗号化、監査 |
| ドキュメント | OpenAPI (Swagger) + Stoplight | API仕様、自動生成、バージョン管理 |

### セキュリティ

| 用途 | 技術 |
|------|------|
| WAF | AWS WAF + Shield Standard | DDoS対策、SQLインジェクション防御 |
| 暗号化 | AWS KMS | 暗号化キー管理、自動ローテーション |
| コンプライアンス | AWS Config + CloudTrail | 監査ログ、コンプライアンスチェック |
| 脆弱性スキャン | AWS Inspector + Snyk | コンテナ・依存関係スキャン |

---

## 9. インフラ構成（AWSサーバーレス）

### 全体アーキテクチャ図

```
┌───────────────────────────────────────────────────────────────┐
│                         ユーザー                               │
└─────────────────────────┬─────────────────────────────────────┘
                          │
                          ▼
              ┌──────────────────────┐
              │  Amazon CloudFront   │ ← Lambda@Edge (認証・リダイレクト)
              │      + S3 (静的)      │
              └──────────┬───────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ AWS Amplify  │ │ API Gateway  │ │ IoT Core     │
│  Hosting     │ │  (REST API)  │ │ (WebSocket)  │
│  (Next.js)   │ └──────┬───────┘ └──────┬───────┘
└──────────────┘        │                │
                        │                │
                ┌───────┴────────────────┴─────────────┐
                │      Amazon Cognito (認証・認可)       │
                └───────┬──────────────────────────────┘
                        │
        ┌───────────────┼───────────────────────┐
        │               │                       │
        ▼               ▼                       ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────────┐
│   Lambda     │ │   Lambda     │ │  Lambda          │
│ (API Logic)  │ │ (WebSocket)  │ │ (Authorizer)     │
└──────┬───────┘ └──────┬───────┘ └──────────────────┘
       │                │
       │    ┌───────────┴─────────────────┐
       │    │                              │
       ▼    ▼                              ▼
┌─────────────────┐              ┌─────────────────┐
│  Aurora         │              │  DynamoDB       │
│  Serverless v2  │              │  (セッション状態)│
│  (PostgreSQL)   │              └─────────────────┘
└─────────────────┘
       │
       └──────────────────┐
                          │
              ┌───────────▼──────────────────────────────┐
              │        EventBridge / Step Functions       │
              │         (非同期処理オーケストレーション)    │
              └───────┬──────────────────────────────────┘
                      │
      ┌───────────────┼───────────────┐
      │               │               │
      ▼               ▼               ▼
┌──────────┐  ┌──────────────┐  ┌──────────────┐
│ Lambda   │  │ MediaConvert │  │ Lambda       │
│ (感情解析)│  │ (動画合成)    │  │ (レポート生成)│
└────┬─────┘  └──────────────┘  └──────┬───────┘
     │                                  │
     └──────────────┬───────────────────┘
                    │
            ┌───────▼─────────┐
            │   Amazon S3     │
            │ (録画・モデル・PDF)│
            └─────────────────┘
                    │
            ┌───────▼─────────┐
            │  CloudFront     │
            │  (CDN配信)      │
            └─────────────────┘
```

### 主要コンポーネント詳細

#### 1. フロントエンド層

```
AWS Amplify Hosting
  │
  ├─ Next.js 15 (App Router)
  │  ├─ SSR: getServerSideProps (ユーザー固有データ)
  │  ├─ SSG: generateStaticParams (公開コンテンツ)
  │  └─ ISR: revalidate (キャッシュ更新)
  │
  ├─ 自動CI/CD (GitHub連携)
  │  ├─ main → 本番環境
  │  ├─ develop → ステージング環境
  │  └─ feature/* → プレビュー環境
  │
  └─ Edge最適化
     ├─ CloudFront統合
     ├─ 自動画像最適化
     └─ グローバル配信
```

#### 2. API層（サーバーレス）

```
API Gateway (REST API)
  │
  ├─ Lambda Authorizer (Cognito JWT検証)
  │  └─ RBAC: ユーザーロール・組織ID検証
  │
  ├─ エンドポイント → Lambda関数
  │  ├─ GET  /avatars → listAvatarsFunction
  │  ├─ POST /sessions → createSessionFunction
  │  ├─ POST /admin/prompt-templates → createPromptFunction
  │  └─ ...
  │
  ├─ レート制限 (API Gateway Usage Plans)
  │  ├─ Free: 100 req/min
  │  ├─ Pro: 1000 req/min
  │  └─ Enterprise: 無制限
  │
  └─ スロットリング・バースト対応

IoT Core (WebSocket API)
  │
  ├─ リアルタイムセッション通信
  │  ├─ 音声ストリーミング
  │  ├─ テキストトランスクリプト配信
  │  └─ アバター制御メッセージ
  │
  ├─ 接続管理 → Lambda関数
  │  ├─ $connect → onConnectFunction
  │  ├─ $disconnect → onDisconnectFunction
  │  └─ custom routes → messageHandlerFunction
  │
  └─ スケーラビリティ
     └─ 100万同時接続対応
```

#### 3. データ層

```
Aurora Serverless v2 (PostgreSQL)
  │
  ├─ 自動スケーリング (0.5 ACU ~ 16 ACU)
  ├─ マルチAZ配置 (高可用性)
  ├─ 自動バックアップ (PITR: 35日保持)
  ├─ Prisma Data Proxy (コネクションプール)
  │
  └─ テーブル設計
     ├─ organizations, users, avatars
     ├─ scenarios, sessions, transcripts
     ├─ prompt_templates, ai_providers
     └─ reports, report_templates

DynamoDB (セッション状態管理)
  │
  ├─ sessions_state テーブル
  │  ├─ PK: session_id
  │  ├─ TTL: 24時間自動削除
  │  └─ 属性: conversation_history, covered_topics, elapsed_time
  │
  ├─ オンデマンドモード (自動スケール)
  ├─ DynamoDB Streams → Lambda (状態変更通知)
  │
  └─ WebSocket接続管理
     ├─ PK: connection_id
     ├─ GSI: user_id-index
     └─ 属性: user_id, session_id, connected_at

ElastiCache Serverless (Redis)
  │
  ├─ セッションキャッシュ
  ├─ レート制限カウンター
  ├─ リアルタイム通知キュー
  └─ 自動スケール・高可用性
```

#### 4. 非同期処理層

```
EventBridge (イベントバス)
  │
  ├─ イベント
  │  ├─ session.completed
  │  ├─ recording.uploaded
  │  ├─ analysis.requested
  │  └─ report.generated
  │
  └─ ルール → ターゲット
     ├─ session.completed → Step Functions (処理ワークフロー)
     ├─ analysis.requested → SQS (感情解析キュー)
     └─ report.generated → SNS (ユーザー通知)

Step Functions (ワークフローオーケストレーション)
  │
  ├─ セッション後処理ワークフロー
  │  ┌─────────────────────────────────────────┐
  │  │ 1. Lambda: 録画ファイル検証              │
  │  │    ↓                                    │
  │  │ 2. MediaConvert: 動画合成               │
  │  │    ↓                                    │
  │  │ 3. Lambda: サムネイル生成 (並列)        │
  │  │ 4. Lambda: Whisperトランスクリプト (並列)│
  │  │    ↓                                    │
  │  │ 5. Lambda: 感情解析 (Azure Face)        │
  │  │    ↓                                    │
  │  │ 6. Lambda: 音声解析 (Azure Speech)      │
  │  │    ↓                                    │
  │  │ 7. Lambda: AIレポート生成 (Claude)      │
  │  │    ↓                                    │
  │  │ 8. Lambda: PDF生成 (Puppeteer)          │
  │  │    ↓                                    │
  │  │ 9. SNS: ユーザー通知                    │
  │  └─────────────────────────────────────────┘
  │
  ├─ エラーハンドリング
  │  ├─ 自動リトライ (指数バックオフ)
  │  ├─ Catch句でフォールバック処理
  │  └─ DLQ (デッドレターキュー) 送信
  │
  └─ 可視化・監視
     ├─ 実行履歴グラフ表示
     ├─ CloudWatch統合
     └─ X-Ray トレーシング

SQS (メッセージキュー)
  │
  ├─ emotion-analysis-queue
  │  └─ Lambda: 感情解析バッチ処理
  │
  ├─ report-generation-queue
  │  └─ Lambda: レポート生成
  │
  └─ DLQ (処理失敗時)
     └─ CloudWatch Alarm → 管理者通知
```

#### 5. ストレージ・CDN層

```
Amazon S3
  │
  ├─ バケット構成
  │  ├─ {org-id}-recordings/      (録画ファイル)
  │  │  ├─ Lifecycle: 90日後Glacier移行 (Pro)
  │  │  └─ Lifecycle: 365日後削除 (Enterprise設定可)
  │  │
  │  ├─ {org-id}-avatars/         (アバターモデル)
  │  │  └─ Intelligent-Tiering
  │  │
  │  ├─ {org-id}-reports/         (PDFレポート)
  │  │  └─ 署名付きURL (有効期限: 7日)
  │  │
  │  └─ {org-id}-temp/            (一時ファイル)
  │     └─ Lifecycle: 1日後自動削除
  │
  ├─ 暗号化
  │  ├─ SSE-KMS (AWS KMS)
  │  └─ バケットポリシー (最小権限)
  │
  └─ イベント通知
     └─ S3 → EventBridge → Lambda

CloudFront (CDN)
  │
  ├─ ディストリビューション
  │  ├─ 静的アセット (Next.js)
  │  ├─ 録画動画 (S3 Origin)
  │  ├─ アバターモデル (S3 Origin)
  │  └─ API (API Gateway Origin)
  │
  ├─ Lambda@Edge
  │  ├─ Viewer Request: 認証チェック
  │  ├─ Origin Request: 署名付きURL生成
  │  └─ Viewer Response: セキュリティヘッダー追加
  │
  ├─ キャッシュ戦略
  │  ├─ 静的アセット: 1年
  │  ├─ 録画動画: 90日
  │  └─ API: キャッシュ無効
  │
  └─ グローバルエッジロケーション
     └─ 低レイテンシ配信
```

### スケーラビリティ設計

#### 水平スケーリング

```
リクエスト増加時の自動スケール:

1. API Gateway → Lambda 同時実行数自動増加
   ├─ 予約済み同時実行数: 100 (ベースライン)
   ├─ プロビジョニング済み同時実行数: 50 (ウォームスタート)
   └─ スケール上限: 1000 → アカウント制限緩和申請

2. Aurora Serverless v2 → ACU自動増加
   ├─ 最小: 0.5 ACU (アイドル時)
   ├─ 最大: 16 ACU (ピーク時)
   └─ スケールアップ: 数秒以内

3. DynamoDB → オンデマンドモード
   └─ 自動スケール (制限なし)

4. ElastiCache Serverless → 自動スケール
   └─ メモリ・スループット自動調整
```

#### コスト最適化

```
1. Lambda
   ├─ ARM64 (Graviton2): x86比 20%コスト削減
   ├─ メモリ最適化: パフォーマンステストで適正値設定
   └─ コールドスタート対策: Provisioned Concurrency (重要API)

2. Aurora Serverless v2
   ├─ 最小ACU: 0.5 (アイドル時コスト最小化)
   └─ Data API: コネクション管理不要

3. S3
   ├─ Intelligent-Tiering: 自動コスト最適化
   └─ Lifecycle Policy: 古いファイル自動削除/移行

4. CloudFront
   └─ Cache Hit Rate 最適化: 90%以上維持

5. 予算アラート
   └─ AWS Budgets: 月次予算超過時アラート
```

### 高可用性・DR設計

```
┌─────────────────────────────────────────────────────┐
│ リージョン: us-east-1 (Primary)                      │
│                                                      │
│ ┌──────────────┐  ┌──────────────┐                 │
│ │ AZ-1a        │  │ AZ-1b        │                 │
│ │ - Lambda     │  │ - Lambda     │                 │
│ │ - Aurora     │  │ - Aurora     │                 │
│ │   (Primary)  │  │   (Replica)  │                 │
│ └──────────────┘  └──────────────┘                 │
└─────────────────────────────────────────────────────┘
         │
         │ (Cross-Region Replication)
         ▼
┌─────────────────────────────────────────────────────┐
│ リージョン: ap-northeast-1 (DR)                      │
│                                                      │
│ ┌──────────────────────────────────────┐            │
│ │ S3 (CRR), Aurora Global Database      │            │
│ │ 自動フェイルオーバー: RTO 1分以内     │            │
│ └──────────────────────────────────────┘            │
└─────────────────────────────────────────────────────┘

可用性目標:
  - SLA: 99.9% (ダウンタイム 43分/月)
  - RTO: 1分 (目標復旧時間)
  - RPO: 5分 (目標復旧時点)
```

### セキュリティアーキテクチャ

```
┌─────────────────────────────────────────────────────┐
│ 多層防御 (Defense in Depth)                          │
├─────────────────────────────────────────────────────┤
│ 1. エッジ層                                          │
│    ├─ AWS WAF (SQL Injection, XSS防御)              │
│    ├─ AWS Shield Standard (DDoS防御)                │
│    └─ CloudFront (地理的制限)                        │
│                                                      │
│ 2. アプリケーション層                                │
│    ├─ Cognito (認証・MFA)                           │
│    ├─ Lambda Authorizer (認可)                      │
│    └─ API Gateway (レート制限)                      │
│                                                      │
│ 3. データ層                                          │
│    ├─ VPC (ネットワーク分離)                         │
│    ├─ Security Groups (最小権限)                    │
│    ├─ KMS (暗号化キー管理)                          │
│    ├─ Secrets Manager (API Key管理)                │
│    └─ S3 Bucket Policy (アクセス制御)               │
│                                                      │
│ 4. 監査層                                            │
│    ├─ CloudTrail (API監査ログ)                      │
│    ├─ Config (コンプライアンスチェック)             │
│    └─ GuardDuty (脅威検出)                          │
└─────────────────────────────────────────────────────┘
```

---

## 10. 実装フェーズ

### Phase 0: インフラ基盤構築（2週間）

**目標:** AWSサーバーレス基盤の確立

**Week 1: コアインフラ**
- [ ] AWS CDKプロジェクト初期化
- [ ] Amazon Cognito (ユーザープール・IDプール)
- [ ] Aurora Serverless v2 (PostgreSQL) セットアップ
- [ ] DynamoDB テーブル設計・作成
- [ ] ElastiCache Serverless (Redis) セットアップ
- [ ] S3 バケット構成 (録画・アバター・レポート)
- [ ] CloudFront ディストリビューション

**Week 2: API基盤**
- [ ] API Gateway (REST/WebSocket) セットアップ
- [ ] Lambda Authorizer (JWT検証)
- [ ] Lambda Layer (Prisma, Puppeteer, FFmpeg)
- [ ] EventBridge イベントバス
- [ ] Step Functions ワークフロー基本構造
- [ ] CloudWatch ロギング・メトリクス設定
- [ ] Secrets Manager (API Key管理)

**成果物:**
- インフラコードリポジトリ (AWS CDK)
- CI/CDパイプライン (GitHub Actions)
- 監視ダッシュボード (CloudWatch)

---

### Phase 1: MVP（コア会話機能）（6週間）

**目標:** 基本的な会話セッションが動作する状態

**Week 1-2: 認証・基本UI**
- [ ] Next.js 15 プロジェクト初期化 (App Router)
- [ ] AWS Amplify Hosting CI/CD設定
- [ ] Cognito認証フロー (サインアップ/ログイン/MFA)
- [ ] 組織管理API (CRUD)
- [ ] ユーザー管理API (CRUD)
- [ ] ダッシュボード基本レイアウト

**Week 3-4: アバター・会話エンジン**
- [ ] 3Dアバター プリセット表示 (Three.js + Ready Player Me)
- [ ] リップシンク実装 (ARKit Blendshapes)
- [ ] Claude API統合 (会話エンジン)
- [ ] シナリオ設定UI (基本版)
- [ ] シナリオ→システムプロンプト生成ロジック

**Week 5-6: 音声・セッション実行**
- [ ] ElevenLabs TTS 統合
- [ ] Azure STT リアルタイム音声認識 (IoT Core WebSocket)
- [ ] セッション実行フロー (WebSocket通信)
- [ ] ブラウザ録画 (MediaRecorder API)
- [ ] S3アップロード (署名付きURL)
- [ ] 基本トランスクリプト生成
- [ ] 録画再生プレイヤー (基本版)

**成果物:**
- プリセットアバターとの会話セッションが可能
- 録画・トランスクリプトの基本機能

---

### Phase 2: AI管理・アバター拡充（5週間）

**目標:** 管理者によるAI制御とアバターカスタマイズ

**Week 1-2: AIプロンプト管理 ★NEW**
- [ ] プロンプトテンプレート CRUD API
- [ ] 管理者UI: プロンプト編集画面
- [ ] 変数システム (動的変数注入)
- [ ] プロンプトバージョン管理
- [ ] テスト実行機能 (リアルタイムプレビュー)
- [ ] エクスポート/インポート (JSON/YAML)

**Week 3: AIプロバイダ管理 ★NEW**
- [ ] プロバイダ抽象化レイヤー (TypeScript Interface)
- [ ] マルチプロバイダ対応 (Claude, GPT-4, Gemini)
- [ ] 管理者UI: プロバイダ設定画面
- [ ] プロバイダ切り替え機能
- [ ] フォールバック設定
- [ ] 使用量トラッキング (DynamoDB)
- [ ] コスト管理ダッシュボード

**Week 4-5: アバターカスタマイズ**
- [ ] 2Dアバター (Live2D プリセット) 対応
- [ ] アバター選択UI (フィルタ・プレビュー) ★NEW
- [ ] 画像からの3Dアバター生成 (Ready Player Me Photo)
- [ ] 画像からの2Dアバター生成 (AnimeGAN Lambda Container)
- [ ] 音声クローニング (ElevenLabs)
- [ ] ブラウザ内音声録音 → クローニング
- [ ] 組織専用アバター管理 (管理者)

**成果物:**
- 管理者がAIプロンプト・プロバイダを完全制御可能
- ユーザーがアバターをUIから選択・カスタマイズ可能

---

### Phase 3: 解析・レポート（5週間）

**目標:** 感情解析とレポート自動生成の完成

**Week 1-2: 非同期処理基盤**
- [ ] Step Functions ワークフロー実装
  - [ ] 録画検証 → 動画合成 → 解析 → レポート生成
- [ ] MediaConvert 動画合成
- [ ] SQS キュー設定 (感情解析・レポート生成)
- [ ] エラーハンドリング・リトライ

**Week 3: 感情・音声解析**
- [ ] Azure Face API 感情解析パイプライン (Lambda)
- [ ] 音声特徴解析 (Azure Speech Analytics)
- [ ] フレーム抽出・バッチ処理最適化
- [ ] 解析結果 DB保存

**Week 4-5: レポート生成**
- [ ] Claude による会話内容評価
- [ ] レポート自動生成 (標準テンプレート)
- [ ] 感情タイムライングラフ (Recharts)
- [ ] ハイライトシーン自動抽出
- [ ] PDF エクスポート (Puppeteer Lambda Layer)
- [ ] トランスクリプト ↔ 動画 同期プレイヤー完成版
- [ ] シナリオビルダー UI (一般ユーザー向け)

**成果物:**
- セッション完了後、自動的に詳細レポート生成
- ユーザーがシナリオを自由に作成・共有可能

---

### Phase 4: SaaS完成・エンタープライズ対応（6週間）

**目標:** 商用SaaSとして完成、エンタープライズ要件対応

**Week 1-2: マルチテナント・課金**
- [ ] マルチテナント完全対応 (Row Level Security)
- [ ] プラン管理 (Free/Pro/Enterprise)
- [ ] Stripe 統合 (サブスクリプション課金)
- [ ] 使用量制限・クォータ管理
- [ ] 管理者ダッシュボード (組織分析)
- [ ] コスト管理・予算アラート

**Week 3: セキュリティ・SSO**
- [ ] SSO / SAML 対応 (Cognito)
- [ ] RBAC 完全実装
- [ ] AWS WAF ルール設定 (SQLi, XSS防御)
- [ ] データ暗号化強化 (KMS)
- [ ] 監査ログ (CloudTrail)
- [ ] 脆弱性スキャン (Inspector, Snyk)

**Week 4: カスタマイズ・拡張**
- [ ] カスタムレポートテンプレートビルダー
- [ ] プロファイルベンチマークシステム ★NEW
  - [ ] ユーザープロファイル計算ロジック
  - [ ] ベンチマーク集約バッチ処理（日次）
  - [ ] ベンチマーク比較UI
  - [ ] 成長トラッキンググラフ
  - [ ] パーソナライズド改善提案生成
  - [ ] 達成バッジシステム
- [ ] 外部連携 API システム ★NEW
  - [ ] API認証・認可フロー（Bearer Token）
  - [ ] APIキー管理UI（クライアント管理者）
  - [ ] スコープベース権限制御
  - [ ] レート制限実装（Redis Sliding Window）
  - [ ] API使用状況トラッキング
  - [ ] OpenAPI仕様書自動生成
  - [ ] Webhook 通知機能

**Week 5: 国際化・最適化**
- [ ] 多言語 UI (i18n: 日本語・英語)
- [ ] パフォーマンス最適化
  - [ ] Lambda コールドスタート削減 (Provisioned Concurrency)
  - [ ] Aurora クエリ最適化
  - [ ] CloudFront キャッシュ戦略最適化
- [ ] 負荷テスト (Locust / Artillery)

**Week 6: スーパー管理者機能・プラン管理**
- [ ] スーパー管理者機能 ★NEW
  - [ ] テナント管理UI（作成・削除・一時停止）
  - [ ] プラットフォーム全体監視ダッシュボード
  - [ ] グローバルAPIレート制限設定UI
  - [ ] 全テナントコスト分析
  - [ ] システムメンテナンスモード
- [ ] プラン管理システム ★NEW
  - [ ] プラン作成・編集UI（クォータ・機能設定）
  - [ ] プラン比較ページ（公開）
  - [ ] サブスクリプション管理
  - [ ] プランアップグレード/ダウングレード
  - [ ] 使用状況・クォータ監視
  - [ ] Stripe統合準備（スキーマ設計）
- [ ] GDPR 対応強化
  - [ ] データポータビリティ (エクスポート)
  - [ ] 削除リクエスト対応 (自動化)
  - [ ] 同意管理（ベンチマークオプトイン/アウト）
- [ ] SOC 2 準拠準備
- [ ] プライバシーポリシー・利用規約
- [ ] ユーザーマニュアル・管理者ガイド
- [ ] API ドキュメント (Stoplight)

**成果物:**
- 商用SaaSとして完全に機能するプラットフォーム
- エンタープライズ要件対応完了
- 本番リリース準備完了

---

### Phase 5: 拡張機能・多言語対応（4週間）★NEW

**目標:** ATS連携、プラグインシステム、多言語対応の実装

**Week 1-2: 多言語対応基盤**
- [ ] 多言語対応システム ★NEW
  - [ ] i18n実装（フロントエンド: next-intl）
  - [ ] バックエンドi18n（i18next）
  - [ ] 翻訳データベース設計・実装
  - [ ] 言語切り替えUI
  - [ ] 日本語・英語翻訳
  - [ ] シナリオ多言語対応
  - [ ] レポート多言語対応
  - [ ] メール通知多言語対応

**Week 3: ATS連携システム**
- [ ] ATS連携フレームワーク ★NEW
  - [ ] ATSアダプター抽象化レイヤー
  - [ ] Greenhouseアダプター実装
  - [ ] Leverアダプター実装
  - [ ] Workdayアダプター実装
  - [ ] 候補者データ同期
  - [ ] セッション結果エクスポート
  - [ ] Webhook受信ハンドラー
  - [ ] ATS管理UI（クライアント管理者）

**Week 4: プラグインシステム**
- [ ] プラグインフレームワーク ★NEW
  - [ ] プラグインSDK開発
  - [ ] プラグインマネージャー実装
  - [ ] プラグインサンドボックス実行
  - [ ] エクステンションポイント定義
  - [ ] プラグインインストール・管理UI
  - [ ] 公式プラグイン開発（国内ATS 3社）
  - [ ] プラグインドキュメント作成

**成果物:**
- 日本語・英語完全対応プラットフォーム
- 国内外主要ATS 6社連携完了
- プラグインシステムの基盤完成

---

### Phase 6: 運用・継続改善（継続）

**目標:** 安定運用とユーザーフィードバックに基づく改善

**継続タスク:**
- [ ] ユーザーサポート体制構築
- [ ] 監視・アラート対応 (24/7)
- [ ] パフォーマンスモニタリング
- [ ] コスト最適化レビュー (月次)
- [ ] セキュリティパッチ適用
- [ ] A/Bテスト (プロンプト最適化、UI改善)
- [ ] 新機能開発 (ユーザーリクエストベース)
- [ ] AI モデルアップデート (Claude新バージョン等)
- [ ] 多言語拡張 (中国語、フランス語、ドイツ語、スペイン語等)
- [ ] ATS連携拡大 (追加プロバイダ)
- [ ] プラグインマーケットプレイス構築（将来構想）

**KPI追跡:**
- [ ] 月間アクティブユーザー (MAU)
- [ ] セッション完了率
- [ ] ユーザー満足度 (NPS)
- [ ] システム可用性 (SLA 99.9%)
- [ ] API レスポンスタイム (p95 < 500ms)
- [ ] コスト効率 ($/セッション)
- [ ] プラン別コンバージョン率
- [ ] ATS連携使用率
- [ ] プラグインインストール数

---

### 実装スケジュール概要

```
Phase 0: インフラ基盤構築              [2週間]  ████
Phase 1: MVP (コア会話機能)            [6週間]  ████████████
Phase 2: AI管理・アバター拡充          [5週間]  ██████████
Phase 3: 解析・レポート                [5週間]  ██████████
Phase 4: SaaS完成・Enterprise対応     [6週間]  ████████████
Phase 5: 拡張機能・多言語対応 ★NEW    [4週間]  ████████
─────────────────────────────────────────────────────────
合計:                                  [28週間 = 約7ヶ月]

Phase 6: 運用・継続改善                [継続]   ∞

追加言語展開:
  - 中国語（簡体字・繁体字）         [+2週間]  ████
  - フランス語・ドイツ語             [+2週間]  ████
  - スペイン語・その他               [+2週間]  ████
```

### チーム構成推奨

| ロール | 人数 | 主な担当 |
|--------|------|----------|
| フロントエンド開発 | 2名 | Next.js, Three.js, UI/UX |
| バックエンド開発 (サーバーレス) | 2名 | Lambda, Step Functions, API設計 |
| インフラ/DevOps | 1名 | AWS CDK, CI/CD, 監視 |
| AI/ML エンジニア | 1名 | プロンプト最適化、解析パイプライン |
| プロダクトマネージャー | 1名 | 要件定義、優先順位付け |
| QA/テスター | 1名 | テスト自動化、品質保証 |
| **合計** | **8名** | |

---

## 11. 外部サービス・ライセンス

| サービス | 用途 | ライセンス・注意事項 |
|----------|------|---------------------|
| **AI・音声** | | |
| Claude API (Anthropic) | 会話AI | 商用利用可、レート制限あり |
| ElevenLabs | TTS・音声クローニング | 商用プランで音声クローニング可 |
| Azure Speech Services | STT・音声解析 | 商用利用可、従量課金 |
| Azure Face API | 感情解析 | EU等一部地域で制限あり要確認 |
| **アバター** | | |
| Ready Player Me | 3Dアバター生成 | 商用利用は Enterprise プラン |
| Live2D Cubism SDK | 2Dアバターレンダリング | 商用利用は Publishing License 必要 |
| AnimeGANv2 | スタイル転換 | MIT License (商用利用可) |
| Remove.bg | 背景除去 | 商用プランで利用可 |
| **決済（将来実装）** ★NEW | | |
| Stripe | サブスクリプション決済 | 手数料: 3.6%, 商用利用標準 |
| **ATS連携** ★NEW | | |
| Greenhouse | ATS（海外） | API利用: 商用プラン、OAuth2認証 |
| Lever | ATS（海外） | API利用: 商用プラン、API Key認証 |
| Workday | ATS・HRIS（海外） | Enterprise契約、OAuth2認証 |
| HRMOS採用 | ATS（国内） | API提供、OAuth2認証 |
| ジョブカン採用管理 | ATS（国内） | API提供、API Key認証 |
| 採用一括かんりくん | ATS（国内） | API提供、連携仕様書要確認 |

---

## 12. セキュリティ・プライバシー

### データ保護

- 録画データは AES-256 で暗号化して S3 保存
- 署名付き URL (有効期限付き) による動画アクセス
- テナント間のデータ完全分離 (Row Level Security)
- 個人情報は最小限取得の原則

### 認証・認可

- JWT + Refresh Token ローテーション
- OAuth2 / SAML SSO 対応 (Enterprise)
- API レート制限 (IP・ユーザー・組織単位)
- RBAC (Role-Based Access Control)

### 音声・映像データ

- ユーザーへのデータ保持期間の明示とコントロール
- データ削除リクエストへの対応 (GDPR Article 17)
- 音声クローニング利用規約の同意フロー必須
- 未成年ユーザーへの追加保護措置

### コンプライアンス

- GDPR (EU)
- 個人情報保護法 (日本)
- SOC 2 Type II 準拠を目標 (Phase 4)

---

## 付録A: バージョン履歴

### Version 2.0 (2026-03-04)

**主要追加機能:**

1. **マルチテナント型SaaSの明確化** ★NEW
   - 3階層ユーザーロール設計（スーパー管理者/クライアント管理者/クライアントユーザー）
   - テナント完全分離アーキテクチャ
   - スーパー管理者によるプラットフォーム全体管理
   - テナントごとの独立した設定・データ領域

2. **AIプロンプト管理システム（管理者）**
   - UI上でシステムプロンプトとユーザープロンプトを編集可能
   - 変数システム（動的・コンテキスト・カスタム変数）
   - プロンプトバージョン管理・ロールバック機能
   - リアルタイムテスト実行機能
   - エクスポート/インポート（JSON/YAML）

3. **AIプロバイダ管理システム（管理者）**
   - マルチプロバイダ対応（会話AI、TTS、STT、感情解析）
   - UI上でプロバイダ選択・切り替え
   - プロバイダ設定管理（API Key、モデル、リージョン）
   - フォールバック設定
   - 使用量トラッキング・コスト管理ダッシュボード

4. **アバター選択UI（一般ユーザー）**
   - プリセットアバターライブラリからの選択
   - カテゴリ・スタイルフィルタリング
   - リアルタイムプレビュー機能
   - 組織専用カスタムアバター（管理者が追加）

5. **プロファイルベンチマークシステム** ★NEW
   - ユーザープロファイル自動算出（総合スコア、項目別スコア）
   - 全体ベンチマーク比較（組織内・同業界・グローバル）
   - パーセンタイル順位表示
   - プロファイルタイプ自動分類（クラスタリング）
   - 成長トラッキンググラフ（過去6ヶ月）
   - パーソナライズド改善提案（Claude API生成）
   - 達成バッジシステム
   - プライバシー保護（匿名化・オプトアウト）

6. **外部連携APIシステム** ★NEW
   - クライアント管理者によるAPIキー発行・管理
   - スコープベース権限制御（エンドポイント別アクセス制御）
   - 階層的レート制限
     - スーパー管理者: グローバル制限設定
     - クライアント管理者: 組織内・APIキーごと制限設定
     - 自動レート制限（時間あたり/日次/月次）
   - API使用状況ダッシュボード（コール数・成功率・コスト）
   - Webhook通知機能
   - IPアドレス制限（オプション）
   - OpenAPI仕様書自動生成

7. **AWSサーバーレスアーキテクチャ**
   - Lambda、API Gateway、IoT Core中心の構成
   - Aurora Serverless v2（自動スケール）
   - DynamoDB（セッション状態・ベンチマークキャッシュ・APIレート制限）
   - Step Functions（非同期処理オーケストレーション）
   - EventBridge（イベント駆動アーキテクチャ）
   - 完全マネージド・高可用性・コスト最適化

8. **サブスクリプション・プラン管理システム** ★NEW
   - スーパー管理者がUIからプラン内容を設定可能（クォータ、機能、価格）
   - 3つのプラン（Free、Pro、Enterprise）+ カスタムプラン作成可能
   - プラン比較ページ、アップグレード/ダウングレード機能
   - Stripe統合準備（将来のクレジットカード決済対応）
   - 使用状況・クォータ監視ダッシュボード

9. **多言語対応システム** ★NEW
   - 初期対応: 日本語・英語
   - 将来対応: 中国語（簡体字・繁体字）、フランス語、ドイツ語、スペイン語等
   - フロントエンド: next-intl（SSR/SSG対応）
   - バックエンド: i18next
   - UI、シナリオ、レポート、メール通知の多言語化
   - 言語切り替えUI、ユーザーごとの言語設定

10. **ATS連携システム** ★NEW
    - 国内主要ATS 3社: HRMOS採用、ジョブカン採用管理、採用一括かんりくん
    - 海外主要ATS 3社: Greenhouse、Lever、Workday Recruiting
    - 候補者データ自動同期
    - セッション結果・レポート自動送信
    - Webhook双方向連携
    - フィールドマッピングカスタマイズ
    - ATS管理UI（クライアント管理者）

11. **プラグインシステム** ★NEW
    - 拡張性の高いプラグインアーキテクチャ
    - プラグインSDK（TypeScript）
    - エクステンションポイント（ATS/HRIS/認証/レポート/Webhook）
    - プラグインマニフェスト・設定スキーマ
    - サンドボックス実行（セキュリティ）
    - プラグイン管理UI（インストール/有効化/設定）
    - 将来: プラグインマーケットプレイス

**更新内容:**

- **権限設計**: 3階層ロール明確化、ロール権限マトリクス追加
- **データベース設計**:
  - `platform_settings`, `plans`, `subscriptions` テーブル追加
  - `user_profiles`, `benchmark_aggregates`, `user_profile_history`, `achievements` テーブル追加
  - `api_keys`, `api_key_usage`, `api_rate_limits` テーブル追加
  - `ats_integrations`, `ats_sync_logs`, `ats_candidate_mappings` テーブル追加
  - `plugins`, `plugin_installations`, `plugin_execution_logs` テーブル追加
  - `translations`, `language_settings` テーブル追加
  - `users` テーブルに `role` (3階層)、`locale`、`ats_candidate_id` 追加
  - `organizations` テーブルに `subscription_id`、`locale`、`supported_locales` 追加
  - DynamoDB: `benchmark_cache`, `api_rate_limit_counters` テーブル追加
- **API設計**:
  - プラン管理エンドポイント追加（CRUD、加入者一覧）
  - サブスクリプション管理エンドポイント追加（アップグレード、キャンセル、使用状況）
  - ATS連携エンドポイント追加（CRUD、同期、ログ、マッピング）
  - プラグインエンドポイント追加（マーケットプレイス、インストール、設定）
  - 多言語エンドポイント追加（サポート言語、翻訳CRUD）
  - ベンチマーク関連エンドポイント追加（プロファイル、履歴、達成バッジ）
  - API管理エンドポイント追加（キー管理、使用状況、ログ）
  - スーパー管理者エンドポイント追加（テナント管理、プラットフォーム設定）
- **技術スタック**:
  - サーバーレス中心に全面刷新
  - next-intl（多言語対応）、i18next（バックエンドi18n）追加
  - Stripe API統合準備
- **インフラ構成**: AWSサーバーレスアーキテクチャ詳細設計追加
- **実装フェーズ**:
  - Phase 0（インフラ基盤）追加
  - Phase 2にAI管理機能追加
  - Phase 4にベンチマーク、API管理、スーパー管理者機能、プラン管理追加
  - **Phase 5（拡張機能・多言語対応）追加** - 4週間
    - 多言語対応基盤（日本語・英語）
    - ATS連携システム（国内外6社）
    - プラグインシステム
  - 合計: 28週間（約7ヶ月）
- **プラン制限**: ベンチマーク、API管理、ATS連携、プラグイン機能の権限・制限を反映

### Version 1.0 (2026-02-26)

**初版:**
- 基本的なAIアバターコミュニケーションプラットフォームの設計
- コアモジュール（アバター、音声、シナリオ、録画、解析、レポート）
- マルチテナント・権限設計
- データベース・API設計
- ECS/Fargate中心のインフラ構成
- 4フェーズ実装計画

---

## 付録B: 主要な設計判断の理由

### なぜサーバーレスアーキテクチャを採用したか？

**1. スケーラビリティ**
- セッション数の予測が困難（時間帯・曜日での変動が大きい）
- サーバーレスは0 → 1000+同時実行まで自動スケール
- コンテナベース（ECS）では事前のキャパシティプランニングが必要

**2. コスト効率**
- 使用量ベース課金: アイドル時のコスト最小化
- 月間1000セッション想定でコンテナ比40%削減
- Aurora Serverless v2: 0.5 ACU（アイドル時）→ 16 ACU（ピーク時）の自動調整

**3. メンテナンサビリティ**
- サーバー管理不要（パッチ適用、OS更新、スケーリング設定）
- インフラコード（AWS CDK）による再現性の高い管理
- 開発者はビジネスロジックに集中可能

**4. 高可用性**
- マネージドサービスの99.9% SLA
- 自動フェイルオーバー・マルチAZ配置
- 運用チームの規模を最小化

**トレードオフ:**
- コールドスタート（初回リクエストの遅延）→ Provisioned Concurrencyで対応
- Lambda実行時間制限（15分）→ Step Functionsで長時間処理を分割
- ベンダーロックイン → 抽象化レイヤーで一部緩和

### なぜAIプロンプト・プロバイダ管理を管理者UIに実装したか？

**1. ビジネスの柔軟性**
- AIモデルの進化が速い（Claude Opus 4 → 次世代モデル）
- コード変更なしでプロンプトを最適化→ 開発サイクル短縮
- プロバイダ切り替えでコスト最適化・品質向上

**2. 顧客要望への対応**
- Enterprise顧客: 独自のAIプロンプトで差別化したい
- 多言語展開: 言語ごとにプロンプトをカスタマイズ
- 業界特化: 医療・法律等でドメイン知識を反映

**3. リスク管理**
- プロバイダ障害時の自動フォールバック
- コスト予算超過時のアラート・制限
- A/Bテストによるプロンプト品質の継続的改善

**トレードオフ:**
- UI実装の複雑化 → テンプレートシステムで管理性向上
- プロンプトインジェクションリスク → バリデーション・サンドボックス実行

---

## 付録C: 想定FAQ

### Q1: なぜReady Player Meを3Dアバターに使用するのか？

**A:**
- Photo Capture APIで写真から高品質3Dアバターを自動生成可能
- WebGL対応でブラウザで動作
- Enterprise プランで商用利用可能
- 豊富なカスタマイズオプション

代替案（VRoid Studio、MetaHuman）は生成の自動化が困難またはブラウザ実行に制約あり。

### Q2: サーバーレスでリアルタイムWebSocket通信は可能か？

**A:**
- AWS IoT Coreを使用することで100万同時接続対応のWebSocket APIを実現
- Lambda関数で接続管理・メッセージ処理
- DynamoDBで接続状態を管理
- 実績: AWSのリファレンスアーキテクチャで採用

### Q3: 動画処理をLambdaで行うのは遅くないか？

**A:**
- 軽量処理（サムネイル生成等）: Lambda（高速・低コスト）
- 重量処理（動画合成）: AWS MediaConvert（専用マネージドサービス）
- Step Functionsで並列処理→ 全体処理時間を短縮

30分の録画セッション処理時間: 約5-8分（合成・解析・レポート生成込み）

### Q4: Aurora Serverless v2とv1の違いは？

**A:**
- **v2**: 秒単位でACU調整、コールドスタート無し、Prisma Data Proxy対応
- **v1**: 分単位で調整、コールドスタート有り、接続制限あり

本プラットフォームはリアルタイム性が重要なためv2を採用。

### Q5: マルチプロバイダ対応のオーバーヘッドは？

**A:**
- 抽象化レイヤー（TypeScript Interface）で統一API提供
- プロバイダ固有の最適化はアダプタークラスで実装
- パフォーマンス影響: < 10ms（ネットワークレイテンシに比べて無視可能）

### Q6: ベンチマーク機能でプライバシーは保護されるか？

**A:**
- 統計的に集約されたデータのみ使用（個人特定不可）
- 最低10ユーザー以上のデータがある場合のみ表示
- ユーザーはオプトアウト可能（自身のデータを集計から除外）
- 組織管理者がベンチマーク範囲を制御可能
- GDPR準拠（匿名化・削除リクエスト対応）

### Q7: 外部APIのレート制限はどのように管理されるか？

**A:**
- **3階層の制限:**
  1. スーパー管理者: プラットフォーム全体の上限設定
  2. クライアント管理者: 組織内・APIキーごとの制限設定
  3. システム: Redis Sliding Windowによるリアルタイム制限

- **精度と効率:**
  - 時間あたり/日次/月次の制限を並行チェック
  - Redis（サブミリ秒レスポンス）で高速処理
  - レート制限超過時は HTTP 429 + Retry-After ヘッダー

### Q8: スーパー管理者とクライアント管理者の違いは？

**A:**
| 機能 | スーパー管理者 | クライアント管理者 |
|------|---------------|-------------------|
| 役割 | プラットフォーム運営者 | 各組織（テナント）の管理者 |
| 管理範囲 | 全テナント | 自組織のみ |
| テナント作成・削除 | ✓ | - |
| グローバルAPI制限設定 | ✓ | - |
| 組織内ユーザー管理 | ✓（全テナント） | ✓（自組織のみ） |
| AIプロンプト管理 | ✓（全テナント） | ✓（自組織のみ、Enterprise） |
| APIキー発行 | ✓（全テナント） | ✓（自組織のみ） |

### Q9: ベンチマーク計算のパフォーマンスは？

**A:**
- **リアルタイム計算は行わない**
  - 日次バッチ処理（EventBridge + Lambda）で集約
  - DynamoDB にキャッシュ（TTL: 30日）
  - ユーザー閲覧時はキャッシュから高速取得（< 100ms）

- **スケーラビリティ:**
  - 100万ユーザーでもバッチ処理時間 < 30分
  - Lambda 並列実行（組織ごとに分散処理）

### Q10: プラン管理の柔軟性は？

**A:**
- スーパー管理者がUIから完全にカスタマイズ可能
  - クォータ設定（セッション数、ユーザー数、APIコール数等）
  - 機能有効化/無効化（ベンチマーク、AI管理、ATS連携等）
  - 価格設定（月額、年額、無料トライアル期間）
- デフォルトプラン（Free/Pro/Enterprise）は初期設定済み
- 新規プラン作成・複製機能
- 組織ごとにカスタムプラン適用可能（Enterprise交渉時）

### Q11: 多言語対応の拡張は容易か？

**A:**
- **非常に容易:**
  - 翻訳ファイルを追加するだけ（JSON形式）
  - UI、シナリオ、レポートが自動的に多言語対応
  - TTS/STTは既に40言語以上対応（Azure, ElevenLabs）
- **プロセス:**
  1. 翻訳ファイル作成（`locales/{locale}/`）
  2. 言語設定に追加（`platform_settings.supported_languages`）
  3. TTS/STT音声マッピング設定
  4. デプロイ（設定変更のみ、コード変更不要）
- **推定時間:** 新言語追加に2週間（翻訳作業含む）

### Q12: ATS連携の追加は難しいか？

**A:**
- **プラグインシステムで容易:**
  - ATSAdapterインターフェース実装（約500行）
  - 認証、データマッピング、Webhook処理
  - プラグインマニフェスト記述
- **開発時間:** 新ATS追加に1-2週間
- **公式サポートATS以外:**
  - Enterprise顧客向けにカスタムプラグイン開発可能
  - コミュニティプラグイン（将来のマーケットプレイス）

### Q13: プラグインのセキュリティは？

**A:**
- **多層セキュリティ:**
  1. **権限スコープ制限** - 必要最小限の権限のみ付与
  2. **サンドボックス実行** - Lambda Layer隔離環境
  3. **リソース制限** - メモリ256MB、タイムアウト30秒、CPU 0.5
  4. **審査プロセス** - 公式プラグインは厳格な審査（将来）
- **監査:**
  - 全プラグイン実行ログ記録
  - 異常検知・アラート
  - 問題発見時の即時無効化

### Q14: Stripe統合はいつ実装されるか？

**A:**
- **Phase 4完了時に基盤準備完了**
  - データベーススキーマ設計済み
  - サブスクリプション管理API実装済み
  - Stripe統合は設定追加のみ
- **実装タイミング:**
  - Phase 6（運用フェーズ）で実装予定
  - 推定: 本番リリースから3-6ヶ月後
  - 初期は請求書払い（Enterprise）で運用

---

*本企画書は詳細設計フェーズ v2.0 の内容です。実装進行に伴い随時更新されます。*

**最終更新:** 2026-03-04
**次回レビュー予定:** Phase 0 完了時（インフラ基盤構築後）
