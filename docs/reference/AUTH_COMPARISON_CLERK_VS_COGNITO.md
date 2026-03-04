# 認証システム比較: Clerk vs Amazon Cognito

**作成日**: 2026-03-04
**プロジェクト**: Prance Communication Platform

---

## 目次

1. [概要比較](#概要比較)
2. [詳細比較マトリクス](#詳細比較マトリクス)
3. [Prance要件への適合性](#prance要件への適合性)
4. [Clerkからの移行戦略](#clerkからの移行戦略)
5. [推奨事項](#推奨事項)

---

## 概要比較

### Clerk

**概要**: モダンなSaaS向け認証・ユーザー管理プラットフォーム

**特徴**:
- 開発者体験重視（DX優先）
- リッチなUI/UXコンポーネント提供
- 組織・メンバー管理機能内蔵
- 使いやすいダッシュボード

### Amazon Cognito

**概要**: AWSのマネージド認証・認可サービス

**特徴**:
- エンタープライズグレードのスケーラビリティ
- AWS統合（IAM, Lambda, API Gateway）
- フルマネージド・高可用性
- コスト効率（大規模利用時）

---

## 詳細比較マトリクス

| カテゴリ | Clerk | Amazon Cognito | 勝者 |
|---------|-------|----------------|------|
| **基本認証機能** | | | |
| メール/パスワード認証 | ✅ 優秀 | ✅ 良好 | Clerk |
| ソーシャルログイン | ✅ 40+ プロバイダ | ✅ 主要プロバイダ | Clerk |
| MFA (多要素認証) | ✅ SMS, TOTP, Backup Codes | ✅ SMS, TOTP | 引き分け |
| パスワードレス認証 | ✅ Magic Link, OTP | ⚠️ カスタム実装必要 | Clerk |
| SSO (SAML/OAuth) | ✅ Enterprise プラン | ✅ 標準対応 | 引き分け |
| | | | |
| **開発者体験 (DX)** | | | |
| セットアップ時間 | ⭐⭐⭐⭐⭐ (10分) | ⭐⭐⭐ (1-2時間) | Clerk |
| UIコンポーネント | ✅ React, Next.js SDKリッチ | ⚠️ 基本的なHosted UI | Clerk |
| カスタマイズ性 | 🟡 制限あり | ✅ 完全カスタマイズ可 | Cognito |
| ドキュメント品質 | ⭐⭐⭐⭐⭐ 優秀 | ⭐⭐⭐ 良好 | Clerk |
| TypeScript対応 | ✅ ネイティブサポート | ✅ AWS SDK v3 | 引き分け |
| ローカル開発 | ✅ Dev環境提供 | ⚠️ 本番環境必要 | Clerk |
| | | | |
| **マルチテナント対応** | | | |
| 組織管理 | ✅ **ネイティブ機能** | ⚠️ カスタム実装必要 | **Clerk** |
| 組織切り替え | ✅ 自動UI提供 | ⚠️ 自前実装 | **Clerk** |
| 組織招待 | ✅ 自動メール送信 | ⚠️ 自前実装 | **Clerk** |
| ロール管理 | ✅ org:admin, org:member | 🟡 Custom Attributes | Clerk |
| 階層構造 | 🟡 2階層（組織・メンバー） | ✅ **柔軟な設計可** | Cognito |
| データ分離 | ✅ 自動 | ⚠️ アプリ層で実装 | Clerk |
| | | | |
| **エンタープライズ機能** | | | |
| スケーラビリティ | 🟡 ~100万ユーザー | ✅ **無制限** | **Cognito** |
| 可用性 SLA | 🟡 99.9% (Enterprise) | ✅ **99.99%** | **Cognito** |
| グローバル展開 | 🟡 US/EU リージョン | ✅ **全AWSリージョン** | **Cognito** |
| コンプライアンス | ✅ SOC 2, GDPR, HIPAA | ✅ SOC 1/2/3, GDPR, HIPAA, PCI | 引き分け |
| 監査ログ | ✅ 詳細ログ | ✅ CloudTrail統合 | 引き分け |
| カスタムドメイン | ✅ 簡単設定 | ✅ 設定可 | Clerk |
| | | | |
| **コスト** | | | |
| 無料枠 | 5,000 MAU | **50,000 MAU** | **Cognito** |
| 小規模 (10K MAU) | ~$25/月 | ~$5/月 | **Cognito** |
| 中規模 (100K MAU) | ~$499/月 | ~$50/月 | **Cognito** |
| 大規模 (1M MAU) | ~$2,500/月 | ~$500/月 | **Cognito** |
| 価格モデル | MAU課金 | MAU課金（段階的割引） | Cognito |
| 隠れコスト | なし | なし | 引き分け |
| | | | |
| **AWS統合** | | | |
| Lambda統合 | 🟡 Webhook経由 | ✅ **直接統合** | **Cognito** |
| API Gateway統合 | 🟡 JWT検証 | ✅ **Lambda Authorizer** | **Cognito** |
| IAM統合 | ❌ 不可 | ✅ **Identity Pool** | **Cognito** |
| EventBridge統合 | 🟡 Webhook経由 | ✅ **Lambda Trigger** | **Cognito** |
| CloudWatch統合 | 🟡 外部ログ | ✅ **ネイティブ** | **Cognito** |
| インフラコード | 🟡 Terraform | ✅ **CDK/CloudFormation** | **Cognito** |
| | | | |
| **高度な機能** | | | |
| セッション管理 | ✅ 自動管理 | 🟡 Refresh Token管理 | Clerk |
| デバイス管理 | ✅ デバイス認識 | ✅ デバイストラッキング | 引き分け |
| 不正検知 | ✅ Bot検出 | 🟡 カスタム実装 | Clerk |
| メタデータ管理 | ✅ public/private/unsafe | ✅ Custom Attributes | 引き分け |
| Webhook | ✅ リアルタイム | ✅ Lambda Trigger | 引き分け |
| カスタムフロー | 🟡 制限あり | ✅ **Lambda Trigger** | **Cognito** |
| | | | |
| **移行・ポータビリティ** | | | |
| データエクスポート | ✅ API提供 | ✅ API提供 | 引き分け |
| ベンダーロックイン | 🔴 高い | 🟡 中程度（AWS依存） | Cognito |
| 標準プロトコル | ✅ OAuth2/OIDC | ✅ OAuth2/OIDC/SAML | 引き分け |

---

## Prance要件への適合性

### Prance固有の要件

| 要件 | Clerk | Cognito | 評価 |
|------|-------|---------|------|
| **3階層ロール** | | | |
| スーパー管理者 | 🟡 外部実装 | ✅ Custom Attr | Cognito |
| クライアント管理者 | ✅ org:admin | ✅ Custom Attr | 引き分け |
| クライアントユーザー | ✅ org:member | ✅ Custom Attr | 引き分け |
| | | | |
| **マルチテナント** | | | |
| 組織管理 | ✅ **ネイティブ** | ⚠️ 自前実装 | **Clerk** |
| テナント分離 | ✅ 自動 | ⚠️ アプリ層 | **Clerk** |
| 組織切り替え | ✅ UI提供 | ⚠️ 自前実装 | **Clerk** |
| | | | |
| **サブスクリプション** | | | |
| プラン管理 | 🟡 外部連携 | 🟡 外部連携 | 引き分け |
| Stripe統合 | 🟡 別途実装 | 🟡 別途実装 | 引き分け |
| 使用量制限 | 🟡 外部実装 | 🟡 外部実装 | 引き分け |
| | | | |
| **スケーラビリティ** | | | |
| 数千組織対応 | 🟡 可能 | ✅ **余裕** | **Cognito** |
| 10万ユーザー対応 | ✅ 可能 | ✅ **余裕** | 引き分け |
| グローバル展開 | 🟡 限定 | ✅ **全世界** | **Cognito** |
| | | | |
| **AWS統合** | | | |
| Lambda Authorizer | 🟡 JWT検証 | ✅ **直接統合** | **Cognito** |
| API Gateway | 🟡 手動設定 | ✅ **自動設定** | **Cognito** |
| IoT Core (WebSocket) | 🟡 カスタム | ✅ **Custom Auth** | **Cognito** |
| Step Functions | 🟡 外部 | ✅ **統合可** | **Cognito** |
| | | | |
| **コスト** | | | |
| 開発環境 | ~$25/月 | ~$0/月 | **Cognito** |
| 本番環境 (想定) | ~$500/月 | ~$50/月 | **Cognito** |

---

## Clerkからの移行戦略

### 移行シナリオ1: 段階的移行（推奨）

**概要**: 既存Clerkユーザーを段階的にCognitoへ移行

#### フェーズ1: 並行運用（1-2週間）

```typescript
// デュアル認証システム
class AuthService {
  async authenticate(token: string) {
    // 1. Clerk JWTを検証
    const clerkUser = await this.verifyClerkToken(token);
    if (clerkUser) {
      // Clerkユーザーを自動移行
      await this.migrateUserToCognito(clerkUser);
      return this.generateCognitoToken(clerkUser);
    }

    // 2. Cognito JWTを検証
    const cognitoUser = await this.verifyCognitoToken(token);
    return cognitoUser;
  }

  async migrateUserToCognito(clerkUser: ClerkUser) {
    // Cognitoユーザーが存在しない場合のみ作成
    const exists = await this.cognitoUserExists(clerkUser.email);
    if (!exists) {
      await cognito.adminCreateUser({
        UserPoolId: userPoolId,
        Username: clerkUser.email,
        UserAttributes: [
          { Name: 'email', Value: clerkUser.email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'custom:clerk_id', Value: clerkUser.id }, // 紐付け
          { Name: 'custom:org_id', Value: clerkUser.orgId },
          { Name: 'custom:role', Value: clerkUser.role },
        ],
        MessageAction: 'SUPPRESS', // メール送信しない
      });

      // Clerkのメタデータを移行
      await this.migrateUserMetadata(clerkUser);
    }
  }
}
```

#### フェーズ2: ユーザー通知・移行促進（2-4週間）

```typescript
// アプリ内通知
const MigrationBanner = () => {
  const { user } = useAuth();
  const isClerkUser = user?.custom?.clerk_id;

  if (!isClerkUser) return null;

  return (
    <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <InfoIcon className="h-5 w-5 text-blue-400" />
        </div>
        <div className="ml-3">
          <p className="text-sm text-blue-700">
            アカウント移行のお知らせ: より安全で高速な認証システムへの移行をお願いします。
          </p>
          <button
            onClick={handleMigration}
            className="mt-2 text-sm font-medium text-blue-700 underline"
          >
            今すぐ移行する（5分で完了）
          </button>
        </div>
      </div>
    </div>
  );
};
```

#### フェーズ3: 完全移行（4-8週間後）

- Clerk認証を完全に停止
- 未移行ユーザーへ最終通知
- データ整合性確認

---

### 移行シナリオ2: 一括移行

**概要**: メンテナンスウィンドウ中に一括移行

#### ステップ1: データエクスポート

```typescript
// Clerk APIからユーザーデータを一括取得
async function exportClerkUsers() {
  const users = await clerkClient.users.getUserList({
    limit: 500, // ページネーション
  });

  return users.map(user => ({
    email: user.emailAddresses[0].emailAddress,
    clerkId: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    organizationId: user.publicMetadata.organizationId,
    role: user.publicMetadata.role,
    createdAt: user.createdAt,
  }));
}
```

#### ステップ2: Cognito一括インポート

```typescript
// CSV生成 → Cognito User Import Job
async function createCognitoImportJob(users: ClerkUser[]) {
  // 1. CSVファイル生成
  const csv = users.map(user => ({
    name: user.email,
    email: user.email,
    email_verified: true,
    'custom:clerk_id': user.clerkId,
    'custom:org_id': user.organizationId,
    'custom:role': user.role,
  }));

  // 2. S3にアップロード
  await s3.putObject({
    Bucket: 'user-import-bucket',
    Key: 'users.csv',
    Body: generateCSV(csv),
  });

  // 3. Cognito User Import Job実行
  await cognito.createUserImportJob({
    JobName: 'ClerkMigration',
    UserPoolId: userPoolId,
    CloudWatchLogsRoleArn: roleArn,
  });
}
```

#### ステップ3: パスワード移行（オプション）

**注意**: Clerkはパスワードハッシュをエクスポートしないため、以下の方法が必要：

**方法A: パスワードリセット強制**

```typescript
// 全ユーザーにパスワード再設定メール送信
async function forcePasswordReset(users: CognitoUser[]) {
  for (const user of users) {
    await cognito.adminSetUserPassword({
      UserPoolId: userPoolId,
      Username: user.email,
      Password: generateTemporaryPassword(),
      Permanent: false, // 次回ログイン時に変更を強制
    });

    await sendPasswordResetEmail(user.email);
  }
}
```

**方法B: マジックリンク認証（推奨）**

```typescript
// 初回ログイン時にマジックリンクで認証
async function sendMagicLink(email: string) {
  const token = generateSecureToken();

  await db.magicLinks.create({
    email,
    token,
    expiresAt: Date.now() + 15 * 60 * 1000, // 15分
  });

  await sendEmail({
    to: email,
    subject: 'アカウント移行完了 - ログインしてください',
    body: `以下のリンクをクリックしてログインし、新しいパスワードを設定してください:\n${magicLinkUrl}`,
  });
}
```

---

## データマッピング

### Clerk → Cognito フィールドマッピング

| Clerk フィールド | Cognito フィールド | 備考 |
|-----------------|-------------------|------|
| `user.id` | `custom:clerk_id` | 紐付け用 |
| `user.emailAddresses[0]` | `email` | Username |
| `user.firstName` | `given_name` | 標準属性 |
| `user.lastName` | `family_name` | 標準属性 |
| `user.publicMetadata.organizationId` | `custom:org_id` | カスタム属性 |
| `user.publicMetadata.role` | `custom:role` | カスタム属性 |
| `user.createdAt` | `created_at` | タイムスタンプ |
| `organization.id` | `custom:org_id` | 組織ID |
| `organization.name` | DB: `organizations.name` | アプリ層で管理 |
| `organization.metadata` | DB: `organizations.settings_json` | アプリ層で管理 |

### 組織管理の実装差分

#### Clerk（ネイティブ機能）

```typescript
// Clerkの組織管理（自動）
const { organization } = useOrganization();
const { user } = useUser();

// 組織切り替え（UI自動提供）
<OrganizationSwitcher />

// 組織メンバー招待（自動メール送信）
await organization.inviteMember({ emailAddress: 'user@example.com' });
```

#### Cognito（自前実装）

```typescript
// Cognitoの組織管理（自前実装が必要）
const { user } = useAuth();
const orgId = user.attributes['custom:org_id'];
const role = user.attributes['custom:role'];

// 組織切り替え（自前UI）
<OrganizationSwitcher
  organizations={userOrganizations}
  onSwitch={async (orgId) => {
    await cognito.adminUpdateUserAttributes({
      UserPoolId: userPoolId,
      Username: user.username,
      UserAttributes: [{ Name: 'custom:org_id', Value: orgId }],
    });
    // トークン再取得が必要
  }}
/>

// 組織メンバー招待（自前実装）
async function inviteMember(email: string, orgId: string) {
  // 1. Cognitoユーザー作成
  await cognito.adminCreateUser({
    UserPoolId: userPoolId,
    Username: email,
    UserAttributes: [
      { Name: 'email', Value: email },
      { Name: 'custom:org_id', Value: orgId },
      { Name: 'custom:role', Value: 'client_user' },
    ],
  });

  // 2. 招待メール送信（自前）
  await sendInvitationEmail(email, orgId);

  // 3. DBに招待記録
  await db.invitations.create({ email, orgId, status: 'pending' });
}
```

**実装量の違い**:
- Clerk: 5行で完結（自動）
- Cognito: 50-100行の実装が必要（自前）

---

## 移行容易性の評価

### ✅ 移行が容易な要素

1. **ユーザーデータ**
   - メールアドレス、名前等の基本情報
   - メタデータ（publicMetadata → Custom Attributes）
   - 組織ID（Clerk organization → Cognito custom:org_id）

2. **認証フロー**
   - OAuth2/OIDCは標準プロトコル
   - JWT構造は類似（クレーム名が異なるのみ）
   - トークンリフレッシュロジックは同等

3. **SDK移行**
   - `useUser()` → `useAuth()`
   - `useOrganization()` → カスタムフック実装
   - API呼び出しは同等（JWT Bearerトークン）

### ⚠️ 移行が困難な要素

1. **パスワード**
   - Clerkはパスワードハッシュをエクスポートしない
   - 対策: パスワードリセット or マジックリンク認証

2. **組織管理UI**
   - ClerkのネイティブUIは使えない
   - 対策: 自前で組織切り替え・招待UIを実装（約1-2週間）

3. **セッション管理**
   - Clerkは自動セッション管理
   - Cognitoはリフレッシュトークン管理が必要

4. **Webhook**
   - Clerkのリアルタイムwebhook → CognitoはLambda Trigger
   - 対策: イベント処理ロジックの書き換え（約1週間）

### 推定移行工数

| タスク | 工数 | 難易度 |
|--------|------|--------|
| データエクスポート | 1日 | 低 |
| Cognitoユーザーインポート | 2-3日 | 中 |
| 認証フロー書き換え | 3-5日 | 中 |
| 組織管理UI実装 | 1-2週間 | 高 |
| テスト・デバッグ | 1週間 | 中 |
| 段階的移行期間 | 4-8週間 | 低 |
| **合計** | **約6-10週間** | |

---

## 推奨事項

### シナリオ別推奨

#### ケース1: 新規プロジェクト（Pranceは該当）

**推奨: Amazon Cognito** ✅

**理由**:
1. ✅ **AWSエコシステム統合** - Lambda, API Gateway, IoT Coreとシームレス
2. ✅ **コスト効率** - 大規模利用時に圧倒的に安い（10倍以上の差）
3. ✅ **スケーラビリティ** - 無制限、99.99% SLA、グローバル展開容易
4. ✅ **カスタマイズ性** - Lambda Triggerで柔軟なカスタムロジック
5. ✅ **エンタープライズ対応** - SAML SSO、高度なコンプライアンス
6. 🟡 **DX犠牲** - 開発初期は実装量が多い（組織管理UIなど）

**トレードオフ**:
- 組織管理UIの自前実装が必要（約1-2週間）
- Clerkより初期セットアップに時間がかかる（+1週間程度）

#### ケース2: 既存Clerkアプリの移行

**推奨: Clerkの継続利用** 🟡

**理由**:
1. ✅ 移行コスト削減（6-10週間の工数削減）
2. ✅ 組織管理機能がそのまま使える
3. ✅ 既存ユーザー体験の維持
4. 🔴 コストが高い（大規模時に顕著）
5. 🔴 AWS統合が弱い（追加実装必要）

**移行を検討すべきタイミング**:
- 月間アクティブユーザーが10万人を超えた時
- AWS統合の複雑さが限界に達した時
- エンタープライズ顧客からのコンプライアンス要求

#### ケース3: ハイブリッド（過渡期）

**推奨: デュアル認証システム** 🟡

**理由**:
1. ✅ 既存ユーザーを段階的に移行可能
2. ✅ リスク分散
3. 🔴 実装・運用の複雑さ（2つのシステム管理）
4. 🔴 一時的なコスト増加

---

## Pranceプラットフォームへの具体的影響

### Cognitoを選択した場合（現在の設計）

#### 追加実装が必要な機能

**1. 組織切り替えUI**（約1週間）

```typescript
// apps/web/components/OrganizationSwitcher.tsx
export function OrganizationSwitcher() {
  const { user, updateUser } = useAuth();
  const { data: organizations } = useUserOrganizations(user.id);

  const handleSwitch = async (orgId: string) => {
    // Cognitoカスタム属性更新
    await cognito.adminUpdateUserAttributes({
      UserPoolId: userPoolId,
      Username: user.username,
      UserAttributes: [{ Name: 'custom:org_id', Value: orgId }],
    });

    // トークン再取得
    await updateUser();

    // ページリロード
    window.location.reload();
  };

  return (
    <Select value={user.orgId} onValueChange={handleSwitch}>
      {organizations.map(org => (
        <SelectItem key={org.id} value={org.id}>
          {org.name}
        </SelectItem>
      ))}
    </Select>
  );
}
```

**2. 組織メンバー招待フロー**（約3-5日）

```typescript
// apps/api/lambda/invitations/create.ts
export const handler = async (event: APIGatewayEvent) => {
  const { email, orgId, role } = JSON.parse(event.body);

  // 1. Cognitoユーザー作成
  const user = await cognito.adminCreateUser({
    UserPoolId: process.env.USER_POOL_ID,
    Username: email,
    UserAttributes: [
      { Name: 'email', Value: email },
      { Name: 'email_verified', Value: 'true' },
      { Name: 'custom:org_id', Value: orgId },
      { Name: 'custom:role', Value: role },
    ],
    DesiredDeliveryMediums: ['EMAIL'],
  });

  // 2. DB記録
  await prisma.invitations.create({
    data: { email, orgId, role, status: 'sent' },
  });

  // 3. カスタム招待メール（Cognitoのデフォルトメールを上書き）
  await sendCustomInvitationEmail(email, orgId);

  return { statusCode: 200, body: JSON.stringify({ userId: user.User.Username }) };
};
```

**3. Lambda Trigger実装**（約2-3日）

```typescript
// infrastructure/lambda/cognito-triggers/pre-token-generation.ts
export const handler = async (event: PreTokenGenerationTriggerEvent) => {
  // カスタムクレームを追加
  event.response = {
    claimsOverrideDetails: {
      claimsToAddOrOverride: {
        org_id: event.request.userAttributes['custom:org_id'],
        role: event.request.userAttributes['custom:role'],
      },
    },
  };

  return event;
};
```

#### メリット（Cognito）

1. ✅ **Phase 0で既に構築済み** - インフラコード完成
2. ✅ **AWSエコシステム統合** - Lambda Authorizer自動設定済み
3. ✅ **コスト効率** - 月間10万ユーザーで約$50 (Clerkは$500)
4. ✅ **スケーラビリティ** - 数千組織対応が容易

#### デメリット（Cognito）

1. 🔴 **追加実装工数** - 組織管理UIで約1-2週間
2. 🔴 **DX劣化** - Clerkより実装量が多い
3. 🔴 **ローカル開発** - 本番Cognito環境が必要

---

### Clerkを選択した場合（変更案）

#### 変更が必要な箇所

**1. infrastructure/をClerk中心に書き換え**（約2週間）

```typescript
// 削除: CognitoStack, Lambda Authorizer
// 追加: Clerk JWT検証用Lambda Authorizer

// infrastructure/lib/api-gateway-stack.ts
const clerkAuthorizer = new apigateway.RequestAuthorizer(this, 'ClerkAuthorizer', {
  handler: clerkAuthorizerFunction,
  identitySources: ['method.request.header.Authorization'],
  resultsCacheTtl: cdk.Duration.minutes(5),
});
```

**2. 認証フロー書き換え**（約1週間）

```typescript
// apps/web/providers/auth-provider.tsx
import { ClerkProvider, useUser, useOrganization } from '@clerk/nextjs';

export function AuthProvider({ children }) {
  return (
    <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_KEY}>
      {children}
    </ClerkProvider>
  );
}
```

**3. CDKでCognito関連リソース削除**（約1日）

#### メリット（Clerk）

1. ✅ **開発速度向上** - 組織管理UIが不要（自動提供）
2. ✅ **DX優秀** - セットアップ10分、UIコンポーネント豊富
3. ✅ **既存アプリとの統合** - 既存Clerkアプリとシームレス連携

#### デメリット（Clerk）

1. 🔴 **Phase 0の作業が無駄** - CognitoStack全削除
2. 🔴 **コスト増** - 月間10万ユーザーで$500 (Cognitoは$50)
3. 🔴 **AWS統合弱い** - Lambda AuthorizerをカスタムJWT検証で実装必要
4. 🔴 **スケーラビリティ制限** - 大規模時にボトルネック

---

## 最終推奨

### Pranceプラットフォーム: **Amazon Cognito（現状維持）** ✅

**理由**:

1. ✅ **Phase 0完了済み** - 既に7スタック構築完了、作業の無駄を避ける
2. ✅ **長期的コスト効率** - 大規模時にCognito圧勝（10倍差）
3. ✅ **AWS統合** - Lambda, API Gateway, IoT Coreとシームレス
4. ✅ **エンタープライズ対応** - 無制限スケール、99.99% SLA
5. ✅ **技術スタック統一** - AWS一本化でインフラ管理が簡素化
6. 🟡 **追加実装** - 組織管理UI（1-2週間）は許容範囲

**追加実装タスク**（Phase 1で対応）:

```markdown
### Week 1-2: 認証・基本UI（既存計画に追加）

- [ ] Cognito認証フロー (サインアップ/ログイン/MFA)
- [ ] **組織切り替えUI** ← 追加（2-3日）
- [ ] **組織メンバー招待フロー** ← 追加（2-3日）
- [ ] ダッシュボード基本レイアウト
```

### 既存Clerkアプリからの移行

**段階的移行を推奨**:

1. **Phase 1-3** (3ヶ月): Clerkのまま開発継続
2. **Phase 4-5** (4-6ヶ月目): デュアル認証システム導入
3. **Phase 6** (7ヶ月目以降): 段階的に全ユーザー移行

**移行判断基準**:
- ✅ 月間10万ユーザー突破
- ✅ エンタープライズ顧客の増加
- ✅ AWS統合の複雑さが限界

---

## 結論

**Pranceプラットフォームは現在のAmazon Cognito設計を継続すべき** ✅

**既存Clerkアプリは将来的に段階的移行を検討** 🟡

組織管理UIの追加実装（1-2週間）は、長期的なコスト効率とスケーラビリティを考えると十分に価値がある投資です。

---

**作成者**: Claude Sonnet 4.5
**最終更新**: 2026-03-04
