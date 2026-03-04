# プロジェクト構造

Claude Codeでの並行開発を前提とした、モジュール分離されたMonorepo構成。

## ディレクトリ構造

```
prance-communication-platform/
├── .github/
│   └── workflows/              # CI/CD パイプライン
│       ├── ci.yml              # PR時: Lint + Test
│       ├── deploy-staging.yml  # mainマージ時: ステージングデプロイ
│       └── deploy-production.yml # タグ時: プロダクションデプロイ
│
├── apps/
│   ├── web/                    # Next.js 15 フロントエンド
│   │   ├── app/                # App Router
│   │   │   ├── [locale]/      # 多言語対応
│   │   │   │   ├── (auth)/    # 認証ページ
│   │   │   │   ├── (dashboard)/ # メインアプリ
│   │   │   │   ├── session/   # セッション実行
│   │   │   │   ├── admin/     # 管理画面
│   │   │   │   └── super-admin/ # スーパー管理者
│   │   │   └── api/            # API Routes (Next.js API)
│   │   ├── components/         # Reactコンポーネント
│   │   │   ├── avatar/         # アバター関連
│   │   │   ├── session/        # セッション関連
│   │   │   ├── player/         # 再生プレイヤー
│   │   │   ├── admin/          # 管理画面
│   │   │   └── ui/             # shadcn/ui
│   │   ├── lib/                # ユーティリティ
│   │   │   ├── auth/           # 認証ロジック
│   │   │   ├── avatar/         # アバター制御
│   │   │   ├── recording/      # 録画ロジック
│   │   │   └── api/            # APIクライアント
│   │   ├── locales/            # 多言語翻訳ファイル
│   │   │   ├── ja/
│   │   │   └── en/
│   │   ├── public/             # 静的ファイル
│   │   └── package.json
│   │
│   ├── api/                    # NestJS バックエンド（Lambda）
│   │   ├── src/
│   │   │   ├── auth/           # 認証モジュール
│   │   │   ├── users/          # ユーザー管理
│   │   │   ├── avatars/        # アバター管理
│   │   │   ├── voices/         # 音声管理
│   │   │   ├── scenarios/      # シナリオ管理
│   │   │   ├── sessions/       # セッション管理
│   │   │   ├── transcripts/    # トランスクリプト
│   │   │   ├── reports/        # レポート
│   │   │   ├── conversation/   # 会話AI
│   │   │   ├── voice/          # TTS/STT
│   │   │   │   ├── tts/
│   │   │   │   └── stt/
│   │   │   ├── analysis/       # 感情・音声解析
│   │   │   ├── benchmark/      # ベンチマーク
│   │   │   ├── billing/        # プラン・課金
│   │   │   ├── api-keys/       # APIキー管理
│   │   │   ├── ats/            # ATS連携
│   │   │   ├── plugins/        # プラグイン管理
│   │   │   ├── prompts/        # プロンプト管理
│   │   │   ├── providers/      # AIプロバイダ管理
│   │   │   ├── websocket/      # WebSocket
│   │   │   ├── i18n/           # 多言語
│   │   │   └── common/         # 共通ユーティリティ
│   │   ├── test/               # E2Eテスト
│   │   └── package.json
│   │
│   └── workers/                # バックグラウンドワーカー（Lambda）
│       ├── src/
│       │   ├── functions/      # 個別Lambda関数
│       │   │   ├── tts-worker.ts
│       │   │   ├── video-composer.ts
│       │   │   ├── emotion-analyzer.ts
│       │   │   ├── audio-analyzer.ts
│       │   │   ├── report-generator.ts
│       │   │   ├── pdf-generator.ts
│       │   │   ├── benchmark-aggregator.ts
│       │   │   └── avatar-generator.ts
│       │   └── workflows/      # Step Functions定義
│       │       └── session-processing.asl.json
│       └── package.json
│
├── packages/                   # 共有パッケージ
│   ├── shared/                 # 共有ライブラリ
│   │   ├── src/
│   │   │   ├── types/          # 共通型定義
│   │   │   ├── constants/      # 定数
│   │   │   ├── utils/          # ユーティリティ
│   │   │   ├── providers/      # AIプロバイダ抽象化
│   │   │   │   ├── ai-provider.interface.ts
│   │   │   │   ├── claude-adapter.ts
│   │   │   │   ├── openai-adapter.ts
│   │   │   │   └── gemini-adapter.ts
│   │   │   └── ats/            # ATS抽象化
│   │   │       ├── ats-adapter.interface.ts
│   │   │       ├── greenhouse-adapter.ts
│   │   │       ├── lever-adapter.ts
│   │   │       └── workday-adapter.ts
│   │   └── package.json
│   │
│   ├── database/               # Prisma
│   │   ├── prisma/
│   │   │   ├── schema.prisma   # スキーマ定義
│   │   │   ├── migrations/     # マイグレーション
│   │   │   └── seed.ts         # Seedデータ
│   │   └── package.json
│   │
│   └── plugins/                # プラグインSDK
│       ├── src/
│       │   ├── plugin.interface.ts
│       │   ├── plugin-context.ts
│       │   └── extension-points.ts
│       └── package.json
│
├── plugins/                    # 公式プラグイン
│   ├── greenhouse/
│   │   ├── plugin.yaml
│   │   ├── src/
│   │   │   └── index.ts
│   │   └── package.json
│   ├── hrmos/
│   └── jobkan/
│
├── infrastructure/             # AWS CDK
│   ├── bin/
│   │   └── app.ts              # CDKアプリエントリーポイント
│   ├── lib/
│   │   ├── network-stack.ts    # VPC, Subnet, SG
│   │   ├── database-stack.ts   # Aurora, DynamoDB
│   │   ├── storage-stack.ts    # S3, CloudFront
│   │   ├── auth-stack.ts       # Cognito
│   │   ├── api-stack.ts        # API Gateway, Lambda
│   │   ├── workflow-stack.ts   # Step Functions, EventBridge
│   │   └── monitoring-stack.ts # CloudWatch, X-Ray
│   ├── config/
│   │   ├── dev.ts
│   │   ├── staging.ts
│   │   └── production.ts
│   └── package.json
│
├── scripts/                    # デプロイ・ユーティリティスクリプト
│   ├── deploy.sh               # ワンクリックデプロイ
│   ├── rollback.sh             # ロールバック
│   ├── setup-dev.sh            # 開発環境セットアップ
│   ├── db-migrate.sh           # DBマイグレーション
│   └── seed-data.sh            # Seedデータ投入
│
├── docs/                       # ドキュメント
│   ├── IMPLEMENTATION_PLAN.md  # 実装プラン
│   ├── PROJECT_STRUCTURE.md    # このファイル
│   ├── ARCHITECTURE.md         # アーキテクチャ
│   ├── DATABASE_DESIGN.md      # DB設計
│   ├── API_SPECIFICATION.md    # API仕様
│   ├── DEPLOYMENT.md           # デプロイ手順
│   ├── DEVELOPMENT_GUIDE.md    # 開発ガイド
│   ├── CICD.md                 # CI/CDガイド
│   ├── BUSINESS_OVERVIEW.md    # ビジネス概要
│   ├── PRODUCT_REQUIREMENTS.md # 製品要件
│   └── USER_STORIES.md         # ユーザーストーリー
│
├── .devcontainer/              # Dev Container設定
│   └── devcontainer.json
├── .env.example                # 環境変数テンプレート
├── .gitignore
├── turbo.json                  # Turborepo設定
├── package.json                # ルートpackage.json
├── tsconfig.json               # ルートTypeScript設定
├── CLAUDE.md                   # プロジェクト企画書
└── README.md                   # このファイル
```

---

## モジュール分離の原則

### 1. 機能ごとの独立性

各モジュールは以下の基準で分離：

- **単一責任**: 1モジュール = 1機能領域
- **明確なインターフェース**: 型定義されたAPI
- **依存関係最小化**: 循環依存なし
- **テスト可能性**: モック可能なインターフェース

### 2. フロントエンド（apps/web）

```typescript
// コンポーネント構造
components/
  avatar/
    - AvatarSelector.tsx      // 選択UI
    - ThreeAvatar.tsx          // 3Dアバター
    - Live2DAvatar.tsx         // 2Dアバター
    - AvatarPreview.tsx        // プレビュー

  session/
    - SessionView.tsx          // セッションメイン画面
    - AudioController.tsx      // 音声制御
    - RecordingManager.tsx     // 録画管理

  player/
    - VideoPlayer.tsx          // 動画プレイヤー
    - SyncedTranscript.tsx     // 同期トランスクリプト

  admin/
    - PromptEditor.tsx         // プロンプト編集
    - ProviderConfig.tsx       // プロバイダ設定
    - ApiKeyManager.tsx        // APIキー管理
```

**並行開発例**:
- Engineer A: `avatar/` 担当
- Engineer B: `session/` 担当
- 依存: 両者とも `lib/api/` を使用（インターフェースのみ依存）

---

### 3. バックエンド（apps/api）

#### NestJSモジュール構造

```typescript
// 各機能はNestJSモジュールとして独立

@Module({
  imports: [PrismaModule],
  controllers: [AvatarsController],
  providers: [AvatarsService],
  exports: [AvatarsService]
})
export class AvatarsModule {}
```

**モジュール間通信**:
- **直接依存**: サービスインジェクション
- **イベント**: EventEmitterによる疎結合
- **共有**: `@prance/shared` パッケージ

**並行開発例**:
- Engineer C: `avatars/`, `scenarios/` 担当
- Engineer D: `voice/`, `conversation/` 担当
- 依存: 両者とも `common/`, `@prance/shared` を使用

---

### 4. 共有パッケージ（packages/）

#### packages/shared

```typescript
// 型定義
export interface Avatar {
  id: string;
  type: '2d' | '3d';
  // ...
}

// AIプロバイダ抽象化
export interface AIProvider {
  generateResponse(prompt: string): Promise<string>;
}

export class ClaudeAdapter implements AIProvider {
  async generateResponse(prompt: string): Promise<string> {
    // Claude API呼び出し
  }
}
```

**使用例**:
```typescript
// apps/api/src/conversation/conversation.service.ts
import { AIProvider, ClaudeAdapter } from '@prance/shared';

export class ConversationService {
  private provider: AIProvider = new ClaudeAdapter();
  // ...
}
```

---

#### packages/database

```typescript
// Prismaクライアント
export * from '@prisma/client';
export { prisma } from './client';

// 型安全なクエリヘルパー
export class UserRepository {
  async findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  }
}
```

---

### 5. ワーカー（apps/workers）

各Lambda関数は独立したファイル:

```typescript
// src/functions/emotion-analyzer.ts
import { Handler } from 'aws-lambda';
import { AzureFaceService } from '../services/azure-face';

export const handler: Handler = async (event) => {
  const service = new AzureFaceService();
  const result = await service.analyzeEmotion(event.videoUrl);
  return result;
};
```

**並行開発**:
- 各関数は完全に独立
- 共通サービスは `src/services/` で共有
- テストは関数ごとに実行可能

---

## Claude Code 開発ガイドライン

### 新機能追加時の手順

#### 1. モジュール作成

```bash
# 例: 新しいAPIモジュール作成
cd apps/api
nest generate module feedback
nest generate service feedback
nest generate controller feedback
```

**Claude Codeプロンプト**:
```
NestJSでfeedbackモジュールを作成してください。
- FeedbackModule, FeedbackService, FeedbackController
- Prisma経由でfeedbackテーブルにアクセス
- CRUD操作（Create, Read, Update, Delete）
- DTOバリデーション（class-validator）
```

---

#### 2. 型定義追加

```typescript
// packages/shared/src/types/feedback.ts
export interface Feedback {
  id: string;
  sessionId: string;
  rating: number;
  comment: string;
  createdAt: Date;
}
```

**Claude Codeプロンプト**:
```
packages/shared/src/types/にfeedback.tsを作成してください。
Feedback型を定義（id, sessionId, rating, comment, createdAt）。
Zod schemaも追加してバリデーション可能に。
```

---

#### 3. フロントエンド統合

```typescript
// apps/web/lib/api/feedback-api.ts
import { Feedback } from '@prance/shared';

export async function submitFeedback(data: Omit<Feedback, 'id' | 'createdAt'>) {
  const response = await fetch('/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return response.json();
}
```

**Claude Codeプロンプト**:
```
apps/web/lib/api/にfeedback-api.tsを作成してください。
submitFeedback関数を実装。
fetchでPOST /api/feedback。エラーハンドリング含む。
```

---

### モジュール間の依存関係管理

#### ルール

1. **上位層は下位層に依存可能**
   - `apps/web` → `packages/shared` ✅
   - `apps/api` → `packages/database` ✅
   - `packages/shared` → `apps/api` ❌

2. **同階層モジュールは直接依存しない**
   - `apps/api/auth` → `apps/api/users` (サービス注入) ✅
   - `apps/web/components/avatar` → `apps/web/components/session` ❌
     （共通ロジックは `lib/` に抽出）

3. **循環依存禁止**
   - ESLintルールで検出
   - Madgeツールでチェック

#### 依存関係チェック

```bash
# 循環依存検出
npm run check:circular

# package.json
"check:circular": "madge --circular --extensions ts,tsx apps/web/app"
```

---

## Git ブランチ戦略

### ブランチ構成

```
main (プロダクション)
  ↑
develop (ステージング)
  ↑
feature/* (機能開発)
  ↑
個人ブランチ
```

### ブランチ命名規則

```bash
# 機能追加
feature/user-authentication
feature/avatar-customization

# バグ修正
fix/login-error
fix/video-sync-issue

# リファクタリング
refactor/api-client
refactor/database-queries

# ドキュメント
docs/api-specification
docs/deployment-guide
```

---

## コミット規約

### Conventional Commits

```bash
<type>(<scope>): <subject>

# 例
feat(auth): implement JWT authentication
fix(avatar): resolve lip-sync timing issue
docs(api): update API specification
refactor(database): optimize query performance
test(session): add WebSocket integration tests
```

### タイプ

- `feat`: 新機能
- `fix`: バグ修正
- `docs`: ドキュメント
- `refactor`: リファクタリング
- `test`: テスト
- `chore`: ビルド・設定変更

---

## テスト構成

### 単体テスト

```typescript
// apps/api/src/avatars/avatars.service.spec.ts
describe('AvatarsService', () => {
  let service: AvatarsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [AvatarsService, { provide: PrismaService, useValue: mockPrisma }]
    }).compile();

    service = module.get<AvatarsService>(AvatarsService);
  });

  it('should create avatar', async () => {
    const result = await service.create({ name: 'Test' });
    expect(result).toBeDefined();
  });
});
```

### 統合テスト

```typescript
// apps/api/test/avatars.e2e-spec.ts
describe('Avatars API (e2e)', () => {
  it('/avatars (POST)', () => {
    return request(app.getHttpServer())
      .post('/avatars')
      .send({ name: 'Test', type: '3d' })
      .expect(201);
  });
});
```

### テスト実行

```bash
# 全テスト
npm test

# 特定パッケージのみ
npm test -- --scope=@prance/api

# ウォッチモード
npm run test:watch
```

---

## ビルド・デプロイ

### Turborepoビルド

```json
// turbo.json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "test": {
      "dependsOn": ["build"]
    },
    "deploy": {
      "dependsOn": ["build", "test"]
    }
  }
}
```

### ビルドコマンド

```bash
# 全パッケージビルド
npm run build

# キャッシュ利用（高速）
npm run build -- --cache

# 特定パッケージのみ
npm run build -- --filter=@prance/web
```

---

## 環境変数管理

### .env.example

```bash
# Database
DATABASE_URL="postgresql://..."
DATABASE_URL_POOL="postgresql://..."

# AWS
AWS_REGION="us-east-1"
AWS_ACCOUNT_ID="123456789012"

# Cognito
COGNITO_USER_POOL_ID="us-east-1_xxxxx"
COGNITO_CLIENT_ID="xxxxxxxxx"

# API Keys
ANTHROPIC_API_KEY="sk-ant-xxxx"
ELEVENLABS_API_KEY="xxxx"
AZURE_SPEECH_KEY="xxxx"
AZURE_FACE_KEY="xxxx"

# Next.js
NEXT_PUBLIC_API_URL="https://api.prance.com"
```

### 環境ごとの設定

```bash
# 開発環境
cp .env.example .env.local

# ステージング環境（AWS Secrets Manager）
aws secretsmanager get-secret-value --secret-id prance/staging/env

# プロダクション環境（AWS Secrets Manager）
aws secretsmanager get-secret-value --secret-id prance/production/env
```

---

## 次のステップ

- [開発ガイド](DEVELOPMENT_GUIDE.md) - Claude Code開発手順
- [デプロイメント](DEPLOYMENT.md) - デプロイ手順
- [CI/CD](CICD.md) - パイプライン詳細
