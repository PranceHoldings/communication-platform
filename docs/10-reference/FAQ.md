# よくある質問 (FAQ)

**バージョン:** 2.0
**作成日:** 2026-03-05
**最終更新:** 2026-03-05
**ステータス:** Phase 0 完了

---

## 目次

1. [アーキテクチャ設計](#1-アーキテクチャ設計)
2. [技術選定](#2-技術選定)
3. [コスト・スケーラビリティ](#3-コストスケーラビリティ)
4. [セキュリティ・プライバシー](#4-セキュリティプライバシー)
5. [開発・デプロイ](#5-開発デプロイ)
6. [機能・ビジネス](#6-機能ビジネス)
7. [トラブルシューティング](#7-トラブルシューティング)

---

## 1. アーキテクチャ設計

### Q1-1: なぜサーバーレスアーキテクチャを採用したのですか?

**A:** サーバーレスアーキテクチャを採用した主な理由は以下の4点です:

#### 1. 自動スケーラビリティ

- **従来型 (EC2)**: 事前に最大負荷を想定してサーバーをプロビジョニング → 過剰容量またはスケール遅延
- **サーバーレス**: 10ユーザー → 10万ユーザーまで自動対応、数秒でスケール
- **実例**: Lambda同時実行数は自動で0 → 1000+まで拡張

#### 2. コスト効率

**月間1,000セッション想定コスト比較:**

| 項目               | EC2ベース (t3.medium × 2) | サーバーレス                   |
| ------------------ | ------------------------- | ------------------------------ |
| コンピューティング | $120/月 (24時間稼働)      | $120/月 (使用時のみ)           |
| データベース       | RDS ($150/月)             | Aurora Serverless v2 ($180/月) |
| ロードバランサー   | ALB ($30/月)              | API Gateway ($3.50/月)         |
| アイドル時コスト   | **$300/月**               | **$50/月** (最小構成)          |

**結論**: 使用量ベース課金により、低トラフィック時は最大 **80% コスト削減**

#### 3. 高可用性

- **従来型**: Multi-AZ構成、Auto Scalingグループ、ヘルスチェック → 複雑な設定
- **サーバーレス**: Lambda/Aurora Serverless v2はデフォルトでMulti-AZ、自動フェイルオーバー
- **SLA**: Lambda 99.95%、Aurora 99.95%、CloudFront 99.9%

#### 4. メンテナンス不要

- **従来型**: OSパッチ、セキュリティ更新、ミドルウェアバージョン管理 → 週次メンテナンス作業
- **サーバーレス**: AWSが自動管理、開発者は **ビジネスロジックのみに集中**

#### トレードオフと対策

| トレードオフ                  | 対策                                            |
| ----------------------------- | ----------------------------------------------- |
| **コールドスタート** (数百ms) | Provisioned Concurrency (重要API用)             |
| **15分実行時間制限**          | Step Functionsで長時間処理を分割                |
| **ベンダーロックイン**        | 抽象化レイヤー (Prisma ORM、移植可能な設計)     |
| **デバッグ難易度**            | X-Ray分散トレーシング、CloudWatch Logs Insights |

---

### Q1-2: なぜ AWS IoT Core を WebSocket に使用するのですか? API Gateway WebSocket APIではダメですか?

**A:** AWS IoT Coreを採用した理由:

| 項目                         | API Gateway WebSocket                     | AWS IoT Core                    |
| ---------------------------- | ----------------------------------------- | ------------------------------- |
| **同時接続数**               | 10,000 (制限引き上げ可)                   | **100万接続** (デフォルト)      |
| **料金**                     | $1.00/100万メッセージ + $0.25/100万接続分 | **$0.08/100万メッセージ**       |
| **グローバルエンドポイント** | リージョン単位                            | **自動グローバル分散**          |
| **ルール処理**               | Lambda統合必須                            | **IoT Rules Engine (組み込み)** |
| **デバイス管理**             | なし                                      | シャドウ、証明書管理            |

**結論**: 大規模同時接続、低コスト、グローバル対応のため **IoT Core を採用**

**使い分け:**

- **API Gateway WebSocket**: 小規模 (< 10,000接続)、シンプルなREST統合
- **IoT Core**: 大規模 (> 10,000接続)、リアルタイム性重視、将来的なIoTデバイス統合

---

### Q1-3: なぜ Prisma Data Proxy を使用しないのですか?

**A:** Prisma Data Proxy (旧 Prisma Accelerate) は **2024年に廃止** され、現在は以下の代替手段を採用:

#### 廃止の理由 (Prisma公式)

- コネクションプール管理の複雑性
- レイテンシ増加 (プロキシ経由)
- メンテナンスコスト高

#### 現在の推奨アーキテクチャ

```typescript
// apps/api/src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';

// Lambdaコンテナ内でグローバルインスタンス再利用
let prisma: PrismaClient;

export function getPrismaClient() {
  if (!prisma) {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });
  }
  return prisma;
}
```

**コネクション管理:**

1. **AWS RDS Proxy** (本番推奨):
   - Lambda → RDS Proxy → Aurora Serverless v2
   - コネクションプール自動管理
   - IAM認証統合

2. **Aurora Serverless v2 Data API** (代替案):
   - HTTPベースクエリ実行
   - コネクション不要
   - レイテンシやや高

**結論**: Prisma Data Proxy廃止により、**RDS Proxy + 通常のPrisma Client** を採用

---

## 2. 技術選定

### Q2-1: なぜ Claude (Anthropic) を会話AIに採用したのですか?

**A:** Claude Sonnet 4.6を採用した理由:

| 項目               | Claude Sonnet 4.6 | GPT-4 Turbo   | Gemini Pro      |
| ------------------ | ----------------- | ------------- | --------------- |
| **コンテキスト**   | 200K tokens       | 128K tokens   | 32K tokens      |
| **料金 (Input)**   | $3/1M tokens      | $10/1M tokens | $0.50/1M tokens |
| **料金 (Output)**  | $15/1M tokens     | $30/1M tokens | $1.50/1M tokens |
| **レスポンス品質** | 高 (自然な会話)   | 高            | 中              |
| **日本語精度**     | 高                | 高            | 中              |
| **AWS統合**        | **Bedrock ✅**    | なし          | Vertex AI (GCP) |

**採用理由:**

1. **コストパフォーマンス**: GPT-4の1/3、Geminiより高品質
2. **AWS統合**: Bedrock経由で統一認証・請求
3. **長文コンテキスト**: シナリオ全体 + 会話履歴を処理可能
4. **自然な対話**: 面接官・講師ロールに最適

**マルチプロバイダ対応** (Phase 1実装予定):

```typescript
// apps/api/src/services/ai-provider.service.ts
export interface AIProvider {
  generateResponse(prompt: string): Promise<string>;
}

export class ClaudeProvider implements AIProvider {
  async generateResponse(prompt: string): Promise<string> {
    // AWS Bedrock (Claude) 実装
  }
}

export class GPT4Provider implements AIProvider {
  async generateResponse(prompt: string): Promise<string> {
    // OpenAI API 実装
  }
}

// 管理者UIで動的切り替え
const provider = await getAIProvider(organizationId); // DB設定から取得
const response = await provider.generateResponse(prompt);
```

---

### Q2-2: なぜ ElevenLabs を TTS に採用したのですか?

**A:** ElevenLabsを採用した理由:

| 項目                 | ElevenLabs                | Amazon Polly | Google Cloud TTS |
| -------------------- | ------------------------- | ------------ | ---------------- |
| **音質**             | **最高 (人間に近い)**     | 中           | 高               |
| **Visemeデータ**     | **あり (リップシンク用)** | あり         | なし             |
| **音声クローニング** | **あり (30秒音声から)**   | なし         | なし             |
| **料金**             | $22/月 (100万文字)        | $4/100万文字 | $4/100万文字     |
| **多言語**           | 29言語                    | 60+ 言語     | 40+ 言語         |

**採用理由:**

1. **音質**: 最も自然な音声合成 (面接官・講師として違和感なし)
2. **Visemeデータ**: アバターのリップシンクに必須
3. **音声クローニング**: ユーザー独自の音声でアバター作成可能

**コスト削減策:**

- **初回生成のみTTS**: 同じセリフは録音キャッシュ利用
- **短縮形プロンプト**: トークン数削減でAPI呼び出し最小化

**代替案 (Phase 2検討):**

- **Amazon Polly Neural**: コスト重視の場合
- **Microsoft Azure TTS**: Visemeデータあり、高品質

---

### Q2-3: なぜ Cognito を採用したのですか? Clerk や Auth0 ではダメですか?

**A:** Amazon Cognitoを採用した理由:

#### コスト比較 (月間10,000アクティブユーザー)

| サービス           | 月額コスト  | 無料枠                     |
| ------------------ | ----------- | -------------------------- |
| **Amazon Cognito** | **$55/月**  | 50,000 MAU無料 (最初の1年) |
| **Clerk**          | **$599/月** | 10,000 MAU無料             |
| **Auth0**          | **$240/月** | 7,000 MAU無料              |

**結論**: Cognitoは **10倍安い**

#### AWS統合

| 機能                  | Cognito           | Clerk / Auth0                  |
| --------------------- | ----------------- | ------------------------------ |
| **IAM統合**           | ✅ ネイティブ     | ❌ Lambda Authorizerで実装必要 |
| **Lambda Authorizer** | ✅ 自動生成       | ⚠️ カスタム実装                |
| **VPC統合**           | ✅ 低レイテンシ   | ❌ インターネット経由          |
| **監視**              | ✅ CloudWatch統合 | ⚠️ 外部監視ツール必要          |

#### 機能比較

| 機能                 | Cognito             | Clerk         | Auth0         |
| -------------------- | ------------------- | ------------- | ------------- |
| **OAuth2 / SAML**    | ✅                  | ✅            | ✅            |
| **MFA (多要素認証)** | ✅                  | ✅            | ✅            |
| **組織管理UI**       | ⚠️ カスタム実装必要 | ✅ ビルトイン | ✅ ビルトイン |
| **ユーザー招待**     | ⚠️ カスタム実装必要 | ✅ ビルトイン | ✅ ビルトイン |
| **カスタムドメイン** | ✅                  | ✅            | ✅            |

#### トレードオフと対策

| Clerkの利点                  | Cognitoでの実装コスト                |
| ---------------------------- | ------------------------------------ |
| **組織管理UI**               | 1-2週間で実装可能 (Next.js + Prisma) |
| **ユーザー招待UI**           | 1週間で実装可能 (SES統合)            |
| **ビルトインコンポーネント** | shadcn/uiで代替 (1週間)              |

**結論**: **初期開発コスト (2-3週間) < 年間ライセンス費用差 ($6,000+)** のため、Cognitoを採用

**詳細**: [Clerk vs Cognito 比較](./AUTH_COMPARISON_CLERK_VS_COGNITO.md)

---

### Q2-4: なぜ PostgreSQL を採用したのですか? MongoDB ではダメですか?

**A:** PostgreSQL (Aurora Serverless v2) を採用した理由:

#### データ特性

| データ種別         | 特性                                   | 最適DB         |
| ------------------ | -------------------------------------- | -------------- |
| **ユーザー・組織** | リレーション強い、トランザクション必須 | **PostgreSQL** |
| **シナリオ**       | リレーション強い、複雑なクエリ         | **PostgreSQL** |
| **セッション履歴** | 時系列、分析クエリ                     | PostgreSQL     |
| **セッション状態** | NoSQL、TTL自動削除                     | **DynamoDB**   |

#### PostgreSQLの利点

1. **Prisma ORM完全サポート**: TypeScript型安全、マイグレーション管理
2. **ACID準拠**: トランザクション、外部キー制約
3. **JSON型対応**: 柔軟なスキーマ + リレーション
4. **フルテキスト検索**: `tsvector`でシナリオ検索高速化

#### MongoDBの課題

- **Prismaサポート**: MongoDB Connector (Experimental、機能制限)
- **トランザクション**: シャード環境で複雑
- **リレーション**: 手動管理、JOIN非効率

#### ハイブリッドアプローチ (採用)

```
PostgreSQL (Aurora Serverless v2): マスターデータ
└── users, organizations, scenarios, prompts

DynamoDB: リアルタイムデータ
└── session_state, websocket_connections, benchmark_cache

S3: ファイル
└── recordings, avatars, reports
```

**結論**: リレーショナルデータはPostgreSQL、リアルタイムデータはDynamoDBの **適材適所**

---

## 3. コスト・スケーラビリティ

### Q3-1: 月間コストの内訳を教えてください

**A:** **月間1,000セッション想定** (1セッション30分平均):

| サービス                 | 使用量                            | 月額 (USD)     | 備考                      |
| ------------------------ | --------------------------------- | -------------- | ------------------------- |
| **Lambda**               | 100万リクエスト、1024MB、30秒平均 | $120           | ARM64で20%削減済み        |
| **Aurora Serverless v2** | 平均2 ACU、730時間、100GB         | $185           | アイドル時0.5 ACUまで縮小 |
| **DynamoDB**             | 500万読込、100万書込、10GB        | $5             | オンデマンドモード        |
| **S3**                   | 1TB保存、ライフサイクル適用       | $23            | Intelligent-Tiering       |
| **CloudFront**           | 10TBダウンロード                  | $85            | S3直接より削減            |
| **IoT Core**             | 100万メッセージ/月                | $8             | WebSocket通信             |
| **API Gateway**          | 100万リクエスト                   | $3.50          | REST API                  |
| **ElastiCache**          | Serverless、1GBキャッシュ         | $20            | Redis                     |
| **Bedrock (Claude)**     | 500万トークン (Input/Output混合)  | $60            | 会話AI                    |
| **ElevenLabs**           | 10万文字 (TTS)                    | $22            | 音声合成                  |
| **Azure Speech**         | 10時間 (STT)                      | $10            | 音声認識                  |
| **その他**               | NAT Gateway, VPC, Logs            | $50            | インフラ基盤              |
| **合計**                 | -                                 | **$591.50/月** | 約 **$0.59/セッション**   |

#### スケール時のコスト (月間10,000セッション)

| サービス                 | 10倍増加        | 月額 (USD)    | 備考                    |
| ------------------------ | --------------- | ------------- | ----------------------- |
| **Lambda**               | リニア          | $1,200        | 使用量ベース            |
| **Aurora Serverless v2** | 2倍 (平均4 ACU) | $370          | 自動スケール            |
| **DynamoDB**             | リニア          | $50           | 無制限スケール          |
| **S3**                   | リニア          | $230          | ストレージ10TB          |
| **CloudFront**           | リニア          | $850          | 100TBダウンロード       |
| **IoT Core**             | リニア          | $80           | メッセージ1,000万       |
| **Bedrock**              | リニア          | $600          | トークン5,000万         |
| **ElevenLabs**           | リニア          | $99           | 100万文字 (Proプラン)   |
| **その他**               | +20%            | $60           | インフラ                |
| **合計**                 | -               | **$3,539/月** | 約 **$0.35/セッション** |

**結論**: スケールするほど **セッション単価が減少** (規模の経済)

---

### Q3-2: コールドスタートの影響はありますか?

**A:** Lambda コールドスタート (初回実行の遅延) は以下の対策で最小化:

#### コールドスタート時間 (実測)

| Lambda設定                    | コールドスタート | ウォームスタート |
| ----------------------------- | ---------------- | ---------------- |
| **Node.js 20 (x86_64)**       | 800-1200ms       | 5-10ms           |
| **Node.js 20 (ARM64)**        | **600-900ms**    | 5-10ms           |
| **+ Provisioned Concurrency** | **50-100ms**     | 5-10ms           |

#### 対策

1. **ARM64 (Graviton2) 採用**: コールドスタート **25%削減**

   ```typescript
   // infrastructure/lib/lambda-stack.ts
   architecture: lambda.Architecture.ARM_64,
   ```

2. **Provisioned Concurrency** (重要APIのみ):

   ```typescript
   // 常に10インスタンスをウォーム状態に維持
   const alias = new lambda.Alias(this, 'LiveAlias', {
     aliasName: 'live',
     version: apiFunction.currentVersion,
     provisionedConcurrentExecutions: 10, // $13.50/月 (us-east-1)
   });
   ```

3. **Lambda Layer 活用**: 依存関係を分離、デプロイサイズ削減

   ```typescript
   // node_modules は Layer に配置
   const sharedLayer = new lambda.LayerVersion(this, 'SharedLayer', {
     code: lambda.Code.fromAsset(path.join(__dirname, '../../layers/shared')),
   });
   apiFunction.addLayers(sharedLayer);
   ```

4. **定期的Warmer** (開発環境のみ):
   ```typescript
   // EventBridge Rule で 5分ごとに Lambda を呼び出し
   new events.Rule(this, 'WarmerRule', {
     schedule: events.Schedule.rate(Duration.minutes(5)),
     targets: [new targets.LambdaFunction(apiFunction)],
   });
   ```

#### 体感影響

- **一般ユーザー**: 初回ログイン時のみ 1秒遅延 → **許容範囲**
- **リアルタイム会話**: Provisioned Concurrency で **影響なし**

---

### Q3-3: Aurora Serverless v2 の自動スケールはどのように動作しますか?

**A:** Aurora Serverless v2 の自動スケール動作:

#### ACU (Aurora Capacity Unit) とは

- **1 ACU = 2GB RAM + CPU**
- **スケール範囲**: 0.5 → 16 ACU (設定可能)
- **スケール速度**: 数秒 (v1は分単位)

#### 実際のスケール例

```
時刻        負荷           ACU   料金/時
────────────────────────────────────────
00:00-08:00 アイドル       0.5   $0.06/時
08:00-09:00 朝のトラフィック 2.0   $0.24/時
09:00-12:00 平常時         1.0   $0.12/時
12:00-13:00 昼のピーク     4.0   $0.48/時
13:00-18:00 平常時         1.5   $0.18/時
18:00-22:00 夜のトラフィック 3.0   $0.36/時
22:00-24:00 深夜           0.5   $0.06/時
────────────────────────────────────────
平均ACU: 1.8 → 月額: $158
```

#### スケールトリガー

| メトリクス       | 閾値  | アクション     |
| ---------------- | ----- | -------------- |
| **CPU使用率**    | > 80% | ACU増加 (+0.5) |
| **メモリ使用率** | > 90% | ACU増加 (+0.5) |
| **接続数**       | > 90% | ACU増加 (+1.0) |
| **アイドル時間** | > 5分 | ACU減少 (-0.5) |

#### 設定

```typescript
// infrastructure/lib/database-stack.ts
this.cluster = new rds.DatabaseCluster(this, 'AuroraCluster', {
  serverlessV2MinCapacity: 0.5, // 最小ACU
  serverlessV2MaxCapacity: 16, // 最大ACU
  // ...
});
```

**推奨設定:**

- **開発環境**: 0.5 → 4 ACU (コスト最小化)
- **本番環境**: 1.0 → 16 ACU (パフォーマンス優先)

---

## 4. セキュリティ・プライバシー

### Q4-1: データ暗号化はどのように実装されていますか?

**A:** 多層暗号化戦略:

#### 1. 転送時暗号化 (Data in Transit)

| サービス            | プロトコル | 証明書                        |
| ------------------- | ---------- | ----------------------------- |
| **CloudFront**      | TLS 1.2+   | ACM (AWS Certificate Manager) |
| **API Gateway**     | HTTPS      | ACM                           |
| **IoT Core**        | TLS 1.2+   | X.509証明書                   |
| **Aurora → Lambda** | SSL/TLS    | RDS証明書                     |

**設定例:**

```typescript
// infrastructure/lib/cdn-stack.ts
const distribution = new cloudfront.Distribution(this, 'Distribution', {
  defaultBehavior: {
    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
  },
  minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
});
```

#### 2. 保存時暗号化 (Data at Rest)

| サービス                    | 暗号化方式 | キー管理           |
| --------------------------- | ---------- | ------------------ |
| **S3 (Recordings/Reports)** | SSE-KMS    | 顧客管理キー (CMK) |
| **S3 (Avatars)**            | SSE-S3     | AWS管理キー        |
| **Aurora**                  | AES-256    | AWS管理キー        |
| **DynamoDB**                | AES-256    | AWS管理キー        |
| **ElastiCache**             | AES-256    | AWS管理キー        |

**KMS設定例:**

```typescript
// infrastructure/lib/storage-stack.ts
const kmsKey = new kms.Key(this, 'RecordingsKey', {
  enableKeyRotation: true, // 年次自動ローテーション
  description: 'KMS key for recordings and reports encryption',
});

const recordingsBucket = new s3.Bucket(this, 'RecordingsBucket', {
  encryption: s3.BucketEncryption.KMS,
  encryptionKey: kmsKey,
});
```

#### 3. アプリケーションレベル暗号化

**機密データ (クレジットカード情報):**

```typescript
// apps/api/src/lib/encryption.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'); // 32バイト

export function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

---

### Q4-2: マルチテナントのデータ分離はどのように保証されていますか?

**A:** 3層のデータ分離戦略:

#### 1. アプリケーションレベル (Row Level Security)

**Prisma Middleware:**

```typescript
// apps/api/src/lib/prisma-middleware.ts
import { Prisma } from '@prisma/client';

export function applyTenantFilter(organizationId: string) {
  return async (params: Prisma.MiddlewareParams, next: any) => {
    // すべてのクエリに organizationId フィルタを自動追加
    if (params.model && params.action === 'findMany') {
      params.args.where = {
        ...params.args.where,
        organizationId,
      };
    }

    if (params.action === 'create') {
      params.args.data = {
        ...params.args.data,
        organizationId,
      };
    }

    return next(params);
  };
}

// 使用例
const prisma = new PrismaClient();
prisma.$use(applyTenantFilter(req.user.organizationId));
```

#### 2. データベースレベル (PostgreSQL RLS)

**Row Level Security設定:**

```sql
-- users テーブルにRLS適用
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ポリシー: 自組織のユーザーのみアクセス可
CREATE POLICY tenant_isolation_policy ON users
  USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Lambda から organizationId を設定
-- SET app.current_organization_id = '{organizationId}';
```

**Prismaでの使用:**

```typescript
// apps/api/src/services/user.service.ts
export async function findUsersForTenant(organizationId: string) {
  await prisma.$executeRaw`SET app.current_organization_id = ${organizationId}`;
  return await prisma.user.findMany(); // RLSで自動フィルタ
}
```

#### 3. ストレージレベル (S3 Bucket Policy)

**S3オブジェクトキー命名規則:**

```
s3://prance-recordings-prod/
├── {organizationId}/
│   ├── {userId}/
│   │   ├── {sessionId}/
│   │   │   ├── avatar.mp4
│   │   │   ├── user.mp4
│   │   │   └── combined.mp4
```

**IAMポリシー (Lambda実行ロール):**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject"],
      "Resource": "arn:aws:s3:::prance-recordings-prod/${aws:PrincipalTag/OrganizationId}/*"
    }
  ]
}
```

**Lambda関数にOrganizationIdタグ付与:**

```typescript
// infrastructure/lib/lambda-stack.ts
apiFunction.grantPrincipal.addToPrincipalPolicy(
  new iam.PolicyStatement({
    actions: ['s3:GetObject', 's3:PutObject'],
    resources: [`arn:aws:s3:::prance-recordings-prod/\${aws:PrincipalTag/OrganizationId}/*`],
  })
);
```

---

### Q4-3: GDPR・個人情報保護法への対応はどうなっていますか?

**A:** GDPR準拠機能の実装:

#### 1. データ削除権 (Right to Erasure)

```typescript
// apps/api/src/services/gdpr.service.ts
export async function deleteUserData(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');

  // 1. S3録画データ削除
  const prefix = `${user.organizationId}/${userId}/`;
  await deleteS3Objects('prance-recordings-prod', prefix);

  // 2. Aurora データ匿名化
  await prisma.user.update({
    where: { id: userId },
    data: {
      email: `deleted_${userId}@example.com`,
      name: '[Deleted User]',
      deletedAt: new Date(),
    },
  });

  // 3. DynamoDB セッション状態削除
  await deleteDynamoDBItems('prance-session-state-prod', { userId });

  // 4. 監査ログ記録
  await prisma.auditLog.create({
    data: {
      action: 'USER_DATA_DELETED',
      userId,
      timestamp: new Date(),
    },
  });
}
```

#### 2. データポータビリティ (Data Portability)

```typescript
// apps/api/src/services/gdpr.service.ts
export async function exportUserData(userId: string): Promise<Buffer> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      sessions: true,
      transcripts: true,
      reports: true,
    },
  });

  // JSON形式でエクスポート
  const exportData = {
    personal_info: {
      email: user.email,
      name: user.name,
      created_at: user.createdAt,
    },
    sessions: user.sessions.map(s => ({
      id: s.id,
      scenario: s.scenarioId,
      duration: s.duration,
      created_at: s.createdAt,
    })),
    transcripts: user.transcripts,
    reports: user.reports,
  };

  return Buffer.from(JSON.stringify(exportData, null, 2));
}
```

#### 3. 同意管理 (Consent Management)

```typescript
// apps/api/src/services/consent.service.ts
export async function updateConsent(userId: string, consents: ConsentSettings) {
  await prisma.userConsent.upsert({
    where: { userId },
    update: {
      recording: consents.recording,
      analysis: consents.analysis,
      marketing: consents.marketing,
      thirdParty: consents.thirdParty,
      updatedAt: new Date(),
    },
    create: {
      userId,
      ...consents,
    },
  });
}

export async function checkConsent(userId: string, type: ConsentType): Promise<boolean> {
  const consent = await prisma.userConsent.findUnique({
    where: { userId },
  });
  return consent?.[type] ?? false;
}
```

#### 4. データ保持ポリシー

**S3ライフサイクルポリシー:**

```typescript
// infrastructure/lib/storage-stack.ts
const recordingsBucket = new s3.Bucket(this, 'RecordingsBucket', {
  lifecycleRules: [
    {
      id: 'DeleteOldRecordings',
      enabled: true,
      expiration: Duration.days(90), // GDPR: データ最小化
      transitions: [
        {
          storageClass: s3.StorageClass.INTELLIGENT_TIERING,
          transitionAfter: Duration.days(30),
        },
      ],
    },
  ],
});
```

**Aurora自動バックアップ:**

```typescript
// infrastructure/lib/database-stack.ts
backup: {
  retention: Duration.days(7), // GDPR: 必要最小限
  preferredWindow: '03:00-04:00',
}
```

---

## 5. 開発・デプロイ

### Q5-1: ローカル開発環境のセットアップ手順を教えてください

**A:** 完全なセットアップ手順:

#### 前提条件

- Node.js 20+ (LTS)
- Docker Desktop (PostgreSQL用)
- AWS CLI v2
- Git

#### 手順

```bash
# 1. リポジトリクローン
git clone https://github.com/your-org/prance-platform.git
cd prance-platform

# 2. 依存関係インストール
pnpm install

# 3. PostgreSQL起動 (Docker)
docker run -d \
  --name prance-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=prance_dev \
  -p 5432:5432 \
  postgres:15

# 4. 環境変数設定
cp .env.example .env.local

# .env.local を編集
# DATABASE_URL="postgresql://postgres:postgres@localhost:5432/prance_dev"
# AWS_REGION=us-east-1
# BEDROCK_MODEL_ID=us.anthropic.claude-sonnet-4-6
# (その他のAPIキーを設定)

# 5. Prisma マイグレーション
cd packages/database
pnpm exec prisma migrate dev --name init
pnpm exec prisma generate
cd ../..

# 6. Next.js 開発サーバー起動
cd apps/web
pnpm run dev
# http://localhost:3000 でアクセス

# 7. Lambda ローカルテスト (別ターミナル)
cd apps/api
pnpm run dev:lambda
```

#### ディレクトリ構成

```
prance-platform/
├── apps/
│   ├── web/                # Next.js フロントエンド
│   └── api/                # Lambda バックエンド
├── packages/
│   ├── database/           # Prisma スキーマ
│   └── shared/             # 共通型定義
├── infrastructure/         # AWS CDK
└── .env.local              # ローカル環境変数
```

---

### Q5-2: AWS へのデプロイ手順を教えてください

**A:** CDKデプロイ手順:

```bash
# 1. AWS認証情報設定
aws configure
# AWS Access Key ID: AKIA...
# AWS Secret Access Key: ...
# Default region name: us-east-1

# 2. CDK Bootstrap (初回のみ)
cd infrastructure
pnpm run bootstrap

# 出力:
#  ✅  Environment aws://123456789012/us-east-1 bootstrapped.

# 3. CDK デプロイ (全スタック)
pnpm run deploy

# または個別スタックデプロイ
pnpm run deploy:network     # VPC, Subnets
pnpm run deploy:cognito     # User Pool
pnpm run deploy:database    # Aurora Serverless v2
pnpm run deploy:storage     # S3, CloudFront
pnpm run deploy:dynamodb    # DynamoDB Tables
pnpm run deploy:api-gateway # REST API, WebSocket
pnpm run deploy:lambda      # Lambda Functions

# 4. デプロイ後の出力確認
# CloudFormation Output:
#   ApiEndpoint = https://abc123.execute-api.us-east-1.amazonaws.com/dev
#   UserPoolId = us-east-1_ABC123
#   DistributionDomainName = d111111abcdef8.cloudfront.net

# 5. Next.js ビルド & デプロイ
cd ../apps/web
pnpm run build
pnpm run deploy:amplify
```

#### CI/CD (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy to AWS

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build
        run: pnpm run build

      - name: CDK Deploy
        run: |
          cd infrastructure
          pnpm run deploy -- --require-approval never
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          AWS_REGION: us-east-1
```

---

## 6. 機能・ビジネス

### Q6-1: なぜAIプロンプト・プロバイダ管理を管理者UIに実装したのですか?

**A:** 管理者UIで動的管理を実装した理由:

#### 1. ビジネスの柔軟性

**従来型 (ハードコード):**

```typescript
// ❌ コード変更が必要
const SYSTEM_PROMPT = `あなたは採用担当者です。候補者の回答を評価してください。`;

// プロンプト変更 → コード修正 → テスト → デプロイ (1-2週間)
```

**動的管理 (DB設定):**

```typescript
// ✅ 管理者UIで即座に変更
const prompt = await prisma.promptTemplate.findUnique({
  where: { id: scenario.promptTemplateId },
});

// プロンプト変更 → 管理者UI更新 → 即座に反映 (5分)
```

#### 2. 顧客要望への対応

**Enterprise顧客のニーズ:**

- 「自社独自の評価基準でプロンプトをカスタマイズしたい」
- 「業界特化型の面接シナリオを作成したい」
- 「プロンプトA/Bテストで最適化したい」

**実装例:**

```typescript
// apps/api/src/services/prompt.service.ts
export async function createPromptTemplate(
  organizationId: string,
  data: CreatePromptTemplateInput
) {
  return await prisma.promptTemplate.create({
    data: {
      organizationId,
      name: data.name,
      systemPrompt: data.systemPrompt,
      variables: data.variables, // {candidateName}, {position} 等
      version: 1,
    },
  });
}

// 管理者UIで作成したプロンプトを即座に利用
const scenario = await prisma.scenario.create({
  data: {
    title: '営業面接 - 上級',
    promptTemplateId: prompt.id, // 動的に紐付け
  },
});
```

#### 3. AIプロバイダ切り替え (リスク管理)

**障害時の自動フォールバック:**

```typescript
// apps/api/src/services/ai-provider.service.ts
export async function generateAIResponse(organizationId: string, prompt: string): Promise<string> {
  const config = await getOrganizationAIConfig(organizationId);

  // 組織ごとにプロバイダ設定
  const providers = [
    config.primaryProvider, // Claude (Bedrock)
    config.fallbackProvider, // GPT-4 (OpenAI)
  ];

  for (const provider of providers) {
    try {
      return await provider.generateResponse(prompt);
    } catch (error) {
      console.error(`Provider ${provider.name} failed, trying next...`);
    }
  }

  throw new Error('All AI providers failed');
}
```

**コスト管理:**

```typescript
// 組織ごとに予算設定
export async function checkAIBudget(organizationId: string): Promise<boolean> {
  const usage = await getMonthlyAIUsage(organizationId);
  const budget = await getOrganizationBudget(organizationId);

  if (usage.totalCost >= budget.monthlyLimit) {
    // 予算超過 → 低コストプロバイダに自動切替
    await updateOrganizationAIConfig(organizationId, {
      primaryProvider: 'claude-haiku', // Sonnet → Haiku
    });
    return false;
  }

  return true;
}
```

---

### Q6-2: 多言語対応の設計思想を教えてください

**A:** コード変更不要の多言語対応:

#### 設計原則

1. **文字列ハードコード禁止**: 全ての表示テキストは言語リソースファイルから読み込み
2. **コード変更不要**: 新言語追加時はリソースファイルのみ変更
3. **ホットデプロイ**: 言語リソース更新後、即座に反映（リビルド不要）

#### 実装

**フロントエンド (next-intl):**

```typescript
// apps/web/messages/ja.json
{
  "HomePage": {
    "title": "Prance Communication Platform",
    "description": "AIアバターとリアルタイム会話",
    "startButton": "セッションを開始"
  }
}

// apps/web/app/[locale]/page.tsx
import { useTranslations } from 'next-intl';

export default function HomePage() {
  const t = useTranslations('HomePage');

  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('description')}</p>
      <button>{t('startButton')}</button>
    </div>
  );
}
```

**バックエンド (シナリオ・レポート):**

```typescript
// apps/api/src/services/i18n.service.ts
export async function getTranslation(
  key: string,
  locale: string,
  variables?: Record<string, string>
): Promise<string> {
  // Redis キャッシュ確認
  const cached = await redis.get(`i18n:${locale}:${key}`);
  if (cached) return formatString(cached, variables);

  // S3から言語リソース取得
  const resources = await getLanguageResources(locale);
  const translation = resources[key];

  // Redis にキャッシュ (TTL: 1時間)
  await redis.setex(`i18n:${locale}:${key}`, 3600, translation);

  return formatString(translation, variables);
}

// 使用例
const reportTitle = await getTranslation('report.interview.title', 'ja', {
  candidateName: '山田太郎',
  date: '2026-03-05',
});
// → "面接レポート - 山田太郎 (2026-03-05)"
```

**言語リソースの管理 (スーパー管理者UI):**

```typescript
// apps/api/src/admin/language-resources.controller.ts
export async function uploadLanguageResource(locale: string, file: File) {
  // 1. JSONバリデーション
  const resources = JSON.parse(await file.text());

  // 2. S3アップロード
  await s3.putObject({
    Bucket: 'prance-language-resources',
    Key: `${locale}.json`,
    Body: JSON.stringify(resources),
  });

  // 3. Redisキャッシュクリア
  await redis.del(`i18n:${locale}:*`);

  // 4. CloudFront キャッシュ無効化
  await cloudfront.createInvalidation({
    DistributionId: DISTRIBUTION_ID,
    InvalidationBatch: {
      Paths: { Items: [`/i18n/${locale}.json`] },
    },
  });

  // → 即座に全ユーザーに反映
}
```

---

## 7. トラブルシューティング

### Q7-1: Lambda関数がタイムアウトします

**A:** タイムアウトのデバッグ手順:

#### 1. CloudWatch Logs確認

```bash
# AWS CLI で最新ログ取得
aws logs tail /aws/lambda/prance-api-function --follow

# または AWS Console
# CloudWatch → Log groups → /aws/lambda/prance-api-function
```

#### 2. X-Ray トレース確認

```bash
# AWS Console
# X-Ray → Traces → [失敗したリクエストを選択]
```

**典型的なボトルネック:**

| 原因                      | 対策                                    |
| ------------------------- | --------------------------------------- |
| **DBクエリが遅い**        | インデックス追加、クエリ最適化          |
| **外部API呼び出しが遅い** | タイムアウト設定、並列処理              |
| **メモリ不足**            | Lambda memorySize増加 (1024MB → 2048MB) |
| **コールドスタート**      | Provisioned Concurrency有効化           |

#### 3. メモリ増加

```typescript
// infrastructure/lib/lambda-stack.ts
const apiFunction = new lambda.Function(this, 'ApiFunction', {
  memorySize: 2048, // 1024MB → 2048MB
  timeout: Duration.seconds(60), // 30秒 → 60秒
});
```

**注**: メモリ増加 = CPU増加 → 実行時間短縮 → コスト相殺

---

### Q7-2: Aurora Serverless v2 の接続が失敗します

**A:** 接続エラーのデバッグ:

#### 1. VPC Security Group確認

```bash
# AWS CLI でセキュリティグループ確認
aws ec2 describe-security-groups \
  --group-ids sg-xxxxxxxxx \
  --query 'SecurityGroups[0].IpPermissions'

# Lambda → Aurora の通信許可確認
# Port 5432 が Lambda SG からの Ingress で許可されているか?
```

#### 2. DATABASE_URL確認

```typescript
// apps/api/src/lib/prisma.ts
console.log('DATABASE_URL:', process.env.DATABASE_URL?.replace(/:[^:]*@/, ':***@'));

// 期待値:
// postgresql://username:***@cluster-endpoint:5432/prance?schema=public
```

#### 3. Aurora エンドポイント確認

```bash
# AWS CLI でクラスターエンドポイント取得
aws rds describe-db-clusters \
  --db-cluster-identifier prance-aurora-cluster \
  --query 'DBClusters[0].Endpoint'

# 出力例: prance-aurora-cluster.cluster-abc123.us-east-1.rds.amazonaws.com
```

#### 4. 接続テスト

```typescript
// apps/api/src/scripts/test-db-connection.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function testConnection() {
  try {
    const result = await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection successful:', result);
  } catch (error) {
    console.error('❌ Database connection failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
```

---

### Q7-3: Bedrock で `AccessDeniedException` が発生します

**A:** IAM権限のデバッグ:

#### 1. IAMポリシー確認

```bash
# Lambda実行ロールのポリシー確認
aws iam list-attached-role-policies --role-name prance-lambda-role

# Bedrock権限があるか確認
aws iam get-policy-version \
  --policy-arn arn:aws:iam::aws:policy/AmazonBedrockFullAccess \
  --version-id v1
```

#### 2. 必要な権限

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
      "Resource": "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-*"
    }
  ]
}
```

#### 3. CDKで権限付与

```typescript
// infrastructure/lib/lambda-stack.ts
apiFunction.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
    resources: ['arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-*'],
  })
);
```

#### 4. モデルアクセス有効化確認

```bash
# AWS Console
# Bedrock → Model access → Manage model access
# Claude 3.5 Sonnet が "Access granted" になっているか確認
```

---

## 関連ドキュメント

- [システムアーキテクチャ](../architecture/SYSTEM_ARCHITECTURE.md)
- [AWSサーバーレス構成](../infrastructure/AWS_SERVERLESS.md)
- [技術スタック詳細](./TECH_STACK.md)
- [データベース設計](../development/DATABASE_DESIGN.md)
- [API設計](../development/API_DESIGN.md)
- [用語集](./GLOSSARY.md)

---

**最終更新:** 2026-03-05
**次回レビュー予定:** Phase 1 完了時
