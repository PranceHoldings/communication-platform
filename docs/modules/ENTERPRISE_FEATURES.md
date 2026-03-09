# エンタープライズ機能（Enterprise Features）

**バージョン:** 1.0
**作成日:** 2026-03-09
**ステータス:** 設計完了・実装予定 (Phase 3.0)

---

## 目次

1. [概要](#概要)
2. [XLSX一括登録システム](#xlsx一括登録システム)
3. [ATS連携](#ats連携)
4. [ブランディング・カスタマイズ](#ブランディングカスタマイズ)
5. [実装フェーズ](#実装フェーズ)
6. [セキュリティ考慮事項](#セキュリティ考慮事項)

---

## 概要

### 目的

エンタープライズ顧客（大企業・採用代行企業）向けに、大規模運用を効率化し、ブランド体験を最適化する機能を提供します。

### 対象ユーザー

- **大企業の採用担当者:** 数百〜数千人の候補者を管理
- **採用代行企業（RPO）:** 複数クライアントの採用を一元管理
- **人材派遣会社:** 大量の登録者をスクリーニング
- **教育機関:** 数千人の学生の模擬面接・評価

### 主要機能

| 機能                           | 説明                                       | 対象ユーザー         |
| ------------------------------ | ------------------------------------------ | -------------------- |
| XLSX一括登録                   | Excelで候補者を一括登録・招待             | CLIENT_ADMIN, CLIENT_USER |
| ATS連携                        | 主要ATSとのデータ同期・Webhook連携        | CLIENT_ADMIN         |
| ブランディング・カスタマイズ   | 候補者ページのロゴ・色・メッセージを編集   | SUPER_ADMIN          |

### ビジネス価値

**運用効率化:**
- **90%の時間削減:** 手動入力 → XLSX一括登録
- **80%のエラー削減:** ATS連携による二重入力排除
- **候補者体験向上:** ブランド統一による信頼感向上

**スケーラビリティ:**
- 1000人の候補者を5分で登録
- ATSからの自動同期で人的リソース不要
- 複数クライアントのブランド設定を一元管理

---

## XLSX一括登録システム

### 概要

Excelファイル（.xlsx）で候補者情報を一括アップロードし、ゲストセッションを自動作成・招待メールを一斉送信します。

### なぜXLSXか？

**CSVではなくXLSXを採用する理由:**

1. **複数シート対応:** 1ファイルに複数の候補者グループ（シナリオ別、部門別等）
2. **リッチな書式:** データ検証、ドロップダウン、数式をサポート
3. **文字化け防止:** UTF-8エンコーディング問題を回避
4. **テンプレート提供:** 記入例・バリデーション付きテンプレートを配布
5. **ビジネス標準:** 採用担当者が日常的に使用

### データモデル

#### BulkInvitation テーブル

```prisma
model BulkInvitation {
  id              String   @id @default(cuid())
  fileName        String
  fileUrl         String           // S3 URL
  fileSize        Int              // バイト
  uploadedBy      String
  uploader        User     @relation(fields: [uploadedBy], references: [id])
  orgId           String
  organization    Organization @relation(fields: [orgId], references: [id])

  // 処理ステータス
  status          BulkInvitationStatus @default(PENDING)
  totalRows       Int              // 総行数
  successCount    Int      @default(0)  // 成功件数
  failureCount    Int      @default(0)  // 失敗件数

  // エラー情報
  errors          Json?            // エラー詳細（行番号、エラー内容）
  errorFileUrl    String?          // エラーレポートのS3 URL

  // 設定
  scenarioId      String
  scenario        Scenario @relation(fields: [scenarioId], references: [id])
  avatarId        String
  avatar          Avatar   @relation(fields: [avatarId], references: [id])
  expiryDays      Int      @default(7)  // 有効期限（日）
  autoSendEmail   Boolean  @default(true)  // 自動メール送信

  // メールテンプレート
  emailTemplateId String?
  emailTemplate   EmailTemplate? @relation(fields: [emailTemplateId], references: [id])

  // 処理時刻
  startedAt       DateTime?
  completedAt     DateTime?

  // リレーション
  guestSessions   GuestSession[]

  // タイムスタンプ
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([uploadedBy])
  @@index([orgId])
  @@index([status])
  @@map("bulk_invitations")
}

enum BulkInvitationStatus {
  PENDING          // アップロード済み、未処理
  VALIDATING       // バリデーション中
  PROCESSING       // 処理中（セッション作成）
  SENDING_EMAILS   // メール送信中
  COMPLETED        // 完了
  FAILED           // 失敗
  PARTIALLY_FAILED // 一部失敗
}
```

### XLSXフォーマット仕様

#### テンプレートファイル構造

**シート1: 候補者リスト (Required)**

| 列名 (A)   | 列名 (B)     | 列名 (C)        | 列名 (D)    | 列名 (E)          | 列名 (F)        | 列名 (G)      |
| ---------- | ------------ | --------------- | ----------- | ----------------- | --------------- | ------------- |
| *Name      | *Email       | Phone           | Position    | Source            | University      | Major         |
| 山田太郎   | yamada@...   | 090-1234-5678   | Engineer    | LinkedIn          | 東京大学        | 情報工学      |
| 田中花子   | tanaka@...   | 080-9876-5432   | Designer    | Indeed            | 京都大学        | 芸術工学      |
| ...        | ...          | ...             | ...         | ...               | ...             | ...           |

**列定義:**

| 列名       | 必須 | データ型 | 説明                           | バリデーション                  |
| ---------- | ---- | -------- | ------------------------------ | ------------------------------- |
| Name       | ✅   | string   | 候補者氏名                     | 最大100文字                     |
| Email      | ✅   | string   | メールアドレス                 | メール形式、重複不可            |
| Phone      | ❌   | string   | 電話番号                       | 数字・ハイフン                  |
| Position   | ❌   | string   | 応募ポジション                 | 最大50文字                      |
| Source     | ❌   | string   | 応募経路                       | LinkedIn, Indeed, Referral等    |
| University | ❌   | string   | 大学名                         | 最大100文字                     |
| Major      | ❌   | string   | 専攻                           | 最大50文字                      |
| ...        | ❌   | any      | カスタムフィールド（最大10列） | -                               |

**シート2: 設定 (Optional)**

| 設定項目         | 値              |
| ---------------- | --------------- |
| Scenario ID      | scenario_123    |
| Avatar ID        | avatar_456      |
| Expiry Days      | 7               |
| Auto Send Email  | TRUE            |

#### データ検証ルール（Excel機能）

テンプレートファイルに以下のデータ検証を設定：

```
Email列 (B):
- カスタム: =ISERROR(FIND("@", B2))=FALSE
- エラーメッセージ: "有効なメールアドレスを入力してください"

Position列 (D):
- リスト: Engineer, Designer, Sales, Marketing, Product Manager, Other
- ドロップダウン表示

Source列 (E):
- リスト: LinkedIn, Indeed, Referral, Website, Job Fair, Other
- ドロップダウン表示
```

### API設計

#### 1. XLSXアップロード

**Endpoint:**
```
POST /api/v1/bulk-invitations/upload
Content-Type: multipart/form-data
```

**認証:**
```
Authorization: Bearer <JWT>
```

**権限:**
- `CLIENT_ADMIN`, `CLIENT_USER`

**リクエスト:**
```typescript
// multipart/form-data
{
  file: File;                   // .xlsx ファイル（最大10MB）
  scenarioId: string;
  avatarId: string;
  expiryDays?: number;          // デフォルト: 7
  autoSendEmail?: boolean;      // デフォルト: true
  emailTemplateId?: string;
}
```

**レスポンス (202 Accepted):**
```typescript
{
  bulkInvitationId: string;
  fileName: string;
  fileSize: number;
  status: 'PENDING';
  message: 'File uploaded successfully. Processing will begin shortly.';
  estimatedProcessingTime: number;  // 秒（例: 60秒 for 100 rows）
}
```

**処理フロー:**
```
1. ファイルをS3にアップロード
2. BulkInvitation レコード作成 (status: PENDING)
3. Step Functions ワークフローを開始（非同期処理）
4. 202 Acceptedをレスポンス
```

#### 2. 処理ステータス確認

**Endpoint:**
```
GET /api/v1/bulk-invitations/{id}
```

**レスポンス (200 OK):**
```typescript
{
  id: string;
  fileName: string;
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'PARTIALLY_FAILED';
  totalRows: number;
  successCount: number;
  failureCount: number;
  progress: number;             // 0-100
  errors?: {
    row: number;
    field: string;
    value: string;
    error: string;
  }[];
  errorFileUrl?: string;        // エラーレポートのダウンロードURL
  startedAt: string;
  completedAt?: string;
  estimatedTimeRemaining?: number; // 秒
}
```

#### 3. テンプレートダウンロード

**Endpoint:**
```
GET /api/v1/bulk-invitations/template
```

**レスポンス:**
```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="candidate_invitation_template.xlsx"

[XLSXファイル]
```

### 処理ワークフロー（Step Functions）

```yaml
StateMachine: BulkInvitationWorkflow

States:
  1. ValidateFile:
      Type: Task
      Resource: arn:aws:lambda:...:function:validate-xlsx
      Next: CheckValidation

  2. CheckValidation:
      Type: Choice
      Choices:
        - Variable: $.validationResult.isValid
          BooleanEquals: true
          Next: ProcessRows
        - Variable: $.validationResult.isValid
          BooleanEquals: false
          Next: MarkAsFailed

  3. ProcessRows:
      Type: Map
      ItemsPath: $.rows
      MaxConcurrency: 10
      Iterator:
        StartAt: CreateGuestSession
        States:
          CreateGuestSession:
            Type: Task
            Resource: arn:aws:lambda:...:function:create-guest-session
            End: true
      Next: SendEmails

  4. SendEmails:
      Type: Task
      Resource: arn:aws:lambda:...:function:send-bulk-emails
      Next: GenerateReport

  5. GenerateReport:
      Type: Task
      Resource: arn:aws:lambda:...:function:generate-error-report
      Next: MarkAsCompleted

  6. MarkAsCompleted:
      Type: Task
      Resource: arn:aws:lambda:...:function:update-status
      End: true

  7. MarkAsFailed:
      Type: Task
      Resource: arn:aws:lambda:...:function:update-status
      End: true
```

### Lambda関数実装例

#### validate-xlsx Lambda

```typescript
// infrastructure/lambda/bulk-invitations/validate-xlsx/index.ts
import { S3 } from 'aws-sdk';
import * as XLSX from 'xlsx';
import { z } from 'zod';

const s3 = new S3();

const rowSchema = z.object({
  Name: z.string().min(1).max(100),
  Email: z.string().email(),
  Phone: z.string().optional(),
  Position: z.string().optional(),
  Source: z.string().optional(),
  University: z.string().max(100).optional(),
  Major: z.string().max(50).optional(),
});

export const handler = async (event: any) => {
  const { fileUrl, bulkInvitationId } = event;

  try {
    // S3からXLSXファイルを取得
    const s3Object = await s3.getObject({
      Bucket: process.env.BUCKET_NAME!,
      Key: fileUrl,
    }).promise();

    // XLSXパース
    const workbook = XLSX.read(s3Object.Body, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);

    // バリデーション
    const validationErrors: any[] = [];
    const validRows: any[] = [];
    const emails = new Set<string>();

    rows.forEach((row: any, index: number) => {
      const rowNumber = index + 2; // Excel行番号（ヘッダー除く）

      // スキーマ検証
      const result = rowSchema.safeParse(row);
      if (!result.success) {
        result.error.errors.forEach(err => {
          validationErrors.push({
            row: rowNumber,
            field: err.path[0],
            value: row[err.path[0]],
            error: err.message,
          });
        });
        return;
      }

      // メール重複チェック
      if (emails.has(result.data.Email)) {
        validationErrors.push({
          row: rowNumber,
          field: 'Email',
          value: result.data.Email,
          error: 'Duplicate email address',
        });
        return;
      }
      emails.add(result.data.Email);

      validRows.push({
        rowNumber,
        data: result.data,
      });
    });

    // 結果
    return {
      bulkInvitationId,
      validationResult: {
        isValid: validationErrors.length === 0,
        totalRows: rows.length,
        validRows: validRows.length,
        errorRows: validationErrors.length,
        errors: validationErrors,
      },
      rows: validRows,
    };
  } catch (error) {
    console.error('Validation error:', error);
    throw error;
  }
};
```

#### create-guest-session Lambda

```typescript
// infrastructure/lambda/bulk-invitations/create-guest-session/index.ts
import { prisma } from '../../shared/database/prisma';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';

export const handler = async (event: any) => {
  const { rowNumber, data, scenarioId, avatarId, expiryDays, bulkInvitationId, orgId, createdBy } = event;

  try {
    // アクセストークン・パスワード生成
    const accessToken = nanoid(32);
    const password = Math.floor(1000 + Math.random() * 9000).toString();
    const passwordHash = await bcrypt.hash(password, 10);
    const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

    // Session + GuestSession 作成
    const result = await prisma.$transaction(async (tx) => {
      const session = await tx.session.create({
        data: {
          scenarioId,
          avatarId,
          userId: createdBy,
          orgId,
          sessionType: 'GUEST',
          status: 'PENDING',
        },
      });

      const guestSession = await tx.guestSession.create({
        data: {
          sessionId: session.id,
          accessToken,
          accessPassword: passwordHash,
          expiresAt,
          guestName: data.Name,
          guestEmail: data.Email,
          guestPhone: data.Phone,
          guestMetadata: {
            position: data.Position,
            source: data.Source,
            university: data.University,
            major: data.Major,
          },
          bulkInvitationId,
          createdBy,
          orgId,
          status: 'PENDING',
        },
      });

      return { session, guestSession };
    });

    return {
      rowNumber,
      success: true,
      sessionId: result.session.id,
      guestSessionId: result.guestSession.id,
      guestUrl: `https://app.prance.com/g/${accessToken}`,
      guestPassword: password,
      guestEmail: data.Email,
      guestName: data.Name,
    };
  } catch (error) {
    console.error(`Failed to create session for row ${rowNumber}:`, error);
    return {
      rowNumber,
      success: false,
      error: error.message,
      data,
    };
  }
};
```

### UI実装

#### アップロードページ

**場所:** `apps/web/app/[locale]/dashboard/bulk-invitations/upload/page.tsx`

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { uploadBulkInvitation } from '@/lib/api/bulk-invitations';

export default function BulkInvitationUploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    scenarioId: '',
    avatarId: '',
    expiryDays: 7,
    autoSendEmail: true,
  });
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // ファイル検証
      if (!selectedFile.name.endsWith('.xlsx')) {
        alert('Please upload an Excel file (.xlsx)');
        return;
      }
      if (selectedFile.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB');
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsUploading(true);
    try {
      const response = await uploadBulkInvitation(file, formData);
      router.push(`/dashboard/bulk-invitations/${response.bulkInvitationId}`);
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadTemplate = () => {
    window.location.href = '/api/v1/bulk-invitations/template';
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Bulk Invitation Upload</h1>

      {/* テンプレートダウンロード */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-2">Step 1: Download Template</h2>
        <p className="text-sm text-gray-600 mb-4">
          Download the Excel template and fill in candidate information.
        </p>
        <button
          onClick={handleDownloadTemplate}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Download Template (.xlsx)
        </button>
      </div>

      {/* ファイルアップロード */}
      <form onSubmit={handleSubmit} className="bg-white border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Step 2: Upload Completed File</h2>

        {/* ファイル選択 */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Excel File (.xlsx) *</label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            {!file ? (
              <>
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer text-blue-600 hover:text-blue-700"
                >
                  <div className="mb-2">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  Click to upload or drag and drop
                </label>
                <p className="text-xs text-gray-500 mt-2">Excel (.xlsx) up to 10MB</p>
              </>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="h-8 w-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(2)} KB</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="text-red-600 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        </div>

        {/* シナリオ選択 */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Scenario *</label>
          <select
            value={formData.scenarioId}
            onChange={(e) => setFormData({ ...formData, scenarioId: e.target.value })}
            className="w-full p-2 border rounded-lg"
            required
          >
            <option value="">Select a scenario</option>
            {/* シナリオ一覧 */}
          </select>
        </div>

        {/* アバター選択 */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Avatar *</label>
          <select
            value={formData.avatarId}
            onChange={(e) => setFormData({ ...formData, avatarId: e.target.value })}
            className="w-full p-2 border rounded-lg"
            required
          >
            <option value="">Select an avatar</option>
            {/* アバター一覧 */}
          </select>
        </div>

        {/* 有効期限 */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Expiry Days</label>
          <input
            type="number"
            value={formData.expiryDays}
            onChange={(e) => setFormData({ ...formData, expiryDays: parseInt(e.target.value) })}
            min="1"
            max="30"
            className="w-full p-2 border rounded-lg"
          />
          <p className="text-xs text-gray-500 mt-1">
            URLs will expire after {formData.expiryDays} days
          </p>
        </div>

        {/* 自動メール送信 */}
        <div className="mb-6">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.autoSendEmail}
              onChange={(e) => setFormData({ ...formData, autoSendEmail: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm">Automatically send invitation emails</span>
          </label>
        </div>

        {/* 送信ボタン */}
        <button
          type="submit"
          disabled={!file || !formData.scenarioId || !formData.avatarId || isUploading}
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {isUploading ? 'Uploading...' : 'Upload and Process'}
        </button>
      </form>
    </div>
  );
}
```

#### 処理ステータスページ

**場所:** `apps/web/app/[locale]/dashboard/bulk-invitations/[id]/page.tsx`

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getBulkInvitationStatus } from '@/lib/api/bulk-invitations';

export default function BulkInvitationStatusPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [status, setStatus] = useState<any>(null);
  const [isPolling, setIsPolling] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const data = await getBulkInvitationStatus(id);
        setStatus(data);

        // 処理完了したらポーリング停止
        if (['COMPLETED', 'FAILED', 'PARTIALLY_FAILED'].includes(data.status)) {
          setIsPolling(false);
        }
      } catch (error) {
        console.error('Failed to fetch status:', error);
      }
    };

    fetchStatus();

    // ポーリング（5秒ごと）
    const interval = isPolling ? setInterval(fetchStatus, 5000) : null;

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [id, isPolling]);

  if (!status) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Bulk Invitation Status</h1>

      {/* プログレスバー */}
      <div className="bg-white border rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Progress</span>
          <span className="text-sm text-gray-600">{status.progress}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-4">
          <div
            className="bg-blue-600 h-4 rounded-full transition-all duration-500"
            style={{ width: `${status.progress}%` }}
          />
        </div>
        <p className="text-sm text-gray-600 mt-2">
          Status: <span className="font-semibold">{status.status}</span>
        </p>
        {status.estimatedTimeRemaining && (
          <p className="text-sm text-gray-600">
            Estimated time remaining: {Math.ceil(status.estimatedTimeRemaining / 60)} minutes
          </p>
        )}
      </div>

      {/* 統計 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">Total Rows</p>
          <p className="text-3xl font-bold">{status.totalRows}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-700 mb-1">Success</p>
          <p className="text-3xl font-bold text-green-600">{status.successCount}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700 mb-1">Failed</p>
          <p className="text-3xl font-bold text-red-600">{status.failureCount}</p>
        </div>
      </div>

      {/* エラーレポート */}
      {status.errors && status.errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-red-900 mb-4">Errors</h2>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {status.errors.slice(0, 10).map((error: any, index: number) => (
              <div key={index} className="text-sm">
                <span className="font-mono bg-red-100 px-2 py-1 rounded">Row {error.row}</span>
                <span className="mx-2">→</span>
                <span className="text-red-700">{error.field}: {error.error}</span>
              </div>
            ))}
          </div>
          {status.errorFileUrl && (
            <a
              href={status.errorFileUrl}
              download
              className="inline-block mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Download Full Error Report
            </a>
          )}
        </div>
      )}

      {/* 完了メッセージ */}
      {status.status === 'COMPLETED' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-green-900 mb-2">Completed Successfully!</h2>
          <p className="text-gray-700">
            {status.successCount} guest sessions have been created and invitation emails have been sent.
          </p>
        </div>
      )}

      {/* アクション */}
      <div className="flex gap-4">
        <button
          onClick={() => router.push('/dashboard/candidates')}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          View Candidates
        </button>
        <button
          onClick={() => router.push('/dashboard/bulk-invitations/upload')}
          className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
        >
          Upload Another File
        </button>
      </div>
    </div>
  );
}
```

---

## ATS連携

### 概要

主要ATS（Applicant Tracking System）とデータを同期し、候補者管理を一元化します。

### サポートATS

#### グローバル市場（北米中心）

| ATS名              | 市場シェア | 対応優先度 | 連携方式              |
| ------------------ | ---------- | ---------- | --------------------- |
| Workday            | 25%        | 高         | REST API + Webhook    |
| Greenhouse         | 18%        | 高         | REST API + Webhook    |
| Lever              | 12%        | 高         | REST API + Webhook    |
| Jobvite            | 10%        | 中         | REST API              |
| SmartRecruiters    | 8%         | 中         | REST API + Webhook    |
| SAP SuccessFactors | 7%         | 中         | SOAP API              |
| iCIMS              | 6%         | 低         | REST API              |
| Taleo (Oracle)     | 5%         | 低         | REST API              |

#### 日本市場

| ATS名                  | 市場シェア | 対応優先度 | 連携方式              | 備考                           |
| ---------------------- | ---------- | ---------- | --------------------- | ------------------------------ |
| HRMOS採用 (ビズリーチ)  | 30%        | 高         | REST API + Webhook    | 日本最大級、大企業向け          |
| ジョブカン採用管理      | 20%        | 高         | REST API              | 中小企業シェアトップ            |
| sonar ATS              | 15%        | 高         | REST API + Webhook    | エンジニア採用に強い            |
| HITO-Manager           | 12%        | 中         | REST API              | パーソルキャリア、大企業向け    |
| TalentPalette          | 8%         | 中         | REST API              | タレントマネジメント統合型       |

### データモデル

#### ATSIntegration テーブル

```prisma
model ATSIntegration {
  id              String   @id @default(cuid())
  orgId           String   @unique
  organization    Organization @relation(fields: [orgId], references: [id])

  // ATS情報
  atsProvider     ATSProvider
  atsAccountId    String?          // ATS側のアカウントID
  atsSubdomain    String?          // 例: "company" in company.greenhouse.io

  // 認証情報（暗号化してSecrets Managerに保存）
  credentialsSecretArn String      // AWS Secrets Manager ARN

  // 同期設定
  syncEnabled     Boolean  @default(false)
  syncDirection   ATSSyncDirection @default(BIDIRECTIONAL)
  syncFrequency   ATSSyncFrequency @default(HOURLY)
  lastSyncAt      DateTime?
  nextSyncAt      DateTime?

  // Webhook設定
  webhookEnabled  Boolean  @default(false)
  webhookUrl      String?          // Prance側のWebhook受信URL
  webhookSecret   String?          // Webhook検証用

  // フィールドマッピング
  fieldMapping    Json?            // ATSフィールド ↔ Pranceフィールドのマッピング

  // 同期ログ
  syncLogs        ATSSyncLog[]

  // タイムスタンプ
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("ats_integrations")
}

enum ATSProvider {
  // グローバル市場
  WORKDAY
  GREENHOUSE
  LEVER
  JOBVITE
  SMARTRECRUITERS
  SAP_SUCCESSFACTORS
  ICIMS
  TALEO

  // 日本市場
  HRMOS                 // HRMOS採用 (ビズリーチ)
  JOBKAN                // ジョブカン採用管理
  SONAR_ATS             // sonar ATS
  HITO_MANAGER          // HITO-Manager (パーソルキャリア)
  TALENT_PALETTE        // TalentPalette
}

enum ATSSyncDirection {
  ATS_TO_PRANCE      // ATSからPranceへのみ
  PRANCE_TO_ATS      // PranceからATSへのみ
  BIDIRECTIONAL      // 双方向
}

enum ATSSyncFrequency {
  REALTIME           // リアルタイム（Webhook）
  HOURLY             // 1時間ごと
  DAILY              // 1日1回
  MANUAL             // 手動
}

model ATSSyncLog {
  id                  String   @id @default(cuid())
  atsIntegrationId    String
  atsIntegration      ATSIntegration @relation(fields: [atsIntegrationId], references: [id])

  // 同期情報
  syncType            ATSSyncType
  direction           ATSSyncDirection
  status              ATSSyncStatus

  // 統計
  candidatesProcessed Int      @default(0)
  candidatesCreated   Int      @default(0)
  candidatesUpdated   Int      @default(0)
  candidatesFailed    Int      @default(0)

  // エラー情報
  errors              Json?

  // タイムスタンプ
  startedAt           DateTime @default(now())
  completedAt         DateTime?

  @@index([atsIntegrationId])
  @@index([startedAt])
  @@map("ats_sync_logs")
}

enum ATSSyncType {
  FULL               // 全件同期
  INCREMENTAL        // 差分同期
  WEBHOOK            // Webhook受信
}

enum ATSSyncStatus {
  IN_PROGRESS
  COMPLETED
  FAILED
  PARTIALLY_FAILED
}
```

#### CandidateATSMapping テーブル

```prisma
model CandidateATSMapping {
  id                String   @id @default(cuid())
  guestSessionId    String   @unique
  guestSession      GuestSession @relation(fields: [guestSessionId], references: [id])

  // ATS情報
  atsProvider       ATSProvider
  atsCandidateId    String           // ATS側の候補者ID
  atsApplicationId  String?          // ATS側の応募ID
  atsJobId          String?          // ATS側の求人ID

  // 同期ステータス
  lastSyncedAt      DateTime?
  syncStatus        String?          // "synced", "pending", "error"
  syncError         String?

  // タイムスタンプ
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([atsCandidateId])
  @@index([atsProvider])
  @@map("candidate_ats_mappings")
}
```

### API設計

#### 1. ATS連携設定

**Endpoint:**
```
POST /api/v1/integrations/ats/setup
```

**認証:**
```
Authorization: Bearer <JWT>
```

**権限:**
- `CLIENT_ADMIN` のみ

**リクエスト (Greenhouse例):**
```typescript
{
  atsProvider: 'GREENHOUSE';
  atsSubdomain: 'mycompany';           // mycompany.greenhouse.io
  credentials: {
    apiToken: 'abc123...';             // Greenhouse API Token
  };
  syncEnabled: true;
  syncDirection: 'BIDIRECTIONAL';
  syncFrequency: 'HOURLY';
  webhookEnabled: true;
  fieldMapping: {
    // ATSフィールド → Pranceフィールド
    'first_name': 'guestName',
    'email_addresses[0].value': 'guestEmail',
    'phone_numbers[0].value': 'guestPhone',
    'jobs[0].id': 'position',
  };
}
```

**レスポンス (201 Created):**
```typescript
{
  id: string;
  atsProvider: 'GREENHOUSE';
  status: 'connected';
  webhookUrl: 'https://api.prance.com/webhooks/ats/greenhouse/{orgId}';
  webhookSecret: 'whsec_...';  // Webhook検証用
  message: 'ATS integration configured successfully. Please configure webhook in Greenhouse.';
}
```

#### 2. 手動同期トリガー

**Endpoint:**
```
POST /api/v1/integrations/ats/sync
```

**リクエスト:**
```typescript
{
  syncType: 'FULL' | 'INCREMENTAL';
  direction: 'ATS_TO_PRANCE' | 'PRANCE_TO_ATS';
}
```

**レスポンス (202 Accepted):**
```typescript
{
  syncLogId: string;
  status: 'IN_PROGRESS';
  estimatedDuration: number;  // 秒
}
```

#### 3. Webhook受信エンドポイント

**Endpoint:**
```
POST /webhooks/ats/greenhouse/{orgId}
X-Greenhouse-Signature: sha256=...
```

**リクエスト（Greenhouseからの通知）:**
```json
{
  "action": "candidate_stage_change",
  "payload": {
    "application": {
      "id": 12345,
      "candidate_id": 67890,
      "status": "active",
      "current_stage": {
        "id": 3,
        "name": "Phone Screen"
      },
      "job": {
        "id": 111,
        "name": "Software Engineer"
      }
    },
    "candidate": {
      "id": 67890,
      "first_name": "John",
      "last_name": "Doe",
      "email_addresses": [
        {"value": "john@example.com", "type": "personal"}
      ],
      "phone_numbers": [
        {"value": "123-456-7890", "type": "mobile"}
      ]
    }
  }
}
```

**処理フロー:**
```
1. Webhook署名検証
2. ペイロード解析
3. 候補者の存在確認（CandidateATSMapping）
4. 新規の場合 → ゲストセッション作成
5. 既存の場合 → 候補者情報更新
6. レスポンス返却（200 OK）
```

### ATS別の実装例

#### Greenhouse連携

```typescript
// infrastructure/lambda/ats/greenhouse/sync.ts
import axios from 'axios';
import { prisma } from '../../shared/database/prisma';
import { SecretsManager } from 'aws-sdk';

const secretsManager = new SecretsManager();

export class GreenhouseSync {
  private apiToken: string;
  private subdomain: string;
  private baseUrl: string;

  constructor(apiToken: string, subdomain: string) {
    this.apiToken = apiToken;
    this.subdomain = subdomain;
    this.baseUrl = `https://harvest.greenhouse.io/v1`;
  }

  // 認証ヘッダー
  private get headers() {
    return {
      Authorization: `Basic ${Buffer.from(this.apiToken + ':').toString('base64')}`,
      'Content-Type': 'application/json',
    };
  }

  // 候補者一覧取得
  async getCandidates(params?: { created_after?: string }): Promise<any[]> {
    const response = await axios.get(`${this.baseUrl}/candidates`, {
      headers: this.headers,
      params,
    });
    return response.data;
  }

  // 候補者詳細取得
  async getCandidate(candidateId: string): Promise<any> {
    const response = await axios.get(`${this.baseUrl}/candidates/${candidateId}`, {
      headers: this.headers,
    });
    return response.data;
  }

  // 候補者の応募情報取得
  async getCandidateApplications(candidateId: string): Promise<any[]> {
    const response = await axios.get(`${this.baseUrl}/applications`, {
      headers: this.headers,
      params: { candidate_id: candidateId },
    });
    return response.data;
  }

  // Pranceの評価結果をGreenhouseに送信
  async updateCandidateStage(applicationId: string, stageId: string, note: string): Promise<void> {
    await axios.post(
      `${this.baseUrl}/applications/${applicationId}/move`,
      {
        from_stage_id: null,
        to_stage_id: stageId,
      },
      { headers: this.headers }
    );

    // 評価ノートを追加
    await axios.post(
      `${this.baseUrl}/applications/${applicationId}/notes`,
      {
        message: note,
        visibility: 'admin_only',
      },
      { headers: this.headers }
    );
  }

  // 全件同期
  async syncToPrance(orgId: string, scenarioId: string, avatarId: string): Promise<{
    created: number;
    updated: number;
    failed: number;
  }> {
    const candidates = await this.getCandidates();
    let created = 0;
    let updated = 0;
    let failed = 0;

    for (const candidate of candidates) {
      try {
        // 既存マッピング確認
        const mapping = await prisma.candidateATSMapping.findFirst({
          where: {
            atsProvider: 'GREENHOUSE',
            atsCandidateId: candidate.id.toString(),
          },
          include: { guestSession: true },
        });

        if (mapping) {
          // 更新
          await prisma.guestSession.update({
            where: { id: mapping.guestSessionId },
            data: {
              guestName: `${candidate.first_name} ${candidate.last_name}`,
              guestEmail: candidate.email_addresses[0]?.value,
              guestPhone: candidate.phone_numbers[0]?.value,
            },
          });
          updated++;
        } else {
          // 新規作成（既存のcreate-guest-session関数を使用）
          // ... (省略)
          created++;
        }
      } catch (error) {
        console.error(`Failed to sync candidate ${candidate.id}:`, error);
        failed++;
      }
    }

    return { created, updated, failed };
  }
}
```

#### Webhook検証

```typescript
// infrastructure/lambda/webhooks/ats/greenhouse/index.ts
import crypto from 'crypto';
import { APIGatewayProxyHandler } from 'aws-lambda';

export const handler: APIGatewayProxyHandler = async (event) => {
  const orgId = event.pathParameters?.orgId;
  const signature = event.headers['X-Greenhouse-Signature'] || '';
  const body = event.body || '';

  // ATS統合設定を取得
  const integration = await prisma.atsIntegration.findUnique({
    where: { orgId },
  });

  if (!integration || !integration.webhookEnabled) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'ATS integration not found or webhook not enabled' }),
    };
  }

  // Webhook署名検証
  const expectedSignature = `sha256=${crypto
    .createHmac('sha256', integration.webhookSecret!)
    .update(body)
    .digest('hex')}`;

  if (signature !== expectedSignature) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Invalid signature' }),
    };
  }

  // ペイロード解析
  const payload = JSON.parse(body);
  const { action, payload: data } = payload;

  // アクション別処理
  switch (action) {
    case 'candidate_stage_change':
      await handleCandidateStageChange(orgId, data);
      break;
    case 'application_created':
      await handleApplicationCreated(orgId, data);
      break;
    default:
      console.log(`Unhandled action: ${action}`);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Webhook processed successfully' }),
  };
};

async function handleCandidateStageChange(orgId: string, data: any) {
  const { application, candidate } = data;

  // ステージ名が "Prance Interview" の場合、ゲストセッションを作成
  if (application.current_stage.name === 'Prance Interview') {
    // 既存マッピング確認
    const existing = await prisma.candidateATSMapping.findFirst({
      where: {
        atsProvider: 'GREENHOUSE',
        atsCandidateId: candidate.id.toString(),
      },
    });

    if (!existing) {
      // ゲストセッション作成
      // ... (省略)
    }
  }
}
```

### UI実装

#### ATS設定ページ

**場所:** `apps/web/app/[locale]/dashboard/settings/ats/page.tsx`

```tsx
'use client';

import { useState } from 'react';
import { setupATSIntegration } from '@/lib/api/ats';

const ATS_PROVIDERS = [
  // グローバル市場
  { value: 'GREENHOUSE', label: 'Greenhouse', logo: '/logos/greenhouse.svg', region: 'global' },
  { value: 'LEVER', label: 'Lever', logo: '/logos/lever.svg', region: 'global' },
  { value: 'WORKDAY', label: 'Workday', logo: '/logos/workday.svg', region: 'global' },
  { value: 'JOBVITE', label: 'Jobvite', logo: '/logos/jobvite.svg', region: 'global' },
  { value: 'SMARTRECRUITERS', label: 'SmartRecruiters', logo: '/logos/smartrecruiters.svg', region: 'global' },

  // 日本市場
  { value: 'HRMOS', label: 'HRMOS採用', logo: '/logos/hrmos.svg', region: 'japan' },
  { value: 'JOBKAN', label: 'ジョブカン採用管理', logo: '/logos/jobkan.svg', region: 'japan' },
  { value: 'SONAR_ATS', label: 'sonar ATS', logo: '/logos/sonar.svg', region: 'japan' },
  { value: 'HITO_MANAGER', label: 'HITO-Manager', logo: '/logos/hito-manager.svg', region: 'japan' },
  { value: 'TALENT_PALETTE', label: 'TalentPalette', logo: '/logos/talent-palette.svg', region: 'japan' },
];

export default function ATSSettingsPage() {
  const [selectedATS, setSelectedATS] = useState('');
  const [formData, setFormData] = useState({
    subdomain: '',
    apiToken: '',
    syncEnabled: true,
    webhookEnabled: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await setupATSIntegration({
        atsProvider: selectedATS,
        atsSubdomain: formData.subdomain,
        credentials: { apiToken: formData.apiToken },
        syncEnabled: formData.syncEnabled,
        webhookEnabled: formData.webhookEnabled,
      });
      alert('ATS integration configured successfully!');
      // Webhook設定手順を表示
    } catch (error) {
      console.error('Failed to setup ATS integration:', error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">ATS Integration</h1>

      {/* ATS選択 */}
      <div className="bg-white border rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Select Your ATS</h2>
        <div className="grid grid-cols-2 gap-4">
          {ATS_PROVIDERS.map((ats) => (
            <button
              key={ats.value}
              onClick={() => setSelectedATS(ats.value)}
              className={`p-4 border-2 rounded-lg flex items-center gap-4 hover:border-blue-500 ${
                selectedATS === ats.value ? 'border-blue-600 bg-blue-50' : 'border-gray-200'
              }`}
            >
              <img src={ats.logo} alt={ats.label} className="h-8 w-8" />
              <span className="font-medium">{ats.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 設定フォーム */}
      {selectedATS && (
        <form onSubmit={handleSubmit} className="bg-white border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Configure {selectedATS}</h2>

          {/* Subdomain */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Subdomain *
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={formData.subdomain}
                onChange={(e) => setFormData({ ...formData, subdomain: e.target.value })}
                className="flex-1 p-2 border rounded-lg"
                placeholder="mycompany"
                required
              />
              <span className="text-gray-600">.greenhouse.io</span>
            </div>
          </div>

          {/* API Token */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              API Token *
            </label>
            <input
              type="password"
              value={formData.apiToken}
              onChange={(e) => setFormData({ ...formData, apiToken: e.target.value })}
              className="w-full p-2 border rounded-lg"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Generate an API token in your Greenhouse settings
            </p>
          </div>

          {/* オプション */}
          <div className="mb-6 space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.syncEnabled}
                onChange={(e) => setFormData({ ...formData, syncEnabled: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">Enable automatic sync</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.webhookEnabled}
                onChange={(e) => setFormData({ ...formData, webhookEnabled: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">Enable webhook notifications</span>
            </label>
          </div>

          <button
            type="submit"
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Connect {selectedATS}
          </button>
        </form>
      )}
    </div>
  );
}
```

### 日本市場ATS実装例

#### HRMOS採用連携

HRMOS採用はビズリーチが提供する日本最大級のクラウド採用管理システムです。大企業を中心に高いシェアを持ち、REST APIとWebhook機能を提供しています。

```typescript
// infrastructure/lambda/ats/hrmos/sync.ts
import axios from 'axios';
import { prisma } from '../../shared/database/prisma';
import { SecretsManager } from 'aws-sdk';

const secretsManager = new SecretsManager();

export class HRMOSSync {
  private apiKey: string;
  private companyId: string;
  private baseUrl: string;

  constructor(apiKey: string, companyId: string) {
    this.apiKey = apiKey;
    this.companyId = companyId;
    this.baseUrl = `https://api.hrmos.co/v1`;
  }

  // 認証ヘッダー
  private get headers() {
    return {
      'X-API-Key': this.apiKey,
      'Content-Type': 'application/json',
    };
  }

  // 応募者一覧取得
  async getApplicants(params?: { updated_after?: string }): Promise<any[]> {
    const response = await axios.get(`${this.baseUrl}/companies/${this.companyId}/applicants`, {
      headers: this.headers,
      params: {
        ...params,
        per_page: 100,
      },
    });
    return response.data.applicants;
  }

  // 応募者詳細取得
  async getApplicant(applicantId: string): Promise<any> {
    const response = await axios.get(
      `${this.baseUrl}/companies/${this.companyId}/applicants/${applicantId}`,
      { headers: this.headers }
    );
    return response.data;
  }

  // 選考ステップ更新
  async updateSelectionStep(applicantId: string, stepId: string, status: string): Promise<void> {
    await axios.patch(
      `${this.baseUrl}/companies/${this.companyId}/applicants/${applicantId}/selection_step`,
      {
        step_id: stepId,
        status: status,  // 'passed', 'failed', 'in_progress'
      },
      { headers: this.headers }
    );
  }

  // 評価メモ追加
  async addEvaluationNote(applicantId: string, note: string, score?: number): Promise<void> {
    await axios.post(
      `${this.baseUrl}/companies/${this.companyId}/applicants/${applicantId}/notes`,
      {
        content: note,
        evaluation_score: score,  // 1-5
        note_type: 'evaluation',
      },
      { headers: this.headers }
    );
  }

  // 全件同期（ATSからPranceへ）
  async syncToPrance(orgId: string, scenarioId: string, avatarId: string): Promise<{
    created: number;
    updated: number;
    failed: number;
  }> {
    const applicants = await this.getApplicants();
    let created = 0;
    let updated = 0;
    let failed = 0;

    for (const applicant of applicants) {
      try {
        // 既存マッピング確認
        const mapping = await prisma.candidateATSMapping.findFirst({
          where: {
            atsProvider: 'HRMOS',
            atsCandidateId: applicant.id.toString(),
          },
          include: { guestSession: true },
        });

        if (mapping) {
          // 更新
          await prisma.guestSession.update({
            where: { id: mapping.guestSessionId },
            data: {
              guestName: `${applicant.last_name} ${applicant.first_name}`,
              guestEmail: applicant.email,
              guestPhone: applicant.phone,
            },
          });
          updated++;
        } else {
          // 新規ゲストセッション作成
          const guestSession = await prisma.guestSession.create({
            data: {
              sessionId: generateSessionId(),
              accessToken: generateAccessToken(),
              accessPassword: await bcrypt.hash(generateRandomPassword(), 10),
              orgId: orgId,
              scenarioId: scenarioId,
              avatarId: avatarId,
              guestName: `${applicant.last_name} ${applicant.first_name}`,
              guestEmail: applicant.email,
              guestPhone: applicant.phone,
              status: 'PENDING',
            },
          });

          // ATSマッピング作成
          await prisma.candidateATSMapping.create({
            data: {
              guestSessionId: guestSession.id,
              atsProvider: 'HRMOS',
              atsCandidateId: applicant.id.toString(),
              atsApplicationId: applicant.application_id?.toString(),
              atsJobId: applicant.job_id?.toString(),
            },
          });

          created++;
        }
      } catch (error) {
        console.error(`Failed to sync applicant ${applicant.id}:`, error);
        failed++;
      }
    }

    return { created, updated, failed };
  }

  // Prance評価結果をHRMOSに送信
  async syncFromPrance(guestSessionId: string): Promise<void> {
    // ゲストセッションと評価データ取得
    const guestSession = await prisma.guestSession.findUnique({
      where: { id: guestSessionId },
      include: {
        evaluation: true,
        candidateATSMapping: true,
      },
    });

    if (!guestSession?.candidateATSMapping) {
      throw new Error('ATS mapping not found');
    }

    const mapping = guestSession.candidateATSMapping;
    const evaluation = guestSession.evaluation;

    if (!evaluation) {
      throw new Error('Evaluation not found');
    }

    // 評価スコアを5段階に変換
    const score = Math.round((evaluation.totalScore / 100) * 5);

    // HRMOSに評価メモ追加
    const noteContent = `
【Prance AI面接評価】
総合スコア: ${evaluation.totalScore}点
コミュニケーション力: ${evaluation.communicationScore}点
論理的思考力: ${evaluation.logicalThinkingScore}点
専門知識: ${evaluation.technicalScore}点

AIフィードバック:
${evaluation.aiFeedback}

詳細レポート: ${process.env.FRONTEND_URL}/sessions/${guestSession.sessionId}/report
    `.trim();

    await this.addEvaluationNote(mapping.atsCandidateId, noteContent, score);

    // 選考ステップ自動更新（オプション）
    if (evaluation.totalScore >= 80) {
      await this.updateSelectionStep(mapping.atsCandidateId, 'next_step_id', 'passed');
    } else if (evaluation.totalScore < 50) {
      await this.updateSelectionStep(mapping.atsCandidateId, 'current_step_id', 'failed');
    }

    // 同期ステータス更新
    await prisma.candidateATSMapping.update({
      where: { id: mapping.id },
      data: {
        lastSyncedAt: new Date(),
        syncStatus: 'synced',
      },
    });
  }
}
```

#### HRMOS Webhook実装

```typescript
// infrastructure/lambda/webhooks/ats/hrmos/index.ts
import crypto from 'crypto';
import { APIGatewayProxyHandler } from 'aws-lambda';
import { prisma } from '../../../shared/database/prisma';

export const handler: APIGatewayProxyHandler = async (event) => {
  const orgId = event.pathParameters?.orgId;
  const signature = event.headers['X-HRMOS-Signature'] || '';
  const timestamp = event.headers['X-HRMOS-Timestamp'] || '';
  const body = event.body || '';

  // ATS統合設定を取得
  const integration = await prisma.atsIntegration.findUnique({
    where: { orgId },
  });

  if (!integration || !integration.webhookEnabled) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'ATS integration not found or webhook not enabled' }),
    };
  }

  // Webhook署名検証（HMAC-SHA256）
  const expectedSignature = crypto
    .createHmac('sha256', integration.webhookSecret!)
    .update(timestamp + body)
    .digest('hex');

  if (signature !== expectedSignature) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Invalid signature' }),
    };
  }

  // タイムスタンプ検証（5分以内）
  const now = Date.now();
  const requestTime = parseInt(timestamp);
  if (Math.abs(now - requestTime) > 5 * 60 * 1000) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Request timestamp too old' }),
    };
  }

  // ペイロード解析
  const payload = JSON.parse(body);
  const { event_type, data } = payload;

  // イベント別処理
  switch (event_type) {
    case 'applicant.created':
      await handleApplicantCreated(orgId, data);
      break;
    case 'applicant.updated':
      await handleApplicantUpdated(orgId, data);
      break;
    case 'applicant.selection_step_changed':
      await handleSelectionStepChanged(orgId, data);
      break;
    default:
      console.log(`Unhandled event type: ${event_type}`);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Webhook processed successfully' }),
  };
};

async function handleApplicantCreated(orgId: string, data: any) {
  const { applicant } = data;

  // デフォルトのシナリオ・アバター取得
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: {
      scenarios: { where: { visibility: 'ORGANIZATION' }, take: 1 },
      avatars: { where: { visibility: 'ORGANIZATION' }, take: 1 },
    },
  });

  if (!org?.scenarios[0] || !org?.avatars[0]) {
    console.error('Default scenario or avatar not found');
    return;
  }

  // ゲストセッション作成
  const guestSession = await prisma.guestSession.create({
    data: {
      sessionId: generateSessionId(),
      accessToken: generateAccessToken(),
      accessPassword: await bcrypt.hash(generateRandomPassword(), 10),
      orgId: orgId,
      scenarioId: org.scenarios[0].id,
      avatarId: org.avatars[0].id,
      guestName: `${applicant.last_name} ${applicant.first_name}`,
      guestEmail: applicant.email,
      guestPhone: applicant.phone,
      status: 'PENDING',
    },
  });

  // ATSマッピング作成
  await prisma.candidateATSMapping.create({
    data: {
      guestSessionId: guestSession.id,
      atsProvider: 'HRMOS',
      atsCandidateId: applicant.id.toString(),
      atsApplicationId: applicant.application_id?.toString(),
      atsJobId: applicant.job_id?.toString(),
    },
  });

  // 招待メール送信
  await sendInvitationEmail(guestSession);
}

async function handleSelectionStepChanged(orgId: string, data: any) {
  const { applicant, selection_step } = data;

  // "AI面接" ステップに到達したら自動的にゲストセッション作成
  if (selection_step.name === 'AI面接' || selection_step.name === 'Prance Interview') {
    const existing = await prisma.candidateATSMapping.findFirst({
      where: {
        atsProvider: 'HRMOS',
        atsCandidateId: applicant.id.toString(),
      },
    });

    if (!existing) {
      await handleApplicantCreated(orgId, data);
    }
  }
}
```

#### UI実装（日本市場ATS対応）

```typescript
// apps/web/app/[locale]/dashboard/settings/ats/page.tsx に追加

const ATS_PROVIDERS = [
  // グローバル
  { value: 'GREENHOUSE', label: 'Greenhouse', logo: '/logos/greenhouse.svg', region: 'global' },
  { value: 'LEVER', label: 'Lever', logo: '/logos/lever.svg', region: 'global' },
  { value: 'WORKDAY', label: 'Workday', logo: '/logos/workday.svg', region: 'global' },
  { value: 'JOBVITE', label: 'Jobvite', logo: '/logos/jobvite.svg', region: 'global' },

  // 日本市場
  { value: 'HRMOS', label: 'HRMOS採用', logo: '/logos/hrmos.svg', region: 'japan' },
  { value: 'JOBKAN', label: 'ジョブカン採用管理', logo: '/logos/jobkan.svg', region: 'japan' },
  { value: 'SONAR_ATS', label: 'sonar ATS', logo: '/logos/sonar.svg', region: 'japan' },
  { value: 'HITO_MANAGER', label: 'HITO-Manager', logo: '/logos/hito-manager.svg', region: 'japan' },
  { value: 'TALENT_PALETTE', label: 'TalentPalette', logo: '/logos/talent-palette.svg', region: 'japan' },
];

// プロバイダー選択時のフォーム切り替え
const getProviderFields = (provider: string) => {
  switch (provider) {
    case 'HRMOS':
      return [
        { name: 'companyId', label: '企業ID', type: 'text', required: true, placeholder: 'company123' },
        { name: 'apiKey', label: 'APIキー', type: 'password', required: true, helper: 'HRMOS管理画面の「API設定」から取得' },
      ];
    case 'JOBKAN':
      return [
        { name: 'subdomain', label: 'サブドメイン', type: 'text', required: true, placeholder: 'mycompany', suffix: '.jobcan.jp' },
        { name: 'apiToken', label: 'APIトークン', type: 'password', required: true },
      ];
    case 'SONAR_ATS':
      return [
        { name: 'accountId', label: 'アカウントID', type: 'text', required: true },
        { name: 'apiKey', label: 'APIキー', type: 'password', required: true },
        { name: 'apiSecret', label: 'APIシークレット', type: 'password', required: true },
      ];
    default:
      return [];
  }
};
```

---

## ブランディング・カスタマイズ

### 概要

スーパー管理者が、候補者が閲覧するゲストページのルック&フィール（ロゴ、カラー、メッセージ等）を各組織ごとにカスタマイズできる機能です。

### 目的

**ブランド統一:**
- 候補者に対して企業のブランドイメージを一貫して提供
- 信頼感・プロフェッショナル感の向上

**ホワイトラベル対応:**
- 採用代行企業が、クライアント企業ごとに異なるブランディングを設定
- Pranceのブランドを隠し、クライアントブランドのみを表示

### データモデル

#### OrganizationBranding テーブル

```prisma
model OrganizationBranding {
  id              String   @id @default(cuid())
  orgId           String   @unique
  organization    Organization @relation(fields: [orgId], references: [id])

  // ロゴ
  logoUrl         String?          // 企業ロゴのS3 URL
  logoWidth       Int?     @default(200)  // px
  logoHeight      Int?     @default(60)   // px
  faviconUrl      String?          // ファビコンのS3 URL

  // カラースキーム
  primaryColor    String   @default("#3B82F6")    // ブルー
  secondaryColor  String   @default("#1E40AF")    // ダークブルー
  accentColor     String   @default("#10B981")    // グリーン
  backgroundColor String   @default("#FFFFFF")    // 白
  textColor       String   @default("#111827")    // ダークグレー

  // フォント
  fontFamily      String   @default("Inter, sans-serif")

  // メッセージ
  welcomeTitle    String?          // 例: "Welcome to {{company}} Interview"
  welcomeMessage  String?          // 例: "Thank you for your interest in joining our team..."
  completionTitle String?          // 例: "Thank you for completing the interview"
  completionMessage String?        // 例: "We will review your responses and get back to you within 5 business days."

  // フッター
  footerText      String?          // 例: "© 2026 MyCompany. All rights reserved."
  privacyPolicyUrl String?
  termsOfServiceUrl String?
  contactEmail    String?

  // ホワイトラベルオプション
  hidePranceBranding Boolean @default(false)  // Pranceブランドを非表示
  customDomain    String?          // カスタムドメイン（例: interview.mycompany.com）

  // メタタグ（SEO・OGP）
  metaTitle       String?
  metaDescription String?
  ogImageUrl      String?

  // タイムスタンプ
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("organization_branding")
}
```

### API設計

#### 1. ブランディング設定取得

**Endpoint:**
```
GET /api/v1/branding/{orgId}
```

**認証:** なし（公開エンドポイント、候補者が参照）

**レスポンス (200 OK):**
```typescript
{
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  welcomeTitle: string;
  welcomeMessage: string;
  // ... 全フィールド
}
```

#### 2. ブランディング設定更新

**Endpoint:**
```
PUT /api/v1/branding/{orgId}
```

**認証:**
```
Authorization: Bearer <JWT>
```

**権限:**
- `SUPER_ADMIN` のみ

**リクエスト:**
```typescript
{
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  welcomeTitle?: string;
  welcomeMessage?: string;
  hidePranceBranding?: boolean;
  // ... 任意のフィールド
}
```

**レスポンス (200 OK):**
```typescript
{
  id: string;
  orgId: string;
  // ... 更新後の全フィールド
  updatedAt: string;
}
```

#### 3. ロゴアップロード

**Endpoint:**
```
POST /api/v1/branding/{orgId}/logo
Content-Type: multipart/form-data
```

**認証:**
```
Authorization: Bearer <JWT>
```

**権限:**
- `SUPER_ADMIN`

**リクエスト:**
```typescript
{
  file: File;  // PNG, JPG, SVG（最大2MB）
  type: 'logo' | 'favicon' | 'ogImage';
}
```

**レスポンス (200 OK):**
```typescript
{
  url: string;  // S3 URL
  width: number;
  height: number;
}
```

### UI実装

#### ブランディング編集ページ

**場所:** `apps/web/app/[locale]/admin/branding/[orgId]/page.tsx`

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getBranding, updateBranding, uploadLogo } from '@/lib/api/branding';

export default function BrandingEditorPage() {
  const params = useParams();
  const orgId = params.orgId as string;

  const [branding, setBranding] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchBranding = async () => {
      const data = await getBranding(orgId);
      setBranding(data);
    };
    fetchBranding();
  }, [orgId]);

  const handleLogoUpload = async (file: File, type: 'logo' | 'favicon') => {
    try {
      const result = await uploadLogo(orgId, file, type);
      setBranding({ ...branding, [`${type}Url`]: result.url });
    } catch (error) {
      console.error('Failed to upload logo:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await updateBranding(orgId, branding);
      alert('Branding updated successfully!');
    } catch (error) {
      console.error('Failed to update branding:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!branding) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Branding Editor</h1>

      <div className="grid grid-cols-2 gap-6">
        {/* 編集フォーム */}
        <div className="space-y-6">
          <form onSubmit={handleSubmit} className="bg-white border rounded-lg p-6">
            {/* ロゴアップロード */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Logo</label>
              <div className="border-2 border-dashed rounded-lg p-4">
                {branding.logoUrl ? (
                  <div className="flex items-center gap-4">
                    <img src={branding.logoUrl} alt="Logo" className="h-16" />
                    <button
                      type="button"
                      onClick={() => setBranding({ ...branding, logoUrl: null })}
                      className="text-red-600 hover:text-red-700 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleLogoUpload(file, 'logo');
                    }}
                    className="w-full"
                  />
                )}
              </div>
            </div>

            {/* カラーピッカー */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Primary Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={branding.primaryColor}
                  onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                  className="w-16 h-10 rounded border"
                />
                <input
                  type="text"
                  value={branding.primaryColor}
                  onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                  className="flex-1 p-2 border rounded"
                  placeholder="#3B82F6"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Secondary Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={branding.secondaryColor}
                  onChange={(e) => setBranding({ ...branding, secondaryColor: e.target.value })}
                  className="w-16 h-10 rounded border"
                />
                <input
                  type="text"
                  value={branding.secondaryColor}
                  onChange={(e) => setBranding({ ...branding, secondaryColor: e.target.value })}
                  className="flex-1 p-2 border rounded"
                />
              </div>
            </div>

            {/* メッセージ */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Welcome Title</label>
              <input
                type="text"
                value={branding.welcomeTitle || ''}
                onChange={(e) => setBranding({ ...branding, welcomeTitle: e.target.value })}
                className="w-full p-2 border rounded"
                placeholder="Welcome to Interview"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Welcome Message</label>
              <textarea
                value={branding.welcomeMessage || ''}
                onChange={(e) => setBranding({ ...branding, welcomeMessage: e.target.value })}
                className="w-full p-2 border rounded"
                rows={4}
                placeholder="Thank you for your interest..."
              />
            </div>

            {/* ホワイトラベル */}
            <div className="mb-6">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={branding.hidePranceBranding}
                  onChange={(e) => setBranding({ ...branding, hidePranceBranding: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Hide Prance branding (white-label)</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>

        {/* ライブプレビュー */}
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Live Preview</h2>
          <div
            className="border rounded-lg overflow-hidden"
            style={{
              backgroundColor: branding.backgroundColor,
              color: branding.textColor,
            }}
          >
            {/* ヘッダー */}
            <div
              className="p-4 border-b"
              style={{ backgroundColor: branding.primaryColor }}
            >
              {branding.logoUrl && (
                <img src={branding.logoUrl} alt="Logo" className="h-8" />
              )}
            </div>

            {/* コンテンツ */}
            <div className="p-8 text-center">
              <h1 className="text-2xl font-bold mb-4">
                {branding.welcomeTitle || 'Welcome to Interview'}
              </h1>
              <p className="text-gray-600 mb-6">
                {branding.welcomeMessage || 'Thank you for your interest in joining our team.'}
              </p>
              <button
                className="px-6 py-3 rounded-lg text-white"
                style={{ backgroundColor: branding.primaryColor }}
              >
                Start Interview
              </button>
            </div>

            {/* フッター */}
            {!branding.hidePranceBranding && (
              <div className="p-4 border-t text-center text-xs text-gray-500">
                Powered by Prance
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

#### 候補者側のゲストページ（ブランディング適用）

**場所:** `apps/web/app/g/[token]/page.tsx`（更新）

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getBrandingForGuestSession } from '@/lib/api/branding';

export default function GuestAccessPage() {
  const params = useParams();
  const token = params.token as string;

  const [branding, setBranding] = useState<any>(null);
  const [password, setPassword] = useState('');

  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const data = await getBrandingForGuestSession(token);
        setBranding(data);

        // ファビコン適用
        if (data.faviconUrl) {
          const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
          if (link) link.href = data.faviconUrl;
        }

        // メタタグ適用
        if (data.metaTitle) {
          document.title = data.metaTitle;
        }
      } catch (error) {
        console.error('Failed to fetch branding:', error);
      }
    };
    fetchBranding();
  }, [token]);

  if (!branding) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        backgroundColor: branding.backgroundColor,
        color: branding.textColor,
        fontFamily: branding.fontFamily,
      }}
    >
      {/* ヘッダー */}
      <header
        className="p-6 border-b"
        style={{ backgroundColor: branding.primaryColor }}
      >
        {branding.logoUrl && (
          <img
            src={branding.logoUrl}
            alt="Logo"
            style={{
              width: branding.logoWidth ? `${branding.logoWidth}px` : 'auto',
              height: branding.logoHeight ? `${branding.logoHeight}px` : 'auto',
            }}
          />
        )}
      </header>

      {/* メインコンテンツ */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold mb-2">
              {branding.welcomeTitle || 'Welcome to Your Interview Session'}
            </h1>
            <p className="text-gray-600">
              {branding.welcomeMessage || 'Please enter the password provided to you.'}
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Password</label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 text-center text-2xl font-mono font-bold border rounded-lg"
                placeholder="••••"
                required
                autoFocus
              />
            </div>

            <button
              type="submit"
              className="w-full px-6 py-3 rounded-lg font-medium text-white"
              style={{ backgroundColor: branding.primaryColor }}
            >
              Start Session
            </button>
          </form>
        </div>
      </main>

      {/* フッター */}
      <footer className="p-6 border-t text-center text-sm text-gray-600">
        {branding.footerText || `© ${new Date().getFullYear()} All rights reserved.`}
        {branding.privacyPolicyUrl && (
          <a href={branding.privacyPolicyUrl} className="ml-4 hover:underline">
            Privacy Policy
          </a>
        )}
        {!branding.hidePranceBranding && (
          <div className="mt-2 text-xs text-gray-400">
            Powered by Prance
          </div>
        )}
      </footer>
    </div>
  );
}
```

---

## 実装フェーズ

### Phase 3.0: エンタープライズ機能（推定4-5週間）

#### Week 1: XLSX一括登録（Backend）

**Day 1-2: データモデル・API**
- [ ] `BulkInvitation` テーブル追加
- [ ] `POST /bulk-invitations/upload` API実装
- [ ] S3アップロード処理
- [ ] Step Functions ワークフロー設計

**Day 3-4: XLSX処理**
- [ ] `validate-xlsx` Lambda実装
- [ ] `create-guest-session` Lambda（バッチ対応）
- [ ] `send-bulk-emails` Lambda実装
- [ ] エラーレポート生成

**Day 5: テスト**
- [ ] 単体テスト（各Lambda）
- [ ] 統合テスト（100件、1000件）
- [ ] エラーケーステスト

#### Week 2: XLSX一括登録（Frontend）+ ATS連携（Backend）

**Day 6-7: Frontend実装**
- [ ] アップロードページUI
- [ ] 処理ステータスページ（ポーリング）
- [ ] テンプレートダウンロード
- [ ] エラー表示・再アップロード

**Day 8-10: ATS連携（Greenhouse）**
- [ ] `ATSIntegration`, `ATSSyncLog`, `CandidateATSMapping` テーブル
- [ ] Greenhouse API連携クラス
- [ ] 全件同期Lambda
- [ ] Webhook受信エンドポイント
- [ ] Webhook署名検証

#### Week 3: ATS連携（他プロバイダ）

**Day 11-12: グローバル市場ATS（Lever, Workday）**
- [ ] Lever API連携クラス
- [ ] Workday API連携クラス
- [ ] プロバイダ別Webhook処理
- [ ] フィールドマッピングロジック

**Day 13: 日本市場ATS（HRMOS採用）**
- [ ] HRMOS API連携クラス
- [ ] HRMOS Webhook処理（HMAC-SHA256検証）
- [ ] 日本語フィールドマッピング（姓・名、全角半角変換）
- [ ] 評価スコア5段階変換ロジック

**Day 14-15: ATS UI**
- [ ] ATS設定ページ（グローバル/日本市場切り替え）
- [ ] プロバイダー別フォーム動的生成
- [ ] 同期ステータス表示
- [ ] 手動同期トリガー
- [ ] Webhook設定手順ガイド（プロバイダー別）

#### Week 4: ブランディング・カスタマイズ

**Day 16-17: Backend**
- [ ] `OrganizationBranding` テーブル
- [ ] ブランディングAPI（GET, PUT）
- [ ] ロゴアップロードAPI
- [ ] 画像リサイズ処理（Sharp）

**Day 18-20: Frontend（管理画面）**
- [ ] ブランディング編集ページ
- [ ] カラーピッカー、ファイルアップロード
- [ ] ライブプレビュー
- [ ] ホワイトラベル設定

**Day 21: Frontend（候補者ページ）**
- [ ] ゲストページへのブランディング適用
- [ ] 動的CSS生成
- [ ] ファビコン、メタタグ適用

#### Week 5: 統合テスト・ドキュメント

**Day 22-23: 統合テスト**
- [ ] XLSX → ATS同期の全フロー
- [ ] ブランディング適用確認
- [ ] パフォーマンステスト（1000候補者）

**Day 24-25: ドキュメント・トレーニング**
- [ ] ユーザーガイド作成
- [ ] ATS設定マニュアル（プロバイダ別）
- [ ] ブランディングガイドライン
- [ ] API ドキュメント更新

---

## セキュリティ考慮事項

### 1. XLSX処理のセキュリティ

**脅威:**
- **XXE攻撃:** 悪意のあるXMLを含むXLSXファイル
- **ファイルボム:** 巨大なファイルでリソース枯渇
- **マクロウイルス:** VBAマクロを含むファイル

**対策:**
```typescript
// ファイルサイズ制限
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// ファイルタイプ検証（マジックナンバー）
import { fromBuffer } from 'file-type';

async function validateXLSX(buffer: Buffer): Promise<boolean> {
  const type = await fromBuffer(buffer);
  if (!type || type.mime !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
    throw new Error('Invalid file type');
  }

  // ファイルサイズチェック
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error('File size exceeds limit');
  }

  return true;
}

// XXE対策（XLSX解析時）
const workbook = XLSX.read(buffer, {
  type: 'buffer',
  cellStyles: false,  // スタイル無視（パフォーマンス）
  cellFormula: false, // 数式無視（セキュリティ）
  cellHTML: false,    // HTML無視
});
```

### 2. ATS認証情報の管理

**脅威:**
- API Token、Webhook Secretの漏洩
- 平文保存によるデータベース侵害リスク

**対策:**
```typescript
// AWS Secrets Managerで暗号化保存
import { SecretsManager } from 'aws-sdk';

const secretsManager = new SecretsManager();

async function storeATSCredentials(orgId: string, apiToken: string): Promise<string> {
  const secretName = `prance/ats/${orgId}`;
  const result = await secretsManager.createSecret({
    Name: secretName,
    SecretString: JSON.stringify({ apiToken }),
    KmsKeyId: process.env.KMS_KEY_ID,  // KMS暗号化
  }).promise();

  return result.ARN!;
}

async function getATSCredentials(secretArn: string): Promise<{ apiToken: string }> {
  const result = await secretsManager.getSecretValue({
    SecretId: secretArn,
  }).promise();

  return JSON.parse(result.SecretString!);
}
```

### 3. Webhook検証

**脅威:**
- 偽装Webhookによる不正データ投入
- リプレイ攻撃

**対策:**
```typescript
// HMAC署名検証
import crypto from 'crypto';

function verifyWebhookSignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  // タイミング攻撃対策（constant-time比較）
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(`sha256=${expectedSignature}`)
  );
}

// タイムスタンプチェック（リプレイ攻撃対策）
function verifyWebhookTimestamp(timestamp: number): boolean {
  const now = Date.now() / 1000;
  const diff = Math.abs(now - timestamp);
  return diff < 300; // 5分以内
}
```

### 4. ブランディング・XSS対策

**脅威:**
- カスタムメッセージにJavaScriptコードを埋め込み
- ロゴURLに悪意のあるURLを指定

**対策:**
```typescript
// HTMLサニタイズ
import DOMPurify from 'dompurify';

function sanitizeMessage(message: string): string {
  return DOMPurify.sanitize(message, {
    ALLOWED_TAGS: [],  // HTMLタグを全て除去
    ALLOWED_ATTR: [],
  });
}

// URL検証
function validateLogoUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // S3バケットのURLのみ許可
    return parsed.hostname.endsWith('.amazonaws.com');
  } catch {
    return false;
  }
}
```

---

## 付録

### A. XLSXテンプレートファイル生成

```typescript
// infrastructure/lambda/bulk-invitations/generate-template/index.ts
import * as XLSX from 'xlsx';

export const handler = async () => {
  const wb = XLSX.utils.book_new();

  // シート1: 候補者リスト
  const wsData = [
    ['*Name', '*Email', 'Phone', 'Position', 'Source', 'University', 'Major'],
    ['山田太郎', 'yamada@example.com', '090-1234-5678', 'Engineer', 'LinkedIn', '東京大学', '情報工学'],
    ['田中花子', 'tanaka@example.com', '080-9876-5432', 'Designer', 'Indeed', '京都大学', '芸術工学'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // データ検証設定
  ws['!dataValidation'] = {
    D2: { // Position列
      type: 'list',
      formula1: '"Engineer,Designer,Sales,Marketing,Product Manager,Other"',
    },
    E2: { // Source列
      type: 'list',
      formula1: '"LinkedIn,Indeed,Referral,Website,Job Fair,Other"',
    },
  };

  XLSX.utils.book_append_sheet(wb, ws, 'Candidates');

  // Excelファイル生成
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  // S3アップロード
  await s3.putObject({
    Bucket: process.env.BUCKET_NAME!,
    Key: 'templates/candidate_invitation_template.xlsx',
    Body: buffer,
    ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }).promise();

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="candidate_invitation_template.xlsx"',
    },
    body: buffer.toString('base64'),
    isBase64Encoded: true,
  };
};
```

### B. 環境変数

```bash
# .env
# XLSX処理
MAX_XLSX_FILE_SIZE=10485760  # 10MB
XLSX_PROCESSING_TIMEOUT=300  # 5分

# ATS連携
ATS_SYNC_FREQUENCY=HOURLY
ATS_WEBHOOK_TIMEOUT=30       # 30秒

# ブランディング
MAX_LOGO_FILE_SIZE=2097152   # 2MB
LOGO_MAX_WIDTH=500           # px
LOGO_MAX_HEIGHT=150          # px
```

### C. 参考リソース

**ATS API ドキュメント:**
- [Greenhouse Harvest API](https://developers.greenhouse.io/harvest.html)
- [Lever API](https://hire.lever.co/developer/documentation)
- [Workday Recruiting API](https://community.workday.com/sites/default/files/file-hosting/productionapi/Recruiting/v35.1/Workday_Recruiting.html)

**XLSXライブラリ:**
- [SheetJS (xlsx)](https://github.com/SheetJS/sheetjs)
- [ExcelJS](https://github.com/exceljs/exceljs)

**関連ドキュメント:**
- [GUEST_USER_SYSTEM.md](./GUEST_USER_SYSTEM.md)
- [API_DESIGN.md](../development/API_DESIGN.md)
- [DATABASE_DESIGN.md](../development/DATABASE_DESIGN.md)

---

**最終更新:** 2026-03-09
**次回レビュー:** Phase 3.0 実装開始時
