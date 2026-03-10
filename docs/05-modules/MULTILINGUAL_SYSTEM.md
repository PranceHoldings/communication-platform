# 多言語対応システム

**バージョン:** 2.1
**最終更新:** 2026-03-05
**ステータス:** Phase 1 実装完了（言語検出・Cookie管理）

---

## 目次

1. [概要](#概要)
2. [URL設計と言語検出](#url設計と言語検出)
3. [設計原則](#設計原則)
4. [言語リソース管理](#言語リソース管理)
5. [実装アーキテクチャ](#実装アーキテクチャ)
6. [言語追加プロセス](#言語追加プロセス)
7. [UI実装](#ui実装)
8. [実装ガイド](#実装ガイド)

---

## 概要

多言語対応システムは、プラットフォームのUI、シナリオ、レポートを**複数言語で提供**し、グローバル展開を可能にする基盤システムです。

### 主要機能

| 機能                 | 説明                                 |
| -------------------- | ------------------------------------ |
| **コード変更不要**   | 言語リソースファイルのみで新言語追加 |
| **ホットデプロイ**   | リビルド不要で即座に反映             |
| **UI多言語化**       | すべての表示テキストを多言語対応     |
| **シナリオ多言語化** | アバターセリフ、評価基準の多言語対応 |
| **レポート多言語化** | PDFレポート、メール通知の多言語対応  |
| **言語選択**         | ユーザー・組織単位の言語設定         |
| **フォールバック**   | 未翻訳キーは英語で表示               |

### サポート言語

#### Phase 1（初期リリース）

- 🇺🇸 英語（en）- デフォルト
- 🇯🇵 日本語（ja）

#### Phase 2（将来的に追加予定）

- 🇨🇳 中国語（簡体字）（zh-CN）
- 🇰🇷 韓国語（ko）
- 🇪🇸 スペイン語（es）
- 🇫🇷 フランス語（fr）
- 🇩🇪 ドイツ語（de）

---

## URL設計と言語検出

### URL設計: 全言語共通URL

**重要:** Pranceプラットフォームでは、**全言語で同一のURLを使用**します。URLにロケールプレフィックス（`/en/`, `/ja/`など）は含めません。

#### ✅ 正しいURL設計

```
https://platform.prance.co.jp/dashboard
https://platform.prance.co.jp/sessions
https://platform.prance.co.jp/reports
```

すべてのユーザーが同じURLにアクセスし、言語はCookieとブラウザ設定によって自動的に決定されます。

#### ❌ 使用しないURL設計

```
https://platform.prance.co.jp/en/dashboard   ← 使用しない
https://platform.prance.co.jp/ja/dashboard   ← 使用しない
https://en.platform.prance.co.jp/dashboard   ← 使用しない
```

**理由:**

- URLの共有が容易（言語に関係なく同じリンクを共有できる）
- SEO最適化（canonical URLが1つのみ）
- シンプルなルーティング（next-intlのロケールプレフィックス不要）

---

### 言語検出ロジック

言語は以下の**優先順位**で自動検出されます：

```
1. Cookie ('NEXT_LOCALE')
   ↓ なし
2. Accept-Language ヘッダー（ブラウザ設定）
   ↓ なし or サポート外言語
3. デフォルト言語（英語: en）
```

#### 1. Cookie優先（ユーザー設定）

ユーザーがUI上で言語を明示的に選択した場合、その言語を**Cookie**に保存します。

```typescript
// Cookieに言語を保存
document.cookie = `NEXT_LOCALE=ja; path=/; max-age=31536000; SameSite=Lax`;
```

**Cookie仕様:**

- **名前**: `NEXT_LOCALE`
- **値**: 言語コード（例: `en`, `ja`, `zh-CN`）
- **有効期限**: 1年（`max-age=31536000`）
- **パス**: `/`（全ページで有効）
- **SameSite**: `Lax`（CSRF対策）

#### 2. ブラウザ設定（Accept-Language）

Cookieが存在しない、または初回アクセス時は、ブラウザの`Accept-Language`ヘッダーから言語を検出します。

```
Accept-Language: ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7
                 ↓
                 ja (日本語) を選択
```

**検出ロジック:**

```typescript
function detectLanguageFromHeader(acceptLanguage: string): string {
  const supportedLocales = ['en', 'ja', 'zh-CN', 'ko', 'es', 'fr', 'de'];
  const languages = acceptLanguage.split(',').map(lang => {
    const [code, qValue] = lang.trim().split(';q=');
    return { code: code.split('-')[0], q: qValue ? parseFloat(qValue) : 1.0 };
  });

  languages.sort((a, b) => b.q - a.q);

  for (const lang of languages) {
    if (supportedLocales.includes(lang.code)) {
      return lang.code;
    }
  }

  return 'en'; // デフォルト: 英語
}
```

#### 3. デフォルト言語（英語）

CookieもAccept-Languageも有効な言語を提供しない場合、**英語（en）**をデフォルトとして使用します。

---

### 言語切り替えフロー

```
┌─────────────────────────────────────────────────────────┐
│ ユーザーがページにアクセス                                │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│ Middleware: 言語検出                                     │
│ 1. Cookie 'NEXT_LOCALE' をチェック                       │
│    ├─ あり → その言語を使用                              │
│    └─ なし → 2へ                                         │
│                                                          │
│ 2. Accept-Language ヘッダーをチェック                    │
│    ├─ サポート言語あり → その言語を使用                  │
│    └─ なし → 3へ                                         │
│                                                          │
│ 3. デフォルト言語（en）を使用                            │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│ 言語リソースを読み込み                                    │
│ - S3 + CloudFront から JSON リソース取得                 │
│ - ブラウザキャッシュ（5分）                               │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│ ページレンダリング（選択された言語）                      │
└─────────────────────────────────────────────────────────┘
```

---

### ユーザーがUI上で言語を変更した場合

```
┌─────────────────────────────────────────────────────────┐
│ ユーザーがヘッダーの言語選択ドロップダウンをクリック      │
│ 例: 🇯🇵 日本語 → 🇺🇸 English                             │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│ フロントエンド: Cookie更新                                │
│ document.cookie = 'NEXT_LOCALE=en; ...'                 │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│ ページリロード（location.reload()）                       │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│ Middleware: Cookie 'NEXT_LOCALE=en' を検出               │
│ → 英語でページをレンダリング                              │
└─────────────────────────────────────────────────────────┘
```

**次回アクセス時:**

- Cookieが保持されているため、自動的に選択した言語（英語）で表示
- ユーザーが再度UI上で変更するまで、この言語を使用

---

### 言語設定の集中管理

言語検出と取得は**単一のMiddleware**で一元管理します。各ページやコンポーネントで個別に言語判定を行いません。

```typescript
// apps/web/middleware.ts
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // 1. Cookie から言語取得
  let locale = request.cookies.get('NEXT_LOCALE')?.value;

  // 2. Cookieがなければ Accept-Language から検出
  if (!locale) {
    const acceptLanguage = request.headers.get('accept-language');
    locale = detectLanguageFromHeader(acceptLanguage || '');
  }

  // 3. サポート言語チェック
  const supportedLocales = ['en', 'ja', 'zh-CN', 'ko'];
  if (!supportedLocales.includes(locale)) {
    locale = 'en'; // デフォルト
  }

  // 4. リクエストヘッダーに言語を追加（App Routerで使用）
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-locale', locale);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
```

---

### フォールバック戦略

言語リソースに翻訳が存在しない場合、**英語（en）にフォールバック**します。

#### フォールバックの仕組み

```typescript
function translate(key: string, locale: string): string {
  // 1. 選択言語のリソースを確認
  const translation = resources[locale]?.[key];
  if (translation) {
    return translation;
  }

  // 2. 英語（デフォルト言語）にフォールバック
  const fallback = resources['en']?.[key];
  if (fallback) {
    console.warn(
      `Translation missing for key "${key}" in locale "${locale}", using English fallback`
    );
    return fallback;
  }

  // 3. キーがどの言語にも存在しない場合
  console.error(`Translation missing for key "${key}" in all locales`);
  return key; // キー名をそのまま表示（開発時にデバッグしやすい）
}
```

#### フォールバック例

```typescript
// ユーザーの言語: 日本語 (ja)
// キー: 'dashboard.newFeature'

// ケース1: 日本語リソースに存在
resources = {
  ja: { 'dashboard.newFeature': '新機能' },
  en: { 'dashboard.newFeature': 'New Feature' }
};
→ 結果: "新機能"

// ケース2: 日本語リソースに存在しない（英語にフォールバック）
resources = {
  ja: { /* キーなし */ },
  en: { 'dashboard.newFeature': 'New Feature' }
};
→ 結果: "New Feature" + 警告ログ

// ケース3: どの言語にも存在しない
resources = {
  ja: { /* キーなし */ },
  en: { /* キーなし */ }
};
→ 結果: "dashboard.newFeature" + エラーログ
```

---

## 設計原則

### 1. 文字列の完全分離

❌ **悪い例（ハードコード）:**

```typescript
const message = 'セッションを開始しました';
const error = 'エラーが発生しました';
```

✅ **良い例（言語リソース使用）:**

```typescript
const message = t('session.started');
const error = t('error.generic');
```

### 2. コード変更不要

新しい言語を追加する際、**ソースコードの変更は一切不要**です。

```
言語追加フロー:
1. 言語リソースファイル作成（JSON/YAML）
2. スーパー管理者UIからアップロード
3. S3 + CloudFrontに配置
4. 即座に利用可能（リビルド不要）
```

### 3. ホットデプロイ

言語リソースを更新しても、**アプリケーションの再ビルド・再デプロイは不要**です。

```
更新フロー:
1. 管理画面で言語リソース編集
2. S3に保存
3. CloudFront CDNキャッシュ無効化
4. 次回ページロード時に反映（1-5分）
```

### 4. ハードコード禁止（ESLint検出）

```typescript
// ESLint設定: .eslintrc.js
module.exports = {
  rules: {
    'no-hardcoded-strings': [
      'error',
      {
        // 許可されるパターン
        allow: [
          /^[a-z0-9._-]+$/, // キー名（例: 'session.started'）
          /^(https?:\/\/)/, // URL
          /^\//, // パス
        ],
      },
    ],
  },
};
```

---

## 言語リソース管理

### リソースファイル構造

```
s3://prance-language-resources/
├── en/
│   ├── common.json
│   ├── auth.json
│   ├── dashboard.json
│   ├── session.json
│   ├── report.json
│   └── errors.json
├── ja/
│   ├── common.json
│   ├── auth.json
│   ├── dashboard.json
│   ├── session.json
│   ├── report.json
│   └── errors.json
└── metadata.json  # 言語リストと設定
```

### リソースファイル例

```json
// s3://prance-language-resources/ja/session.json
{
  "session": {
    "title": "セッション",
    "start": "セッション開始",
    "end": "セッション終了",
    "started": "セッションを開始しました",
    "ended": "セッションを終了しました",
    "duration": "所要時間: {minutes}分",
    "status": {
      "pending": "待機中",
      "in_progress": "進行中",
      "completed": "完了",
      "failed": "失敗"
    },
    "create": {
      "title": "新しいセッションを作成",
      "selectScenario": "シナリオを選択してください",
      "selectAvatar": "アバターを選択してください",
      "submit": "セッション開始"
    },
    "errors": {
      "notFound": "セッションが見つかりません",
      "limitExceeded": "月間セッション数の上限に達しました",
      "genericError": "エラーが発生しました: {message}"
    }
  }
}
```

```json
// s3://prance-language-resources/en/session.json
{
  "session": {
    "title": "Session",
    "start": "Start Session",
    "end": "End Session",
    "started": "Session started",
    "ended": "Session ended",
    "duration": "Duration: {minutes} min",
    "status": {
      "pending": "Pending",
      "in_progress": "In Progress",
      "completed": "Completed",
      "failed": "Failed"
    },
    "create": {
      "title": "Create New Session",
      "selectScenario": "Please select a scenario",
      "selectAvatar": "Please select an avatar",
      "submit": "Start Session"
    },
    "errors": {
      "notFound": "Session not found",
      "limitExceeded": "Monthly session limit exceeded",
      "genericError": "An error occurred: {message}"
    }
  }
}
```

### メタデータファイル

```json
// s3://prance-language-resources/metadata.json
{
  "version": "1.2.0",
  "lastUpdated": "2026-03-05T10:30:00Z",
  "languages": [
    {
      "code": "en",
      "name": "English",
      "nativeName": "English",
      "flag": "🇺🇸",
      "direction": "ltr",
      "isDefault": true,
      "completeness": 100
    },
    {
      "code": "ja",
      "name": "Japanese",
      "nativeName": "日本語",
      "flag": "🇯🇵",
      "direction": "ltr",
      "isDefault": false,
      "completeness": 98
    }
  ],
  "namespaces": ["common", "auth", "dashboard", "session", "report", "errors"]
}
```

---

## 実装アーキテクチャ

### システム構成

```
┌─────────────────────────────────────────────────────────────┐
│ フロントエンド (Next.js)                                    │
│ - next-intl                                                 │
│ - i18n Middleware                                           │
│ - useTranslations() Hook                                    │
└────────────┬────────────────────────────────────────────────┘
             │ HTTP Request
             ▼
┌─────────────────────────────────────────────────────────────┐
│ CloudFront CDN                                              │
│ - 言語リソースをキャッシュ（TTL: 5分）                     │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ S3 Bucket: prance-language-resources                        │
│ - 言語リソースファイル（JSON）                             │
│ - Public Read Access（署名付きURL不要）                    │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ Lambda: Language Resource Manager                           │
│ - リソース更新API                                           │
│ - CloudFrontキャッシュ無効化                                │
└─────────────────────────────────────────────────────────────┘
```

### キャッシュ戦略

```
ブラウザキャッシュ
  ↓ (5分)
CloudFront CDN
  ↓ (キャッシュミス時)
S3オリジン
```

**キャッシュ無効化:**

- 言語リソース更新時にCloudFront Invalidation APIを呼び出し
- 通常1-5分で全世界に反映

---

## 言語追加プロセス

### ステップ1: 言語リソース作成

```bash
# 新しい言語ディレクトリ作成
mkdir -p language-resources/zh-CN

# 英語リソースをコピーして翻訳
cp language-resources/en/*.json language-resources/zh-CN/

# 各ファイルを翻訳
# （翻訳者またはAI翻訳ツール使用）
```

### ステップ2: スーパー管理者UIでアップロード

```
┌──────────────────────────────────────────────────────────────┐
│ 言語リソース管理（スーパー管理者専用）                        │
├──────────────────────────────────────────────────────────────┤
│ 現在の言語                                                    │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ 🇺🇸 English (en)                          [デフォルト]  │   │
│ │ 完成度: 100% | 最終更新: 2026-03-01                    │   │
│ │ [編集] [ダウンロード]                                  │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ 🇯🇵 日本語 (ja)                                         │   │
│ │ 完成度: 98% (未翻訳: 23キー) | 最終更新: 2026-03-05   │   │
│ │ [編集] [ダウンロード] [削除]                           │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ 新しい言語を追加                              [+ 追加]       │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ 言語コード: [zh-CN]                                    │   │
│ │ 言語名: [中国語（簡体字）]                             │   │
│ │ ネイティブ名: [简体中文]                               │   │
│ │ フラグ: [🇨🇳]                                           │   │
│ │                                                        │   │
│ │ リソースファイルをアップロード:                        │   │
│ │ [ファイル選択] zh-CN.zip                               │   │
│ │                                                        │   │
│ │ または既存言語から複製:                                │   │
│ │ [English (en) ▼] [複製]                                │   │
│ │                                                        │   │
│ │ [キャンセル] [追加]                                    │   │
│ └────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### ステップ3: 自動処理（ホットデプロイ）

**重要**: 言語リソースをアップロードすると、**アプリケーションの再ビルド・再デプロイなし**で即座に反映されます。

#### ホットデプロイの仕組み

```
┌──────────────────────────────────────────────────────────┐
│ 1. スーパー管理者が言語リソースをアップロード            │
│    (UI: /admin/languages/upload)                        │
└──────────────┬───────────────────────────────────────────┘
               │ POST /api/v1/admin/languages
               ▼
┌──────────────────────────────────────────────────────────┐
│ 2. Lambda: Language Resource Manager                    │
│    - リソースファイルをS3にアップロード                  │
│    - metadata.json を更新                                │
└──────────────┬───────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────┐
│ 3. CloudFront キャッシュ無効化                           │
│    - 新しい言語のパス: /{languageCode}/*                 │
│    - メタデータ: /metadata.json                          │
└──────────────┬───────────────────────────────────────────┘
               │ (1-5分で完了)
               ▼
┌──────────────────────────────────────────────────────────┐
│ 4. 次回ページロード時に新言語が利用可能                  │
│    - ユーザーは言語選択ドロップダウンから選択可能        │
│    - Cookieに保存され、以降は自動的にその言語で表示      │
└──────────────────────────────────────────────────────────┘
```

#### Lambda実装例

```typescript
// infrastructure/lambda/admin/languages/upload.ts
import { APIGatewayProxyHandler } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

const s3 = new S3Client({ region: 'us-east-1' });
const cloudfront = new CloudFrontClient({ region: 'us-east-1' });
const sns = new SNSClient({ region: 'us-east-1' });

export const handler: APIGatewayProxyHandler = async event => {
  const { languageCode, languageName, nativeName, flag, files } = JSON.parse(event.body || '{}');

  console.log(`Adding language: ${languageName} (${languageCode})`);

  try {
    // 1. S3にリソースファイルをアップロード
    await Promise.all(
      files.map((file: { name: string; content: string }) =>
        s3.send(
          new PutObjectCommand({
            Bucket: 'prance-language-resources',
            Key: `${languageCode}/${file.name}`,
            Body: file.content,
            ContentType: 'application/json',
            CacheControl: 'public, max-age=300', // 5分キャッシュ
          })
        )
      )
    );

    // 2. metadata.jsonを更新
    const metadataResponse = await s3.send(
      new GetObjectCommand({
        Bucket: 'prance-language-resources',
        Key: 'metadata.json',
      })
    );
    const metadata = JSON.parse(await metadataResponse.Body.transformToString());

    metadata.languages.push({
      code: languageCode,
      name: languageName,
      nativeName,
      flag,
      direction: 'ltr',
      isDefault: false,
      completeness: 100,
    });
    metadata.lastUpdated = new Date().toISOString();
    metadata.version = incrementVersion(metadata.version);

    await s3.send(
      new PutObjectCommand({
        Bucket: 'prance-language-resources',
        Key: 'metadata.json',
        Body: JSON.stringify(metadata, null, 2),
        ContentType: 'application/json',
        CacheControl: 'public, max-age=300',
      })
    );

    // 3. CloudFrontキャッシュ無効化（重要！）
    await cloudfront.send(
      new CreateInvalidationCommand({
        DistributionId: process.env.CLOUDFRONT_DISTRIBUTION_ID!,
        InvalidationBatch: {
          CallerReference: `lang-${languageCode}-${Date.now()}`,
          Paths: {
            Quantity: 2,
            Items: [`/${languageCode}/*`, '/metadata.json'],
          },
        },
      })
    );

    console.log(`CloudFront cache invalidated for language: ${languageCode}`);

    // 4. 管理者に通知
    await sns.send(
      new PublishCommand({
        TopicArn: process.env.ADMIN_TOPIC_ARN!,
        Subject: `New language added: ${languageName}`,
        Message: `Language "${languageName}" (${languageCode}) has been successfully added to Prance Platform.\n\nThe new language is now available for all users. CloudFront cache invalidation is in progress (1-5 minutes).`,
      })
    );

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        languageCode,
        message: `Language ${languageName} added successfully. It will be available to users within 5 minutes.`,
      }),
    };
  } catch (error) {
    console.error('Error adding language:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};

function incrementVersion(version: string): string {
  const [major, minor, patch] = version.split('.').map(Number);
  return `${major}.${minor}.${patch + 1}`;
}
```

#### ホットデプロイのメリット

| メリット             | 説明                                   |
| -------------------- | -------------------------------------- |
| **迅速な展開**       | 新言語を1-5分で追加可能（ビルド不要）  |
| **ダウンタイムゼロ** | サービス停止なしで言語追加             |
| **コスト削減**       | CI/CD パイプライン不要、Lambda実行のみ |
| **A/Bテスト**        | 言語リソースのA/Bテストが容易          |
| **即座に修正**       | 翻訳ミスをすぐに修正可能               |

#### 注意事項

1. **CloudFrontキャッシュ無効化は必須**: 無効化しないと、古いリソースが最大5分間配信される
2. **メタデータ更新を忘れない**: `metadata.json`を更新しないと、UIに言語選択肢が表示されない
3. **完全性チェック**: すべての必須キーが翻訳されているか確認する
4. **ロールバック準備**: 問題がある場合に備えて、前バージョンのリソースを保持する

---

## UI実装

### Next.js Middleware（言語検出）

**重要**: URLにロケールプレフィックスは使用しません。言語はCookieとAccept-Languageヘッダーで検出します。

```typescript
// apps/web/middleware.ts
import { NextRequest, NextResponse } from 'next/server';

const supportedLocales = ['en', 'ja', 'zh-CN', 'ko', 'es', 'fr', 'de'];
const defaultLocale = 'en';

/**
 * Accept-Languageヘッダーから言語を検出
 */
function detectLanguageFromHeader(acceptLanguage: string | null): string {
  if (!acceptLanguage) return defaultLocale;

  const languages = acceptLanguage.split(',').map(lang => {
    const [code, qValue] = lang.trim().split(';q=');
    const baseCode = code.split('-')[0].toLowerCase();
    return { code: baseCode, q: qValue ? parseFloat(qValue) : 1.0 };
  });

  // 品質値で降順ソート
  languages.sort((a, b) => b.q - a.q);

  // サポートされている言語を優先的に選択
  for (const lang of languages) {
    if (supportedLocales.includes(lang.code)) {
      return lang.code;
    }
  }

  return defaultLocale;
}

export function middleware(request: NextRequest) {
  // 1. Cookieから言語を取得
  let locale = request.cookies.get('NEXT_LOCALE')?.value;

  // 2. Cookieがなければ Accept-Language ヘッダーから検出
  if (!locale || !supportedLocales.includes(locale)) {
    const acceptLanguage = request.headers.get('accept-language');
    locale = detectLanguageFromHeader(acceptLanguage);
  }

  // 3. リクエストヘッダーに言語を追加（コンポーネントで使用）
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-locale', locale);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // 4. Cookieに言語を保存（初回アクセス時）
  if (!request.cookies.get('NEXT_LOCALE')) {
    response.cookies.set('NEXT_LOCALE', locale, {
      path: '/',
      maxAge: 31536000, // 1年
      sameSite: 'lax',
    });
  }

  return response;
}

export const config = {
  // APIルート、静的ファイル、画像を除外
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
```

### 言語プロバイダー設定

```typescript
// apps/web/lib/i18n/provider.tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { headers } from 'next/headers';

interface I18nContextType {
  locale: string;
  messages: Record<string, any>;
  t: (key: string, params?: Record<string, any>) => string;
  setLocale: (locale: string) => void;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children, initialLocale, initialMessages }: {
  children: React.ReactNode;
  initialLocale: string;
  initialMessages: Record<string, any>;
}) {
  const [locale, setLocaleState] = useState(initialLocale);
  const [messages, setMessages] = useState(initialMessages);

  const t = (key: string, params?: Record<string, any>): string => {
    const keys = key.split('.');
    let value: any = messages;

    for (const k of keys) {
      value = value?.[k];
      if (value === undefined) {
        console.warn(`Translation missing: ${key} (locale: ${locale})`);
        return key; // キー名をそのまま返す
      }
    }

    // パラメータ置換
    if (params && typeof value === 'string') {
      return value.replace(/\{(\w+)\}/g, (_, param) => params[param] ?? `{${param}}`);
    }

    return value;
  };

  const setLocale = async (newLocale: string) => {
    // Cookieに保存
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;

    // 言語リソースを取得
    const response = await fetch(`https://cdn.prance.ai/languages/${newLocale}/common.json`);
    const newMessages = await response.json();

    setLocaleState(newLocale);
    setMessages(newMessages);

    // ページをリロードして新しい言語を反映
    window.location.reload();
  };

  return (
    <I18nContext.Provider value={{ locale, messages, t, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}
```

### 翻訳Hook使用例

```typescript
// app/dashboard/page.tsx
'use client';

import { useI18n } from '@/lib/i18n/provider';

export default function DashboardPage() {
  const { t } = useI18n();

  return (
    <div>
      <h1>{t('dashboard.title')}</h1>
      <p>{t('dashboard.welcome', { name: 'John' })}</p>

      <button>{t('dashboard.session.create')}</button>

      <div>
        {t('dashboard.stats.sessions', { count: 45 })}
      </div>
    </div>
  );
}
```

### 動的翻訳（サーバーサイド）

```typescript
// Lambda: Report Generator
import { createTranslator } from 'next-intl';

async function generateReport(sessionId: string, locale: string) {
  // 言語リソース取得
  const messages = await fetchMessages(locale);
  const t = createTranslator({ locale, messages });

  const report = {
    title: t('report.title'),
    summary: t('report.summary', { score: 85 }),
    recommendations: [
      t('report.recommendation.improve_communication'),
      t('report.recommendation.increase_confidence'),
    ],
  };

  return report;
}

// 言語リソース取得
async function fetchMessages(locale: string): Promise<Record<string, any>> {
  const response = await fetch(`https://cdn.prance.ai/languages/${locale}/report.json`);
  return response.json();
}
```

### 言語選択UI

```typescript
// components/LanguageSwitcher.tsx
'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n/provider';

export default function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  const [isLoading, setIsLoading] = useState(false);

  const languages = [
    { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
    { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
    { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '简体中文', flag: '🇨🇳' },
    { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  ];

  const handleLanguageChange = async (newLocale: string) => {
    if (newLocale === locale) return;

    setIsLoading(true);
    await setLocale(newLocale);
    // setLocale内でwindow.location.reload()が呼ばれるため、ここに到達しない
  };

  const currentLanguage = languages.find((lang) => lang.code === locale) || languages[0];

  return (
    <div className="relative inline-block text-left">
      <select
        value={locale}
        onChange={(e) => void handleLanguageChange(e.target.value)}
        disabled={isLoading}
        className="block w-full px-4 py-2 pr-8 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.flag} {lang.nativeName}
          </option>
        ))}
      </select>

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 rounded-lg">
          <svg className="animate-spin h-5 w-5 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      )}
    </div>
  );
}
```

---

## 実装ガイド

### フォールバック機構

```typescript
// lib/i18n/fallback.ts
export function getTranslation(locale: string, key: string, params?: Record<string, any>): string {
  const messages = loadMessages(locale);

  // 1. 指定言語で翻訳を取得
  let value = getNestedValue(messages, key);

  if (!value) {
    // 2. フォールバック（英語）
    const fallbackMessages = loadMessages('en');
    value = getNestedValue(fallbackMessages, key);

    // 3. 未翻訳キーをログ記録
    logMissingTranslation(locale, key);
  }

  if (!value) {
    // 4. キーそのものを返す（開発時にわかりやすい）
    return `[Missing: ${key}]`;
  }

  // 5. パラメータ置換
  return interpolate(value, params);
}

function interpolate(template: string, params?: Record<string, any>): string {
  if (!params) return template;

  return template.replace(/\{(\w+)\}/g, (_, key) => {
    return params[key]?.toString() || '';
  });
}

// 未翻訳キーの記録
function logMissingTranslation(locale: string, key: string) {
  // CloudWatch Logsに記録
  console.warn(`Missing translation: [${locale}] ${key}`);

  // DynamoDBに保存（後で一括翻訳）
  dynamodb.put({
    TableName: 'MissingTranslations',
    Item: {
      PK: `LOCALE#${locale}`,
      SK: `KEY#${key}`,
      locale,
      key,
      timestamp: Date.now(),
    },
  });
}
```

### 複数形対応

```json
// en/common.json
{
  "items": {
    "one": "{count} item",
    "other": "{count} items"
  },
  "sessions": {
    "zero": "No sessions",
    "one": "1 session",
    "other": "{count} sessions"
  }
}
```

```typescript
// 使用例
const t = useTranslations('common');

t('items', { count: 0 }); // "0 items"
t('items', { count: 1 }); // "1 item"
t('items', { count: 5 }); // "5 items"

t('sessions', { count: 0 }); // "No sessions"
t('sessions', { count: 1 }); // "1 session"
t('sessions', { count: 10 }); // "10 sessions"
```

### 日時・数値フォーマット

```typescript
import { useFormatter } from 'next-intl';

export default function DateTimeExample() {
  const format = useFormatter();

  const date = new Date('2026-03-05T10:30:00Z');
  const number = 1234567.89;

  return (
    <div>
      {/* 日付 */}
      <p>{format.dateTime(date, { dateStyle: 'full' })}</p>
      {/* en: Wednesday, March 5, 2026 */}
      {/* ja: 2026年3月5日水曜日 */}

      {/* 時刻 */}
      <p>{format.dateTime(date, { timeStyle: 'short' })}</p>
      {/* en: 10:30 AM */}
      {/* ja: 10:30 */}

      {/* 数値 */}
      <p>{format.number(number, { style: 'decimal' })}</p>
      {/* en: 1,234,567.89 */}
      {/* ja: 1,234,567.89 */}

      {/* 通貨 */}
      <p>{format.number(99, { style: 'currency', currency: 'USD' })}</p>
      {/* en: $99.00 */}
      {/* ja: $99.00 */}
    </div>
  );
}
```

---

## まとめ

### 重要なポイント（再確認）

#### 1. URL設計

- ✅ **全言語で共通URL**: `/dashboard`, `/sessions` など
- ❌ **ロケールプレフィックスなし**: `/en/dashboard`, `/ja/dashboard` は使用しない

#### 2. 言語検出の優先順位

1. **Cookie** (`NEXT_LOCALE`)
2. **Accept-Language** ヘッダー（ブラウザ設定）
3. **デフォルト言語**（英語: en）

#### 3. 言語切り替え

- ユーザーがUI上で言語を選択 → **Cookieに保存**
- 次回アクセス時に自動的に選択した言語で表示
- 明示的にUI上で変更するまでCookieを保持

#### 4. 言語リソース管理

- **S3 + CloudFront** で配信
- **ホットデプロイ**: スーパー管理者がアップロード → 1-5分で反映
- **フォールバック**: リソースがない場合は英語にフォールバック

#### 5. 集中管理

- 言語検出は**Middleware**で一元管理
- 各ページやコンポーネントで個別に言語判定を行わない

---

### システムの価値

✅ **グローバル展開**: 複数言語でのサービス提供
✅ **コード変更不要**: 言語リソースファイルのみで新言語追加
✅ **ホットデプロイ**: リビルド不要で即座に反映（1-5分）
✅ **シンプルなURL**: 全言語で同一URLを使用
✅ **ユーザー体験**: ブラウザ設定を自動検出、選択した言語を記憶
✅ **高速配信**: CloudFront CDNによる世界中への高速配信
✅ **保守性**: 文字列の一元管理、翻訳の容易性
✅ **スケーラビリティ**: 言語数が増えてもパフォーマンス影響なし
✅ **フォールバック**: 未翻訳キーは英語で表示

このシステムにより、プラットフォームは簡単に新しい市場へ展開でき、各地域のユーザーに最適化された体験を提供できます。

---

## 実装状況（Phase 1）

### ✅ 実装完了（2026-03-05）

#### 1. Next.js Middleware実装

**ファイル:** `apps/web/middleware.ts`

**実装内容:**

- URLパラメータ `lang` による言語切り替え（最優先）
- Cookie `NEXT_LOCALE` による言語保持
- Accept-Languageヘッダーからの自動検出
- デフォルト言語へのフォールバック

**言語検出の優先順位:**

```
1. URL parameter (?lang=en, ?lang=ja, etc.)
   → Cookie設定 + パラメータ削除してリダイレクト
2. Cookie (NEXT_LOCALE)
3. Accept-Language ヘッダー
4. デフォルト言語 (en)
```

**主要機能:**

1. **URLパラメータ検出**

   ```typescript
   // /?lang=en でアクセス → Cookieに保存して / にリダイレクト
   const langParam = searchParams.get('lang');
   if (langParam && supportedLocales.includes(langParam)) {
     searchParams.delete('lang');
     const cleanUrl = new URL(pathname + ..., request.url);
     const response = NextResponse.redirect(cleanUrl);
     response.cookies.set('NEXT_LOCALE', langParam, { ... });
     return response;
   }
   ```

2. **Cookie優先**

   ```typescript
   let locale = request.cookies.get('NEXT_LOCALE')?.value;
   ```

3. **Accept-Language検出**

   ```typescript
   function detectLanguageFromHeader(acceptLanguage: string | null): string {
     // 品質値で降順ソート、サポート言語を優先選択
     // 例: Accept-Language: ja,en;q=0.9,fr;q=0.8 → ja
   }
   ```

4. **リクエストヘッダーに言語を追加**
   ```typescript
   requestHeaders.set('x-locale', locale);
   ```

**テスト結果:**

```bash
# URLパラメータでの切り替え
curl 'http://localhost:3001/?lang=en' → 307 redirect to / + Cookie: NEXT_LOCALE=en
curl 'http://localhost:3001/?lang=ja' → 307 redirect to / + Cookie: NEXT_LOCALE=ja
curl 'http://localhost:3001/?lang=zh-CN' → 307 redirect to / + Cookie: NEXT_LOCALE=zh-CN

# Cookie保持
2回目のアクセス → Cookieから自動的に言語を読み取り

# Accept-Language検出
curl -H 'Accept-Language: ja,en;q=0.9' → HTML lang="ja"
curl -H 'Accept-Language: fr,en;q=0.9' → HTML lang="fr"
```

#### 2. RootLayout動的lang属性

**ファイル:** `apps/web/app/layout.tsx`

**実装内容:**

- MiddlewareでセットされたHTTPヘッダー `x-locale` を取得
- HTMLの`lang`属性を動的に設定

**コード:**

```typescript
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const locale = headersList.get('x-locale') || 'en';

  return (
    <html lang={locale} suppressHydrationWarning>
      {/* ... */}
    </html>
  );
}
```

**動作確認:**

```bash
# 言語毎に正しいlang属性が設定される
/?lang=en → <html lang="en">
/?lang=ja → <html lang="ja">
/?lang=zh-CN → <html lang="zh-CN">
```

#### 3. サポート言語

現在サポートされている言語（middleware.tsで定義）:

- 🇺🇸 英語（en）- デフォルト
- 🇯🇵 日本語（ja）
- 🇨🇳 中国語簡体字（zh-CN）
- 🇰🇷 韓国語（ko）
- 🇪🇸 スペイン語（es）
- 🇫🇷 フランス語（fr）
- 🇩🇪 ドイツ語（de）

### 🚧 未実装（Phase 2）

以下の機能はPhase 2で実装予定：

1. **I18nプロバイダー**
   - 言語リソースファイル（JSON）からテキストを読み込むシステム
   - `useI18n()` フック、`t()` 関数の実装

2. **言語リソースファイル**
   - `messages/en.json`, `messages/ja.json` 等の作成
   - 各ページ・コンポーネントの翻訳キー定義

3. **LanguageSwitcherコンポーネント**
   - ヘッダーに配置する言語切り替えUI
   - ドロップダウンまたはフラグアイコン選択

4. **既存ページの多言語化**
   - ハードコードされたテキストをI18nキーに置き換え
   - すべてのUIテキストを翻訳可能にする

5. **ホットデプロイシステム**
   - スーパー管理者UIからの言語リソースアップロード
   - S3 + CloudFrontへのデプロイ
   - キャッシュ無効化

### 技術的メモ

**Cookie仕様（実装済み）:**

```typescript
{
  name: 'NEXT_LOCALE',
  path: '/',
  maxAge: 31536000, // 1年
  sameSite: 'lax',
  httpOnly: false, // JavaScript アクセス許可（言語切り替えUI用）
}
```

**Matcher設定（実装済み）:**

```typescript
export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
```

- APIルート、Next.js内部ファイル、静的ファイルを除外
- すべてのページリクエストでMiddlewareが実行される

---

**関連ドキュメント:**

- [UI/UX設計](../design/UI_UX.md)
- [フロントエンド開発](../development/FRONTEND.md)
