# ATS連携システム

**バージョン:** 1.0
**最終更新:** 2026-03-05
**ステータス:** 設計完了

---

## 目次

1. [概要](#概要)
2. [サポートATS一覧](#サポートats一覧)
3. [連携フロー](#連携フロー)
4. [アダプター実装](#アダプター実装)
5. [データ同期](#データ同期)
6. [Webhook統合](#webhook統合)
7. [実装ガイド](#実装ガイド)

---

## 概要

ATS連携システムは、主要な採用管理システム（Applicant Tracking System）とPranceプラットフォームをシームレスに統合し、採用プロセスの自動化・効率化を実現します。

### 主要機能

| 機能                         | 説明                                 |
| ---------------------------- | ------------------------------------ |
| **候補者同期**               | ATS→Pranceへの候補者情報自動取り込み |
| **面接スケジューリング**     | 自動セッション作成・招待メール送信   |
| **結果エクスポート**         | 面接結果・レポートをATSへ自動送信    |
| **Webhook統合**              | イベント駆動型の双方向連携           |
| **アダプターアーキテクチャ** | 各ATSの差異を吸収する抽象化レイヤー  |
| **認証管理**                 | OAuth2.0/APIキーによる安全な接続     |

### ユースケース

#### シナリオ1: 面接自動化

```
1. 候補者がATSで応募
2. HR担当者がAI面接をスケジュール
3. Pranceが自動で候補者にメール送信
4. 候補者がセッション実施
5. 結果レポートがATSに自動反映
```

#### シナリオ2: 一括スクリーニング

```
1. ATSから候補者リスト（50名）をインポート
2. 一括で面接セッションを作成
3. 各候補者に招待リンク送信
4. 完了者から順次レポート生成
5. ATSに評価スコアを自動送信
```

---

## サポートATS一覧

### 国内ATS（3社）

| ATS                    | API対応     | OAuth       | Webhook   | 優先度 |
| ---------------------- | ----------- | ----------- | --------- | ------ |
| **HRMOS採用**          | ✅ REST API | ✅ OAuth2.0 | ✅        | 高     |
| **ジョブカン採用管理** | ✅ REST API | ❌ APIキー  | ✅        | 中     |
| **採用一括かんりくん** | ✅ REST API | ❌ APIキー  | ⚠️ 限定的 | 中     |

### 海外ATS（3社）

| ATS                    | API対応     | OAuth       | Webhook | 優先度 |
| ---------------------- | ----------- | ----------- | ------- | ------ |
| **Greenhouse**         | ✅ REST API | ✅ OAuth2.0 | ✅      | 高     |
| **Lever**              | ✅ REST API | ✅ OAuth2.0 | ✅      | 高     |
| **Workday Recruiting** | ✅ REST API | ✅ OAuth2.0 | ✅      | 中     |

### 連携優先度

**Phase 1（初期リリース）:**

- Greenhouse（海外No.1シェア）
- HRMOS採用（国内大手）

**Phase 2（3ヶ月後）:**

- Lever
- ジョブカン採用管理

**Phase 3（6ヶ月後）:**

- Workday Recruiting
- 採用一括かんりくん

---

## 連携フロー

### 基本連携フロー

```
┌─────────────────┐                    ┌─────────────────┐
│  ATS System     │                    │  Prance Platform│
│  (Greenhouse)   │                    │                 │
└────────┬────────┘                    └────────┬────────┘
         │                                      │
         │ 1. 候補者応募                        │
         │────────────────────────>            │
         │                                      │
         │ 2. AI面接スケジュール                │
         │    (HR担当者が設定)                  │
         │                                      │
         │ 3. Webhook送信                       │
         │    (candidate.stage_changed)         │
         │─────────────────────────────────────>│
         │                                      │
         │                        4. セッション作成
         │                        5. 招待メール送信
         │                                      │
         │                        6. 候補者がセッション実施
         │                                      │
         │                        7. レポート生成完了
         │                                      │
         │ 8. Webhook送信 <─────────────────────│
         │    (session.completed)               │
         │                                      │
         │ 9. API Call: レポート取得            │
         │<─────────────────────────────────────│
         │                                      │
         │ 10. スコア・評価を候補者に紐付け     │
         │                                      │
         ▼                                      ▼
```

### 詳細フロー

#### 1. 認証・接続設定

```
組織管理者 → Prance管理画面
  ↓
ATS連携設定画面
  ↓
「Greenhouse」を選択
  ↓
OAuth2.0認証フロー開始
  ↓
Greenhouseログイン → 権限承認
  ↓
アクセストークン取得・保存
  ↓
接続テスト（API Call）
  ↓
設定完了
```

#### 2. 候補者同期

```
Greenhouse → Webhook送信
  (candidate.stage_changed: "AI Interview")
  ↓
Prance Webhook受信
  ↓
候補者情報取得（Greenhouse API）
  - 名前、メール、職種、応募日
  ↓
Pranceに候補者レコード作成
  ↓
シナリオ自動選択（職種ベース）
  ↓
セッション作成
  ↓
招待メール送信
```

#### 3. 結果エクスポート

```
Pranceセッション完了
  ↓
レポート生成
  ↓
Greenhouse API Call
  POST /v1/candidates/{id}/scorecards
  ↓
評価スコアを送信
  - 総合評価: 85/100
  - 技術力: 4/5
  - コミュニケーション: 5/5
  - レポートURL
  ↓
Greenhouseに反映完了
```

---

## アダプター実装

### アダプターアーキテクチャ

```typescript
// 共通インターフェース
interface ATSAdapter {
  // 認証
  authenticate(credentials: AuthCredentials): Promise<AccessToken>;
  refreshToken(refreshToken: string): Promise<AccessToken>;

  // 候補者管理
  getCandidates(filters?: CandidateFilter): Promise<Candidate[]>;
  getCandidate(id: string): Promise<Candidate>;
  createCandidate(data: CandidateData): Promise<Candidate>;
  updateCandidate(id: string, data: Partial<CandidateData>): Promise<Candidate>;

  // 評価・スコアカード
  createScorecard(candidateId: string, scorecard: Scorecard): Promise<void>;
  updateScorecard(scorecardId: string, scorecard: Partial<Scorecard>): Promise<void>;

  // 添付ファイル
  uploadAttachment(candidateId: string, file: File): Promise<Attachment>;

  // Webhook
  verifyWebhook(signature: string, payload: string): boolean;
  parseWebhook(payload: any): WebhookEvent;
}

// Greenhouse実装例
class GreenhouseAdapter implements ATSAdapter {
  private apiUrl = 'https://harvest.greenhouse.io/v1';
  private accessToken: string;

  constructor(private config: GreenhouseConfig) {}

  async authenticate(credentials: AuthCredentials): Promise<AccessToken> {
    // OAuth2.0フロー
    const response = await fetch('https://api.greenhouse.io/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code: credentials.code,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.redirectUri,
      }),
    });

    const data = await response.json();
    this.accessToken = data.access_token;

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  async getCandidates(filters?: CandidateFilter): Promise<Candidate[]> {
    const params = new URLSearchParams({
      per_page: '100',
      ...(filters?.status && { status: filters.status }),
      ...(filters?.job_id && { job_id: filters.job_id }),
    });

    const response = await fetch(`${this.apiUrl}/candidates?${params}`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'On-Behalf-Of': this.config.onBehalfOf,
      },
    });

    const data = await response.json();

    return data.map((item: any) => ({
      id: item.id.toString(),
      firstName: item.first_name,
      lastName: item.last_name,
      email: item.email_addresses[0]?.value,
      phone: item.phone_numbers[0]?.value,
      jobId: item.application_ids[0],
      status: item.status,
      appliedAt: new Date(item.created_at),
    }));
  }

  async createScorecard(candidateId: string, scorecard: Scorecard): Promise<void> {
    await fetch(`${this.apiUrl}/candidates/${candidateId}/scorecards`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'On-Behalf-Of': this.config.onBehalfOf,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        interview: scorecard.interviewId,
        submitted_by: scorecard.submittedBy,
        overall_recommendation: scorecard.overallRecommendation,
        attributes: scorecard.attributes.map(attr => ({
          id: attr.id,
          rating: attr.rating,
          note: attr.note,
        })),
      }),
    });
  }

  verifyWebhook(signature: string, payload: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', this.config.webhookSecret)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  }

  parseWebhook(payload: any): WebhookEvent {
    switch (payload.action) {
      case 'candidate_stage_change':
        return {
          type: 'CANDIDATE_STAGE_CHANGED',
          candidateId: payload.payload.application.candidate_id.toString(),
          newStage: payload.payload.application.current_stage.name,
          timestamp: new Date(payload.occurred_at),
        };

      case 'candidate_hired':
        return {
          type: 'CANDIDATE_HIRED',
          candidateId: payload.payload.application.candidate_id.toString(),
          timestamp: new Date(payload.occurred_at),
        };

      default:
        return {
          type: 'UNKNOWN',
          rawPayload: payload,
        };
    }
  }
}
```

### データモデル

```typescript
// ATS接続設定
interface ATSConnection {
  id: string;
  organizationId: string;
  atsProvider: 'greenhouse' | 'lever' | 'hrmos' | 'jobcan' | 'workday' | 'saiyokanri';

  // 認証情報（暗号化保存）
  credentials: {
    accessToken: string;
    refreshToken?: string;
    apiKey?: string; // APIキー方式の場合
    expiresAt?: Date;
  };

  // 設定
  settings: {
    autoSync: boolean; // 自動同期有効/無効
    syncInterval: number; // 同期間隔（分）
    defaultScenarioId?: string; // デフォルトシナリオ
    jobMappings: {
      // 職種とシナリオのマッピング
      [jobId: string]: string; // scenarioId
    };
  };

  // 状態
  status: 'active' | 'error' | 'disabled';
  lastSync?: Date;
  lastError?: string;

  createdAt: Date;
  updatedAt: Date;
}

// 候補者レコード
interface ATSCandidate {
  id: string;
  organizationId: string;
  atsConnectionId: string;
  externalId: string; // ATS側のID

  // 候補者情報
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  jobTitle?: string;
  jobId?: string;

  // Pranceセッション
  sessionId?: string;
  sessionStatus?: 'pending' | 'invited' | 'completed' | 'failed';
  invitedAt?: Date;
  completedAt?: Date;

  // 同期情報
  syncedAt: Date;
  lastModified: Date;
}

// 評価スコアカード
interface Scorecard {
  interviewId: string;
  submittedBy: string;
  overallRecommendation: 'strong_yes' | 'yes' | 'no' | 'strong_no';
  attributes: {
    id: string; // 評価項目ID
    name: string; // 'Technical Skills'
    rating: number; // 1-5
    note: string;
  }[];
}
```

---

## データ同期

### 同期戦略

#### 1. Webhook駆動型（リアルタイム）

```typescript
// Lambda: ATS Webhook Handler
export const handleATSWebhook: APIGatewayProxyHandler = async event => {
  const { atsConnectionId } = event.pathParameters;

  // 1. ATS接続情報取得
  const connection = await prisma.atsConnection.findUnique({
    where: { id: atsConnectionId },
  });

  // 2. Webhook署名検証
  const adapter = createAdapter(connection.atsProvider, connection);
  const signature = event.headers['X-Signature'] || event.headers['x-signature'];
  const isValid = adapter.verifyWebhook(signature, event.body);

  if (!isValid) {
    return { statusCode: 401, body: 'Invalid signature' };
  }

  // 3. Webhookペイロード解析
  const webhookEvent = adapter.parseWebhook(JSON.parse(event.body));

  // 4. イベント処理
  switch (webhookEvent.type) {
    case 'CANDIDATE_STAGE_CHANGED':
      await handleCandidateStageChanged(connection, webhookEvent);
      break;

    case 'CANDIDATE_HIRED':
      await handleCandidateHired(connection, webhookEvent);
      break;

    default:
      console.log(`Unhandled event type: ${webhookEvent.type}`);
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};

// 候補者ステージ変更処理
async function handleCandidateStageChanged(connection: ATSConnection, event: WebhookEvent) {
  // ステージ名に"AI Interview"が含まれる場合のみ処理
  if (!event.newStage.toLowerCase().includes('ai interview')) {
    return;
  }

  // 1. 候補者情報取得（ATS API）
  const adapter = createAdapter(connection.atsProvider, connection);
  const candidate = await adapter.getCandidate(event.candidateId);

  // 2. Pranceに候補者レコード作成
  const atsCandidate = await prisma.atsCandidate.create({
    data: {
      organizationId: connection.organizationId,
      atsConnectionId: connection.id,
      externalId: candidate.id,
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      email: candidate.email,
      phone: candidate.phone,
      jobTitle: candidate.jobTitle,
      jobId: candidate.jobId,
      sessionStatus: 'pending',
      syncedAt: new Date(),
    },
  });

  // 3. シナリオ選択
  const scenarioId =
    connection.settings.jobMappings[candidate.jobId] || connection.settings.defaultScenarioId;

  // 4. セッション作成
  const session = await prisma.session.create({
    data: {
      organizationId: connection.organizationId,
      scenarioId,
      userId: null, // 候補者未登録の場合
      status: 'pending',
      metadata: {
        source: 'ats',
        atsProvider: connection.atsProvider,
        candidateId: atsCandidate.id,
      },
    },
  });

  // 5. 候補者レコード更新
  await prisma.atsCandidate.update({
    where: { id: atsCandidate.id },
    data: { sessionId: session.id },
  });

  // 6. 招待メール送信
  await sendInvitationEmail({
    to: candidate.email,
    name: `${candidate.firstName} ${candidate.lastName}`,
    sessionUrl: `${process.env.FRONTEND_URL}/sessions/${session.id}/start`,
  });

  // 7. ATSCandidateステータス更新
  await prisma.atsCandidate.update({
    where: { id: atsCandidate.id },
    data: {
      sessionStatus: 'invited',
      invitedAt: new Date(),
    },
  });
}
```

#### 2. 定期同期（バッチ処理）

```typescript
// Lambda: ATS Sync Job (EventBridge定期実行)
export const syncATSCandidates: ScheduledHandler = async () => {
  // 自動同期が有効なATS接続を取得
  const connections = await prisma.atsConnection.findMany({
    where: {
      status: 'active',
      settings: { path: ['autoSync'], equals: true },
    },
  });

  for (const connection of connections) {
    try {
      await syncConnection(connection);
    } catch (error) {
      console.error(`Sync failed for connection ${connection.id}:`, error);

      await prisma.atsConnection.update({
        where: { id: connection.id },
        data: {
          status: 'error',
          lastError: error.message,
        },
      });
    }
  }
};

async function syncConnection(connection: ATSConnection) {
  const adapter = createAdapter(connection.atsProvider, connection);

  // 1. 最近更新された候補者を取得（過去24時間）
  const candidates = await adapter.getCandidates({
    updatedSince: new Date(Date.now() - 24 * 60 * 60 * 1000),
  });

  // 2. 各候補者を同期
  for (const candidate of candidates) {
    const existing = await prisma.atsCandidate.findFirst({
      where: {
        atsConnectionId: connection.id,
        externalId: candidate.id,
      },
    });

    if (existing) {
      // 更新
      await prisma.atsCandidate.update({
        where: { id: existing.id },
        data: {
          firstName: candidate.firstName,
          lastName: candidate.lastName,
          email: candidate.email,
          phone: candidate.phone,
          jobTitle: candidate.jobTitle,
          syncedAt: new Date(),
        },
      });
    } else {
      // 新規作成
      await prisma.atsCandidate.create({
        data: {
          organizationId: connection.organizationId,
          atsConnectionId: connection.id,
          externalId: candidate.id,
          firstName: candidate.firstName,
          lastName: candidate.lastName,
          email: candidate.email,
          phone: candidate.phone,
          jobTitle: candidate.jobTitle,
          sessionStatus: 'pending',
          syncedAt: new Date(),
        },
      });
    }
  }

  // 3. 同期完了を記録
  await prisma.atsConnection.update({
    where: { id: connection.id },
    data: { lastSync: new Date() },
  });
}
```

---

## Webhook統合

### PranceからATSへの通知

```typescript
// EventBridge Rule: Session Completed → Lambda
export const notifyATSSessionCompleted: EventBridgeHandler = async event => {
  const { sessionId } = event.detail;

  // 1. セッション情報取得
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { report: true },
  });

  // 2. ATS候補者レコード確認
  const atsCandidate = await prisma.atsCandidate.findFirst({
    where: { sessionId },
    include: { atsConnection: true },
  });

  if (!atsCandidate) {
    // ATS連携なし → 処理終了
    return;
  }

  // 3. ATSアダプター作成
  const adapter = createAdapter(atsCandidate.atsConnection.atsProvider, atsCandidate.atsConnection);

  // 4. スコアカード作成
  const scorecard: Scorecard = {
    interviewId: session.id,
    submittedBy: 'AI Interview Platform',
    overallRecommendation: calculateRecommendation(session.report.overallScore),
    attributes: session.report.scores.map(score => ({
      id: score.metricId,
      name: score.metricName,
      rating: Math.round(score.value / 20), // 0-100 → 1-5
      note: score.feedback || '',
    })),
  };

  // 5. ATSにスコアカード送信
  await adapter.createScorecard(atsCandidate.externalId, scorecard);

  // 6. レポートPDFをATSに添付
  const reportUrl = session.report.pdfUrl;
  await adapter.uploadAttachment(atsCandidate.externalId, {
    url: reportUrl,
    filename: `Interview_Report_${session.id}.pdf`,
  });

  // 7. ATSCandidateステータス更新
  await prisma.atsCandidate.update({
    where: { id: atsCandidate.id },
    data: {
      sessionStatus: 'completed',
      completedAt: new Date(),
    },
  });
};

function calculateRecommendation(score: number): string {
  if (score >= 85) return 'strong_yes';
  if (score >= 70) return 'yes';
  if (score >= 50) return 'no';
  return 'strong_no';
}
```

---

## 実装ガイド

### データベーススキーマ

```sql
-- ATS接続設定
CREATE TABLE ats_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  ats_provider VARCHAR(50) NOT NULL,

  -- 認証情報（暗号化）
  credentials_encrypted TEXT NOT NULL,

  -- 設定
  settings JSONB,

  -- 状態
  status VARCHAR(20) DEFAULT 'active',
  last_sync TIMESTAMP,
  last_error TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(organization_id, ats_provider)
);

-- ATS候補者
CREATE TABLE ats_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  ats_connection_id UUID REFERENCES ats_connections(id),
  external_id VARCHAR(255) NOT NULL, -- ATS側のID

  -- 候補者情報
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  job_title VARCHAR(255),
  job_id VARCHAR(255),

  -- Pranceセッション
  session_id UUID REFERENCES sessions(id),
  session_status VARCHAR(20),
  invited_at TIMESTAMP,
  completed_at TIMESTAMP,

  -- 同期情報
  synced_at TIMESTAMP,
  last_modified TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(ats_connection_id, external_id)
);

-- インデックス
CREATE INDEX idx_ats_connections_org ON ats_connections(organization_id);
CREATE INDEX idx_ats_candidates_session ON ats_candidates(session_id);
CREATE INDEX idx_ats_candidates_status ON ats_candidates(session_status);
```

---

## まとめ

ATS連携システムは、以下の価値を提供します：

✅ **採用プロセス自動化**: 候補者同期→面接→評価反映まで自動化
✅ **シームレス統合**: 主要ATS 6社に対応、拡張可能なアダプター設計
✅ **リアルタイム連携**: Webhook駆動型のイベント連携
✅ **柔軟な設定**: 職種別シナリオマッピング、自動同期ON/OFF
✅ **双方向データフロー**: ATS→Prance、Prance→ATS両方向の連携

このシステムにより、採用担当者はATSとPranceを別々に操作する必要がなく、統合されたワークフローで効率的に採用活動を進められます。

---

**関連ドキュメント:**

- [外部連携API](EXTERNAL_API.md)
- [Webhook統合](../development/WEBHOOK.md)
