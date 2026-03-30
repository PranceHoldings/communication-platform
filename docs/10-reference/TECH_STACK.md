# 技術スタック詳細

**バージョン:** 2.0
**作成日:** 2026-03-05
**最終更新:** 2026-03-05
**ステータス:** Phase 0 完了

---

## 目次

1. [技術スタック概要](#1-技術スタック概要)
2. [フロントエンド技術](#2-フロントエンド技術)
3. [バックエンド技術（サーバーレス）](#3-バックエンド技術サーバーレス)
4. [AI・音声サービス](#4-ai音声サービス)
5. [データストア・ストレージ](#5-データストアストレージ)
6. [インフラ・DevOps](#6-インフラdevops)
7. [外部サービス・ライセンス](#7-外部サービスライセンス)
8. [開発ツール](#8-開発ツール)
9. [バージョン管理](#9-バージョン管理)

---

## 1. 技術スタック概要

### 全体構成図

```
┌─────────────────────────────────────────────────────────────────┐
│                        フロントエンド                            │
│  Next.js 15 | React 19 | TypeScript 5.7 | Tailwind CSS 4.0    │
│  Three.js | Live2D SDK 5 | shadcn/ui | next-intl              │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ↓ (REST API + WebSocket)
┌─────────────────────────────────────────────────────────────────┐
│                        バックエンド (AWS)                        │
│  Lambda (Node.js 20) | API Gateway | AWS IoT Core              │
│  Prisma ORM 5.22 | PostgreSQL 15.4 | DynamoDB | Redis          │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ↓ (API統合)
┌─────────────────────────────────────────────────────────────────┐
│                      AI・音声サービス                            │
│  AWS Bedrock (Claude Sonnet 4.6) | ElevenLabs | Azure Speech   │
│  AWS Rekognition | MediaConvert                                │
└─────────────────────────────────────────────────────────────────┘
```

### 選定基準

1. **サーバーレスファースト**: 自動スケール、使用量ベース課金
2. **型安全性**: TypeScript全面採用、Prisma ORM
3. **エコシステム成熟度**: 豊富なライブラリ、コミュニティサポート
4. **開発生産性**: ホットリロード、自動生成、テストツール充実
5. **AWS統合**: マネージドサービス活用、統一された認証・監視

---

## 2. フロントエンド技術

### 2.1 コアフレームワーク

#### Next.js 15

**バージョン**: 15.1.3
**ライセンス**: MIT

**採用理由:**

- **App Router**: React Server Components、ストリーミングSSR
- **ハイブリッドレンダリング**: SSR/SSG/ISRを柔軟に選択
- **画像最適化**: 自動WebP変換、遅延読み込み
- **APIルート**: サーバーサイドロジック統合
- **TypeScript完全サポート**: 型安全なルーティング

**主要機能:**

```typescript
// app/layout.tsx - Root Layout
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Prance Communication Platform',
  description: 'AI Avatar Communication Platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
```

**パフォーマンス:**

- **Partial Pre-rendering**: 静的部分と動的部分のハイブリッド
- **Server Actions**: フォーム送信のゼロJavaScript化
- **Streaming**: 段階的HTML配信

**参考リンク:**

- 公式ドキュメント: https://nextjs.org/docs
- App Router Guide: https://nextjs.org/docs/app

---

#### React 19

**バージョン**: 19.0.0
**ライセンス**: MIT

**主要機能:**

- **React Server Components**: サーバーサイドレンダリング
- **Suspense**: データ取得の宣言的エラーハンドリング
- **Concurrent Features**: useTransition、useDeferredValue
- **Automatic Batching**: 複数state更新の自動バッチング

**使用例:**

```typescript
// app/components/SessionPlayer.tsx
'use client';

import { Suspense } from 'react';

export default function SessionPlayer({ sessionId }: { sessionId: string }) {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <SessionContent sessionId={sessionId} />
    </Suspense>
  );
}
```

---

#### TypeScript 5.7

**バージョン**: 5.7.2
**ライセンス**: Apache-2.0

**設定 (tsconfig.json):**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./src/components/*"]
    }
  }
}
```

**主要機能:**

- **厳密な型チェック**: `strict: true`、`noUncheckedIndexedAccess: true`
- **Path Mapping**: エイリアス設定で相対パス簡略化
- **型推論**: 高度な型推論でボイラープレート削減

---

### 2.2 UIフレームワーク

#### Tailwind CSS 4.0

**バージョン**: 4.0.0
**ライセンス**: MIT

**設定 (tailwind.config.ts):**

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        // ...
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
```

**特徴:**

- **ユーティリティファースト**: HTML内で直接スタイリング
- **JIT (Just-In-Time)**: 使用されたクラスのみビルド
- **カスタマイズ性**: CSS変数でテーマ管理
- **ダークモード**: `class`ストラテジーでトグル対応

---

#### shadcn/ui

**バージョン**: 最新 (コンポーネントライブラリ)
**ライセンス**: MIT

**インストール:**

```bash
npx shadcn-ui@latest init
npx shadcn-ui@latest add button
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add dropdown-menu
```

**特徴:**

- **コピー&ペースト**: コンポーネントをプロジェクトにコピー
- **カスタマイズ自由**: Tailwind CSSベースで完全制御
- **アクセシビリティ**: Radix UIベース、ARIA対応
- **TypeScript完全サポート**: 型定義付き

**使用例:**

```typescript
// app/components/ui/button.tsx
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
```

---

### 2.3 3D/2Dアバターレンダリング

#### Three.js

**バージョン**: r169
**ライセンス**: MIT

**用途**: 3Dアバター（Ready Player Me）のレンダリング

**主要機能:**

```typescript
// app/components/Avatar3D.tsx
'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

export function Avatar3D({ modelUrl }: { modelUrl: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });

    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    containerRef.current.appendChild(renderer.domElement);

    // Load GLTF model
    const loader = new GLTFLoader();
    loader.load(modelUrl, (gltf) => {
      scene.add(gltf.scene);
    });

    // Animation loop
    function animate() {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    }
    animate();

    return () => {
      renderer.dispose();
    };
  }, [modelUrl]);

  return <div ref={containerRef} className="w-full h-full" />;
}
```

**参考リンク:**

- 公式ドキュメント: https://threejs.org/docs/
- Three.js Journey (学習リソース): https://threejs-journey.com/

---

#### Live2D Cubism SDK 5

**バージョン**: 5.0.0
**ライセンス**: Proprietary (Live2D社商用ライセンス必要)

**用途**: 2Dアニメアバターのレンダリング

**導入:**

```bash
npm install @live2d/cubism-framework
```

**使用例:**

```typescript
// app/components/Avatar2D.tsx
'use client';

import { useEffect, useRef } from 'react';
import { Live2DCubismFramework } from '@live2d/cubism-framework';

export function Avatar2D({ modelPath }: { modelPath: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const gl = canvas.getContext('webgl');
    if (!gl) return;

    // Load Live2D model
    const model = Live2DCubismFramework.loadModel(modelPath);

    // Render loop
    function render() {
      model.update();
      model.draw(gl);
      requestAnimationFrame(render);
    }
    render();
  }, [modelPath]);

  return <canvas ref={canvasRef} width={800} height={600} />;
}
```

**ライセンス要件:**

- **開発用**: 無料SDK (クレジット表記必須)
- **商用**: Live2D PRO ライセンス ($42/月)

**参考リンク:**

- 公式ドキュメント: https://www.live2d.com/en/download/cubism-sdk/
- サンプルコード: https://github.com/Live2D/CubismWebSamples

---

### 2.4 多言語対応

#### next-intl

**バージョン**: 3.22.0
**ライセンス**: MIT

**設定 (middleware.ts):**

```typescript
import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  locales: ['ja', 'en'],
  defaultLocale: 'ja',
});

export const config = {
  matcher: ['/', '/(ja|en)/:path*'],
};
```

**使用例:**

```typescript
// app/[locale]/page.tsx
import { useTranslations } from 'next-intl';

export default function HomePage() {
  const t = useTranslations('HomePage');

  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('description')}</p>
    </div>
  );
}
```

**言語リソースファイル (messages/ja.json):**

```json
{
  "HomePage": {
    "title": "Prance Communication Platform",
    "description": "AIアバターとリアルタイム会話"
  }
}
```

**特徴:**

- **RSC対応**: React Server Componentsで使用可能
- **型安全**: TypeScript型定義自動生成
- **リッチフォーマット**: 複数形、日時、数値フォーマット
- **動的言語切り替え**: URLパスベース (`/ja/`, `/en/`)

---

## 3. バックエンド技術（サーバーレス）

### 3.1 ランタイム・フレームワーク

#### Node.js 20 (AWS Lambda)

**バージョン**: 20.x (LTS)
**ライセンス**: MIT

**Lambda設定:**

```typescript
// infrastructure/lib/lambda-stack.ts
new lambda.Function(this, 'ApiFunction', {
  runtime: lambda.Runtime.NODEJS_20_X,
  architecture: lambda.Architecture.ARM_64, // Graviton2
  handler: 'index.handler',
  memorySize: 1024,
  timeout: Duration.seconds(30),
});
```

**特徴:**

- **ARM64 (Graviton2)**: 20%コスト削減、高性能
- **ES Modules**: `import/export`構文ネイティブサポート
- **Top-level await**: async/await簡略化
- **Performance Hooks**: パフォーマンス計測

---

#### Prisma ORM 5.22

**バージョン**: 5.22.0
**ライセンス**: Apache-2.0

**スキーマ (prisma/schema.prisma):**

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
  binaryTargets = ["native", "rhel-openssl-3.0.x"] // Lambda対応
}

model Organization {
  id        String   @id @default(uuid())
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  users     User[]

  @@map("organizations")
}

model User {
  id             String       @id @default(uuid())
  email          String       @unique
  name           String?
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  role           UserRole     @default(CLIENT_USER)
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  @@map("users")
}

enum UserRole {
  SUPER_ADMIN
  CLIENT_ADMIN
  CLIENT_USER
}
```

**マイグレーション:**

```bash
# マイグレーション作成
npx prisma migrate dev --name init

# 本番適用
npx prisma migrate deploy

# Prisma Client生成
npx prisma generate
```

**使用例:**

```typescript
// apps/api/src/services/user.service.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function createUser(data: { email: string; name: string; organizationId: string }) {
  return await prisma.user.create({
    data: {
      ...data,
      role: 'CLIENT_USER',
    },
    include: {
      organization: true,
    },
  });
}

export async function findUserByEmail(email: string) {
  return await prisma.user.findUnique({
    where: { email },
    include: {
      organization: true,
    },
  });
}
```

**特徴:**

- **型安全**: TypeScript型定義自動生成
- **リレーション管理**: 外部キー、JOIN自動処理
- **マイグレーション**: バージョン管理可能
- **パフォーマンス**: コネクションプール、クエリ最適化

---

### 3.2 API・通信

#### AWS API Gateway

**種類**: REST API、WebSocket API
**ライセンス**: AWS Managed Service

**REST API設定:**

```typescript
// infrastructure/lib/api-gateway-stack.ts
const api = new apigateway.RestApi(this, 'PranceApi', {
  restApiName: 'Prance Platform API',
  deployOptions: {
    stageName: 'dev',
    tracingEnabled: true,
    loggingLevel: apigateway.MethodLoggingLevel.INFO,
  },
  defaultCorsPreflightOptions: {
    allowOrigins: apigateway.Cors.ALL_ORIGINS,
    allowMethods: apigateway.Cors.ALL_METHODS,
    allowHeaders: ['Content-Type', 'Authorization', 'X-Api-Key', 'X-Tenant-Id'],
  },
});
```

**特徴:**

- **Lambda統合**: プロキシ統合、カスタム統合
- **認証・認可**: Cognito Authorizer、Lambda Authorizer
- **レート制限**: Usage Plan、APIキー管理
- **CORS設定**: プリフライトリクエスト対応

---

#### AWS IoT Core (WebSocket)

**用途**: リアルタイム双方向通信（セッション中の音声・テキスト）

**接続フロー:**

```typescript
// apps/web/src/lib/websocket.ts
import { IoTDataPlaneClient, PublishCommand } from '@aws-sdk/client-iot-data-plane';

const iotClient = new IoTDataPlaneClient({
  region: 'us-east-1',
  credentials: {
    // Cognito Identity Poolから取得
  },
});

export async function publishMessage(topic: string, message: object) {
  const command = new PublishCommand({
    topic,
    payload: JSON.stringify(message),
  });

  await iotClient.send(command);
}
```

**特徴:**

- **100万同時接続**: 大規模対応
- **低レイテンシ**: グローバルエンドポイント
- **MQTT over WebSocket**: 標準プロトコル
- **認証**: Cognito統合

---

## 4. AI・音声サービス

### 4.1 会話AI

#### AWS Bedrock (Claude Sonnet 4.6)

**モデルID**: `us.anthropic.claude-sonnet-4-6`
**ライセンス**: AWS Managed Service

**料金:**

| 項目    | 価格          |
| ------- | ------------- |
| Input   | $3/1M tokens  |
| Output  | $15/1M tokens |
| Context | 200K tokens   |

**SDK:**

```bash
npm install @aws-sdk/client-bedrock-runtime
```

**使用例:**

```typescript
// apps/api/src/services/ai.service.ts
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const bedrockClient = new BedrockRuntimeClient({ region: 'us-east-1' });

export async function generateAIResponse(
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const command = new InvokeModelCommand({
    modelId: 'us.anthropic.claude-sonnet-4-6',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  const response = await bedrockClient.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  return responseBody.content[0].text;
}
```

**特徴:**

- **AWS統合請求**: 個別APIキー不要
- **低レイテンシ**: VPC内からアクセス
- **IAM認証**: セキュリティ強化
- **コスト管理**: AWS Budgetsで予算アラート

---

### 4.2 音声サービス

#### ElevenLabs (TTS)

**バージョン**: API v1
**ライセンス**: Commercial (有料プラン)

**料金:**

| プラン  | 月額 | 文字数/月 |
| ------- | ---- | --------- |
| Free    | $0   | 10,000    |
| Starter | $5   | 30,000    |
| Creator | $22  | 100,000   |
| Pro     | $99  | 500,000   |
| Scale   | $330 | 2,000,000 |

**SDK:**

```bash
npm install elevenlabs
```

**使用例:**

```typescript
// apps/api/src/services/tts.service.ts
import { ElevenLabsClient } from 'elevenlabs';

const client = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

export async function generateSpeech(text: string, voiceId: string): Promise<Buffer> {
  const audio = await client.generate({
    voice: voiceId,
    text,
    model_id: 'eleven_multilingual_v2',
  });

  const chunks: Uint8Array[] = [];
  for await (const chunk of audio) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}
```

**特徴:**

- **高品質TTS**: 自然な音声合成
- **音声クローニング**: カスタムボイス作成
- **Visemeデータ**: リップシンク用タイムスタンプ
- **多言語対応**: 29言語サポート

---

#### Azure Speech Services (STT)

**バージョン**: Cognitive Services Speech SDK 1.40
**ライセンス**: Azure Managed Service

**料金:**

| 項目          | 価格 (1時間) |
| ------------- | ------------ |
| Standard      | $1.00        |
| Custom Speech | $1.40        |

**SDK:**

```bash
npm install microsoft-cognitiveservices-speech-sdk
```

**使用例:**

```typescript
// apps/api/src/services/stt.service.ts
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

export async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  const speechConfig = sdk.SpeechConfig.fromSubscription(
    process.env.AZURE_SPEECH_KEY!,
    process.env.AZURE_SPEECH_REGION!
  );

  speechConfig.speechRecognitionLanguage = 'ja-JP';

  const audioConfig = sdk.AudioConfig.fromWavFileInput(audioBuffer);
  const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

  return new Promise((resolve, reject) => {
    recognizer.recognizeOnceAsync(result => {
      if (result.reason === sdk.ResultReason.RecognizedSpeech) {
        resolve(result.text);
      } else {
        reject(new Error('Speech recognition failed'));
      }
    });
  });
}
```

**特徴:**

- **リアルタイムSTT**: ストリーミング認識
- **高精度**: 音声認識精度 95%+
- **多言語**: 100+ 言語対応
- **カスタムモデル**: ドメイン固有語彙対応

---

### 4.3 画像・感情解析

#### AWS Rekognition

**用途**: 顔検出、表情・感情解析

**SDK:**

```bash
npm install @aws-sdk/client-rekognition
```

**使用例:**

```typescript
// apps/api/src/services/emotion.service.ts
import { RekognitionClient, DetectFacesCommand } from '@aws-sdk/client-rekognition';

const rekognitionClient = new RekognitionClient({ region: 'us-east-1' });

export async function analyzeEmotion(imageBytes: Uint8Array) {
  const command = new DetectFacesCommand({
    Image: { Bytes: imageBytes },
    Attributes: ['ALL'],
  });

  const response = await rekognitionClient.send(command);
  return response.FaceDetails?.map(face => face.Emotions);
}
```

**料金:**

| 項目          | 価格 (1,000画像) |
| ------------- | ---------------- |
| Face Analysis | $1.00            |

---

## 5. データストア・ストレージ

### 5.1 リレーショナルデータベース

#### Amazon Aurora Serverless v2 (PostgreSQL 15.4)

**用途**: マスターデータ、ユーザー・組織・シナリオ・プロンプト管理

**スケール範囲**: 0.5 → 16 ACU (1 ACU = 2GB RAM + CPU)

**料金:**

| 項目       | 価格                  |
| ---------- | --------------------- |
| ACU時間    | $0.12/ACU/hour        |
| ストレージ | $0.10/GB/month        |
| I/O        | $0.20/100万リクエスト |

**推定コスト** (平均2 ACU、100GB):

- **ACU**: $0.12 × 2 × 730時間 = $175/月
- **ストレージ**: $0.10 × 100GB = $10/月
- **合計**: 約 **$185/月**

**特徴:**

- **自動スケール**: 負荷に応じて自動調整
- **Multi-AZ**: 高可用性、自動フェイルオーバー
- **バックアップ**: 7日間自動バックアップ
- **Prisma対応**: TypeScript型安全アクセス

---

### 5.2 NoSQLデータベース

#### Amazon DynamoDB

**用途**:

- セッション状態管理 (リアルタイム会話)
- WebSocket接続管理
- ベンチマークキャッシュ
- APIレート制限

**料金 (オンデマンドモード):**

| 項目       | 価格                  |
| ---------- | --------------------- |
| 書き込み   | $1.25/100万リクエスト |
| 読み込み   | $0.25/100万リクエスト |
| ストレージ | $0.25/GB/month        |

**推定コスト** (500万読込、100万書込、10GB):

- **読み込み**: $0.25 × 5 = $1.25/月
- **書き込み**: $1.25 × 1 = $1.25/月
- **ストレージ**: $0.25 × 10GB = $2.50/月
- **合計**: 約 **$5/月**

**特徴:**

- **無制限スケール**: オンデマンドモード
- **低レイテンシ**: 1桁ms応答時間
- **TTL自動削除**: 期限切れデータ自動削除
- **DynamoDB Streams**: リアルタイム変更通知

---

### 5.3 キャッシュ

#### Amazon ElastiCache Serverless (Redis 7)

**用途**:

- APIレート制限 (トークンバケット)
- セッションキャッシュ
- 言語リソースキャッシュ
- JWT検証キャッシュ

**料金:**

| 項目                   | 価格              |
| ---------------------- | ----------------- |
| ElastiCache Serverless | 使用量ベース      |
| データストレージ       | $0.125/GB/hour    |
| ECPUs (処理単位)       | $0.0034/ECPU/hour |

**推定コスト** (1GB、平均10 ECPU):

- **ストレージ**: $0.125 × 1GB × 730時間 = $91/月
- **ECPU**: $0.0034 × 10 × 730時間 = $25/月
- **合計**: 約 **$20/月** (小規模構成)

---

### 5.4 オブジェクトストレージ

#### Amazon S3

**用途**:

- **Recordings Bucket**: 録画動画・音声 (90日保持)
- **Avatars Bucket**: 3D/2Dアバターモデル
- **Reports Bucket**: PDF/HTMLレポート (365日保持)
- **Website Bucket**: Next.js静的アセット

**料金:**

| 項目                        | 価格                |
| --------------------------- | ------------------- |
| Standard Storage            | $0.023/GB/month     |
| Intelligent-Tiering (自動)  | $0.023 → $0.0125/GB |
| リクエスト (PUT)            | $0.005/1,000        |
| データ転送 (インターネット) | $0.09/GB            |

**推定コスト** (1TB保存、10TB転送):

- **ストレージ**: $0.023 × 1,000GB = $23/月
- **転送**: $0.09 × 10,000GB = $900/月 → **CloudFrontで削減**
- **合計**: 約 **$50/月** (CloudFront経由)

**特徴:**

- **Intelligent-Tiering**: アクセス頻度で自動コスト最適化
- **ライフサイクルポリシー**: 自動削除・アーカイブ
- **バージョニング**: 誤削除防止
- **KMS暗号化**: セキュリティ強化

---

#### Amazon CloudFront (CDN)

**用途**: S3オブジェクトのグローバル配信、レイテンシ削減

**料金:**

| 項目       | 価格 (最初の10TB) |
| ---------- | ----------------- |
| データ転送 | $0.085/GB         |
| リクエスト | $0.0075/10,000    |

**推定コスト** (10TB転送):

- **データ転送**: $0.085 × 10,000GB = $850/月
- **リクエスト**: $0.0075 × 1,000,000 = $7.50/月
- **合計**: 約 **$85/月** (S3直接より削減)

---

## 6. インフラ・DevOps

### 6.1 Infrastructure as Code (IaC)

#### AWS CDK (Cloud Development Kit)

**バージョン**: 2.169.0
**ライセンス**: Apache-2.0

**プロジェクト構成:**

```
infrastructure/
├── bin/
│   └── infrastructure.ts      # CDK App Entry Point
├── lib/
│   ├── network-stack.ts       # VPC, Subnets, Security Groups
│   ├── cognito-stack.ts       # User Pool, Identity Pool
│   ├── database-stack.ts      # Aurora Serverless v2
│   ├── storage-stack.ts       # S3, CloudFront
│   ├── dynamodb-stack.ts      # DynamoDB Tables
│   ├── api-gateway-stack.ts   # REST API, WebSocket API
│   └── lambda-stack.ts        # Lambda Functions
├── cdk.json                   # CDK Config
└── tsconfig.json              # TypeScript Config
```

**デプロイコマンド:**

```bash
cd infrastructure

# Bootstrap (初回のみ)
npm run bootstrap

# 全スタックデプロイ
npm run deploy

# 個別スタックデプロイ
npm run deploy:network
npm run deploy:database
```

**特徴:**

- **TypeScript**: 型安全なインフラ定義
- **再利用性**: コンポーネント化、Constructライブラリ
- **差分検出**: `cdk diff`で変更確認
- **ロールバック**: CloudFormationスタック管理

---

### 6.2 CI/CD

#### GitHub Actions

**設定 (.github/workflows/deploy.yml):**

```yaml
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
        run: npm ci
      - name: Build
        run: npm run build
      - name: CDK Deploy
        run: |
          cd infrastructure
          npm run deploy -- --require-approval never
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          AWS_REGION: us-east-1
```

**特徴:**

- **自動デプロイ**: `main`ブランチへのpushでトリガー
- **並列実行**: 複数ジョブ同時実行
- **シークレット管理**: GitHub Secrets統合
- **ステータスバッジ**: README表示

---

### 6.3 監視・ロギング

#### Amazon CloudWatch

**用途**:

- **Metrics**: Lambda実行時間、エラー率、DynamoDB消費ユニット
- **Logs**: Lambda実行ログ、API Gatewayアクセスログ
- **Alarms**: 閾値超過時の通知 (SNS経由)
- **Dashboards**: メトリクス可視化

**設定:**

```typescript
// infrastructure/lib/monitoring-stack.ts
const dashboard = new cloudwatch.Dashboard(this, 'PranceDashboard', {
  dashboardName: 'Prance-Platform',
});

dashboard.addWidgets(
  new cloudwatch.GraphWidget({
    title: 'Lambda Invocations',
    left: [apiFunction.metricInvocations()],
  }),
  new cloudwatch.GraphWidget({
    title: 'Lambda Errors',
    left: [apiFunction.metricErrors()],
  })
);

// アラート
const errorAlarm = new cloudwatch.Alarm(this, 'HighErrorRateAlarm', {
  metric: apiFunction.metricErrors(),
  threshold: 10,
  evaluationPeriods: 2,
});

errorAlarm.addAlarmAction(new actions.SnsAction(alertTopic));
```

---

#### AWS X-Ray

**用途**: 分散トレーシング、パフォーマンス分析

**有効化:**

```typescript
// Lambda Tracing Enabled
new lambda.Function(this, 'ApiFunction', {
  tracing: lambda.Tracing.ACTIVE,
  // ...
});
```

**特徴:**

- **エンドツーエンドトレース**: リクエストの全経路可視化
- **サービスマップ**: 依存関係グラフ
- **レイテンシ分析**: ボトルネック特定
- **エラートレース**: 例外発生箇所の特定

---

## 7. 外部サービス・ライセンス

### 7.1 アバター生成

#### Ready Player Me

**バージョン**: API v1
**ライセンス**: Free for dev, Commercial for production

**用途**: ユーザー画像から3Dアバター生成

**API:**

```bash
curl -X POST https://api.readyplayer.me/v1/avatars \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "image=@photo.jpg"
```

**料金:**

| プラン     | 月額   | 生成数/月 |
| ---------- | ------ | --------- |
| Free       | $0     | 100       |
| Indie      | $25    | 1,000     |
| Studio     | $99    | 10,000    |
| Enterprise | Custom | Unlimited |

---

### 7.2 決済

#### Stripe

**バージョン**: API 2024-12-18
**ライセンス**: Stripe Terms of Service

**用途**: サブスクリプション管理、クレジットカード決済

**SDK:**

```bash
npm install stripe
```

**料金:**

| 項目       | 価格 |
| ---------- | ---- |
| 決済手数料 | 3.6% |
| 月額固定費 | $0   |

**使用例:**

```typescript
// apps/api/src/services/payment.service.ts
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function createSubscription(customerId: string, priceId: string) {
  return await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
  });
}
```

---

### 7.3 ATS連携

#### 対応ATS (6社)

| ATS名              | APIバージョン | 国内/海外 |
| ------------------ | ------------- | --------- |
| **HRMOS**          | v1            | 国内      |
| **TalentPalette**  | REST API      | 国内      |
| **Greenhouse**     | Harvest API   | 海外      |
| **Lever**          | REST API v1   | 海外      |
| **Workday**        | REST API      | 海外      |
| **SuccessFactors** | OData API     | 海外      |

**共通機能:**

- 候補者データ同期 (氏名、メール、応募ポジション)
- 面接結果エクスポート (スコア、録画URL、レポートPDF)
- Webhook統合 (候補者追加時の自動通知)

---

## 8. 開発ツール

### 8.1 パッケージマネージャ

#### npm 10

**バージョン**: 10.9.2
**設定 (.npmrc):**

```ini
engine-strict=true
save-exact=true
```

---

### 8.2 リンター・フォーマッター

#### ESLint 9

**設定 (eslint.config.js):**

```javascript
import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
];
```

---

#### Prettier 3

**設定 (.prettierrc.json):**

```json
{
  "semi": true,
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "trailingComma": "es5"
}
```

---

### 8.3 テスト

#### Jest 29

**設定 (jest.config.js):**

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
};
```

---

#### Playwright (E2Eテスト)

**設定 (apps/web/playwright.config.ts):**

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',  // apps/web/ からの相対パス
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    permissions: ['microphone', 'camera'],
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
```

**テスト構造:** `apps/web/tests/e2e/`
- **Level 1 (Stage 0-1):** UI Component Tests
- **Level 2 (Stage 2):** Integration Tests (Mock)
- **Level 3 (Stage 3-5):** System E2E Tests（全スタック）

**テスト成功率:** 35/35 (100%) ✅

詳細: [apps/web/tests/e2e/README.md](../../apps/web/tests/e2e/README.md)

---

## 9. バージョン管理

### 重要なバージョン固定

| パッケージ           | バージョン | 理由                           |
| -------------------- | ---------- | ------------------------------ |
| **Next.js**          | 15.1.3     | 安定版、App Router完全サポート |
| **React**            | 19.0.0     | Server Components対応          |
| **TypeScript**       | 5.7.2      | 最新機能、型推論強化           |
| **Prisma**           | 5.22.0     | PostgreSQL 15対応、安定版      |
| **AWS CDK**          | 2.169.0    | 最新AWSサービス対応            |
| **Node.js (Lambda)** | 20.x       | LTS、Lambda最新ランタイム      |

### セマンティックバージョニング

```json
{
  "dependencies": {
    "next": "15.1.3", // 固定
    "@aws-sdk/client-bedrock-runtime": "^3.0.0" // 自動更新許可
  },
  "devDependencies": {
    "@types/node": "^20.0.0" // 型定義は最新追従
  }
}
```

---

## 関連ドキュメント

- [AWSサーバーレス構成](../infrastructure/AWS_SERVERLESS.md)
- [システムアーキテクチャ](../architecture/SYSTEM_ARCHITECTURE.md)
- [データベース設計](../development/DATABASE_DESIGN.md)
- [API設計](../development/API_DESIGN.md)
- [FAQ](./FAQ.md)
- [用語集](./GLOSSARY.md)

---

**最終更新:** 2026-03-05
**次回レビュー予定:** Phase 1 完了時
