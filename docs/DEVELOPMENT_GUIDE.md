# 開発ガイド

Claude Codeを活用した効率的な開発手順。

## 目次

1. [開発環境セットアップ](#開発環境セットアップ)
2. [Claude Code 開発フロー](#claude-code-開発フロー)
3. [コーディング規約](#コーディング規約)
4. [テスト](#テスト)
5. [デバッグ](#デバッグ)
6. [トラブルシューティング](#トラブルシューティング)

---

## 開発環境セットアップ

### 前提条件

```bash
# 必須
- Node.js 20.x
- npm 10.x
- Docker Desktop
- AWS CLI v2
- AWS CDK CLI

# 推奨
- VS Code
- Claude Code Extension (最新版)
```

### 初期セットアップ

```bash
# リポジトリクローン
git clone https://github.com/your-org/prance-platform.git
cd prance-platform

# 依存関係インストール
npm install

# 環境変数設定
cp .env.example .env.local
# .env.localを編集してAWS認証情報、APIキー等を設定

# データベースセットアップ
npm run db:migrate
npm run db:seed

# 開発環境起動
npm run dev
```

---

## Claude Code 開発フロー

### 基本ワークフロー

#### 1. タスク選択

実装プランから担当タスクを選択：

```bash
# 例: 認証モジュール実装
Task: 1.1.1 Cognito認証統合
File: apps/api/src/auth/auth.module.ts
Complexity: ⭐⭐ (中)
```

#### 2. ブランチ作成

```bash
git checkout -b feature/auth-module
```

#### 3. Claude Codeプロンプト作成

**良いプロンプトの例**:

```
NestJSでCognitoサービス用認証モジュールを実装してください。

要件:
- PassportJSでJWT戦略
- CognitoのJWKS検証
- カスタムデコレータ @CurrentUser()
- ガード @UseGuards(JwtAuthGuard)

ファイル構成:
- apps/api/src/auth/auth.module.ts
- apps/api/src/auth/auth.service.ts
- apps/api/src/auth/jwt.strategy.ts
- apps/api/src/auth/decorators/current-user.decorator.ts

参考: NestJS公式ドキュメントのPassport実装
```

**悪いプロンプトの例**:

```
認証を実装して
```

---

### プロンプトテンプレート集

#### テンプレート1: 新規モジュール作成

```
[フレームワーク名]で[モジュール名]を実装してください。

要件:
- [機能1]
- [機能2]
- [機能3]

技術仕様:
- [データベース/API/ライブラリ]
- [バリデーション要件]
- [エラーハンドリング]

ファイル構成:
- [ファイル1]
- [ファイル2]

参考:
- [既存コード/ドキュメントURL]
```

#### テンプレート2: API統合

```
[サービス名] APIクライアントを実装してください。

API仕様:
- エンドポイント: [URL]
- 認証: [方式]
- レート制限: [制限]

実装要件:
- TypeScriptインターフェース定義
- エラーハンドリング（リトライロジック含む）
- レスポンスキャッシング（オプション）
- ユニットテスト

ファイル:
- [クライアントファイル]
- [型定義ファイル]
- [テストファイル]
```

#### テンプレート3: UIコンポーネント

```
[コンポーネント名]コンポーネントを実装してください。

デザイン:
- [UIライブラリ] (shadcn/ui) 使用
- レスポンシブデザイン
- アクセシビリティ対応 (ARIA属性)

機能:
- [インタラクション1]
- [インタラクション2]
- [状態管理方法]

Props:
interface [ComponentName]Props {
  [prop1]: [type];
  [prop2]: [type];
}

ファイル:
- apps/web/components/[category]/[ComponentName].tsx
```

#### テンプレート4: Lambda関数

```
AWS Lambda関数 [関数名] を実装してください。

トリガー:
- [EventBridge / S3 / SQS]

処理内容:
1. [ステップ1]
2. [ステップ2]
3. [ステップ3]

外部サービス:
- [サービス1]: [用途]
- [サービス2]: [用途]

エラーハンドリング:
- [リトライ戦略]
- [DLQ設定]

ファイル:
- apps/workers/src/functions/[function-name].ts
- apps/workers/src/services/[service-name].ts
```

---

### Claude Code 実行例

#### 例1: 認証モジュール実装

**プロンプト**:

```
NestJSでJWT認証モジュールを実装してください。

要件:
- Cognitoから発行されたJWTトークンの検証
- PassportJS JWT戦略
- @CurrentUser() デコレータでユーザー情報取得
- JwtAuthGuard で保護されたエンドポイント

技術仕様:
- jwks-rsaでCognitoの公開鍵取得
- トークンExpiry検証
- ユーザー情報をPrisma経由で取得

ファイル:
- apps/api/src/auth/auth.module.ts
- apps/api/src/auth/jwt.strategy.ts
- apps/api/src/auth/decorators/current-user.decorator.ts
- apps/api/src/auth/guards/jwt-auth.guard.ts
```

**期待される成果物**:

```typescript
// apps/api/src/auth/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksUri: `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}/.well-known/jwks.json`,
      }),
      audience: process.env.COGNITO_CLIENT_ID,
      issuer: `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}`,
    });
  }

  async validate(payload: any) {
    const user = await this.usersService.findByCognitoSub(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
```

---

#### 例2: React コンポーネント

**プロンプト**:

```
React + TypeScriptでアバター選択コンポーネントを実装してください。

要件:
- アバターリストを表示（グリッドレイアウト）
- フィルタリング機能（カテゴリ、スタイル）
- プレビューモーダル
- 選択状態管理（Zustand）

デザイン:
- shadcn/uiコンポーネント使用
- Tailwind CSSでスタイリング
- レスポンシブデザイン（mobile-first）

API:
- GET /api/avatars → Avatar[]

ファイル:
- apps/web/components/avatar/AvatarSelector.tsx
- apps/web/components/avatar/AvatarCard.tsx
- apps/web/components/avatar/AvatarPreview.tsx
- apps/web/lib/stores/avatar-store.ts
```

---

### マルチファイル実装

複数ファイルにまたがる機能実装時:

**プロンプト**:

```
シナリオ管理機能を実装してください（バックエンド + フロントエンド）。

バックエンド（NestJS）:
- シナリオCRUD API
- バリデーション（Zod）
- Prisma統合

ファイル:
- apps/api/src/scenarios/scenarios.module.ts
- apps/api/src/scenarios/scenarios.service.ts
- apps/api/src/scenarios/scenarios.controller.ts
- apps/api/src/scenarios/dto/create-scenario.dto.ts

フロントエンド（Next.js）:
- シナリオ一覧表示
- 作成フォーム
- 編集機能

ファイル:
- apps/web/app/[locale]/scenarios/page.tsx
- apps/web/components/scenarios/ScenarioList.tsx
- apps/web/components/scenarios/ScenarioForm.tsx
- apps/web/lib/api/scenarios-api.ts

実装順序:
1. バックエンドAPI
2. 型定義（@prance/shared）
3. フロントエンドAPI client
4. UI コンポーネント
```

---

## コーディング規約

### TypeScript

```typescript
// ✅ Good
interface User {
  id: string;
  email: string;
  name: string;
}

async function getUser(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } });
}

// ❌ Bad
async function getUser(id) {
  return prisma.user.findUnique({ where: { id } });
}
```

### 命名規則

```typescript
// ファイル名
ComponentName.tsx; // Reactコンポーネント
service - name.service.ts; // NestJSサービス
user - repository.ts; // Repository
user.interface.ts; // インターフェース

// 変数・関数
const userName = 'John'; // camelCase
function getUserById() {} // camelCase

// クラス
class UserService {} // PascalCase

// 定数
const MAX_RETRIES = 3; // UPPER_SNAKE_CASE

// インターフェース
interface User {} // PascalCase (Iプレフィックス不要)

// 型エイリアス
type UserId = string; // PascalCase
```

### コメント

```typescript
// ✅ Good - 複雑なロジックに説明
/**
 * ユーザープロファイルのベンチマークスコアを計算
 * K-meansクラスタリングで類似ユーザーグループを判定
 * @param userId - ユーザーID
 * @param timeframe - 計算期間（month/quarter/year）
 */
async function calculateBenchmark(userId: string, timeframe: string) {
  // ...
}

// ❌ Bad - 自明なコードにコメント
// ユーザーを取得する
const user = await getUser(id);
```

### エラーハンドリング

```typescript
// ✅ Good - 具体的なエラー
try {
  const result = await externalAPI.call();
} catch (error) {
  if (error instanceof NetworkError) {
    throw new ServiceUnavailableException('External API is unavailable');
  }
  throw new InternalServerErrorException('Unexpected error occurred');
}

// ❌ Bad - エラーを無視
try {
  await externalAPI.call();
} catch (error) {
  console.log(error);
}
```

---

## テスト

### 単体テスト

```typescript
// apps/api/src/auth/auth.service.spec.ts
describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('validateUser', () => {
    it('should return user when credentials are valid', async () => {
      const mockUser = { id: '1', email: 'test@example.com' };
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);

      const result = await service.validateUser('test@example.com', 'password');

      expect(result).toEqual(mockUser);
    });

    it('should throw UnauthorizedException when user not found', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

      await expect(service.validateUser('test@example.com', 'password')).rejects.toThrow(
        UnauthorizedException
      );
    });
  });
});
```

### 統合テスト

```typescript
// apps/api/test/auth.e2e-spec.ts
describe('Auth API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/auth/login (POST)', () => {
    it('should return JWT token', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'password' })
        .expect(200)
        .expect(res => {
          expect(res.body).toHaveProperty('accessToken');
        });
    });

    it('should return 401 for invalid credentials', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'wrong' })
        .expect(401);
    });
  });
});
```

### フロントエンドテスト

```typescript
// apps/web/components/avatar/AvatarSelector.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { AvatarSelector } from './AvatarSelector';

describe('AvatarSelector', () => {
  const mockAvatars = [
    { id: '1', name: 'Avatar 1', type: '3d' },
    { id: '2', name: 'Avatar 2', type: '2d' }
  ];

  it('should render avatar list', () => {
    render(<AvatarSelector avatars={mockAvatars} onSelect={jest.fn()} />);

    expect(screen.getByText('Avatar 1')).toBeInTheDocument();
    expect(screen.getByText('Avatar 2')).toBeInTheDocument();
  });

  it('should call onSelect when avatar is clicked', () => {
    const onSelect = jest.fn();
    render(<AvatarSelector avatars={mockAvatars} onSelect={onSelect} />);

    fireEvent.click(screen.getByText('Avatar 1'));

    expect(onSelect).toHaveBeenCalledWith(mockAvatars[0]);
  });
});
```

### テスト実行

```bash
# 全テスト
npm test

# ウォッチモード
npm run test:watch

# カバレッジ
npm run test:cov

# E2Eテスト
npm run test:e2e
```

---

## デバッグ

### VS Code デバッグ設定

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug API",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "start:debug"],
      "cwd": "${workspaceFolder}/apps/api",
      "console": "integratedTerminal",
      "restart": true
    },
    {
      "name": "Debug Web",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:3000",
      "webRoot": "${workspaceFolder}/apps/web"
    }
  ]
}
```

### ログ出力

```typescript
// 開発環境のみ
if (process.env.NODE_ENV === 'development') {
  console.log('Debug info:', data);
}

// NestJS Logger
import { Logger } from '@nestjs/common';

@Injectable()
export class MyService {
  private readonly logger = new Logger(MyService.name);

  async doSomething() {
    this.logger.log('Doing something...');
    this.logger.error('Error occurred', error.stack);
  }
}
```

---

## トラブルシューティング

### 問題1: ビルドエラー

```bash
# キャッシュクリア
npm run clean
rm -rf node_modules
npm install

# Turborepoキャッシュクリア
rm -rf .turbo
npm run build
```

### 問題2: Prismaエラー

```bash
# スキーマ再生成
npm run db:generate

# マイグレーション再適用
npm run db:migrate:reset
npm run db:seed
```

### 問題3: 型エラー

```bash
# 型定義再生成
npm run build:types

# TypeScriptキャッシュクリア
rm -rf apps/*/tsconfig.tsbuildinfo
```

### 問題4: Lambda関数エラー

```bash
# ローカルで関数実行テスト
cd apps/workers
npm run invoke:local -- --function emotion-analyzer --path test/events/sample-event.json
```

---

## 開発Tips

### 1. Claude Codeのコンテキスト最適化

```
# 関連ファイルを明示的に指定
@apps/api/src/auth/auth.service.ts
@packages/shared/src/types/user.ts

上記ファイルを参考に、ユーザープロフィール更新APIを実装してください。
```

### 2. 段階的実装

```
# Phase 1: インターフェース定義
まず、UserServiceのインターフェースを定義してください。

# Phase 2: 実装
次に、UserServiceを実装してください。

# Phase 3: テスト
最後に、UserServiceのテストを作成してください。
```

### 3. エラー修正

```
以下のエラーを修正してください:

Error: Cannot find module '@prance/shared'

コンテキスト:
- apps/api/src/users/users.service.ts でインポートしている
- packages/shared/src/types/user.ts を参照したい
```

---

## 次のステップ

- [デプロイメント](DEPLOYMENT.md) - デプロイ手順
- [CI/CD](CICD.md) - パイプライン詳細
- [トラブルシューティング](TROUBLESHOOTING.md) - よくある問題
