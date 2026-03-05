# Prance Alpha開発 - セッション進捗まとめ

**最終更新:** 2026-03-05
**セッション:** Phase 0完了 + 認証機能実装完了 + 多言語対応実装（Phase 1開始）

---

## 📋 プロジェクト概要

**プロジェクト名:** Prance Communication Platform
**バージョン:** 0.1.0-alpha
**アーキテクチャ:** マルチテナント型SaaS、AWSサーバーレス
**主要技術:** Next.js 15, AWS Lambda, Aurora Serverless v2, Claude API

---

## ✅ 完了したセットアップ

### 1. 外部サービス設定

| サービス                 | ステータス | 詳細                                       |
| ------------------------ | ---------- | ------------------------------------------ |
| **AWS Bedrock (Claude)** | ✅ 完了    | Model ID: `us.anthropic.claude-sonnet-4-6` |
| **ElevenLabs (TTS)**     | ✅ 完了    | API Key設定済み                            |
| **Azure Speech (STT)**   | ✅ 完了    | API Key設定済み、リージョン: eastus        |
| **Ready Player Me**      | ⏸️ 保留    | Phase 1以降で設定予定                      |

**設定ファイル:** `/workspaces/prance-communication-platform/.env.local`

### 2. データベース設定

| 項目                 | 詳細                                                       |
| -------------------- | ---------------------------------------------------------- |
| **DBMS**             | PostgreSQL 15.17                                           |
| **稼働方法**         | Docker コンテナ                                            |
| **コンテナ名**       | `prance-postgres`                                          |
| **データベース名**   | `prance_dev`                                               |
| **接続情報**         | `postgresql://postgres:password@localhost:5432/prance_dev` |
| **Prisma**           | v5.22.0 (Client生成済み)                                   |
| **マイグレーション** | ✅ 実行済み（8テーブル作成）                               |

**作成されたテーブル:**

- organizations
- users (UserRole enum含む)
- avatars
- scenarios
- sessions
- recordings
- transcripts
- \_prisma_migrations

### 3. プロジェクト構造

```
prance-communication-platform/
├── .env.local                    # 環境変数（秘密情報含む、Git除外）
├── .env.example                  # 環境変数テンプレート
├── package.json                  # ルートパッケージ（workspace設定）
├── apps/
│   ├── web/                      # Next.js 15 ✅
│   │   ├── src/
│   │   │   └── app/              # App Router
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── api/                      # Lambda関数 (Phase 1以降)
├── packages/
│   ├── shared/                   # 共通型定義 ✅
│   │   ├── src/types/index.ts   # TypeScript型定義
│   │   └── src/index.ts
│   └── database/                 # Prisma設定 ✅
│       ├── prisma/
│       │   ├── schema.prisma    # データベーススキーマ（8モデル）
│       │   └── migrations/       # マイグレーション履歴
│       └── .env                  # Prisma用環境変数
├── infrastructure/               # AWS CDK ✅
│   ├── bin/
│   │   └── infrastructure.ts    # CDK App
│   ├── lib/                      # CDK Stacks
│   │   ├── network-stack.ts     # VPC、Subnets、Security Groups
│   │   ├── database-stack.ts    # Aurora Serverless v2
│   │   ├── storage-stack.ts     # S3、CloudFront
│   │   ├── dynamodb-stack.ts    # DynamoDB Tables
│   │   ├── cognito-stack.ts     # Cognito User Pool
│   │   ├── api-gateway-stack.ts # API Gateway、WebSocket
│   │   └── api-lambda-stack.ts  # Lambda Functions
│   ├── lambda/                   # Lambda関数実装 ✅
│   │   ├── health-check/
│   │   │   └── index.ts
│   │   ├── auth/
│   │   │   ├── authorizer/
│   │   │   │   └── index.ts     # JWT Authorizer
│   │   │   ├── register/
│   │   │   │   └── index.ts     # ユーザー登録
│   │   │   └── login/
│   │   │       └── index.ts     # ログイン
│   │   ├── users/
│   │   │   └── me/
│   │   │       └── index.ts     # 現在のユーザー情報取得
│   │   ├── migrations/
│   │   │   └── index.ts         # DBマイグレーション
│   │   └── shared/               # 共有ユーティリティ ✅
│   │       ├── auth/
│   │       │   ├── jwt.ts       # JWT生成/検証
│   │       │   └── password.ts  # パスワードハッシュ
│   │       ├── database/
│   │       │   └── prisma.ts    # Prismaクライアント
│   │       ├── utils/
│   │       │   ├── response.ts  # レスポンスハンドラー
│   │       │   └── validation.ts # バリデーション
│   │       └── types/
│   │           └── index.ts     # 共通型定義
│   ├── cdk.json
│   └── package.json
├── docs/                         # ドキュメント
│   ├── ALPHA_DEVELOPMENT.md
│   ├── AZURE_SETUP_CHECKLIST.md
│   └── EXTERNAL_TOOLS_SETUP.md
└── CLAUDE.md                     # プロジェクト企画書（v2.0）
```

---

## 🔧 環境状態

### Docker コンテナ

```bash
# PostgreSQL コンテナ確認
docker ps | grep prance-postgres

# 期待される出力:
# CONTAINER ID   IMAGE         STATUS         PORTS                    NAMES
# 75b79a6ad544   postgres:15   Up XX minutes  0.0.0.0:5432->5432/tcp   prance-postgres
```

### データベース接続テスト

```bash
# 接続確認
docker exec prance-postgres psql -U postgres -d prance_dev -c "SELECT version();"

# テーブル一覧
docker exec prance-postgres psql -U postgres -d prance_dev -c "\dt"
```

### 環境変数

**`.env.local`（プロジェクトルート）:**

- AWS_REGION=us-east-1
- BEDROCK_MODEL_ID=us.anthropic.claude-sonnet-4-6
- ELEVENLABS_API_KEY=sk_*** (設定済み)
- AZURE_SPEECH_KEY=*** (設定済み)
- AZURE_SPEECH_REGION=eastus
- DATABASE_URL="postgresql://postgres:password@localhost:5432/prance_dev"

**`packages/database/.env`（Prisma用）:**

- DATABASE_URL="postgresql://postgres:password@localhost:5432/prance_dev"

---

## 🎯 次回セッション開始時の確認事項

### 1. Docker コンテナ起動確認

```bash
# コンテナが起動しているか確認
docker ps | grep prance-postgres

# 停止している場合は起動
docker start prance-postgres
```

### 2. データベース接続確認

```bash
# 接続テスト
docker exec prance-postgres psql -U postgres -d prance_dev -c "SELECT COUNT(*) FROM users;"
```

### 3. AWS認証確認

```bash
# AWS認証情報確認
aws sts get-caller-identity

# 期待される出力:
# Account: 010438500933
# UserId: kenwakasa
```

---

## 📊 タスク進捗状況

| ID  | タスク                             | ステータス | 詳細                                   |
| --- | ---------------------------------- | ---------- | -------------------------------------- |
| #2  | Alpha版開発タスク管理セットアップ  | ✅ 完了    | TaskCreateで管理                       |
| #3  | プロジェクト構造の初期化           | ✅ 完了    | workspace設定、基本ディレクトリ        |
| #4  | TypeScript設定とLinter設定         | ✅ 完了    | 全プロジェクトで設定完了               |
| #5  | データベーススキーマ設計（Prisma） | ✅ 完了    | PostgreSQL + Prisma + マイグレーション |
| #6  | Next.js 15 プロジェクト初期化      | ✅ 完了    | App Router、Tailwind CSS設定完了       |
| #7  | AWS CDK プロジェクト初期化         | ✅ 完了    | 7スタック構築完了、CDK Synth成功       |
| #8  | 開発環境ドキュメント作成           | ✅ 完了    | infrastructure/README.md作成完了       |
| #9  | AWS環境デプロイ（全7スタック）     | ✅ 完了    | Network、Database、Storage、API等      |
| #10 | Lambda Authorizer実装              | ✅ 完了    | JWT認証、環境変数設定                  |
| #11 | 認証API実装                        | ✅ 完了    | Register、Login、/users/me             |
| #12 | 認証フロー動作確認                 | ✅ 完了    | 登録→ログイン→認証済みAPI正常動作      |

---

## 🎉 Phase 0: インフラ基盤構築（完了）

### 完了した作業

**Week 1: コアインフラ** ✅
- [x] AWS CDKプロジェクト初期化
- [x] Network Stack: VPC、Subnets、NAT Gateway、VPC Endpoints、Security Groups
- [x] Cognito Stack: User Pool、Custom Attributes、Password Policy、OAuth
- [x] Database Stack: Aurora Serverless v2 (PostgreSQL 15.4)、Auto Scaling、Secrets Manager
- [x] Storage Stack: S3 Buckets (Recordings/Avatars)、CloudFront CDN、Lifecycle Policies
- [x] DynamoDB Stack: 4テーブル（Sessions State、WebSocket、Benchmark Cache、Rate Limit）

**Week 2: API基盤** ✅
- [x] API Gateway Stack: REST API、WebSocket API、Cognito Authorizer、CloudWatch Logs
- [x] Lambda Stack: Health Check関数、ARM64 (Graviton2)、X-Ray Tracing
- [x] Lambda関数実装: health-check/index.ts
- [x] TypeScript設定: 厳密な型チェック、ESLint、Prettier
- [x] CDK Synth成功: 7スタック生成
- [x] 包括的ドキュメント: infrastructure/README.md

**追加実装（2026-03-05）** ✅
- [x] Lambda Authorizer実装: JWT Token検証、IAMポリシー生成
- [x] 認証Lambda関数実装: Register、Login、GetCurrentUser
- [x] 共有ユーティリティ実装: JWT生成/検証、パスワードハッシュ、レスポンスハンドラー
- [x] Prismaクライアント統合: Lambda関数からのDB接続
- [x] 環境変数設定: JWT_SECRET、DATABASE_URL、LOG_LEVEL
- [x] 全スタックAWSデプロイ: 7スタック正常デプロイ完了

### 成果物

- ✅ インフラコードリポジトリ (AWS CDK TypeScript)
- ✅ 7つのCloudFormationスタック (cdk.out/ ディレクトリ)
- ✅ ドキュメント完備 (README.md)
- ✅ **稼働中のAWS環境** (us-east-1リージョン)
- ✅ **動作確認済みの認証API** (Register、Login、/users/me)

---

## 🔐 実装済み認証システム（2026-03-05）

### Lambda関数構成

| 関数名                     | 用途                         | VPC接続 | メモリ | タイムアウト |
| -------------------------- | ---------------------------- | ------- | ------ | ------------ |
| `prance-authorizer-dev`    | JWT Token検証、認可          | なし    | 256MB  | 10秒         |
| `prance-auth-register-dev` | ユーザー登録、組織作成       | あり    | 512MB  | 30秒         |
| `prance-auth-login-dev`    | ユーザーログイン、JWT発行    | あり    | 512MB  | 30秒         |
| `prance-users-me-dev`      | 現在のユーザー情報取得       | あり    | 512MB  | 30秒         |
| `prance-health-check-dev`  | ヘルスチェック               | なし    | 256MB  | 30秒         |
| `prance-db-migration-dev`  | データベースマイグレーション | あり    | 1024MB | 300秒        |

### API エンドポイント

**ベースURL:** `https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/`

| メソッド | エンドポイント               | 認証 | 説明                         |
| -------- | ---------------------------- | ---- | ---------------------------- |
| GET      | `/api/v1/health`             | 不要 | ヘルスチェック               |
| POST     | `/api/v1/auth/register`      | 不要 | ユーザー登録                 |
| POST     | `/api/v1/auth/login`         | 不要 | ログイン、JWT取得            |
| GET      | `/api/v1/users/me`           | 必要 | 現在のユーザー情報取得       |

### 認証フロー

```
1. ユーザー登録
   POST /api/v1/auth/register
   {
     "email": "user@example.com",
     "password": "SecurePass123",
     "name": "User Name",
     "organizationName": "Org Name"  // オプション
   }

   → 組織作成（新規の場合）
   → ユーザー作成（CLIENT_ADMIN）
   → JWT Token発行
   → Response: { user, tokens: { accessToken, refreshToken, expiresIn } }

2. ログイン
   POST /api/v1/auth/login
   {
     "email": "user@example.com",
     "password": "SecurePass123"
   }

   → パスワード検証（bcrypt）
   → JWT Token発行
   → Response: { user, tokens }

3. 認証済みAPI呼び出し
   GET /api/v1/users/me
   Headers: {
     "Authorization": "Bearer <accessToken>"
   }

   → Lambda Authorizer: JWT検証
   → Lambda Authorizer: IAMポリシー生成（Allow/Deny）
   → API Gateway: ポリシー評価
   → Lambda Function: ユーザー情報取得
   → Response: { id, email, name, role, organizationId, organization }
```

### JWT仕様

**Access Token:**
- 有効期限: 24時間
- ペイロード: `{ userId, email, role, organizationId }`
- アルゴリズム: HS256
- シークレット: 環境変数 `JWT_SECRET`

**Refresh Token:**
- 有効期限: 7日間
- 同じペイロード
- 将来的にトークンリフレッシュエンドポイント実装予定

### 環境変数設定

**全Lambda関数共通（共通環境変数）:**
```bash
ENVIRONMENT=dev
LOG_LEVEL=DEBUG
NODE_ENV=development
DATABASE_URL=postgresql://...（Secrets Manager参照）
JWT_SECRET=development-secret-change-in-production
```

**注意事項:**
- JWT_SECRETは全認証関連Lambda関数で統一
- 本番環境ではAWS Secrets Managerから取得
- CDKデプロイ時に自動設定

### 動作確認済みシナリオ

✅ **シナリオ1: 新規ユーザー登録**
```bash
curl -X POST "$API_URL/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123","name":"Test User"}'

→ 成功: 組織作成、ユーザー作成、JWT発行
```

✅ **シナリオ2: ログイン**
```bash
curl -X POST "$API_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123"}'

→ 成功: パスワード検証、JWT発行
```

✅ **シナリオ3: 認証済みAPI呼び出し**
```bash
curl -X GET "$API_URL/api/v1/users/me" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

→ 成功: JWT検証、ユーザー情報取得
```

✅ **シナリオ4: 無効なトークンでの呼び出し**
```bash
curl -X GET "$API_URL/api/v1/users/me" \
  -H "Authorization: Bearer invalid_token"

→ 失敗: 401 Unauthorized
```

### トラブルシューティング履歴

**問題1: JWT_SECRET不一致**
- 症状: Authorizerでトークン検証失敗
- 原因: Register/Login関数でJWT_SECRET環境変数未設定
- 解決: CDK再デプロイで環境変数自動設定

**問題2: Prismaフィールド名不一致**
- 症状: Prismaクエリで`organizationId`フィールドエラー
- 原因: DBスキーマは`orgId`、APIレスポンスは`organizationId`
- 解決: Prismaクエリで`orgId`使用、レスポンスで`organizationId`にマッピング

**問題3: Lambda Authorizer context未使用**
- 症状: 認証済みエンドポイントでユーザー情報取得失敗
- 原因: `event.requestContext.authorizer`からユーザー情報取得していない
- 解決: `getUserFromEvent`関数でAuthorizer contextを優先的に確認

---

## 🚀 次のステップ（Phase 1: MVP開発）

**Phase 0完了により、以下が実現:**
- ✅ AWSインフラ基盤構築完了
- ✅ 認証システム動作確認済み
- ✅ API Gatewayと Lambda関数の連携確認済み

**Phase 1の選択肢:**

### Option A: フロントエンド開発開始（推奨）★

Next.js開発環境を整備して、ユーザーがブラウザで操作できるようにします。

**実装内容（Week 1-2の残り）:**

1. **Next.js開発サーバー起動とAWS連携**
   ```bash
   cd apps/web

   # 環境変数設定
   cat > .env.local << EOF
   NEXT_PUBLIC_API_URL=https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev
   NEXT_PUBLIC_WS_URL=wss://bu179h4agh.execute-api.us-east-1.amazonaws.com/dev
   EOF

   # 開発サーバー起動
   npm run dev
   ```

2. **認証フロー実装**
   - ログイン画面 (`/login`)
   - 新規登録画面 (`/register`)
   - 認証状態管理（Zustand or TanStack Query）
   - JWT Token保存（localStorage or Cookie）

3. **ダッシュボード基本レイアウト**
   - ヘッダー（ユーザー情報、ログアウト）
   - サイドバーナビゲーション
   - ホーム画面

**成果物:**
- ✅ ブラウザでログイン → ダッシュボード表示
- ✅ フロントエンド ↔ バックエンド連携確認
- ✅ 全体のUX/UIフロー確認

---

## 🌐 Phase 1開始: 多言語対応実装（2026-03-05）

### 実装完了した機能

#### 1. Next.js Middleware - 言語検出システム

**ファイル:** `apps/web/middleware.ts`

**実装内容:**
- Cookie-based言語管理（ロケールプレフィックスなしURL設計）
- URLパラメータによる言語切り替え機能
- Accept-Languageヘッダーからの自動検出
- デフォルト言語へのフォールバック

**言語検出の優先順位:**
```
1. URL parameter (?lang=en, ?lang=ja, etc.)
   → Cookieに保存 + パラメータ削除してリダイレクト
2. Cookie (NEXT_LOCALE)
3. Accept-Language ヘッダー（ブラウザ設定）
4. デフォルト言語 (en)
```

**URL設計:**
```
✅ 全言語で共通URL:
   /dashboard, /login, /sessions

❌ ロケールプレフィックスなし:
   /en/dashboard, /ja/dashboard は使用しない
```

**主要実装:**
```typescript
export function middleware(request: NextRequest) {
  const { searchParams, pathname } = new URL(request.url);
  const langParam = searchParams.get('lang');

  // 1. URL parameter 'lang' (highest priority)
  if (langParam && supportedLocales.includes(langParam)) {
    searchParams.delete('lang');
    const cleanUrl = new URL(pathname + ..., request.url);

    const response = NextResponse.redirect(cleanUrl);
    response.cookies.set('NEXT_LOCALE', langParam, {
      path: '/',
      maxAge: 31536000, // 1年
      sameSite: 'lax',
      httpOnly: false,
    });
    return response;
  }

  // 2. Get language from Cookie
  let locale = request.cookies.get('NEXT_LOCALE')?.value;

  // 3. Detect from Accept-Language header
  if (!locale || !supportedLocales.includes(locale)) {
    const acceptLanguage = request.headers.get('accept-language');
    locale = detectLanguageFromHeader(acceptLanguage);
  }

  // 4. Add language to request headers
  requestHeaders.set('x-locale', locale);

  // 5. Save language to Cookie (first-time visitors)
  if (!request.cookies.get('NEXT_LOCALE')) {
    response.cookies.set('NEXT_LOCALE', locale, { ... });
  }

  return response;
}
```

**テスト結果:**
```bash
# URLパラメータでの切り替え
curl 'http://localhost:3001/?lang=en'
→ 307 Redirect to /
→ Set-Cookie: NEXT_LOCALE=en
→ <html lang="en">

curl 'http://localhost:3001/?lang=ja'
→ 307 Redirect to /
→ Set-Cookie: NEXT_LOCALE=ja
→ <html lang="ja">

curl 'http://localhost:3001/?lang=zh-CN'
→ 307 Redirect to /
→ Set-Cookie: NEXT_LOCALE=zh-CN
→ <html lang="zh-CN">

# Cookie保持による自動切り替え
2回目のアクセス（Cookie保持）
→ 自動的に保存された言語で表示

# Accept-Language検出
curl -H 'Accept-Language: ja,en;q=0.9'
→ <html lang="ja">

curl -H 'Accept-Language: fr,en;q=0.9'
→ <html lang="fr">
```

#### 2. RootLayout - 動的lang属性

**ファイル:** `apps/web/app/layout.tsx`

**実装内容:**
- MiddlewareからのHTTPヘッダー `x-locale` を取得
- HTMLの`lang`属性を動的に設定（SEO・アクセシビリティ対応）

**コード:**
```typescript
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const locale = headersList.get('x-locale') || 'en';

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={inter.className}>
        <AuthProvider>
          <div className="relative flex min-h-screen flex-col">
            <main className="flex-1">{children}</main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
```

#### 3. サポート言語

現在サポートされている言語（`middleware.ts`で定義）:
- 🇺🇸 英語（en）- デフォルト
- 🇯🇵 日本語（ja）
- 🇨🇳 中国語簡体字（zh-CN）
- 🇰🇷 韓国語（ko）
- 🇪🇸 スペイン語（es）
- 🇫🇷 フランス語（fr）
- 🇩🇪 ドイツ語（de）

#### 4. Cookie仕様

```typescript
{
  name: 'NEXT_LOCALE',
  value: 'en' | 'ja' | 'zh-CN' | 'ko' | 'es' | 'fr' | 'de',
  path: '/',
  maxAge: 31536000,  // 1年
  sameSite: 'lax',   // CSRF対策
  httpOnly: false,   // JavaScript アクセス許可（言語切り替えUI用）
}
```

### 更新されたドキュメント

1. **docs/modules/MULTILINGUAL_SYSTEM.md** (v2.0 → v2.1)
   - 「実装状況（Phase 1）」セクション追加
   - middleware.tsの実装詳細を記録
   - layout.tsxの動的lang属性を記録
   - テスト結果を記録

2. **CLAUDE.md** (v2.0)
   - 「多言語対応」セクションに設計方針を追加
   - URL設計の明確化
   - 言語検出ロジックの優先順位を記載

### 次のステップ（Phase 1 - 多言語対応）

現在、言語検出とCookie管理は完了していますが、実際のテキスト翻訳はまだ実装されていません。

#### 未実装の機能:

1. **I18nプロバイダー実装**
   - 言語リソースファイル（JSON）からテキストを読み込むシステム
   - `useI18n()` フック、`t()` 関数の実装
   - パラメータ置換機能（例: `t('welcome', { name: 'John' })`）

2. **言語リソースファイル作成**
   - `messages/en.json`, `messages/ja.json` 等
   - 各ページ・コンポーネントの翻訳キー定義
   - 共通UI要素の翻訳（ボタン、エラーメッセージ等）

3. **LanguageSwitcherコンポーネント**
   - ヘッダーに配置する言語切り替えUI
   - ドロップダウンまたはフラグアイコン選択
   - 選択時にCookie更新 + ページリロード

4. **既存ページの多言語化**
   - ハードコードされたテキストをI18nキーに置き換え
   - `/login`, `/register`, `/dashboard` 等
   - 全UIテキストを翻訳可能にする

5. **ホットデプロイシステム（Phase 2以降）**
   - スーパー管理者UIからの言語リソースアップロード
   - S3 + CloudFrontへのデプロイ
   - キャッシュ無効化

### 技術的メモ

**Accept-Language検出ロジック:**
```typescript
function detectLanguageFromHeader(acceptLanguage: string | null): string {
  // 例: "ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7"
  // → 品質値で降順ソート
  // → サポート言語の中から最優先を選択
  // → 見つからない場合はデフォルト（en）
}
```

**Middleware Matcher設定:**
```typescript
export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
```
- APIルート、Next.js内部ファイル、静的ファイルを除外
- すべてのページリクエストでMiddlewareが実行される

**開発サーバー:**
- ポート: 3001 (ポート3000使用中のため)
- Turbopackモード有効
- ホットリロード対応

---

### Option B: アバター・会話エンジン実装

バックエンド中心で、コアとなる会話機能を先に作ります。

**実装内容（Week 3-4タスク）:**

1. **3Dアバター実装**
   - Three.js + React Three Fiber セットアップ
   - Ready Player Me統合（APIキー取得）
   - プリセットアバター表示機能
   - リップシンク基盤（ARKit Blendshapes）

2. **Claude API統合（会話エンジン）**
   ```bash
   cd infrastructure/lambda
   mkdir -p conversation/{session,chat}

   # 実装:
   # - AWS Bedrockとの連携
   # - システムプロンプト生成ロジック
   # - シナリオ → 会話フロー変換
   ```

3. **シナリオ管理API**
   - シナリオCRUD（Create, Read, Update, Delete）
   - シナリオテンプレート機能
   - シナリオビルダーUI（基本版）

**成果物:**
- ✅ AIアバター会話のプロトタイプ
- ✅ 技術的な難易度の高い部分の解決
- ✅ コア機能の早期確立

---

### Option C: 音声・セッション実行

リアルタイム会話機能の実装を開始します。

**実装内容（Week 5-6タスク）:**

1. **音声処理統合**
   - ElevenLabs TTS統合
   - Azure STT リアルタイム音声認識
   - WebSocket通信（AWS IoT Core）

2. **セッション実行フロー**
   - セッション開始/終了API
   - ブラウザ録画（MediaRecorder API）
   - S3アップロード（署名付きURL）

3. **基本トランスクリプト生成**
   - 音声認識結果の保存
   - タイムスタンプ付きトランスクリプト

**成果物:**
- ✅ リアルタイム会話セッション実行
- ✅ 録画・トランスクリプトの基本機能

---

### 推奨順序

**Phase 1全体を効率的に進めるための推奨順序:**

```
1. Option A: フロントエンド開発開始（1-2週間）
   └─ ユーザーがブラウザで操作できる基盤

2. Option B: アバター・会話エンジン（2-3週間）
   └─ コア機能の実装

3. Option C: 音声・セッション実行（2-3週間）
   └─ リアルタイム会話機能の完成

合計: 5-8週間でPhase 1（MVP）完成
```

**どれから始めますか？**

---

## ⚠️ 重要な注意事項

### 1. 本番環境との互換性

✅ **互換性確認済み:**

- PostgreSQL 15.17 → Aurora Serverless v2（完全互換）
- Prisma 5.22.0 → Aurora（完全互換）

⚠️ **Phase 0で対応必要:**

- AWS RDS Proxy設定（コネクションプーリング）
- CLAUDE.mdの「Prisma Data Proxy」記述修正（廃止済みサービス）

### 2. Git管理

**Git除外済み:**

- `.env.local`（秘密情報）
- `packages/database/.env`
- `node_modules/`

**Git管理対象:**

- `.env.example`（テンプレート）
- `prisma/schema.prisma`
- `prisma/migrations/`（マイグレーション履歴）

### 3. セキュリティ

🔒 **APIキーが設定済みのため、以下に注意:**

- `.env.local`を絶対にGitにコミットしない
- コード共有時は環境変数をマスク
- 本番環境ではAWS Secrets Managerを使用

---

## 📚 参考ドキュメント

| ドキュメント       | パス                            | 説明                           |
| ------------------ | ------------------------------- | ------------------------------ |
| プロジェクト企画書 | `CLAUDE.md`                     | v2.0、全体設計・アーキテクチャ |
| Alpha開発計画      | `docs/ALPHA_DEVELOPMENT.md`     | Phase 1-6実装計画              |
| Azure設定          | `docs/AZURE_SETUP_CHECKLIST.md` | Azure Speech Services設定手順  |
| 外部ツール設定     | `docs/EXTERNAL_TOOLS_SETUP.md`  | AWS Bedrock、ElevenLabs等      |

---

## 🔄 よくある操作コマンド

### データベース操作

```bash
# Prisma Client再生成
npm run db:generate

# マイグレーション実行
npm run db:migrate

# Prisma Studio起動（GUI）
npm run db:studio

# データベース接続確認
docker exec prance-postgres psql -U postgres -d prance_dev
```

### Docker操作

```bash
# PostgreSQL起動
docker start prance-postgres

# PostgreSQL停止
docker stop prance-postgres

# ログ確認
docker logs prance-postgres

# コンテナ削除（データも削除）
docker rm -f prance-postgres
```

### AWS操作

```bash
# 認証確認
aws sts get-caller-identity

# デプロイ済みスタック一覧
aws cloudformation list-stacks \
  --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE \
  --query 'StackSummaries[?contains(StackName, `Prance-dev`)].StackName'

# Lambda関数一覧
aws lambda list-functions \
  --query 'Functions[?contains(FunctionName, `prance`)].FunctionName'

# API Gateway情報
aws apigateway get-rest-apis \
  --query 'items[?name==`prance-api-dev`].[id,name]'

# Lambda関数環境変数確認
aws lambda get-function-configuration \
  --function-name prance-auth-register-dev \
  --query 'Environment.Variables'

# Lambda関数ログ確認（直近10分）
aws logs tail /aws/lambda/prance-auth-register-dev --since 10m

# 認証APIテスト
API_URL="https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev"

# ユーザー登録
curl -X POST "$API_URL/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123","name":"Test User"}'

# ログイン
curl -X POST "$API_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123"}'

# 認証済みAPI呼び出し
TOKEN="<your_access_token>"
curl -X GET "$API_URL/api/v1/users/me" \
  -H "Authorization: Bearer $TOKEN"

# Bedrock利用可能モデル一覧
aws bedrock list-foundation-models --region us-east-1 --query 'modelSummaries[?contains(modelId, `claude`)].modelId'

# Bedrockテスト実行
aws bedrock-runtime invoke-model \
  --model-id us.anthropic.claude-sonnet-4-6 \
  --region us-east-1 \
  --body '{"anthropic_version":"bedrock-2023-05-31","max_tokens":100,"messages":[{"role":"user","content":"Hello"}]}' \
  /tmp/response.json
```

---

## 🆘 トラブルシューティング

### PostgreSQLに接続できない

```bash
# 1. コンテナ起動確認
docker ps | grep prance-postgres

# 2. 停止している場合は起動
docker start prance-postgres

# 3. それでも接続できない場合は再作成
docker rm -f prance-postgres
docker run -d \
  --name prance-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=prance_dev \
  -p 5432:5432 \
  postgres:15
```

### Prisma Clientが見つからない

```bash
# 再生成
npm run db:generate
```

### AWS認証エラー

```bash
# 認証情報確認
aws configure list

# 再認証が必要な場合
aws configure
```

### Lambda関数のJWT_SECRET不一致（解決済み）

**症状:** Lambda Authorizerでトークン検証失敗、401 Unauthorized

**原因:** Register/Login関数でJWT_SECRET環境変数が設定されていない

**解決方法:**
```bash
cd infrastructure

# 正しいコマンドでデプロイ
npm run cdk -- deploy Prance-dev-ApiLambda --require-approval never

# 環境変数確認
aws lambda get-function-configuration \
  --function-name prance-auth-register-dev \
  --query 'Environment.Variables.JWT_SECRET'
```

**重要:** CDKコードは正しく設定されている。`--all`と特定スタック名の併用は不可。

### Prisma "Unknown field" エラー（解決済み）

**症状:** `Unknown field 'organizationId' for select statement on model 'User'`

**原因:** Prismaスキーマは`orgId`、APIレスポンスは`organizationId`

**解決方法:**
```typescript
// Prismaクエリでは orgId を使用
const user = await prisma.user.findUnique({
  where: { email },
  select: {
    id: true,
    email: true,
    orgId: true,  // ← orgId
    // ...
  },
});

// レスポンスで organizationId にマッピング
return successResponse({
  id: user.id,
  email: user.email,
  organizationId: user.orgId,  // ← マッピング
});
```

### Lambda Authorizer contextが使われない（解決済み）

**症状:** 認証済みエンドポイントでユーザー情報が取得できない

**原因:** `event.requestContext.authorizer`からユーザー情報を取得していない

**解決方法:**
```typescript
// lambda/shared/auth/jwt.ts
export const getUserFromEvent = (event) => {
  // Lambda Authorizerがある場合は、そこからユーザー情報を取得
  if (event.requestContext?.authorizer) {
    const auth = event.requestContext.authorizer;
    if (auth.userId && auth.email && auth.role && auth.organizationId) {
      return {
        userId: auth.userId,
        email: auth.email,
        role: auth.role,
        organizationId: auth.organizationId,
      };
    }
  }

  // フォールバック: ヘッダーから直接トークンを検証
  const authHeader = event.headers['Authorization'] || event.headers['authorization'];
  const token = extractTokenFromHeader(authHeader);
  return verifyToken(token);
};
```

---

## 📝 メモ

### 現在のステータス（2026-03-05）

- ✅ **Phase 0完了**: インフラ基盤構築完了、AWSにデプロイ済み
- ✅ **認証システム稼働中**: Register、Login、認証済みAPI動作確認済み
- ✅ **AWS環境稼働中**: us-east-1リージョンで7スタック稼働
- 🚀 **Phase 1開始準備完了**: MVP開発を開始できる状態

### 開発環境構成

- **ローカル開発**: Docker PostgreSQL（prance-postgres）
- **本番環境**: AWSサーバーレス（7スタックデプロイ済み）
- **認証**: JWT Token（24時間有効）
- **API Base URL**: `https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/`

### 次回セッション開始時の確認

1. **Docker起動確認**
   ```bash
   docker ps | grep prance-postgres
   docker start prance-postgres  # 必要な場合
   ```

2. **AWS認証確認**
   ```bash
   aws sts get-caller-identity
   ```

3. **API動作確認**
   ```bash
   curl https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1/health
   ```

4. **Phase 1の方向性決定**
   - Option A: フロントエンド開発（推奨）
   - Option B: アバター・会話エンジン
   - Option C: 音声・セッション実行

---

**このドキュメントは次回セッション開始時に最初に確認してください。**
