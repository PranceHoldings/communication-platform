# ハードコード値監査レポート

**作成日:** 2026-03-19
**監査範囲:** apps/web, infrastructure/lambda
**優先度:** 🔴 CRITICAL

---

## 📋 Executive Summary

**検出された問題:**
- ハードコードされたURL: 12箇所
- ハードコードされたリージョン: 4箇所
- ハードコードされたバケット名: 7箇所
- ハードコードされたデフォルト値: 8箇所

**リスク:**
- 環境間の設定ミス
- 本番環境での開発用URLアクセス
- セキュリティリスク（S3直接アクセス）
- メンテナンス性の低下

---

## 🔴 検出されたハードコード

### 1. API URLのハードコード（E2Eテスト）

**ファイル:** `apps/web/tests/e2e/fixtures/session.fixture.ts`

```typescript
// Line 35, 92
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  'https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1';
```

**問題:**
- 開発環境のAPI Gatewayエンドポイントがハードコード
- E2Eテストが環境変数なしで実行されると開発環境にアクセス

**修正方法:**
```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_BASE_URL) {
  throw new Error('NEXT_PUBLIC_API_URL is required for E2E tests');
}
```

---

### 2. S3 URLのハードコード（Lambda関数）

#### 2.1 video-processor.ts

**ファイル:** `infrastructure/lambda/websocket/default/video-processor.ts`

```typescript
// Line 258, 281
return `https://${this.bucket}.s3.amazonaws.com/${videoKey}`;
```

**問題:**
- CloudFront経由すべきところをS3直接URL生成
- 署名付きURL機能が使えない
- CDNキャッシュが効かない

**修正方法:**
```typescript
// CloudFrontドメイン使用
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN;
return `https://${CLOUDFRONT_DOMAIN}/${videoKey}`;

// または署名付きURL生成
return await generateSignedUrl(videoKey);
```

#### 2.2 frame-analyzer.ts

**ファイル:** `infrastructure/lambda/websocket/default/frame-analyzer.ts`

```typescript
// Line 146
const frameUrl = `https://${this.bucket}.s3.amazonaws.com/${frameKey}`;
```

**問題:** 同上

---

#### 2.3 seed-recording-data.ts

**ファイル:** `infrastructure/lambda/test/seed-recording-data.ts`

```typescript
// Line 107
const mockS3Url = `https://prance-dev-recordings.s3.us-east-1.amazonaws.com/${mockS3Key}`;
```

**問題:**
- テストデータでもバケット名・リージョンがハードコード
- 環境間で再利用不可

**修正方法:**
```typescript
const BUCKET = process.env.S3_BUCKET || 'prance-recordings-dev';
const REGION = process.env.AWS_REGION || 'us-east-1';
const mockS3Url = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${mockS3Key}`;
```

---

#### 2.4 db-mutation/index.ts

**ファイル:** `infrastructure/lambda/db-mutation/index.ts`

```typescript
// Line 93
'https://prance-dev-recordings.s3.us-east-1.amazonaws.com/recordings/' || $1 || '/combined-test.webm',
```

**問題:**
- SQLクエリ内にS3 URLがハードコード
- 開発環境専用

---

#### 2.5 report/generator.ts

**ファイル:** `infrastructure/lambda/report/generator.ts`

```typescript
// Line 92
const pdfUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${pdfKey}`;
```

**問題:**
- PDFレポートURLがS3直接アクセス
- CloudFront + 署名付きURLを使うべき

**修正方法:**
```typescript
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN;
const pdfUrl = `https://${CLOUDFRONT_DOMAIN}/${pdfKey}`;

// または署名付きURL
const pdfUrl = await generateSignedUrl(pdfKey, 7200); // 2時間有効
```

---

### 3. リージョンのハードコード

**ファイル:** `infrastructure/lambda/shared/config/defaults.ts`

```typescript
// Lines 13, 22, 31, 39
export const AWS_DEFAULTS = {
  REGION: 'us-east-1', // ハードコード
};

export const BEDROCK_DEFAULTS = {
  REGION: 'us-east-1', // ハードコード
};

export const REKOGNITION_DEFAULTS = {
  REGION: 'us-east-1', // ハードコード
};

export const POLLY_DEFAULTS = {
  REGION: 'us-east-1', // ハードコード
};
```

**問題:**
- リージョンがコード内にハードコード
- マルチリージョン展開ができない

**修正方法:**
```typescript
export const AWS_DEFAULTS = {
  REGION: process.env.AWS_REGION || 'us-east-1',
};

export const BEDROCK_DEFAULTS = {
  REGION: process.env.BEDROCK_REGION || process.env.AWS_REGION || 'us-east-1',
};
```

---

### 4. デフォルト値のハードコード

#### 4.1 Lambda関数名

**複数ファイル:**
- `infrastructure/lambda/websocket/default/index.ts:1286`
- `infrastructure/lambda/sessions/trigger-analysis/index.ts:11`

```typescript
const ANALYSIS_FUNCTION_NAME =
  process.env.ANALYSIS_LAMBDA_FUNCTION_NAME || 'prance-session-analysis-dev';
```

**問題:**
- 開発環境の関数名がデフォルト値
- 本番環境で環境変数未設定の場合、開発環境の関数が呼ばれる

**修正方法:**
```typescript
const ANALYSIS_FUNCTION_NAME = process.env.ANALYSIS_LAMBDA_FUNCTION_NAME;

if (!ANALYSIS_FUNCTION_NAME) {
  throw new Error('ANALYSIS_LAMBDA_FUNCTION_NAME is required');
}
```

---

#### 4.2 バケット名

**ファイル:** `infrastructure/lambda/report/generator.ts:15`

```typescript
const BUCKET_NAME = process.env.S3_BUCKET || 'prance-storage-dev';
```

**問題:**
- 開発環境のバケット名がデフォルト値
- 本番環境で環境変数未設定の場合、開発バケットに書き込み

**修正方法:**
```typescript
const BUCKET_NAME = process.env.S3_BUCKET;

if (!BUCKET_NAME) {
  throw new Error('S3_BUCKET environment variable is required');
}
```

---

#### 4.3 FRONTEND_URL

**複数ファイル:**
- `infrastructure/lambda/shared/utils/tokenGenerator.ts:98`
- `infrastructure/lambda/guest-sessions/batch/index.ts:20`
- `infrastructure/lambda/guest-sessions/create/index.ts:21`

```typescript
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
```

**問題:**
- localhostがデフォルト値
- 本番環境で未設定の場合、ゲスト招待URLがlocalhostになる

**修正方法:**
```typescript
const FRONTEND_URL = process.env.FRONTEND_URL;

if (!FRONTEND_URL) {
  throw new Error('FRONTEND_URL environment variable is required');
}
```

---

## 🎯 修正アクションプラン

### Phase 1: URL生成の統一（優先度: CRITICAL）

**目標:** CloudFront + 署名付きURL使用を徹底

#### Step 1.1: 共有URL生成ユーティリティ作成

```typescript
// infrastructure/lambda/shared/utils/url-generator.ts

import { generateSignedUrl } from './cloudfront-signer';

/**
 * Generate public CDN URL for static content
 */
export function generateCdnUrl(key: string): string {
  const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN;

  if (!CLOUDFRONT_DOMAIN) {
    throw new Error('CLOUDFRONT_DOMAIN environment variable is required');
  }

  return `https://${CLOUDFRONT_DOMAIN}/${key}`;
}

/**
 * Generate signed URL for protected content
 */
export async function generateProtectedUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  return generateSignedUrl(key, expiresIn);
}

/**
 * Generate recording URL (signed)
 */
export async function generateRecordingUrl(
  sessionId: string,
  expiresIn: number = 3600
): Promise<string> {
  const key = `recordings/${sessionId}.webm`;
  return generateProtectedUrl(key, expiresIn);
}

/**
 * Generate PDF report URL (signed)
 */
export async function generateReportUrl(
  sessionId: string,
  expiresIn: number = 7200
): Promise<string> {
  const key = `reports/${sessionId}.pdf`;
  return generateProtectedUrl(key, expiresIn);
}

/**
 * Generate avatar image URL (public)
 */
export function generateAvatarUrl(avatarId: string): string {
  const key = `avatars/${avatarId}.png`;
  return generateCdnUrl(key);
}
```

---

#### Step 1.2: S3直接URL生成を置き換え

**video-processor.ts:**
```typescript
// Before
return `https://${this.bucket}.s3.amazonaws.com/${videoKey}`;

// After
import { generateProtectedUrl } from '../../shared/utils/url-generator';
return await generateProtectedUrl(videoKey);
```

**frame-analyzer.ts:**
```typescript
// Before
const frameUrl = `https://${this.bucket}.s3.amazonaws.com/${frameKey}`;

// After
import { generateCdnUrl } from '../../shared/utils/url-generator';
const frameUrl = generateCdnUrl(frameKey);
```

**report/generator.ts:**
```typescript
// Before
const pdfUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${pdfKey}`;

// After
import { generateReportUrl } from '../shared/utils/url-generator';
const pdfUrl = await generateReportUrl(sessionId, 7200);
```

---

### Phase 2: デフォルト値の削除（優先度: HIGH）

**目標:** 必須環境変数の明示化

#### Step 2.1: 環境変数バリデーション関数作成

```typescript
// infrastructure/lambda/shared/utils/env-validator.ts

/**
 * Get required environment variable or throw error
 */
export function getRequiredEnv(key: string): string {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }

  return value;
}

/**
 * Get optional environment variable with type-safe default
 */
export function getOptionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

/**
 * Validate all required environment variables at startup
 */
export function validateEnvironment(): void {
  const required = [
    'AWS_REGION',
    'DATABASE_URL',
    'S3_BUCKET',
    'CLOUDFRONT_DOMAIN',
    'FRONTEND_URL',
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }
}
```

---

#### Step 2.2: 各Lambda関数で使用

```typescript
// infrastructure/lambda/report/generator.ts

import { getRequiredEnv } from '../shared/utils/env-validator';

const BUCKET_NAME = getRequiredEnv('S3_BUCKET');
const CLOUDFRONT_DOMAIN = getRequiredEnv('CLOUDFRONT_DOMAIN');

// デフォルト値が適切な場合のみ
const LOG_LEVEL = getOptionalEnv('LOG_LEVEL', 'INFO');
```

---

### Phase 3: リージョン設定の統一（優先度: MEDIUM）

**目標:** defaults.ts から環境変数取得に変更

#### Step 3.1: defaults.ts更新

```typescript
// infrastructure/lambda/shared/config/defaults.ts

export const AWS_DEFAULTS = {
  REGION: process.env.AWS_REGION || 'us-east-1',
};

export const BEDROCK_DEFAULTS = {
  MODEL_ID: process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-sonnet-4-6',
  REGION: process.env.BEDROCK_REGION || process.env.AWS_REGION || 'us-east-1',
};

export const REKOGNITION_DEFAULTS = {
  REGION: process.env.REKOGNITION_REGION || process.env.AWS_REGION || 'us-east-1',
};

export const POLLY_DEFAULTS = {
  VOICE_ID: process.env.POLLY_VOICE_ID || 'Mizuki',
  ENGINE: process.env.POLLY_ENGINE || 'neural',
  REGION: process.env.POLLY_REGION || process.env.AWS_REGION || 'us-east-1',
};
```

---

### Phase 4: E2Eテスト修正（優先度: MEDIUM）

**目標:** 環境変数必須化

#### Step 4.1: session.fixture.ts更新

```typescript
// apps/web/tests/e2e/fixtures/session.fixture.ts

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_BASE_URL) {
  throw new Error(
    'NEXT_PUBLIC_API_URL environment variable is required for E2E tests. ' +
    'Please set it in .env.local or BASE_URL in playwright.config.ts'
  );
}
```

#### Step 4.2: playwright.config.ts更新

```typescript
// apps/web/playwright.config.ts

import { defineConfig } from '@playwright/test';
import * as dotenv from 'dotenv';

// .env.local読み込み
dotenv.config({ path: '../../.env.local' });

export default defineConfig({
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
  },
  // ...
});
```

---

## ✅ 完了チェックリスト

### Phase 1: URL生成統一
- [ ] url-generator.ts作成
- [ ] cloudfront-signer.ts実装（既存）
- [ ] video-processor.ts修正
- [ ] frame-analyzer.ts修正
- [ ] report/generator.ts修正
- [ ] seed-recording-data.ts修正
- [ ] db-mutation/index.ts修正

### Phase 2: デフォルト値削除
- [ ] env-validator.ts作成
- [ ] report/generator.ts修正
- [ ] websocket/default/index.ts修正
- [ ] sessions/trigger-analysis/index.ts修正
- [ ] guest-sessions/batch/index.ts修正
- [ ] guest-sessions/create/index.ts修正
- [ ] tokenGenerator.ts修正

### Phase 3: リージョン設定統一
- [ ] defaults.ts更新（4箇所）
- [ ] 各Lambda関数でdefaults使用確認

### Phase 4: E2Eテスト修正
- [ ] session.fixture.ts修正
- [ ] playwright.config.ts修正
- [ ] E2Eテスト実行確認

---

## 📊 推定工数

| Phase | タスク数 | 推定工数 | 優先度 |
|-------|---------|---------|--------|
| Phase 1 | 7 | 4-5時間 | 🔴 CRITICAL |
| Phase 2 | 7 | 3-4時間 | ⚠️ HIGH |
| Phase 3 | 5 | 1-2時間 | 💡 MEDIUM |
| Phase 4 | 3 | 1-2時間 | 💡 MEDIUM |
| **合計** | **22** | **9-13時間** | - |

---

## 🔒 セキュリティへの影響

### 現在のリスク

1. **S3直接アクセス:**
   - CloudFront経由すべき
   - 署名なしでアクセス可能

2. **環境間の混在:**
   - 本番環境から開発バケットアクセス可能性
   - Lambda関数名デフォルト値で開発関数呼び出し

3. **URL推測攻撃:**
   - S3 URLパターンが予測可能
   - 署名付きURLで防御すべき

### 修正後の改善

1. **CloudFront + 署名付きURL:**
   - 全コンテンツがCDN経由
   - 時間制限付きアクセス
   - URL推測攻撃防御

2. **環境分離:**
   - デフォルト値削除
   - 環境変数必須化
   - クロスenv汚染防止

---

## 📚 参考資料

- [CloudFront署名付きURL実装ガイド](../../06-infrastructure/CLOUDFRONT_SIGNED_URL_IMPLEMENTATION.md)
- [環境変数監査レポート](./ENVIRONMENT_VARIABLE_AUDIT_REPORT.md)
- [今後の必須タスク](../../03-planning/implementation/FUTURE_REQUIRED_TASKS.md)

---

**最終更新:** 2026-03-19
**次回レビュー:** Phase 1完了時
**担当:** Backend + DevOps Team
