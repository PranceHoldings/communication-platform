# セキュリティポリシー

Pranceプラットフォームのセキュリティ対策とコンプライアンス

## 目次

- [セキュリティ概要](#セキュリティ概要)
- [データ保護](#データ保護)
- [認証・認可](#認証認可)
- [ネットワークセキュリティ](#ネットワークセキュリティ)
- [アプリケーションセキュリティ](#アプリケーションセキュリティ)
- [脆弱性管理](#脆弱性管理)
- [インシデント対応](#インシデント対応)
- [コンプライアンス](#コンプライアンス)

---

## セキュリティ概要

### セキュリティ原則

```
┌──────────────────────────────────────────────────────────┐
│ 1. Defense in Depth（多層防御）                           │
│    複数のセキュリティレイヤーで保護                        │
│                                                          │
│ 2. Least Privilege（最小権限の原則）                      │
│    必要最小限の権限のみ付与                               │
│                                                          │
│ 3. Secure by Default（デフォルトで安全）                  │
│    安全な設定をデフォルトとする                           │
│                                                          │
│ 4. Fail Secure（安全側に倒れる）                          │
│    障害時は権限を制限                                     │
│                                                          │
│ 5. Complete Mediation（完全な媒介）                       │
│    すべてのアクセスを検証                                 │
└──────────────────────────────────────────────────────────┘
```

### セキュリティ組織体制

```
CISO（最高情報セキュリティ責任者）
    │
    ├─ セキュリティエンジニアリングチーム
    │   ├─ アプリケーションセキュリティ
    │   ├─ インフラセキュリティ
    │   └─ セキュリティ自動化
    │
    ├─ セキュリティオペレーションチーム
    │   ├─ 監視・検知
    │   ├─ インシデント対応
    │   └─ 脆弱性管理
    │
    └─ ガバナンス・リスク・コンプライアンス（GRC）
        ├─ ポリシー策定
        ├─ リスク評価
        └─ 監査対応
```

---

## データ保護

### データ分類

| レベル | 説明 | 例 | 保護要件 |
|--------|------|-----|---------|
| **Public** | 公開情報 | プレスリリース、ドキュメント | 整合性保護 |
| **Internal** | 社内情報 | 社内ドキュメント、設計書 | アクセス制御 |
| **Confidential** | 機密情報 | 顧客データ、セッションデータ | 暗号化、アクセス制御、監査ログ |
| **Restricted** | 極秘情報 | APIキー、認証情報、PII | 強暗号化、厳格なアクセス制御、完全監査 |

### 暗号化

#### 転送時の暗号化（Encryption in Transit）

```
┌──────────────────────────────────────────────────────────┐
│ すべての通信をTLS 1.3で暗号化                              │
│                                                          │
│ CloudFront → ユーザー                                     │
│   - TLS 1.3                                              │
│   - Perfect Forward Secrecy (PFS)                        │
│   - HSTS (HTTP Strict Transport Security)               │
│                                                          │
│ API Gateway → Lambda                                     │
│   - TLS 1.2以上                                          │
│   - AWS内部ネットワーク暗号化                             │
│                                                          │
│ Lambda → Aurora                                          │
│   - VPC内通信                                            │
│   - TLS 1.2                                              │
└──────────────────────────────────────────────────────────┘
```

**TLS設定:**

```yaml
# CloudFront
MinimumProtocolVersion: TLSv1.3_2021
SecurityPolicy: TLS_SECURITY_POLICY_2021

# 禁止する暗号化方式
DisabledCiphers:
  - TLS_RSA_WITH_*  # RSA鍵交換は禁止
  - *_CBC_*          # CBC modeは禁止
  - *_MD5            # MD5は禁止
  - *_SHA1           # SHA1は禁止

# 推奨暏化方式
PreferredCiphers:
  - TLS_AES_128_GCM_SHA256
  - TLS_AES_256_GCM_SHA384
  - TLS_CHACHA20_POLY1305_SHA256
```

#### 保管時の暗号化（Encryption at Rest）

**S3:**

```yaml
# デフォルトバケット暗号化
S3Bucket:
  BucketEncryption:
    ServerSideEncryptionConfiguration:
      - ServerSideEncryptionByDefault:
          SSEAlgorithm: aws:kms
          KMSMasterKeyID: !GetAtt KMSKey.Arn
        BucketKeyEnabled: true

# オブジェクトレベル暗号化
S3Object:
  ServerSideEncryption: aws:kms
  SSEKMSKeyId: !GetAtt KMSKey.Arn
```

**Aurora:**

```yaml
AuroraCluster:
  StorageEncrypted: true
  KmsKeyId: !GetAtt KMSKey.Arn

  # 自動バックアップも暗号化
  BackupRetentionPeriod: 35
  PreferredBackupWindow: "03:00-04:00"
```

**DynamoDB:**

```yaml
DynamoDBTable:
  SSESpecification:
    SSEEnabled: true
    SSEType: KMS
    KMSMasterKeyId: !GetAtt KMSKey.Arn
```

#### KMS（Key Management Service）

```typescript
// KMSキー階層
import * as kms from 'aws-cdk-lib/aws-kms';

// マスターキー（組織ごと）
const masterKey = new kms.Key(this, 'MasterKey', {
  description: 'Master encryption key for org data',
  enableKeyRotation: true,  // 自動ローテーション（年次）
  removalPolicy: RemovalPolicy.RETAIN,
  policy: new iam.PolicyDocument({
    statements: [
      new iam.PolicyStatement({
        sid: 'Enable IAM User Permissions',
        effect: iam.Effect.ALLOW,
        principals: [new iam.AccountRootPrincipal()],
        actions: ['kms:*'],
        resources: ['*'],
      }),
      new iam.PolicyStatement({
        sid: 'Allow Lambda to decrypt',
        effect: iam.Effect.ALLOW,
        principals: [lambdaExecutionRole.grantPrincipal],
        actions: ['kms:Decrypt', 'kms:DescribeKey'],
        resources: ['*'],
      }),
    ],
  }),
});

// データキー（用途別）
const recordingKey = new kms.Key(this, 'RecordingKey', {
  description: 'Encryption key for recordings',
  enableKeyRotation: true,
});

const apiKeyEncryptionKey = new kms.Key(this, 'ApiKeyEncryptionKey', {
  description: 'Encryption key for API keys',
  enableKeyRotation: true,
});
```

### データ保持・削除

#### 保持期間ポリシー

| データタイプ | 保持期間 | 削除方法 |
|-------------|---------|---------|
| **録画データ** | プランによる（7日-無制限） | S3 Lifecycle Policy |
| **セッションデータ** | 永続（削除リクエストまで） | 論理削除 |
| **監査ログ** | 7年 | 自動削除 |
| **APIログ** | 90日 | 自動削除 |
| **一時データ** | 24時間 | TTL自動削除 |

#### GDPRデータ削除

```typescript
// データ削除リクエスト処理
async function processDataDeletionRequest(userId: string): Promise<void> {
  // 1. ユーザーデータの論理削除
  await prisma.user.update({
    where: { id: userId },
    data: {
      deleted_at: new Date(),
      email: `deleted_${userId}@example.com`,
      name: 'Deleted User',
      // PII削除
      profile: null,
    },
  });

  // 2. S3ファイル削除（録画・アバター）
  const sessions = await prisma.session.findMany({
    where: { user_id: userId },
    include: { recordings: true },
  });

  for (const session of sessions) {
    for (const recording of session.recordings) {
      await s3.deleteObject({
        Bucket: process.env.RECORDINGS_BUCKET,
        Key: getS3KeyFromUrl(recording.s3_url),
      });
    }
  }

  // 3. DynamoDB一時データ削除
  await dynamodb.deleteItem({
    TableName: 'sessions_state',
    Key: { session_id: { S: userId } },
  });

  // 4. ベンチマークデータから除外
  await prisma.userProfile.update({
    where: { user_id: userId },
    data: { benchmark_opt_in: false },
  });

  // 5. 監査ログ記録
  await auditLog.create({
    event_type: 'DATA_DELETION',
    user_id: userId,
    timestamp: new Date(),
    details: { request_type: 'GDPR_ERASURE' },
  });
}
```

---

## 認証・認可

### 認証方式

#### 1. AWS Cognito（ユーザー認証）

```typescript
// Cognito User Pool設定
const userPool = new cognito.UserPool(this, 'UserPool', {
  selfSignUpEnabled: false,  // 管理者招待のみ
  signInAliases: {
    email: true,
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
    tempPasswordValidity: Duration.days(3),
  },
  mfa: cognito.Mfa.OPTIONAL,
  mfaSecondFactor: {
    sms: true,
    otp: true,
  },
  accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
  advancedSecurityMode: cognito.AdvancedSecurityMode.ENFORCED,
});
```

**パスワードポリシー:**

- 最低12文字
- 大文字・小文字・数字・記号を含む
- 過去5世代のパスワード再利用禁止
- 90日ごとのパスワード変更推奨
- アカウントロックアウト: 5回失敗で15分間ロック

**MFA（多要素認証）:**

- Enterprise: 必須
- Pro: オプション（推奨）
- Free: オプション

#### 2. SSO/SAML（Enterprise）

```yaml
# Cognito Identity Provider設定
IdentityProvider:
  Type: SAML
  ProviderName: Okta
  MetadataURL: https://company.okta.com/app/metadata

  AttributeMapping:
    email: http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress
    name: http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name
    custom:org_id: http://schemas.xmlsoap.org/ws/2005/05/identity/claims/organization
```

**サポートIdP:**

- Okta
- Azure AD
- Google Workspace
- OneLogin

### 認可（RBAC）

#### ロールベースアクセス制御

```typescript
// ロール定義
enum Role {
  SUPER_ADMIN = 'super_admin',
  CLIENT_ADMIN = 'client_admin',
  CLIENT_USER = 'client_user',
}

// 権限マッピング
const permissions: Record<Role, string[]> = {
  super_admin: [
    'platform:*',
    'tenant:*',
    'user:*',
    'session:*',
    'report:*',
  ],
  client_admin: [
    'org:manage',
    'user:invite',
    'user:manage',
    'session:view_all',
    'report:view_all',
    'api_key:manage',
    'prompt:manage',
  ],
  client_user: [
    'session:create',
    'session:view_own',
    'report:view_own',
    'avatar:create',
    'scenario:create',
  ],
};

// 権限チェックミドルウェア
function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    const userPermissions = permissions[user.role];

    if (!hasPermission(userPermissions, permission)) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Insufficient permissions',
      });
    }

    next();
  };
}

// 使用例
router.get('/admin/users',
  authenticate,
  requirePermission('user:manage'),
  listUsers
);
```

#### Row Level Security（RLS）

```sql
-- PostgreSQL RLS設定
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- ポリシー: ユーザーは自分のセッションのみ閲覧可
CREATE POLICY sessions_own_read
  ON sessions
  FOR SELECT
  USING (
    user_id = current_setting('app.current_user_id')::uuid OR
    (
      org_id = current_setting('app.current_org_id')::uuid AND
      current_setting('app.current_role') IN ('super_admin', 'client_admin')
    )
  );

-- ポリシー: セッション作成は自分のみ
CREATE POLICY sessions_own_create
  ON sessions
  FOR INSERT
  WITH CHECK (
    user_id = current_setting('app.current_user_id')::uuid
  );
```

### APIキー管理

#### キー生成

```typescript
// APIキー生成（暗号学的に安全）
import * as crypto from 'crypto';

function generateApiKey(environment: 'live' | 'test'): string {
  const prefix = environment === 'live' ? 'sk_live' : 'sk_test';
  const randomBytes = crypto.randomBytes(32);
  const key = randomBytes.toString('base64url');
  return `${prefix}_${key}`;
}

// ハッシュ化（保存用）
function hashApiKey(apiKey: string): string {
  return crypto
    .createHash('sha256')
    .update(apiKey)
    .digest('hex');
}

// 検証
function verifyApiKey(providedKey: string, storedHash: string): boolean {
  const providedHash = hashApiKey(providedKey);
  return crypto.timingSafeEqual(
    Buffer.from(providedHash),
    Buffer.from(storedHash)
  );
}
```

#### キーローテーション

```typescript
// 定期的なキーローテーション推奨
async function rotateApiKey(oldKeyId: string): Promise<{ newKey: string }> {
  // 1. 新しいキー生成
  const newKey = generateApiKey('live');
  const newKeyHash = hashApiKey(newKey);

  // 2. DB更新
  const result = await prisma.apiKey.update({
    where: { id: oldKeyId },
    data: {
      key_hash: newKeyHash,
      key_prefix: newKey.substring(0, 12),
      created_at: new Date(),
      last_used_at: null,
    },
  });

  // 3. 監査ログ
  await auditLog.create({
    event_type: 'API_KEY_ROTATED',
    api_key_id: oldKeyId,
    timestamp: new Date(),
  });

  return { newKey };
}

// 自動ローテーションスケジュール（推奨: 90日ごと）
// EventBridge Rule → Lambda
```

---

## ネットワークセキュリティ

### VPC設計

```
┌─────────────────────────────────────────────────────────┐
│ VPC (10.0.0.0/16)                                        │
│                                                          │
│ ┌────────────────────────────────────────────────────┐  │
│ │ Public Subnet (10.0.1.0/24, 10.0.2.0/24)           │  │
│ │ - NAT Gateway                                      │  │
│ │ - Application Load Balancer (将来)                 │  │
│ └────────────────────────────────────────────────────┘  │
│                          │                               │
│                          ▼                               │
│ ┌────────────────────────────────────────────────────┐  │
│ │ Private Subnet (10.0.10.0/24, 10.0.11.0/24)        │  │
│ │ - Lambda Functions                                 │  │
│ │ - ElastiCache (Redis)                              │  │
│ └────────────────────────────────────────────────────┘  │
│                          │                               │
│                          ▼                               │
│ ┌────────────────────────────────────────────────────┐  │
│ │ Isolated Subnet (10.0.20.0/28, 10.0.21.0/28)       │  │
│ │ - Aurora Cluster                                   │  │
│ │ (外部アクセス不可)                                  │  │
│ └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Security Groups

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

// Lambda → Aurora接続のみ許可
auroraSG.addIngressRule(
  lambdaSG,
  ec2.Port.tcp(5432),
  'Allow Lambda to access Aurora'
);

// ElastiCache Security Group
const redisSG = new ec2.SecurityGroup(this, 'RedisSG', {
  vpc,
  description: 'Security group for ElastiCache',
  allowAllOutbound: false,
});

redisSG.addIngressRule(
  lambdaSG,
  ec2.Port.tcp(6379),
  'Allow Lambda to access Redis'
);
```

### AWS WAF

```typescript
// WAF設定
const webAcl = new wafv2.CfnWebACL(this, 'WebAcl', {
  scope: 'CLOUDFRONT',
  defaultAction: { allow: {} },
  rules: [
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
        metricName: 'CommonRuleSet',
      },
    },
    {
      name: 'AWSManagedRulesKnownBadInputsRuleSet',
      priority: 2,
      statement: {
        managedRuleGroupStatement: {
          vendorName: 'AWS',
          name: 'AWSManagedRulesKnownBadInputsRuleSet',
        },
      },
      overrideAction: { none: {} },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'KnownBadInputs',
      },
    },
    {
      name: 'AWSManagedRulesSQLiRuleSet',
      priority: 3,
      statement: {
        managedRuleGroupStatement: {
          vendorName: 'AWS',
          name: 'AWSManagedRulesSQLiRuleSet',
        },
      },
      overrideAction: { none: {} },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'SQLi',
      },
    },
    {
      name: 'RateLimitRule',
      priority: 4,
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
        metricName: 'RateLimit',
      },
    },
  ],
  visibilityConfig: {
    sampledRequestsEnabled: true,
    cloudWatchMetricsEnabled: true,
    metricName: 'WebAcl',
  },
});
```

---

## アプリケーションセキュリティ

### OWASP Top 10対策

| リスク | 対策 |
|--------|------|
| **A01: Broken Access Control** | RBAC, RLS, セッション検証 |
| **A02: Cryptographic Failures** | TLS 1.3, KMS暗号化 |
| **A03: Injection** | パラメータ化クエリ、入力検証 |
| **A04: Insecure Design** | 脅威モデリング、セキュアコーディング |
| **A05: Security Misconfiguration** | IaC、自動セキュリティチェック |
| **A06: Vulnerable Components** | Dependabot、Snyk、定期更新 |
| **A07: Auth Failures** | MFA、セッション管理、パスワードポリシー |
| **A08: Software and Data Integrity** | コード署名、SRI、SBOM |
| **A09: Logging Failures** | CloudWatch、監査ログ、アラート |
| **A10: Server-Side Request Forgery** | URLホワイトリスト、ネットワーク分離 |

### 入力検証

```typescript
// Zodによるバリデーション
import { z } from 'zod';

const createSessionSchema = z.object({
  scenario_id: z.string().uuid(),
  avatar_id: z.string().uuid(),
  voice_id: z.string().uuid(),
  metadata: z.object({}).optional(),
});

// エンドポイント
app.post('/sessions', async (req, res) => {
  try {
    // 入力検証
    const validated = createSessionSchema.parse(req.body);

    // XSS防止: サニタイゼーション
    const sanitized = sanitizeInput(validated);

    // ビジネスロジック
    const session = await createSession(sanitized);

    res.json({ success: true, data: session });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }
    throw error;
  }
});
```

### SQLインジェクション防止

```typescript
// Prisma（パラメータ化クエリ）
const users = await prisma.user.findMany({
  where: {
    email: userInput,  // 安全: 自動エスケープ
  },
});

// 生SQLが必要な場合もパラメータ化
const result = await prisma.$queryRaw`
  SELECT * FROM users
  WHERE email = ${userInput}
`;  // 安全: パラメータ化

// ❌ 危険: 文字列結合
const query = `SELECT * FROM users WHERE email = '${userInput}'`;
await prisma.$executeRawUnsafe(query);  // 使用禁止
```

### XSS（クロスサイトスクリプティング）防止

```typescript
// Next.js（自動エスケープ）
export default function UserProfile({ user }) {
  return (
    <div>
      <h1>{user.name}</h1>  {/* 自動エスケープ */}
      <div dangerouslySetInnerHTML={{ __html: user.bio }} />  {/* 注意 */}
    </div>
  );
}

// サニタイゼーション
import DOMPurify from 'isomorphic-dompurify';

const sanitizedBio = DOMPurify.sanitize(user.bio, {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a'],
  ALLOWED_ATTR: ['href'],
});
```

### CSRF（クロスサイトリクエストフォージェリ）防止

```typescript
// SameSite Cookie
res.cookie('session', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: 3600000,
});

// CSRF Token（状態変更APIのみ）
app.post('/sessions', csrfProtection, async (req, res) => {
  // CSRFトークン検証済み
  const session = await createSession(req.body);
  res.json({ data: session });
});
```

---

## 脆弱性管理

### 依存関係スキャン

```yaml
# .github/workflows/security-scan.yml
name: Security Scan

on:
  push:
    branches: [main, develop]
  pull_request:
  schedule:
    - cron: '0 0 * * 0'  # 毎週日曜

jobs:
  dependency-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Snyk scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high

      - name: Run Trivy scan
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          severity: 'CRITICAL,HIGH'
          format: 'sarif'
          output: 'trivy-results.sarif'

      - name: Upload to GitHub Security
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'
```

### ペネトレーションテスト

**スケジュール:**

- 年次: 外部セキュリティ企業による本格的ペンテスト
- 四半期: 自動脆弱性スキャン
- リリース前: 重要機能の手動テスト

**スコープ:**

- Webアプリケーション
- API
- インフラストラクチャ
- ネットワーク

---

## インシデント対応

### インシデント分類

| レベル | 定義 | 対応時間 | 例 |
|--------|------|---------|-----|
| **P0 - Critical** | サービス全停止、データ漏洩 | 即座（15分以内） | データベース侵害 |
| **P1 - High** | 主要機能停止 | 1時間以内 | 認証システム障害 |
| **P2 - Medium** | 一部機能影響 | 4時間以内 | 特定機能のバグ |
| **P3 - Low** | 軽微な影響 | 24時間以内 | UI表示の問題 |

### インシデント対応フロー

```
┌────────────────────────────────────────────────────────┐
│ 1. 検知 (Detection)                                     │
│    - CloudWatch Alarms                                 │
│    - GuardDuty検知                                     │
│    - ユーザー報告                                       │
│    - セキュリティスキャン結果                           │
├────────────────────────────────────────────────────────┤
│ 2. トリアージ (Triage)                                  │
│    - インシデント分類（P0-P3）                          │
│    - 影響範囲評価                                       │
│    - 対応チーム招集                                     │
│    → Slack #incident-response チャンネル通知           │
├────────────────────────────────────────────────────────┤
│ 3. 封じ込め (Containment)                               │
│    - 影響を受けたリソースの隔離                         │
│    - アクセス制限                                       │
│    - バックアップからの復旧準備                         │
├────────────────────────────────────────────────────────┤
│ 4. 根絶 (Eradication)                                   │
│    - 脆弱性のパッチ適用                                 │
│    - マルウェア除去                                     │
│    - 認証情報のリセット                                 │
├────────────────────────────────────────────────────────┤
│ 5. 復旧 (Recovery)                                      │
│    - サービスの段階的再開                               │
│    - 監視強化                                           │
│    - 動作確認                                           │
├────────────────────────────────────────────────────────┤
│ 6. 事後分析 (Post-Incident Review)                      │
│    - 根本原因分析                                       │
│    - 再発防止策策定                                     │
│    - ドキュメント更新                                   │
│    - チーム共有・学習                                   │
└────────────────────────────────────────────────────────┘
```

### 通知体制

```yaml
P0 - Critical:
  - CISO: 即座に電話
  - セキュリティチーム: Slack + 電話
  - 経営陣: 15分以内にメール
  - 影響顧客: 1時間以内に通知

P1 - High:
  - セキュリティチーム: Slack
  - 開発チーム: Slack
  - CISO: 30分以内にメール

P2-P3:
  - 担当チーム: Slack
  - 週次レポートで経営陣報告
```

---

## コンプライアンス

### GDPR（EU一般データ保護規則）

**対応状況:**

| 要件 | 対策 | ステータス |
|------|------|-----------|
| **データ最小化** | 必要最小限のデータのみ収集 | ✓ 対応済み |
| **同意管理** | オプトイン方式、明示的同意 | ✓ 対応済み |
| **アクセス権** | ユーザーは自分のデータにアクセス可能 | ✓ 対応済み |
| **削除権** | データ削除リクエスト対応（30日以内） | ✓ 対応済み |
| **データポータビリティ** | JSON/CSVエクスポート機能 | ✓ 対応済み |
| **侵害通知** | 72時間以内にDPA通知 | ✓ 手順整備済み |
| **DPO** | データ保護責任者の任命 | △ Year 2予定 |

### 個人情報保護法（日本）

**対応状況:**

| 要件 | 対策 | ステータス |
|------|------|-----------|
| **利用目的の明示** | プライバシーポリシーに明記 | ✓ 対応済み |
| **安全管理措置** | 暗号化、アクセス制御 | ✓ 対応済み |
| **第三者提供の制限** | 同意取得、記録保存 | ✓ 対応済み |
| **漏えい等報告** | 個人情報保護委員会への報告手順 | ✓ 手順整備済み |

### SOC 2 Type II

**準拠目標:** Year 3

**対応領域:**

- **Security:** アクセス制御、暗号化、監視
- **Availability:** 稼働率99.9%、DR対策
- **Processing Integrity:** データ処理の正確性
- **Confidentiality:** 機密情報の保護
- **Privacy:** 個人情報の保護

**準備状況:**

- [ ] ポリシー・手順書の整備（Year 2 Q3）
- [ ] 内部監査の実施（Year 2 Q4）
- [ ] 外部監査の準備（Year 3 Q1）
- [ ] SOC 2 監査実施（Year 3 Q2-Q3）
- [ ] レポート取得（Year 3 Q4）

---

## セキュリティ監査・モニタリング

### 監査ログ

```typescript
// 監査ログの記録
interface AuditLog {
  event_id: string;
  timestamp: Date;
  user_id: string;
  org_id: string;
  event_type: string;  // 'LOGIN', 'DATA_ACCESS', 'DATA_MODIFICATION', etc.
  resource_type: string;
  resource_id: string;
  action: string;
  result: 'SUCCESS' | 'FAILURE';
  ip_address: string;
  user_agent: string;
  details: object;
}

// 記録対象イベント
const auditableEvents = [
  'USER_LOGIN',
  'USER_LOGOUT',
  'USER_PASSWORD_CHANGE',
  'API_KEY_CREATED',
  'API_KEY_DELETED',
  'DATA_EXPORT',
  'DATA_DELETION',
  'PERMISSION_CHANGED',
  'SENSITIVE_DATA_ACCESS',
];
```

### CloudWatch 監視

```typescript
// セキュリティメトリクス
const securityMetrics = [
  {
    namespace: 'Security',
    metricName: 'FailedLoginAttempts',
    threshold: 100,
    evaluationPeriods: 5,
    alarmAction: 'sns:SecurityTeam',
  },
  {
    namespace: 'Security',
    metricName: 'UnauthorizedAPIAccess',
    threshold: 50,
    evaluationPeriods: 5,
    alarmAction: 'sns:SecurityTeam',
  },
  {
    namespace: 'Security',
    metricName: 'DataExportRequests',
    threshold: 10,
    evaluationPeriods: 1,
    alarmAction: 'sns:SecurityTeam',
  },
];
```

---

次のステップ: [運用ガイド](OPERATIONS_GUIDE.md) → [プロダクト要求仕様](PRODUCT_REQUIREMENTS.md)
