# 多言語対応 - 影響を受けるファイル一覧

**バージョン:** 1.0
**作成日:** 2026-03-08
**目的:** Phase 2多言語対応実装時に**変更・確認が必要なすべてのファイル**を網羅

---

## 📋 使い方

Phase 2実装時に、このリストのすべてのファイルを確認・更新してください。

**記号の意味:**

- 🔴 **必須変更** - 必ず修正が必要
- 🟡 **確認必須** - ハードコードがないか確認
- 🟢 **新規作成** - Phase 2で新規作成
- ⚪ **任意** - 必要に応じて変更

---

## 🎯 Phase 1現状（ベースライン）

### ハードコードされた言語リスト（Phase 1で最小化済み）

**現在のデフォルト値:**

```typescript
// ✅ 最小限のデフォルト値のみ（Phase 1）
DEFAULT_STT_AUTO_DETECT_LANGUAGES = ['ja-JP', 'en-US'];
```

**Phase 2で削除/動的化する箇所:**

- このリストを環境変数またはデータベースから取得

---

## 📂 影響を受けるファイル

### 1. バックエンド - Lambda Functions

#### 1.1 言語取得・管理

| ファイルパス                                      | 状態    | 変更内容                                                  |
| ------------------------------------------------- | ------- | --------------------------------------------------------- |
| `infrastructure/lambda/languages/list/index.ts`   | 🟢 新規 | GET `/api/v1/languages` - 言語一覧取得                    |
| `infrastructure/lambda/languages/get/index.ts`    | 🟢 新規 | GET `/api/v1/languages/:code` - 言語詳細取得              |
| `infrastructure/lambda/languages/create/index.ts` | 🟢 新規 | POST `/api/v1/languages` - 言語追加（管理者のみ）         |
| `infrastructure/lambda/languages/update/index.ts` | 🟢 新規 | PUT `/api/v1/languages/:code` - 言語更新（管理者のみ）    |
| `infrastructure/lambda/languages/delete/index.ts` | 🟢 新規 | DELETE `/api/v1/languages/:code` - 言語削除（管理者のみ） |

**実装詳細:**

```typescript
// infrastructure/lambda/languages/list/index.ts
export const handler = async (): Promise<APIGatewayProxyResultV2> => {
  try {
    // 方法1: S3から言語リソースファイルを読み込み
    const languages = await getLanguagesFromS3();

    // 方法2: データベースから取得
    // const languages = await prisma.language.findMany({ where: { enabled: true } });

    return {
      statusCode: 200,
      body: JSON.stringify({ languages }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch languages' }),
    };
  }
};
```

#### 1.2 STT（音声認識）

| ファイルパス                                                 | 状態    | 変更内容                                 |
| ------------------------------------------------------------ | ------- | ---------------------------------------- |
| `infrastructure/lambda/shared/audio/stt-azure.ts`            | ✅ 完了 | 自動言語検出実装済み（Phase 1）          |
| `infrastructure/lambda/websocket/default/audio-processor.ts` | ✅ 完了 | `autoDetectLanguages`パラメータ対応済み  |
| `infrastructure/lambda/websocket/default/index.ts`           | 🔴 必須 | AudioProcessor初期化を動的言語取得に変更 |

**変更箇所:**

```typescript
// 現在（Phase 1）:
const autoDetectLanguages = process.env.STT_AUTO_DETECT_LANGUAGES
  ? process.env.STT_AUTO_DETECT_LANGUAGES.split(',')
  : DEFAULT_STT_AUTO_DETECT_LANGUAGES; // ← ハードコード

// Phase 2で変更:
const autoDetectLanguages = await getAvailableSTTLanguages(); // ← 動的取得
```

#### 1.3 共有ヘルパー関数

| ファイルパス                                                       | 状態    | 変更内容                   |
| ------------------------------------------------------------------ | ------- | -------------------------- |
| `infrastructure/lambda/shared/language/get-available-languages.ts` | 🟢 新規 | 利用可能な言語を動的取得   |
| `infrastructure/lambda/shared/language/get-stt-languages.ts`       | 🟢 新規 | STT候補言語を動的取得      |
| `infrastructure/lambda/shared/language/language-cache.ts`          | 🟢 新規 | 言語リストのキャッシュ管理 |

**実装例:**

```typescript
// infrastructure/lambda/shared/language/get-available-languages.ts
export interface Language {
  code: string; // "ja", "en", "zh"
  sttCode: string; // "ja-JP", "en-US", "zh-CN"
  displayName: string; // "日本語", "English", "中文"
  enabled: boolean;
}

/**
 * 利用可能な言語を取得（キャッシュ付き）
 */
export async function getAvailableLanguages(): Promise<Language[]> {
  // 1. キャッシュチェック
  const cached = await getCachedLanguages();
  if (cached) return cached;

  // 2. S3から言語リソースファイルを読み込み
  const languages = await loadLanguagesFromS3();

  // 3. キャッシュに保存（TTL: 5分）
  await cacheLanguages(languages, 300);

  return languages;
}

/**
 * STT候補言語を取得（組織設定を考慮）
 */
export async function getSTTCandidateLanguages(orgId?: string): Promise<string[]> {
  // 1. 組織設定を確認
  if (orgId) {
    const orgSettings = await getOrganizationSettings(orgId);
    if (orgSettings.sttCandidateLanguages) {
      return orgSettings.sttCandidateLanguages;
    }
  }

  // 2. デフォルト: すべての有効な言語
  const languages = await getAvailableLanguages();
  return languages.filter(l => l.enabled).map(l => l.sttCode);
}
```

#### 1.4 設定ファイル

| ファイルパス                                      | 状態    | 変更内容                                            |
| ------------------------------------------------- | ------- | --------------------------------------------------- |
| `infrastructure/lambda/shared/config/defaults.ts` | ✅ 完了 | フォールバック用最小限のデフォルト値のみ（Phase 1） |

**Phase 2で追加すべきコメント:**

```typescript
// ⚠️ 警告: 新言語を追加する場合、このファイルを変更しないこと
// 言語リソースファイル（apps/web/messages/{code}.json）を追加するか、
// 環境変数 STT_AUTO_DETECT_LANGUAGES を更新してください。
```

### 2. バックエンド - CDK Infrastructure

| ファイルパス                                    | 状態    | 変更内容                                        |
| ----------------------------------------------- | ------- | ----------------------------------------------- |
| `infrastructure/lib/stacks/api-lambda-stack.ts` | 🔴 必須 | 言語管理APIのLambda関数追加                     |
| `infrastructure/lib/stacks/storage-stack.ts`    | 🔴 必須 | 言語リソース用S3バケット追加                    |
| `infrastructure/lib/stacks/cloudfront-stack.ts` | 🟡 確認 | 言語リソースCDN配信設定                         |
| `infrastructure/lib/stacks/database-stack.ts`   | 🟡 確認 | `languages`テーブル追加（DB管理を選択した場合） |

**CDK変更例:**

```typescript
// infrastructure/lib/stacks/storage-stack.ts
export class StorageStack extends cdk.Stack {
  public readonly languageResourcesBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    // 言語リソース用S3バケット
    this.languageResourcesBucket = new s3.Bucket(this, 'LanguageResourcesBucket', {
      bucketName: `prance-language-resources-${props.env}`,
      versioned: true, // バージョニング有効化
      lifecycleRules: [
        {
          noncurrentVersionExpiration: cdk.Duration.days(30),
        },
      ],
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET],
          allowedOrigins: ['*'], // 本番では制限すべき
          allowedHeaders: ['*'],
        },
      ],
    });
  }
}
```

### 3. データベース（オプション）

| ファイルパス                             | 状態    | 変更内容                                        |
| ---------------------------------------- | ------- | ----------------------------------------------- |
| `packages/database/prisma/schema.prisma` | 🟡 確認 | `languages`テーブル追加（DB管理を選択した場合） |

**Prismaスキーマ例:**

```prisma
model Language {
  id          String   @id @default(uuid())
  code        String   @unique // "ja", "en", "zh"
  sttCode     String   // "ja-JP", "en-US", "zh-CN"
  displayName String   // "日本語", "English", "中文"
  enabled     Boolean  @default(true)
  sortOrder   Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([enabled])
  @@map("languages")
}
```

### 4. フロントエンド - API Client

| ファイルパス                    | 状態    | 変更内容            |
| ------------------------------- | ------- | ------------------- |
| `apps/web/lib/api/languages.ts` | 🟢 新規 | 言語取得API呼び出し |

**実装例:**

```typescript
// apps/web/lib/api/languages.ts
import { apiClient } from './client';

export interface Language {
  code: string;
  sttCode: string;
  displayName: string;
  enabled: boolean;
}

/**
 * 利用可能な言語一覧を取得
 */
export async function getAvailableLanguages(): Promise<Language[]> {
  const response = await apiClient.get<{ languages: Language[] }>('/languages');
  return response.languages;
}

/**
 * 言語リストをキャッシュ付きで取得
 */
let cachedLanguages: Language[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5分

export async function getCachedLanguages(): Promise<Language[]> {
  const now = Date.now();
  if (cachedLanguages && now - cacheTimestamp < CACHE_TTL) {
    return cachedLanguages;
  }

  cachedLanguages = await getAvailableLanguages();
  cacheTimestamp = now;
  return cachedLanguages;
}
```

### 5. フロントエンド - コンポーネント

#### 5.1 言語選択UI

| ファイルパス                                | 状態    | 変更内容                                     |
| ------------------------------------------- | ------- | -------------------------------------------- |
| `apps/web/components/language-selector.tsx` | 🔴 必須 | ハードコードされた言語リストを動的取得に変更 |
| `apps/web/app/(auth)/login/page.tsx`        | 🟡 確認 | 言語選択UIがある場合                         |
| `apps/web/components/navigation.tsx`        | 🟡 確認 | ナビゲーションの言語選択                     |

**変更前（Phase 1）:**

```typescript
// ❌ ハードコード
const languages = [
  { code: 'ja', label: '日本語' },
  { code: 'en', label: 'English' },
];
```

**変更後（Phase 2）:**

```typescript
// ✅ 動的取得
const { data: languages, isLoading } = useQuery('languages', getCachedLanguages);

return (
  <select>
    {languages?.map(lang => (
      <option key={lang.code} value={lang.code}>
        {lang.displayName}
      </option>
    ))}
  </select>
);
```

#### 5.2 管理者UI（新規）

| ファイルパス                                         | 状態    | 変更内容                   |
| ---------------------------------------------------- | ------- | -------------------------- |
| `apps/web/app/admin/languages/page.tsx`              | 🟢 新規 | 言語一覧表示               |
| `apps/web/app/admin/languages/new/page.tsx`          | 🟢 新規 | 言語追加フォーム           |
| `apps/web/app/admin/languages/[code]/page.tsx`       | 🟢 新規 | 言語編集フォーム           |
| `apps/web/components/admin/language-form.tsx`        | 🟢 新規 | 言語フォームコンポーネント |
| `apps/web/components/admin/translation-uploader.tsx` | 🟢 新規 | 翻訳ファイルアップローダー |

### 6. フロントエンド - i18n設定

| ファイルパス              | 状態    | 変更内容                                        |
| ------------------------- | ------- | ----------------------------------------------- |
| `apps/web/i18n/config.ts` | 🔴 必須 | ハードコードされた`locales`配列を動的取得に変更 |
| `apps/web/middleware.ts`  | 🔴 必須 | サポート言語の動的取得                          |

**変更箇所:**

```typescript
// apps/web/i18n/config.ts

// 現在（Phase 1）:
export const locales = ['en', 'ja'] as const; // ← ハードコード

// Phase 2で変更:
let cachedLocales: string[] | null = null;

export async function getLocales(): Promise<string[]> {
  if (cachedLocales) return cachedLocales;

  const languages = await getCachedLanguages();
  cachedLocales = languages.map(l => l.code);
  return cachedLocales;
}
```

### 7. 言語リソースファイル

| ファイルパス                | 状態    | 変更内容             |
| --------------------------- | ------- | -------------------- |
| `apps/web/messages/en.json` | 🔴 必須 | `meta`セクション追加 |
| `apps/web/messages/ja.json` | 🔴 必須 | `meta`セクション追加 |
| `apps/web/messages/zh.json` | 🟢 新規 | 中国語リソース（例） |
| `apps/web/messages/ko.json` | 🟢 新規 | 韓国語リソース（例） |

**フォーマット（Phase 2）:**

```json
{
  "meta": {
    "languageCode": "ja",
    "sttCode": "ja-JP",
    "displayName": "日本語",
    "enabled": true,
    "sortOrder": 1
  },
  "common": {
    "welcome": "ようこそ",
    ...
  },
  "auth": {
    "login": "ログイン",
    ...
  }
}
```

### 8. スクリプト

| ファイルパス                           | 状態    | 変更内容                           |
| -------------------------------------- | ------- | ---------------------------------- |
| `scripts/validate-language-files.ts`   | 🟢 新規 | 言語ファイルのバリデーション       |
| `scripts/deploy-language-resources.sh` | 🟢 新規 | 言語リソースのS3デプロイ           |
| `scripts/check-hardcoded-languages.sh` | 🟢 新規 | ハードコードされた言語リストを検出 |

**バリデーションスクリプト例:**

```typescript
// scripts/validate-language-files.ts
import * as fs from 'fs';
import * as path from 'path';

const MESSAGES_DIR = path.join(__dirname, '../apps/web/messages');

async function validateLanguageFiles() {
  const files = fs.readdirSync(MESSAGES_DIR).filter(f => f.endsWith('.json'));

  let hasError = false;

  for (const file of files) {
    const filePath = path.join(MESSAGES_DIR, file);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    // meta セクションのチェック
    if (!content.meta) {
      console.error(`❌ ${file}: 'meta' section is missing`);
      hasError = true;
      continue;
    }

    // 必須フィールドのチェック
    const required = ['languageCode', 'sttCode', 'displayName', 'enabled'];
    for (const field of required) {
      if (!(field in content.meta)) {
        console.error(`❌ ${file}: 'meta.${field}' is missing`);
        hasError = true;
      }
    }

    console.log(`✅ ${file}: Valid`);
  }

  if (hasError) {
    process.exit(1);
  }

  console.log('\n✅ All language files are valid');
}

validateLanguageFiles();
```

### 9. テスト

| ファイルパス                                               | 状態    | 変更内容                |
| ---------------------------------------------------------- | ------- | ----------------------- |
| `infrastructure/lambda/languages/__tests__/list.test.ts`   | 🟢 新規 | 言語一覧取得APIのテスト |
| `apps/web/__tests__/components/language-selector.test.tsx` | 🟡 確認 | 言語選択UIのテスト更新  |
| `apps/web/__tests__/i18n/dynamic-locales.test.ts`          | 🟢 新規 | 動的言語取得のテスト    |

### 10. ドキュメント

| ファイルパス                                                | 状態    | 変更内容                      |
| ----------------------------------------------------------- | ------- | ----------------------------- |
| `docs/modules/MULTILINGUAL_SYSTEM.md`                       | 🔴 必須 | Phase 2実装の詳細を追記       |
| `docs/modules/VOICE_MODULE.md`                              | ✅ 完了 | STT自動言語検出の仕様記載済み |
| `docs/development/API_DESIGN.md`                            | 🔴 必須 | 言語管理API仕様を追加         |
| `docs/development/MULTILINGUAL_IMPLEMENTATION_CHECKLIST.md` | ✅ 完了 | このドキュメント              |
| `docs/development/MULTILINGUAL_AFFECTED_FILES.md`           | ✅ 完了 | このドキュメント              |
| `docs/operations/ADD_NEW_LANGUAGE.md`                       | 🟢 新規 | 新言語追加手順（運用者向け）  |

### 11. 環境変数

| ファイル                      | 状態    | 変更内容         |
| ----------------------------- | ------- | ---------------- |
| `.env.local.example`          | 🔴 必須 | 新環境変数を追加 |
| `infrastructure/.env.example` | 🔴 必須 | 新環境変数を追加 |

**追加する環境変数:**

```bash
# 言語リソース設定
LANGUAGE_RESOURCES_S3_BUCKET=prance-language-resources-dev
LANGUAGE_RESOURCES_CDN_URL=https://cdn-languages.prance.com

# STT自動言語検出（オーバーライド用）
# カンマ区切りで指定。未設定の場合はすべての有効な言語を使用
STT_AUTO_DETECT_LANGUAGES=ja-JP,en-US,zh-CN,ko-KR
```

---

## 🔍 ハードコード検出コマンド

Phase 2実装前に、以下のコマンドでハードコードされた言語リストを検出してください。

### 言語配列の検出

```bash
# 言語コード配列
grep -rn "\['ja', 'en'\]" apps/web infrastructure/lambda --include="*.ts" --include="*.tsx"
grep -rn "\['en', 'ja'\]" apps/web infrastructure/lambda --include="*.ts" --include="*.tsx"

# STT言語コード配列
grep -rn "\['ja-JP', 'en-US'\]" infrastructure/lambda --include="*.ts"
grep -rn "\['en-US', 'ja-JP'\]" infrastructure/lambda --include="*.ts"
```

### 言語オブジェクトの検出

```bash
# { code: 'ja', label: '日本語' } のようなパターン
grep -rn "code.*:.*'ja'\|'en'" apps/web --include="*.tsx" --include="*.ts"
```

### 言語名のハードコード

```bash
# "日本語" "Japanese" "English" などのハードコード
grep -rn "日本語\|Japanese\|English" apps/web/components --include="*.tsx" | grep -v "messages/"
```

**期待結果:** Phase 2完了後はすべてゼロになるべき

---

## 📊 変更ファイル統計

| カテゴリ           | 新規作成 | 必須変更 | 確認必須 | 合計   |
| ------------------ | -------- | -------- | -------- | ------ |
| Lambda関数         | 8        | 1        | 0        | 9      |
| 共有ライブラリ     | 3        | 1        | 0        | 4      |
| CDK Infrastructure | 0        | 1        | 3        | 4      |
| フロントエンド API | 1        | 0        | 0        | 1      |
| フロントエンド UI  | 4        | 1        | 2        | 7      |
| i18n設定           | 0        | 2        | 0        | 2      |
| 言語リソース       | 2        | 2        | 0        | 4      |
| スクリプト         | 3        | 0        | 0        | 3      |
| テスト             | 2        | 0        | 1        | 3      |
| ドキュメント       | 1        | 2        | 0        | 3      |
| **合計**           | **24**   | **10**   | **6**    | **40** |

---

## ✅ Phase 2実装時の作業フロー

### ステップ1: ハードコード検出

```bash
./scripts/check-hardcoded-languages.sh
```

### ステップ2: 必須ファイル変更

- このドキュメントの「🔴 必須変更」をすべて実装

### ステップ3: 新規ファイル作成

- このドキュメントの「🟢 新規作成」をすべて作成

### ステップ4: 確認必須ファイル

- このドキュメントの「🟡 確認必須」をすべてレビュー

### ステップ5: 再度ハードコード検出

```bash
./scripts/check-hardcoded-languages.sh
# 期待結果: すべてゼロ
```

### ステップ6: テスト実行

```bash
npm run test
npm run test:e2e
```

---

## 🔗 関連ドキュメント

- [MULTILINGUAL_IMPLEMENTATION_CHECKLIST.md](MULTILINGUAL_IMPLEMENTATION_CHECKLIST.md) - 完全チェックリスト
- [MULTILINGUAL_PHASE2_TASKS.md](MULTILINGUAL_PHASE2_TASKS.md) - タスク管理
- [MULTILINGUAL_SYSTEM.md](../modules/MULTILINGUAL_SYSTEM.md) - システム設計

---

**最終更新:** 2026-03-08
**レビュー予定:** Phase 2実装開始前
