# 多言語対応システム

**バージョン:** 1.0
**最終更新:** 2026-03-05
**ステータス:** 設計完了

---

## 目次

1. [概要](#概要)
2. [設計原則](#設計原則)
3. [言語リソース管理](#言語リソース管理)
4. [実装アーキテクチャ](#実装アーキテクチャ)
5. [言語追加プロセス](#言語追加プロセス)
6. [UI実装](#ui実装)
7. [実装ガイド](#実装ガイド)

---

## 概要

多言語対応システムは、プラットフォームのUI、シナリオ、レポートを**複数言語で提供**し、グローバル展開を可能にする基盤システムです。

### 主要機能

| 機能 | 説明 |
| ---- | ---- |
| **コード変更不要** | 言語リソースファイルのみで新言語追加 |
| **ホットデプロイ** | リビルド不要で即座に反映 |
| **UI多言語化** | すべての表示テキストを多言語対応 |
| **シナリオ多言語化** | アバターセリフ、評価基準の多言語対応 |
| **レポート多言語化** | PDFレポート、メール通知の多言語対応 |
| **言語選択** | ユーザー・組織単位の言語設定 |
| **フォールバック** | 未翻訳キーは英語で表示 |

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

## 設計原則

### 1. 文字列の完全分離

❌ **悪い例（ハードコード）:**
```typescript
const message = "セッションを開始しました";
const error = "エラーが発生しました";
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
  "namespaces": [
    "common",
    "auth",
    "dashboard",
    "session",
    "report",
    "errors"
  ]
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

### ステップ3: 自動処理

```typescript
// POST /api/v1/languages
export const addLanguage: APIGatewayProxyHandler = async (event) => {
  const { languageCode, languageName, nativeName, flag, files } = JSON.parse(event.body);

  // 1. S3にアップロード
  await Promise.all(
    files.map(file =>
      s3.putObject({
        Bucket: 'prance-language-resources',
        Key: `${languageCode}/${file.name}`,
        Body: file.content,
        ContentType: 'application/json',
      })
    )
  );

  // 2. メタデータ更新
  const metadata = await getMetadata();
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

  await s3.putObject({
    Bucket: 'prance-language-resources',
    Key: 'metadata.json',
    Body: JSON.stringify(metadata, null, 2),
    ContentType: 'application/json',
  });

  // 3. CloudFrontキャッシュ無効化
  await cloudfront.createInvalidation({
    DistributionId: process.env.CLOUDFRONT_DISTRIBUTION_ID,
    InvalidationBatch: {
      CallerReference: Date.now().toString(),
      Paths: {
        Quantity: 1,
        Items: [`/${languageCode}/*`, '/metadata.json'],
      },
    },
  });

  // 4. 通知送信
  await sns.publish({
    TopicArn: process.env.ADMIN_TOPIC_ARN,
    Subject: 'New language added',
    Message: `Language ${languageName} (${languageCode}) has been added successfully.`,
  });

  return {
    statusCode: 201,
    body: JSON.stringify({ success: true, languageCode }),
  };
};
```

---

## UI実装

### Next.js設定

```typescript
// next.config.js
const withNextIntl = require('next-intl/plugin')();

module.exports = withNextIntl({
  i18n: {
    locales: ['en', 'ja', 'zh-CN'],
    defaultLocale: 'en',
    localeDetection: true, // ブラウザ言語自動検出
  },
});
```

```typescript
// middleware.ts
import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  locales: ['en', 'ja', 'zh-CN'],
  defaultLocale: 'en',
  localePrefix: 'as-needed', // /en/... は /... にリダイレクト
});

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
```

### 翻訳Hook使用例

```typescript
// app/[locale]/dashboard/page.tsx
'use client';

import { useTranslations } from 'next-intl';

export default function DashboardPage() {
  const t = useTranslations('dashboard');

  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('welcome', { name: 'John' })}</p>

      <button>{t('session.create')}</button>

      <div>
        {t('stats.sessions', { count: 45 })}
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

import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';

export default function LanguageSwitcher() {
  const t = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const languages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'ja', name: '日本語', flag: '🇯🇵' },
  ];

  const changeLanguage = (newLocale: string) => {
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPath);
  };

  return (
    <select
      value={locale}
      onChange={(e) => changeLanguage(e.target.value)}
      className="language-switcher"
    >
      {languages.map((lang) => (
        <option key={lang.code} value={lang.code}>
          {lang.flag} {lang.name}
        </option>
      ))}
    </select>
  );
}
```

---

## 実装ガイド

### フォールバック機構

```typescript
// lib/i18n/fallback.ts
export function getTranslation(
  locale: string,
  key: string,
  params?: Record<string, any>
): string {
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

多言語対応システムは、以下の価値を提供します：

✅ **グローバル展開**: 複数言語でのサービス提供
✅ **コード変更不要**: 言語リソースファイルのみで新言語追加
✅ **ホットデプロイ**: リビルド不要で即座に反映
✅ **高速配信**: CloudFront CDNによる世界中への高速配信
✅ **保守性**: 文字列の一元管理、翻訳の容易性
✅ **スケーラビリティ**: 言語数が増えてもパフォーマンス影響なし

このシステムにより、プラットフォームは簡単に新しい市場へ展開でき、各地域のユーザーに最適化された体験を提供できます。

---

**関連ドキュメント:**
- [UI/UX設計](../design/UI_UX.md)
- [フロントエンド開発](../development/FRONTEND.md)
