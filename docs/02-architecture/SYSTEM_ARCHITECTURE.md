# システムアーキテクチャ

Prance Communication Platformの包括的なシステムアーキテクチャ設計書

**バージョン:** 2.0
**最終更新:** 2026-03-05
**ステータス:** Phase 0 完了

---

## 目次

1. [アーキテクチャ概要](#1-アーキテクチャ概要)
2. [全体構成図](#2-全体構成図)
3. [リアルタイム通信フロー](#3-リアルタイム通信フロー)
4. [サーバーレスアーキテクチャの特徴](#4-サーバーレスアーキテクチャの特徴)
5. [コンポーネント詳細](#5-コンポーネント詳細)
6. [スケーラビリティ設計](#6-スケーラビリティ設計)
7. [コスト最適化](#7-コスト最適化)
8. [高可用性・DR設計](#8-高可用性dr設計)
9. [セキュリティアーキテクチャ](#9-セキュリティアーキテクチャ)

---

## 1. アーキテクチャ概要

### 1.1 アーキテクチャ原則

Pranceプラットフォームは以下の5つの設計原則に基づいて構築されています。

#### 1. サーバーレスファースト

- **AWS Lambda、API Gateway、Aurora Serverless v2** を中心とした構成
- 使用量ベースの課金で初期コストを最小化
- 自動スケーリングによる運用負荷削減
- インフラ管理の完全自動化

#### 2. マイクロサービス指向

- 機能ごとに独立したLambda関数として実装
- 疎結合な設計で保守性と拡張性を確保
- イベント駆動アーキテクチャで非同期処理を実現
- 各サービスの独立したデプロイとスケーリング

#### 3. マルチテナント対応

- Row Level Security (RLS) によるデータ分離
- テナント単位のリソース管理と課金
- プラグインシステムによるカスタマイズ性
- 階層的な権限管理（スーパー管理者、クライアント管理者、クライアントユーザー）

#### 4. 高可用性

- マルチAZ構成（最低2 AZ）
- CloudFrontによるグローバル配信
- 自動フェイルオーバーとヘルスチェック
- 99.9% SLA保証

#### 5. セキュリティ

- VPC内でのプライベートネットワーク構成
- IAMロールベースの権限管理（最小権限の原則）
- 暗号化（転送時: TLS 1.2+、保管時: KMS）
- 監査ログとアクセス制御

### 1.2 技術的な設計判断

#### なぜサーバーレスアーキテクチャを採用したか？

**採用理由:**

1. **自動スケーラビリティ** - 10ユーザー → 10万ユーザーまでインフラ変更なしで対応
2. **コスト効率** - 使用量ベース課金、アイドル時のコストほぼゼロ（月間1000セッション: $500-800）
3. **高可用性** - マネージドサービス 99.9% SLA、自動フェイルオーバー
4. **メンテナンス不要** - サーバー管理、パッチ適用、OS更新すべて自動
5. **開発速度** - インフラ管理不要でビジネスロジックに集中

**トレードオフと対策:**

| 課題                             | 対策                                          |
| -------------------------------- | --------------------------------------------- |
| コールドスタート（初回起動遅延） | Provisioned Concurrency（重要API）、VPC最適化 |
| 15分実行時間制限                 | Step Functionsで長時間処理を分割              |
| ベンダーロックイン懸念           | 抽象化レイヤー、移行可能なアーキテクチャ設計  |
| ステートレス制約                 | DynamoDB/Redisで状態管理                      |

---

## 2. 全体構成図

### 2.1 システム全体図

```
┌─────────────────────────────────────────────────────────────────┐
│                    インターネット（グローバル）                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      CloudFront CDN                              │
│                  (Global Edge Locations)                         │
│  - TLS 1.2+ 暗号化                                               │
│  - DDoS Protection (AWS Shield)                                  │
│  - 静的コンテンツキャッシング                                    │
└────────────┬────────────────────────────────────┬───────────────┘
             │                                    │
             ↓                                    ↓
┌────────────────────────────┐      ┌────────────────────────────┐
│     S3 Static Hosting      │      │      API Gateway           │
│   (Next.js Static Assets)  │      │   (REST + WebSocket)       │
│  - SSG/ISR ページ          │      │  - リージョナルエンドポイント│
│  - 画像・フォント           │      │  - Cognito Authorizer      │
│  - 言語リソース             │      │  - レート制限（プラン別）   │
└────────────────────────────┘      └──────────┬─────────────────┘
                                               │
                              ┌────────────────┴────────────────┐
                              │         AWS IoT Core            │
                              │    (WebSocket 100万同時接続)    │
                              │  - リアルタイム音声ストリーム    │
                              │  - STT結果配信                  │
                              │  - AI応答配信                   │
                              └────────────────┬────────────────┘
                                               │
                              ┌────────────────┴────────────────┐
                              │       Amazon Cognito            │
                              │      (認証・認可)                │
                              │  - JWT トークン発行             │
                              │  - MFA サポート                 │
                              │  - SSO 統合準備                 │
                              └────────────────┬────────────────┘
                                               │
┌──────────────────────────────────────────────┴─────────────────┐
│                         AWS Lambda Functions                    │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│  │  REST API    │ │  WebSocket   │ │  Background  │           │
│  │  Handler     │ │  Handler     │ │  Workers     │           │
│  │ (Node.js 20) │ │ (Node.js 20) │ │ (Node.js 20) │           │
│  │  ARM64       │ │  ARM64       │ │  ARM64       │           │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘           │
└─────────┼────────────────┼────────────────┼───────────────────┘
          │                │                │
          ├────────────────┼────────────────┤
          │                │                │
  ┌───────┴────────┐  ┌───┴─────────┐  ┌──┴──────────────┐
  │   Aurora       │  │  DynamoDB   │  │   ElastiCache   │
  │  Serverless v2 │  │  - Sessions │  │   (Redis)       │
  │  (PostgreSQL)  │  │  - WebSocket│  │  - Rate Limit   │
  │  - マルチAZ    │  │    Conn     │  │  - Cache        │
  │  - 自動スケール│  │  - Benchmark│  │  - Session Store│
  └───────┬────────┘  └─────────────┘  └─────────────────┘
          │
          ▼
  ┌────────────────────────────────────────────────┐
  │              Amazon S3 Buckets                 │
  │  - 録画映像 (user/avatar)                      │
  │  - アバターアセット                             │
  │  - レポートファイル                             │
  │  - バックアップ                                 │
  └────────────────────────────────────────────────┘
          │
          ▼
  ┌────────────────────────────────────────────────┐
  │         外部サービス（API連携）                 │
  │  - AWS Bedrock (Claude Sonnet 4.6)             │
  │  - ElevenLabs API (TTS)                        │
  │  - Azure Speech Services (STT)                 │
  │  - AWS Rekognition (感情解析)                  │
  └────────────────────────────────────────────────┘
```

### 2.2 ネットワーク構成

```
┌──────────────────────────────────────────────────────────────┐
│                       VPC (10.0.0.0/16)                       │
│  ┌────────────────────────────────────────────────────────┐  │
│  │           Availability Zone A                           │  │
│  │  ┌────────────────┐  ┌────────────────┐               │  │
│  │  │ Public Subnet  │  │ Private Subnet │               │  │
│  │  │  10.0.1.0/24   │  │  10.0.11.0/24  │               │  │
│  │  │                │  │                │               │  │
│  │  │ NAT Gateway    │  │ Lambda         │               │  │
│  │  │ (Static IP)    │  │ Functions      │               │  │
│  │  └────────────────┘  └────────────────┘               │  │
│  │           │                   │                         │  │
│  │  ┌────────────────────────────────────┐               │  │
│  │  │     Isolated Subnet                 │               │  │
│  │  │      10.0.21.0/28                   │               │  │
│  │  │                                     │               │  │
│  │  │  Aurora Writer Instance             │               │  │
│  │  └────────────────────────────────────┘               │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │           Availability Zone B                           │  │
│  │  ┌────────────────┐  ┌────────────────┐               │  │
│  │  │ Public Subnet  │  │ Private Subnet │               │  │
│  │  │  10.0.2.0/24   │  │  10.0.12.0/24  │               │  │
│  │  │                │  │                │               │  │
│  │  │ (Reserved)     │  │ Lambda         │               │  │
│  │  │                │  │ Functions      │               │  │
│  │  └────────────────┘  └────────────────┘               │  │
│  │           │                   │                         │  │
│  │  ┌────────────────────────────────────┐               │  │
│  │  │     Isolated Subnet                 │               │  │
│  │  │      10.0.22.0/28                   │               │  │
│  │  │                                     │               │  │
│  │  │  Aurora Reader Instance             │               │  │
│  │  └────────────────────────────────────┘               │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  Security Groups:                                             │
│  - Lambda SG (0.0.0.0/0:443 outbound, Aurora:5432)          │
│  - Aurora SG (Lambda SG:5432 inbound only)                   │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. リアルタイム通信フロー

### 3.1 セッション実行中の通信フロー

```
┌────────────────────────────────────────────────────────────────┐
│                      ブラウザ（React）                          │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────┐  ┌───────────────────┐                 │
│  │ ユーザーカメラ映像│  │ AIアバター映像     │                 │
│  │ (右側表示)        │  │ (左側表示)        │                 │
│  │                   │  │                   │                 │
│  │ getUserMedia API  │  │ Three.js/Live2D   │                 │
│  │ 30-60fps          │  │ 60fps             │                 │
│  │ 1280x720          │  │ 1280x720          │                 │
│  └─────────┬─────────┘  └─────────┬─────────┘                 │
│            │                       │                            │
│            ├───────────────────────┤                            │
│            │  MediaRecorder API    │                            │
│            │  (同時録画)           │                            │
│            └───────────┬───────────┘                            │
│                        │                                        │
│  ┌─────────────────────┴────────────────────────────────────┐  │
│  │       リアルタイム文字起こし（会話履歴）                 │  │
│  │  ┌──────────────────────────────────────────────────┐   │  │
│  │  │ 00:12 AI: よろしくお願いします。                 │   │  │
│  │  │ 00:18 YOU: よろしくお願いします。私は...       │   │  │
│  │  │ 00:34 AI: ありがとうございます。技術スタック... │   │  │
│  │  │ 00:41 YOU: ReactとNode.jsを... (認識中💭)       │   │  │
│  │  └──────────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
         │                          │
         │ WebSocket (IoT Core)     │ HTTPS (API Gateway)
         ▼                          ▼
┌──────────────────────┐  ┌──────────────────────┐
│  Lambda (WebSocket)  │  │  Lambda (REST API)   │
│  - 音声ストリーム中継│  │  - セッション管理    │
│  - STT結果配信       │  │  - トランスクリプト  │
│  - AI応答配信        │  │    保存              │
└──────────────────────┘  └──────────────────────┘
         │                          │
         ▼                          ▼
┌─────────────────────────────────────────┐
│  外部サービス                            │
│  - Azure Speech Services (STT)          │
│  - AWS Bedrock Claude (会話生成)        │
│  - ElevenLabs (TTS + Viseme)            │
└─────────────────────────────────────────┘
```

### 3.2 ユーザー発話フロー（詳細）

```
1. ユーザーがマイクで発話
   │
   ▼
2. getUserMedia → Azure STT（ストリーミング）
   │  - WebSocket接続で音声データを連続送信
   │  - 100ms以下のレイテンシ
   ▼
3. recognizing イベント（0.1秒ごと）
   │  - 暫定テキスト生成
   │  - UI: グレー表示、💭認識中マーク
   ▼
4. recognized イベント（発話終了時）
   │  - 確定テキスト生成
   │  - UI: 通常色で表示
   ▼
5. WebSocket → Lambda → DynamoDB
   │  - セッション状態更新
   │  - トランスクリプト保存
   ▼
6. Lambda → AWS Bedrock (Claude Sonnet 4.6)
   │  - シナリオ + 会話履歴 + ユーザー発話
   │  - AI応答テキスト生成
   ▼
7. Lambda → ElevenLabs API
   │  - TTS音声生成
   │  - Viseme（口形状）データ生成
   ▼
8. WebSocket → ブラウザ
   │  ├─ 音声データ（ArrayBuffer）
   │  ├─ Visemeデータ（口形状タイムスタンプ）
   │  └─ テキスト（トランスクリプト表示）
   ▼
9. ブラウザでレンダリング
   │  - 音声再生
   │  - アバター口パク（リップシンク）
   │  - トランスクリプト表示（青背景、AIタグ）
   └─ 次のユーザー発話を待機
```

### 3.3 録画フロー

```
セッション開始時:
┌────────────────────────────────────────────┐
│ 1. MediaRecorder起動                       │
│    ├─ ユーザーカメラストリーム録画開始     │
│    └─ アバターCanvasストリーム録画開始     │
└────────────────────────────────────────────┘
         │
         ▼
セッション中（1秒ごと）:
┌────────────────────────────────────────────┐
│ 2. チャンク生成                             │
│    ├─ ユーザー映像チャンク（WebM）         │
│    └─ アバター映像チャンク（WebM）         │
└────────────────────────────────────────────┘
         │
         ▼
セッション終了時:
┌────────────────────────────────────────────┐
│ 3. Blob生成＆アップロード                  │
│    ├─ 両方のBlobをマージ                   │
│    ├─ S3署名付きURL取得（Lambda経由）      │
│    └─ 並列アップロード                     │
└────────────────────────────────────────────┘
         │
         ▼
バックグラウンド処理（非同期）:
┌────────────────────────────────────────────┐
│ 4. EventBridge → Step Functions             │
│    ├─ MediaConvert: サイドバイサイド合成   │
│    ├─ サムネイル生成（Lambda）             │
│    ├─ トランスクリプト生成（WebVTT）       │
│    └─ 完了通知（WebSocket）                │
└────────────────────────────────────────────┘
```

---

## 4. サーバーレスアーキテクチャの特徴

### 4.1 AWS Lambda 設計

#### Lambda関数構成

| 関数名                 | 用途                 | メモリ  | タイムアウト | 同時実行数      |
| ---------------------- | -------------------- | ------- | ------------ | --------------- |
| **ApiFunction**        | REST API処理         | 1024 MB | 30秒         | Provisioned: 10 |
| **WebSocketFunction**  | WebSocket処理        | 2048 MB | 60秒         | 予約なし        |
| **WorkerFunction**     | バックグラウンド処理 | 512 MB  | 5分          | 予約: 10        |
| **AuthorizerFunction** | JWT検証              | 256 MB  | 5秒          | 予約なし        |
| **MigrationFunction**  | DBマイグレーション   | 512 MB  | 10分         | 予約: 1         |

#### Lambda最適化戦略

**1. コールドスタート対策**

```typescript
// Provisioned Concurrency（重要API）
apiFunction.addAlias('live', {
  version: apiFunction.currentVersion,
  provisionedConcurrentExecutions: 10,
});

// VPC最適化（Hyperplane ENI）
// - Lambda実行時間を1秒 → 100ms に短縮
```

**2. Lambda Layers活用**

```
/opt/
├── nodejs/node_modules/
│   ├── @prisma/client    # 共有ライブラリ
│   ├── @anthropic-ai/sdk # AI SDK
│   └── aws-sdk           # AWS SDK
└── shared/
    ├── utils/            # 共通ユーティリティ
    └── types/            # TypeScript型定義
```

**3. ARM64 (Graviton2) 採用**

- **コスト削減**: 20% 安価
- **パフォーマンス向上**: 19% 高速
- **エコフレンドリー**: 60% 低消費電力

### 4.2 API Gateway 設計

#### REST API エンドポイント

```
https://api.prance.com/
├── /v1/auth
│   ├── POST /register       # ユーザー登録
│   ├── POST /login          # ログイン
│   └── POST /refresh        # トークン更新
├── /v1/users
│   ├── GET  /me             # 自己情報取得
│   ├── PUT  /me             # プロフィール更新
│   └── DELETE /me           # アカウント削除
├── /v1/sessions
│   ├── POST /                # セッション作成
│   ├── GET  /:id             # セッション取得
│   ├── POST /:id/start       # セッション開始
│   └── POST /:id/complete    # セッション完了
├── /v1/avatars
│   ├── GET  /                # アバター一覧
│   └── POST /generate        # アバター生成
├── /v1/scenarios
│   ├── GET  /                # シナリオ一覧
│   ├── POST /                # シナリオ作成
│   └── PUT  /:id             # シナリオ更新
└── /v1/reports
    ├── GET  /:sessionId      # レポート取得
    └── POST /:sessionId/pdf  # PDF生成
```

#### WebSocket API エンドポイント

```
wss://ws.prance.com/
├── $connect              # 接続時
├── $disconnect           # 切断時
├── $default              # デフォルトルート
├── user_speech           # ユーザー発話
├── avatar_response       # AI応答
├── session_state_update  # セッション状態更新
└── recording_chunk       # 録画チャンク送信
```

#### レート制限（プラン別）

| プラン         | リクエスト/分 | バースト | 月間上限  |
| -------------- | ------------- | -------- | --------- |
| **Free**       | 60            | 100      | 10,000    |
| **Pro**        | 600           | 1,000    | 100,000   |
| **Enterprise** | 6,000         | 10,000   | Unlimited |

### 4.3 AWS IoT Core（WebSocket）

#### IoT Coreを採用した理由

| 比較項目         | API Gateway WebSocket | AWS IoT Core          |
| ---------------- | --------------------- | --------------------- |
| **同時接続数**   | 〜10,000              | 1,000,000+            |
| **料金**         | $1.00/100万メッセージ | $1.00/100万メッセージ |
| **レイテンシ**   | 50-100ms              | 30-50ms               |
| **双方向通信**   | ○                     | ○                     |
| **Pub/Sub**      | ×                     | ○                     |
| **デバイス管理** | ×                     | ○                     |

**採用理由:** 将来的な大規模展開（10万+ 同時接続）を見据えた選択

#### IoT Core トピック設計

```
prance/
├── sessions/{sessionId}/
│   ├── audio/in          # ユーザー音声入力
│   ├── audio/out         # AIアバター音声出力
│   ├── transcript/user   # ユーザー発話テキスト
│   ├── transcript/ai     # AI応答テキスト
│   ├── state             # セッション状態更新
│   └── control           # 制御コマンド（一時停止等）
└── users/{userId}/
    ├── notifications     # 通知
    └── presence          # オンライン状態
```

---

## 5. コンポーネント詳細

### 5.1 フロントエンド層（Next.js 15）

#### ディレクトリ構成

```
apps/web/
├── app/                          # App Router
│   ├── (auth)/                   # 認証グループ
│   │   ├── login/
│   │   ├── register/
│   │   └── forgot-password/
│   ├── (dashboard)/              # ダッシュボードグループ
│   │   ├── dashboard/
│   │   ├── sessions/
│   │   ├── analytics/
│   │   └── settings/
│   ├── (admin)/                  # 管理者グループ
│   │   ├── admin/                # スーパー管理者
│   │   │   ├── tenants/
│   │   │   ├── plans/
│   │   │   ├── ai-prompts/
│   │   │   └── providers/
│   │   └── client-admin/         # クライアント管理者
│   │       ├── users/
│   │       ├── avatars/
│   │       └── benchmarks/
│   └── session-player/           # セッション実行画面
├── components/
│   ├── ui/                       # shadcn/ui コンポーネント
│   ├── features/                 # 機能別コンポーネント
│   │   ├── SessionPlayer/
│   │   ├── AvatarRenderer/
│   │   ├── RealtimeTranscript/
│   │   └── ReportViewer/
│   └── layouts/                  # レイアウト
├── lib/
│   ├── api-client.ts             # API クライアント
│   ├── websocket.ts              # WebSocket マネージャー
│   └── webrtc.ts                 # WebRTC マネージャー
├── hooks/
│   ├── useRealtimeSession.ts
│   ├── useRealtimeTranscription.ts
│   └── useAvatarRenderer.ts
└── contexts/
    ├── AuthContext.tsx
    └── TenantContext.tsx
```

#### 主要機能実装

**1. API Client（Axios + Zustand）**

```typescript
// lib/api-client.ts
import axios from 'axios';
import { create } from 'zustand';

interface ApiStore {
  client: AxiosInstance;
  tenantId: string | null;
  setTenantId: (id: string) => void;
}

export const useApiStore = create<ApiStore>(set => ({
  client: axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL,
    timeout: 30000,
  }),
  tenantId: null,
  setTenantId: id => set({ tenantId: id }),
}));

// Request Interceptor（認証トークン自動付与）
useApiStore.getState().client.interceptors.request.use(config => {
  const { tenantId } = useApiStore.getState();
  const token = sessionStorage.getItem('access_token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (tenantId) {
    config.headers['X-Tenant-Id'] = tenantId;
  }

  return config;
});

// Response Interceptor（トークン更新）
useApiStore.getState().client.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      const refreshToken = sessionStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const { data } = await axios.post('/api/auth/refresh', {
            refreshToken,
          });
          sessionStorage.setItem('access_token', data.accessToken);
          error.config.headers.Authorization = `Bearer ${data.accessToken}`;
          return axios(error.config);
        } catch {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);
```

**2. リアルタイムセッションフック**

```typescript
// hooks/useRealtimeSession.ts
export function useRealtimeSession(sessionId: string) {
  const [userStream, setUserStream] = useState<MediaStream | null>(null);
  const [avatarRenderer, setAvatarRenderer] = useState<AvatarRenderer | null>(null);
  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([]);
  const [sessionState, setSessionState] = useState<SessionState>({
    isRecording: false,
    microphoneActive: true,
    cameraActive: true,
    volume: 0.8,
    elapsedTime: 0,
    maxDuration: 1800, // 30分
  });

  // ユーザーカメラ初期化
  useEffect(() => {
    const initCamera = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      setUserStream(stream);
    };
    initCamera();
  }, []);

  // アバターレンダラー初期化
  useEffect(() => {
    const renderer = new AvatarRenderer({
      container: document.getElementById('avatar-canvas'),
      avatarType: '3d', // or '2d'
      width: 1280,
      height: 720,
    });
    setAvatarRenderer(renderer);

    return () => renderer.destroy();
  }, []);

  // リアルタイム文字起こし
  const { transcriptEntries, currentRecognizing } = useRealtimeTranscription(sessionId);

  return {
    userStream,
    avatarRenderer,
    transcriptEntries,
    currentRecognizing,
    sessionState,
    controls: {
      toggleMicrophone: () =>
        setSessionState(prev => ({ ...prev, microphoneActive: !prev.microphoneActive })),
      toggleCamera: () => setSessionState(prev => ({ ...prev, cameraActive: !prev.cameraActive })),
      setVolume: (volume: number) => setSessionState(prev => ({ ...prev, volume })),
    },
  };
}
```

### 5.2 API層（AWS Lambda + NestJS）

#### モジュール構成

```
apps/api/src/
├── main.ts                       # エントリーポイント
├── app.module.ts                 # ルートモジュール
├── modules/
│   ├── auth/                     # 認証・認可
│   │   ├── auth.service.ts
│   │   ├── strategies/
│   │   │   ├── jwt.strategy.ts
│   │   │   └── api-key.strategy.ts
│   │   └── guards/
│   │       ├── roles.guard.ts
│   │       └── tenant.guard.ts
│   ├── users/                    # ユーザー管理
│   ├── tenants/                  # テナント管理
│   ├── sessions/                 # セッション管理
│   ├── avatars/                  # アバター管理
│   ├── ai/                       # AI Provider管理
│   │   ├── providers/
│   │   │   ├── claude.provider.ts
│   │   │   ├── openai.provider.ts
│   │   │   └── gemini.provider.ts
│   │   └── prompts/
│   ├── speech/                   # TTS/STT
│   │   ├── elevenlabs.service.ts
│   │   ├── azure-speech.service.ts
│   │   └── speech.gateway.ts
│   ├── analytics/                # 解析
│   ├── benchmarks/               # ベンチマーク
│   └── ats/                      # ATS連携
├── common/
│   ├── decorators/
│   ├── filters/
│   ├── interceptors/
│   └── middleware/
└── config/
```

#### AI Provider実装（Claude Sonnet 4.6）

```typescript
// modules/ai/providers/claude.provider.ts
import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

@Injectable()
export class ClaudeProvider implements AIProvider {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async generateResponse(
    prompt: string,
    context: ConversationContext,
    options: AIOptions
  ): Promise<AIResponse> {
    const response = await this.client.messages.create({
      model: 'us.anthropic.claude-sonnet-4-6', // Claude Sonnet 4.6
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature || 0.7,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      system: options.systemPrompt,
    });

    return {
      text: response.content[0].text,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      metadata: {
        model: response.model,
        stopReason: response.stop_reason,
      },
    };
  }

  async streamResponse(
    prompt: string,
    context: ConversationContext,
    options: AIOptions,
    callback: (chunk: string) => void
  ): Promise<void> {
    const stream = await this.client.messages.stream({
      model: 'us.anthropic.claude-sonnet-4-6',
      max_tokens: options.maxTokens || 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        callback(chunk.delta.text);
      }
    }
  }
}
```

### 5.3 データ層

#### Aurora Serverless v2（PostgreSQL 15.4）

**接続プール管理（Prisma）**

```typescript
// packages/database/src/client.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['query', 'error', 'warn'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Row Level Security Middleware
prisma.$use(async (params, next) => {
  const tenantId = params.args?.where?.tenant_id;

  if (tenantId) {
    await prisma.$executeRawUnsafe(`SET app.current_tenant_id = '${tenantId}'`);
  }

  return next(params);
});
```

**自動スケーリング設定**

```typescript
// infrastructure/lib/database-stack.ts
const auroraCluster = new rds.DatabaseCluster(this, 'AuroraCluster', {
  engine: rds.DatabaseClusterEngine.auroraPostgres({
    version: rds.AuroraPostgresEngineVersion.VER_15_4,
  }),
  serverlessV2MinCapacity: 0.5, // 0.5 ACU（最小）
  serverlessV2MaxCapacity: 2, // 2 ACU（最大）
  writer: rds.ClusterInstance.serverlessV2('writer'),
  readers: [rds.ClusterInstance.serverlessV2('reader1', { scaleWithWriter: true })],
  vpc: props.vpc,
  vpcSubnets: {
    subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
  },
  backup: {
    retention: Duration.days(7),
    preferredWindow: '03:00-04:00',
  },
  storageEncrypted: true,
  storageEncryptionKey: props.kmsKey,
});
```

#### DynamoDB（セッション状態管理）

**テーブル設計**

| テーブル名               | パーティションキー | ソートキー | TTL    | 用途                   |
| ------------------------ | ------------------ | ---------- | ------ | ---------------------- |
| **Sessions**             | sessionId          | -          | 24時間 | セッション状態         |
| **WebSocketConnections** | connectionId       | -          | 2時間  | WebSocket接続管理      |
| **BenchmarkCache**       | userId             | timestamp  | 30日   | ベンチマークキャッシュ |
| **RateLimits**           | apiKey             | timestamp  | 1分    | APIレート制限          |

```typescript
// packages/shared/src/session-store.ts
import { DynamoDB } from 'aws-sdk';

export class DynamoDBSessionStore {
  private client: DynamoDB.DocumentClient;
  private tableName: string;

  constructor() {
    this.client = new DynamoDB.DocumentClient();
    this.tableName = process.env.SESSIONS_TABLE_NAME!;
  }

  async set(sessionId: string, data: any, ttl: number): Promise<void> {
    await this.client
      .put({
        TableName: this.tableName,
        Item: {
          sessionId,
          data: JSON.stringify(data),
          ttl: Math.floor(Date.now() / 1000) + ttl,
        },
      })
      .promise();
  }

  async get(sessionId: string): Promise<any | null> {
    const result = await this.client
      .get({
        TableName: this.tableName,
        Key: { sessionId },
      })
      .promise();

    return result.Item ? JSON.parse(result.Item.data) : null;
  }

  async delete(sessionId: string): Promise<void> {
    await this.client
      .delete({
        TableName: this.tableName,
        Key: { sessionId },
      })
      .promise();
  }
}
```

#### Redis ElastiCache（レート制限・キャッシュ）

```typescript
// packages/shared/src/rate-limiter.ts
import Redis from 'ioredis';

export class RateLimiter {
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      tls: process.env.NODE_ENV === 'production' ? {} : undefined,
    });
  }

  async checkLimit(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number }> {
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;

    // 古いエントリ削除
    await this.redis.zremrangebyscore(key, 0, windowStart);

    // ウィンドウ内のリクエスト数カウント
    const count = await this.redis.zcard(key);

    if (count >= limit) {
      return { allowed: false, remaining: 0 };
    }

    // 新しいリクエスト追加
    await this.redis.zadd(key, now, `${now}-${Math.random()}`);
    await this.redis.expire(key, windowSeconds);

    return { allowed: true, remaining: limit - count - 1 };
  }
}
```

### 5.4 非同期処理層（Step Functions）

#### 録画処理ワークフロー

```yaml
# infrastructure/statemachines/recording-processing.asl.json
{
  'Comment': 'Recording Processing Workflow',
  'StartAt': 'ValidateInputs',
  'States':
    {
      'ValidateInputs':
        {
          'Type': 'Task',
          'Resource': 'arn:aws:lambda:us-east-1:123456789012:function:ValidateRecordingInputs',
          'Next': 'ParallelProcessing',
        },
      'ParallelProcessing':
        {
          'Type': 'Parallel',
          'Branches':
            [
              {
                'StartAt': 'MergeVideos',
                'States':
                  {
                    'MergeVideos':
                      {
                        'Type': 'Task',
                        'Resource': 'arn:aws:states:::mediaconvert:createJob.sync',
                        'Parameters':
                          {
                            'JobTemplate': 'SideBySideMerge',
                            'UserMetadata': { 'sessionId.$': '$.sessionId' },
                          },
                        'End': true,
                      },
                  },
              },
              {
                'StartAt': 'GenerateThumbnail',
                'States':
                  {
                    'GenerateThumbnail':
                      {
                        'Type': 'Task',
                        'Resource': 'arn:aws:lambda:us-east-1:123456789012:function:GenerateThumbnail',
                        'End': true,
                      },
                  },
              },
              {
                'StartAt': 'GenerateWebVTT',
                'States':
                  {
                    'GenerateWebVTT':
                      {
                        'Type': 'Task',
                        'Resource': 'arn:aws:lambda:us-east-1:123456789012:function:GenerateWebVTT',
                        'End': true,
                      },
                  },
              },
            ],
          'Next': 'UpdateDatabase',
        },
      'UpdateDatabase':
        {
          'Type': 'Task',
          'Resource': 'arn:aws:lambda:us-east-1:123456789012:function:UpdateRecordingMetadata',
          'Next': 'SendNotification',
        },
      'SendNotification':
        {
          'Type': 'Task',
          'Resource': 'arn:aws:lambda:us-east-1:123456789012:function:SendWebSocketNotification',
          'End': true,
        },
    },
}
```

### 5.5 ストレージ・CDN層

#### S3バケット構成

| バケット名               | 用途                | ライフサイクル  | 暗号化  |
| ------------------------ | ------------------- | --------------- | ------- |
| **prance-media-{env}**   | 録画映像、音声      | 90日後にGlacier | SSE-KMS |
| **prance-avatars-{env}** | アバターアセット    | 無期限          | SSE-S3  |
| **prance-reports-{env}** | レポートPDF         | 365日後削除     | SSE-KMS |
| **prance-backups-{env}** | DBバックアップ      | 30日後削除      | SSE-KMS |
| **prance-website-{env}** | Next.js静的ファイル | 無期限          | SSE-S3  |

#### CloudFront Distribution設定

```typescript
// infrastructure/lib/cdn-stack.ts
const distribution = new cloudfront.Distribution(this, 'Distribution', {
  defaultBehavior: {
    origin: new origins.S3Origin(websiteBucket, {
      originAccessIdentity: oai,
    }),
    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
    cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
    compress: true,
    cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
  },
  additionalBehaviors: {
    '/api/*': {
      origin: new origins.RestApiOrigin(restApi),
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
    },
    '/media/*': {
      origin: new origins.S3Origin(mediaBucket, {
        originAccessIdentity: oai,
      }),
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
      cachePolicy: new cloudfront.CachePolicy(this, 'MediaCachePolicy', {
        cachePolicyName: 'MediaCachePolicy',
        minTtl: Duration.hours(1),
        maxTtl: Duration.days(365),
        defaultTtl: Duration.days(7),
      }),
    },
  },
  certificate: props.certificate,
  domainNames: [props.domainName],
  priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL,
  minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
  httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
  enableIpv6: true,
});
```

---

## 6. スケーラビリティ設計

### 6.1 水平スケーリング

#### Lambda自動スケーリング

```typescript
// Provisioned Concurrency Auto Scaling
const scalableTarget = new appscaling.ScalableTarget(this, 'ScalableTarget', {
  serviceNamespace: appscaling.ServiceNamespace.LAMBDA,
  maxCapacity: 100,
  minCapacity: 10,
  resourceId: `function:${apiFunction.functionName}:live`,
  scalableDimension: 'lambda:function:ProvisionedConcurrentExecutions',
});

scalableTarget.scaleToTrackMetric('PceTracking', {
  targetValue: 0.7, // 70% 利用率でスケール
  predefinedMetric: appscaling.PredefinedMetric.LAMBDA_PROVISIONED_CONCURRENCY_UTILIZATION,
});

// スケジュールベーススケーリング（ピーク時間帯）
scalableTarget.scaleOnSchedule('ScaleUpMorning', {
  schedule: appscaling.Schedule.cron({ hour: '8', minute: '0' }),
  minCapacity: 50,
  maxCapacity: 200,
});

scalableTarget.scaleOnSchedule('ScaleDownNight', {
  schedule: appscaling.Schedule.cron({ hour: '22', minute: '0' }),
  minCapacity: 10,
  maxCapacity: 50,
});
```

#### Aurora Read Replica自動スケーリング

```typescript
// Aurora Reader Auto Scaling
const auroraCluster = new rds.DatabaseCluster(this, 'AuroraCluster', {
  engine: rds.DatabaseClusterEngine.auroraPostgres({
    version: rds.AuroraPostgresEngineVersion.VER_15_4,
  }),
  serverlessV2MinCapacity: 0.5,
  serverlessV2MaxCapacity: 2,
  writer: rds.ClusterInstance.serverlessV2('writer'),
  readers: [
    rds.ClusterInstance.serverlessV2('reader1', { scaleWithWriter: true }),
    rds.ClusterInstance.serverlessV2('reader2', { scaleWithWriter: true }),
  ],
  vpc: props.vpc,
  vpcSubnets: {
    subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
  },
});
```

### 6.2 垂直スケーリング

#### Aurora Serverless v2 自動キャパシティ調整

```
ACU（Aurora Capacity Unit）の動的スケーリング:

負荷低時（夜間）:
├─ Writer: 0.5 ACU（最小）
└─ Reader: 0.5 ACU（最小）
    → コスト: $0.12/時

負荷中時（通常営業時間）:
├─ Writer: 1.0 ACU
└─ Reader: 1.0 ACU
    → コスト: $0.24/時

負荷高時（ピーク時間）:
├─ Writer: 2.0 ACU（最大）
└─ Reader: 2.0 ACU（最大）
    → コスト: $0.48/時
```

### 6.3 キャッシング戦略

#### 多層キャッシュアーキテクチャ

```
┌────────────────────────────────────────────────────────────┐
│                     CloudFront Edge Cache                   │
│  - 静的アセット: 365日                                      │
│  - API レスポンス: キャッシュなし                            │
│  - メディアファイル: 7日                                     │
└────────────────────────┬───────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────┐
│                     Redis ElastiCache                       │
│  - セッションデータ: 24時間                                  │
│  - APIレート制限: 1分                                        │
│  - ユーザープロフィール: 1時間                               │
│  - ベンチマークデータ: 30分                                  │
└────────────────────────┬───────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────┐
│                        DynamoDB                             │
│  - セッション状態: 2時間                                     │
│  - WebSocket接続情報: 30分                                   │
└────────────────────────┬───────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────┐
│                  Aurora PostgreSQL                          │
│  - 永続データストア                                          │
└────────────────────────────────────────────────────────────┘
```

### 6.4 スケーラビリティメトリクス

| 指標                  | 目標値 | 実装戦略                         |
| --------------------- | ------ | -------------------------------- |
| **同時セッション数**  | 10,000 | Lambda自動スケール、IoT Core     |
| **API リクエスト/秒** | 50,000 | API Gateway + Lambda Provisioned |
| **データベース接続**  | 500    | RDS Proxy + コネクションプール   |
| **ストレージ容量**    | 無制限 | S3自動スケール                   |
| **CDN帯域幅**         | 無制限 | CloudFront自動スケール           |

---

## 7. コスト最適化

### 7.1 月間コスト見積もり（プロダクション環境）

#### 前提条件

- アクティブユーザー: 1,000人
- 月間セッション数: 5,000
- 平均セッション時間: 15分
- 録画保存: 90日

#### コスト内訳

| サービス                 | 使用量                     | 月額コスト（USD） | 備考                  |
| ------------------------ | -------------------------- | ----------------- | --------------------- |
| **Aurora Serverless v2** | 平均1 ACU, 24/7稼働        | $87.60            | 0.5-2 ACU自動スケール |
| **Lambda**               | 500万リクエスト、512MB平均 | $45.00            | ARM64、VPC最適化      |
| **API Gateway**          | 1000万リクエスト           | $35.00            | REST + WebSocket      |
| **AWS IoT Core**         | 5000万メッセージ           | $50.00            | リアルタイム通信      |
| **S3**                   | 500GB保存、1TB転送         | $32.00            | 録画映像90日保存      |
| **CloudFront**           | 2TB転送                    | $170.00           | グローバル配信        |
| **DynamoDB**             | 1GB保存、100万R/W          | $5.00             | オンデマンド          |
| **ElastiCache**          | t4g.micro (2ノード)        | $24.00            | Redis Serverless検討  |
| **Cognito**              | 10,000 MAU                 | $50.00            | 認証サービス          |
| **Step Functions**       | 5,000実行                  | $1.25             | 録画処理ワークフロー  |
| **CloudWatch Logs**      | 10GB保存                   | $5.00             | ログ・メトリクス      |
| **Secrets Manager**      | 5シークレット              | $2.00             | API キー管理          |
| **Route53**              | 1ホストゾーン              | $0.50             | DNS管理               |
| **AWS Backup**           | 100GB                      | $5.00             | 自動バックアップ      |
| **外部サービス**         |                            |                   |                       |
| - AWS Bedrock (Claude)   | 50万トークン               | $150.00           | 会話AI                |
| - ElevenLabs             | 500K文字                   | $99.00            | TTS                   |
| - Azure Speech           | 50時間                     | $50.00            | STT                   |
| **合計**                 |                            | **$810.35/月**    |                       |

### 7.2 コスト最適化戦略

#### 1. Lambda最適化

```typescript
// ✅ 推奨: ARM64 (Graviton2) 採用
const function = new lambda.Function(this, 'Function', {
  runtime: lambda.Runtime.NODEJS_20_X,
  architecture: lambda.Architecture.ARM_64,  // 20% コスト削減
  memorySize: 1024,  // メモリ最適化
});

// ✅ 推奨: VPC設定の最適化（Hyperplane ENI）
// - コールドスタート時間短縮: 10秒 → 1秒
// - ENI作成コスト削減
```

#### 2. Aurora最適化

```typescript
// ✅ 推奨: Serverless v2 最小ACU設定
serverlessV2MinCapacity: 0.5,  // 夜間は最小ACU

// ✅ 推奨: RDS Proxy使用
const rdsProxy = new rds.DatabaseProxy(this, 'Proxy', {
  proxyTarget: rds.ProxyTarget.fromCluster(cluster),
  secrets: [secret],
  vpc,
  maxConnectionsPercent: 90,  // コネクション効率化
});
```

#### 3. S3ライフサイクルポリシー

```typescript
// ✅ 推奨: 階層型ストレージ
mediaBucket.addLifecycleRule({
  id: 'ArchiveOldRecordings',
  transitions: [
    {
      storageClass: s3.StorageClass.INFREQUENT_ACCESS,
      transitionAfter: Duration.days(30), // 30日後にIA
    },
    {
      storageClass: s3.StorageClass.GLACIER,
      transitionAfter: Duration.days(90), // 90日後にGlacier
    },
  ],
  expiration: Duration.days(365), // 365日後に削除
});
```

#### 4. CloudFrontキャッシング最適化

```typescript
// ✅ 推奨: 積極的なキャッシング
const cachePolicy = new cloudfront.CachePolicy(this, 'StaticCachePolicy', {
  cachePolicyName: 'StaticAssetsCachePolicy',
  minTtl: Duration.hours(1),
  maxTtl: Duration.days(365),
  defaultTtl: Duration.days(30),
  enableAcceptEncodingGzip: true,
  enableAcceptEncodingBrotli: true,
});
```

### 7.3 プラン別コスト配分

| コスト項目     | Free                   | Pro               | Enterprise       |
| -------------- | ---------------------- | ----------------- | ---------------- |
| **月額料金**   | $0                     | $49               | $499             |
| **限界利益率** | -                      | 85%               | 90%              |
| **想定コスト** | $7.50/月               | $7.35/月          | $49.90/月        |
| **損益分岐点** | プラットフォーム維持費 | 6.7ユーザーで黒字 | 10ユーザーで黒字 |

---

## 8. 高可用性・DR設計

### 8.1 マルチAZ構成

#### コンポーネント別可用性

| コンポーネント    | 配置             | 自動フェイルオーバー | RTO  | RPO |
| ----------------- | ---------------- | -------------------- | ---- | --- |
| **Aurora Writer** | Multi-AZ         | ○（1分以内）         | 1分  | 0秒 |
| **Aurora Reader** | Multi-AZ         | ○（即時）            | 即時 | 0秒 |
| **Lambda**        | Multi-AZ（自動） | ○（即時）            | 即時 | 0秒 |
| **DynamoDB**      | Multi-AZ（自動） | ○（即時）            | 即時 | 0秒 |
| **ElastiCache**   | Multi-AZ         | ○（1分以内）         | 1分  | 1分 |
| **S3**            | Multi-AZ（自動） | ○（即時）            | 即時 | 0秒 |

### 8.2 バックアップ戦略

#### 自動バックアップ設定

```typescript
// Aurora自動バックアップ
const cluster = new rds.DatabaseCluster(this, 'Cluster', {
  backup: {
    retention: Duration.days(7), // 7日間保持
    preferredWindow: '03:00-04:00', // 低負荷時間帯
  },
  removalPolicy: cdk.RemovalPolicy.SNAPSHOT, // 削除時スナップショット作成
});

// S3バックアップ（クロスリージョンレプリケーション）
new s3.Bucket(this, 'BackupBucket', {
  versioned: true,
  replicationRules: [
    {
      destination: {
        bucket: props.drBucket, // DR用バケット（別リージョン）
      },
    },
  ],
});

// AWS Backup統合
const backupPlan = new backup.BackupPlan(this, 'BackupPlan', {
  backupPlanRules: [
    new backup.BackupPlanRule({
      ruleName: 'DailyBackup',
      scheduleExpression: backup.Schedule.cron({ hour: '3', minute: '0' }),
      deleteAfter: Duration.days(30),
    }),
  ],
});

backupPlan.addSelection('Resources', {
  resources: [
    backup.BackupResource.fromArn(cluster.clusterArn),
    backup.BackupResource.fromArn(dynamoTable.tableArn),
  ],
});
```

### 8.3 災害復旧（DR）計画

#### DR戦略: パイロットライト

```
通常運用（us-east-1）:
┌─────────────────────────────────────┐
│ プライマリリージョン（フル稼働）     │
│  - Aurora Writer/Reader             │
│  - Lambda Functions (Provisioned)   │
│  - DynamoDB                         │
│  - ElastiCache                      │
└─────────────────────────────────────┘
          │
          │ リアルタイムレプリケーション
          ▼
DR環境（us-west-2）:
┌─────────────────────────────────────┐
│ DRリージョン（最小構成）             │
│  - Aurora Read Replica（スタンバイ） │
│  - Lambda Functions（未デプロイ）    │
│  - DynamoDB Global Table            │
│  - S3 Cross-Region Replication      │
└─────────────────────────────────────┘
```

#### フェイルオーバー手順

```bash
# 1. Route53ヘルスチェック失敗検知
# 2. 自動切り替え or 手動切り替え

# 手動フェイルオーバー（CDK）
cd infrastructure
pnpm run failover:dr

# 内部処理:
# - Aurora Reader昇格（Writer化）
# - Lambda関数デプロイ（DR環境）
# - Route53 DNSレコード更新
# - CloudFront Origin切り替え

# 3. RTO: 15分以内
# 4. RPO: 1分以内（DynamoDB Global Table）
```

### 8.4 ヘルスチェック・監視

```typescript
// Route53ヘルスチェック
const healthCheck = new route53.HealthCheck(this, 'HealthCheck', {
  type: route53.HealthCheckType.HTTPS,
  resourcePath: '/health',
  fqdn: 'api.prance.com',
  port: 443,
  requestInterval: Duration.seconds(30),
  failureThreshold: 3,
});

// CloudWatchアラーム（自動通知）
const apiErrorAlarm = new cloudwatch.Alarm(this, 'ApiErrorAlarm', {
  metric: apiFunction.metricErrors({
    statistic: 'Sum',
    period: Duration.minutes(1),
  }),
  threshold: 10,
  evaluationPeriods: 2,
  treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
});

apiErrorAlarm.addAlarmAction(new actions.SnsAction(props.alarmTopic));
```

---

## 9. セキュリティアーキテクチャ

### 9.1 認証・認可

#### Amazon Cognito設計

```typescript
// User Pool設定
const userPool = new cognito.UserPool(this, 'UserPool', {
  userPoolName: 'PranceUserPool',
  selfSignUpEnabled: true,
  signInAliases: {
    email: true,
    username: false,
  },
  autoVerify: {
    email: true,
  },
  passwordPolicy: {
    minLength: 12,
    requireLowercase: true,
    requireUppercase: true,
    requireDigits: true,
    requireSymbols: true,
  },
  mfa: cognito.Mfa.OPTIONAL,
  mfaSecondFactor: {
    sms: true,
    otp: true,
  },
  accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
  advancedSecurityMode: cognito.AdvancedSecurityMode.ENFORCED,
});

// カスタム属性（マルチテナント対応）
userPool.addCustomAttribute(
  'tenantId',
  new cognito.StringAttribute({
    mutable: false,
  })
);
userPool.addCustomAttribute(
  'role',
  new cognito.StringAttribute({
    mutable: true,
  })
);
```

#### ロールベースアクセス制御（RBAC）

```typescript
// Guard実装
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // テナント分離チェック
    const tenantId = request.headers['x-tenant-id'];
    if (user.tenantId !== tenantId && user.role !== 'super_admin') {
      throw new ForbiddenException('Tenant mismatch');
    }

    return requiredRoles.some((role) => user.role === role);
  }
}

// 使用例
@Get('admin/tenants')
@Roles('super_admin')
@UseGuards(RolesGuard)
async getTenants() {
  return this.tenantService.findAll();
}
```

### 9.2 データ暗号化

#### 転送時暗号化（TLS 1.2+）

```typescript
// CloudFront: TLS 1.2以上強制
const distribution = new cloudfront.Distribution(this, 'Distribution', {
  minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
  domainNames: ['prance.com', 'www.prance.com'],
  certificate: props.certificate, // ACM証明書
});

// API Gateway: TLS 1.2以上強制
const api = new apigateway.RestApi(this, 'Api', {
  deployOptions: {
    minimumCompressionSize: 0,
  },
  policy: new iam.PolicyDocument({
    statements: [
      new iam.PolicyStatement({
        effect: iam.Effect.DENY,
        principals: [new iam.AnyPrincipal()],
        actions: ['execute-api:Invoke'],
        resources: ['execute-api:/*'],
        conditions: {
          StringNotEquals: {
            'aws:SecureTransport': 'true',
          },
        },
      }),
    ],
  }),
});
```

#### 保管時暗号化（KMS）

```typescript
// Aurora暗号化
const cluster = new rds.DatabaseCluster(this, 'Cluster', {
  storageEncrypted: true,
  storageEncryptionKey: new kms.Key(this, 'DatabaseKey', {
    enableKeyRotation: true,
    alias: 'prance/database',
  }),
});

// S3暗号化
const bucket = new s3.Bucket(this, 'MediaBucket', {
  encryption: s3.BucketEncryption.KMS,
  encryptionKey: new kms.Key(this, 'MediaBucketKey', {
    enableKeyRotation: true,
    alias: 'prance/media',
  }),
});

// DynamoDB暗号化
const table = new dynamodb.Table(this, 'SessionsTable', {
  encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
  encryptionKey: new kms.Key(this, 'DynamoDBKey', {
    enableKeyRotation: true,
    alias: 'prance/dynamodb',
  }),
});
```

### 9.3 IAMロール・ポリシー設計

#### Lambda実行ロール（最小権限の原則）

```typescript
// Lambda実行ロール
const lambdaExecutionRole = new iam.Role(this, 'LambdaExecutionRole', {
  assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
  managedPolicies: [
    iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
  ],
  inlinePolicies: {
    DynamoDBAccess: new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          actions: [
            'dynamodb:GetItem',
            'dynamodb:PutItem',
            'dynamodb:UpdateItem',
            'dynamodb:DeleteItem',
          ],
          resources: [sessionsTable.tableArn],
        }),
      ],
    }),
    S3Access: new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          actions: ['s3:GetObject', 's3:PutObject'],
          resources: [`${mediaBucket.bucketArn}/*`],
        }),
      ],
    }),
    SecretsManagerAccess: new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          actions: ['secretsmanager:GetSecretValue'],
          resources: [databaseSecret.secretArn, apiKeysSecret.secretArn],
        }),
      ],
    }),
  },
});
```

### 9.4 ネットワークセキュリティ

#### Security Group設計

```typescript
// Lambda Security Group
const lambdaSG = new ec2.SecurityGroup(this, 'LambdaSG', {
  vpc,
  description: 'Security group for Lambda functions',
  allowAllOutbound: true,
});

// Aurora Security Group
const auroraSG = new ec2.SecurityGroup(this, 'AuroraSG', {
  vpc,
  description: 'Security group for Aurora cluster',
  allowAllOutbound: false,
});

// Lambda → Aurora（PostgreSQL 5432ポートのみ許可）
auroraSG.addIngressRule(lambdaSG, ec2.Port.tcp(5432), 'Allow Lambda to access Aurora');

// ElastiCache Security Group
const cacheSG = new ec2.SecurityGroup(this, 'CacheSG', {
  vpc,
  description: 'Security group for ElastiCache',
  allowAllOutbound: false,
});

// Lambda → ElastiCache（Redis 6379ポートのみ許可）
cacheSG.addIngressRule(lambdaSG, ec2.Port.tcp(6379), 'Allow Lambda to access ElastiCache');
```

#### WAF（Web Application Firewall）

```typescript
// WAF設定（CloudFront統合）
const wafWebAcl = new wafv2.CfnWebACL(this, 'WebACL', {
  scope: 'CLOUDFRONT',
  defaultAction: { allow: {} },
  rules: [
    // AWS マネージドルール: コアルールセット
    {
      name: 'AWSManagedRulesCommonRuleSet',
      priority: 1,
      statement: {
        managedRuleGroupStatement: {
          vendorName: 'AWS',
          name: 'AWSManagedRulesCommonRuleSet',
        },
      },
      overrideAction: { none: {} },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'AWSManagedRulesCommonRuleSetMetric',
      },
    },
    // レート制限（IP単位）
    {
      name: 'RateLimitRule',
      priority: 2,
      statement: {
        rateBasedStatement: {
          limit: 2000,
          aggregateKeyType: 'IP',
        },
      },
      action: { block: {} },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'RateLimitRuleMetric',
      },
    },
  ],
  visibilityConfig: {
    sampledRequestsEnabled: true,
    cloudWatchMetricsEnabled: true,
    metricName: 'WebACLMetric',
  },
});
```

### 9.5 監査ログ・コンプライアンス

#### CloudTrail統合

```typescript
// 全APIアクティビティ記録
const trail = new cloudtrail.Trail(this, 'AuditTrail', {
  trailName: 'PranceAuditTrail',
  sendToCloudWatchLogs: true,
  cloudWatchLogsRetention: logs.RetentionDays.ONE_YEAR,
  enableFileValidation: true,
  includeGlobalServiceEvents: true,
  isMultiRegionTrail: true,
  s3BucketName: props.auditBucket.bucketName,
});

// 重要イベント監視
trail.addEventSelector(cloudtrail.DataResourceType.LAMBDA_FUNCTION, [
  `${apiFunction.functionArn}/*`,
]);

trail.addEventSelector(cloudtrail.DataResourceType.S3_OBJECT, [`${mediaBucket.bucketArn}/*`]);
```

#### VPCフローログ

```typescript
// VPCトラフィック監視
vpc.addFlowLog('FlowLog', {
  destination: ec2.FlowLogDestination.toCloudWatchLogs(flowLogGroup, flowLogRole),
  trafficType: ec2.FlowLogTrafficType.ALL,
});
```

---

## まとめ

Prance Communication Platformは、**AWSサーバーレスアーキテクチャ**を基盤とした、スケーラブルで高可用性なSaaSプラットフォームです。

### 主要な設計上の強み

1. **自動スケーラビリティ**: 10ユーザー → 10万ユーザーまでインフラ変更不要
2. **コスト効率**: 使用量ベース課金、月間1000セッションで$810（プロダクション環境）
3. **高可用性**: 99.9% SLA、マルチAZ構成、自動フェイルオーバー
4. **セキュリティ**: 多層防御、暗号化（転送時・保管時）、RBAC
5. **開発速度**: インフラ管理不要、ビジネスロジックに集中

### 次のステップ

- [マルチテナント設計](./MULTITENANCY.md) - 3階層ユーザーロール、データ分離戦略
- [データベース設計](../development/DATABASE_DESIGN.md) - Prismaスキーマ、RLS実装
- [API設計](../development/API_DESIGN.md) - RESTful API、WebSocket API仕様

---

**最終更新:** 2026-03-05
**次回レビュー予定:** Phase 1 完了時
