# エンタープライズ機能（Enterprise Features）

**バージョン:** 1.0
**作成日:** 2026-03-09
**ステータス:** 設計完了・実装予定 (Phase 3.0)

---

## 目次

1. [概要](#概要)
2. [XLSX一括登録システム](#xlsx一括登録システム)
3. [ATS連携](#ats連携)
4. [AIプロンプト・プロバイダー管理](#aiプロンプトプロバイダー管理)
5. [レポート・検索・分析機能](#レポート検索分析機能)
6. [データ管理・アーカイブ機能](#データ管理アーカイブ機能)
7. [ブランディング・カスタマイズ](#ブランディングカスタマイズ)
8. [実装フェーズ](#実装フェーズ)
9. [セキュリティ考慮事項](#セキュリティ考慮事項)

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
| AIプロンプト・プロバイダー管理 | LLMベンダー切り替え、プロンプト編集       | SUPER_ADMIN          |
| レポート・検索・分析機能       | 候補者検索、フィルタ・ソート、Excelエクスポート | CLIENT_ADMIN, CLIENT_USER |
| データ管理・アーカイブ機能     | ソフトデリート、アーカイブ、復元機能       | CLIENT_ADMIN         |
| ブランディング・カスタマイズ   | 候補者ページのロゴ・色・メッセージを編集   | SUPER_ADMIN          |

### ビジネス価値

**運用効率化:**
- **90%の時間削減:** 手動入力 → XLSX一括登録
- **80%のエラー削減:** ATS連携による二重入力排除
- **90%のレポート作成時間削減:** 手動集計 → ワンクリックExcelエクスポート
- **候補者体験向上:** ブランド統一による信頼感向上

**データドリブン意思決定:**
- 複雑なフィルター条件で候補者を即座に抽出
- 経営層への報告資料を1クリックで生成
- 採用基準の標準化と最適化をデータで実現

**スケーラビリティ:**
- 1000人の候補者を5分で登録
- ATSからの自動同期で人的リソース不要
- 複数クライアントのブランド設定を一元管理
- 数千件のセッションデータから瞬時にフィルタリング

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

## AIプロンプト・プロバイダー管理

### 概要

スーパー管理者が**コード変更なし**でAI会話の挙動を制御・最適化するための中核システムです。LLMベンダーの選択・切り替えと、AIに投入するプロンプトの編集を全てUI上で実行できます。

### 目的

**ビジネスの柔軟性:**
- プロンプト変更 → 5分で本番反映（従来: 2-3日のデプロイサイクル）
- Enterprise顧客ごとの独自プロンプト設定が可能
- A/Bテスト、バージョン管理、即座のロールバック

**リスク管理:**
- プロバイダー障害時の自動フォールバック（Bedrock → OpenAI → Google AI）
- エラー率・レスポンス時間の監視と自動切り替え
- サービス継続性の向上（99.99% Uptime目標）

**コスト最適化:**
- プロバイダー別コスト比較（Bedrock $18/1M → Gemini $2/1M）
- 使用量に応じた自動切り替え
- 月間予算管理・アラート設定

### 主要機能

| 機能                   | 説明                                       | アクセス権限     |
| ---------------------- | ------------------------------------------ | ---------------- |
| プロンプトテンプレート | システムプロンプト、変数定義、AI設定       | SUPER_ADMIN      |
| プロバイダー管理       | LLMベンダー選択、優先順位、フォールバック  | SUPER_ADMIN      |
| バージョン管理         | プロンプト変更履歴、比較、ロールバック     | SUPER_ADMIN      |
| テスト実行             | リアルタイムテスト、デバッグ情報表示       | SUPER_ADMIN      |
| コスト管理             | プロバイダー別コスト追跡、予算管理         | SUPER_ADMIN      |

### データモデル

#### PromptTemplate テーブル

```prisma
model PromptTemplate {
  id              String   @id @default(cuid())
  name            String   // '面接官プロンプト（標準）'
  category        PromptCategory
  orgId           String?  // 組織固有のカスタムプロンプト
  isDefault       Boolean  @default(false)
  version         Int      @default(1)
  status          PromptStatus @default(DRAFT)

  // プロンプト本体
  systemPrompt    String   @db.Text
  userPromptTemplate String? @db.Text

  // 変数定義（JSON）
  variables       Json?    // { key, label, type, required, defaultValue }

  // AI設定
  modelSettings   Json?    // { temperature, maxTokens, topP }

  // メタデータ
  description     String?
  tags            String[]
  usageCount      Int      @default(0)

  // 関連
  versions        PromptVersion[]
  sessions        Session[] @relation("SessionPrompt")

  // タイムスタンプ
  createdBy       String
  updatedBy       String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([orgId])
  @@index([category, status])
  @@map("prompt_templates")
}

enum PromptCategory {
  SYSTEM          // システムプロンプト（役割定義）
  SCENARIO        // シナリオ固有プロンプト
  EVALUATION      // 評価用プロンプト
}

enum PromptStatus {
  DRAFT           // 下書き
  ACTIVE          // 有効
  ARCHIVED        // アーカイブ
}

model PromptVersion {
  id              String   @id @default(cuid())
  templateId      String
  template        PromptTemplate @relation(fields: [templateId], references: [id])
  version         Int
  changelog       String   @db.Text

  // スナップショット
  snapshot        Json     // { systemPrompt, variables, modelSettings }

  // 統計情報
  totalSessions   Int      @default(0)
  avgRating       Float?
  errorRate       Float?

  createdBy       String
  createdAt       DateTime @default(now())

  @@unique([templateId, version])
  @@index([templateId])
  @@map("prompt_versions")
}
```

#### AIProvider テーブル

```prisma
model AIProvider {
  id              String   @id @default(cuid())
  name            String   // 'AWS Bedrock (Claude Sonnet 4.6)'
  provider        AIProviderType
  modelId         String   // 'us.anthropic.claude-sonnet-4-6'

  // 接続設定（暗号化してSecrets Managerに保存）
  configSecretArn String?  // AWS Secrets Manager ARN

  // 優先順位（フォールバック用）
  priority        Int      @default(1)
  status          AIProviderStatus @default(ACTIVE)

  // コスト設定
  inputCostPer1M  Float    // $3.0
  outputCostPer1M Float    // $15.0

  // 制限設定
  maxTokens       Int      @default(4096)
  maxRPM          Int      @default(1000)
  maxRPD          Int      @default(100000)

  // 健全性チェック
  healthStatus    String?  // 'healthy', 'degraded', 'down'
  lastHealthCheck DateTime?
  errorRate       Float?
  avgLatency      Float?

  // タイムスタンプ
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([priority, status])
  @@map("ai_providers")
}

enum AIProviderType {
  BEDROCK         // AWS Bedrock
  OPENAI          // OpenAI
  GOOGLE          // Google AI (Gemini)
  AZURE_OPENAI    // Azure OpenAI Service
  ANTHROPIC       // Anthropic (Direct)
}

enum AIProviderStatus {
  ACTIVE          // アクティブ（優先使用）
  STANDBY         // スタンバイ（フォールバック）
  DISABLED        // 無効
  ERROR           // エラー状態
}
```

### サポートAIプロバイダー

| プロバイダ       | モデル            | 入力コスト | 出力コスト | 特徴                          |
| ---------------- | ----------------- | ---------- | ---------- | ----------------------------- |
| **AWS Bedrock**  | Claude Sonnet 4.6 | $3.0/1M    | $15.0/1M   | 高品質、低レイテンシ、AWS統合 |
| **OpenAI**       | GPT-4 Turbo       | $10.0/1M   | $30.0/1M   | 高性能、広範な知識            |
| **Google AI**    | Gemini Pro        | $0.5/1M    | $1.5/1M    | コスト効率、多言語対応        |
| **Azure OpenAI** | GPT-4             | $10.0/1M   | $30.0/1M   | Enterprise向け、SLA保証       |
| **Anthropic**    | Claude 3.5 Sonnet | $3.0/1M    | $15.0/1M   | 直接契約、高性能              |

### API設計

#### 1. プロンプトテンプレート一覧取得

**Endpoint:**
```
GET /api/v1/prompts/templates?category=system&status=active
```

**認証:**
```
Authorization: Bearer <JWT>
```

**権限:**
- `SUPER_ADMIN`

**レスポンス (200 OK):**
```typescript
{
  templates: [
    {
      id: 'tpl_abc123',
      name: '面接官プロンプト（標準）',
      category: 'SYSTEM',
      status: 'ACTIVE',
      version: 3,
      usageCount: 120,
      updatedAt: '2026-03-08T10:30:00Z',
    },
    // ...
  ],
  pagination: {
    total: 15,
    limit: 20,
    offset: 0,
  }
}
```

#### 2. プロンプトテンプレート作成・更新

**Endpoint:**
```
POST /api/v1/prompts/templates
PUT /api/v1/prompts/templates/{id}
```

**リクエスト:**
```typescript
{
  name: '面接官プロンプト（標準）',
  category: 'SYSTEM',
  systemPrompt: 'あなたは{{company_name}}の採用面接官です...',
  variables: [
    {
      key: 'company_name',
      label: '会社名',
      type: 'text',
      required: true,
      defaultValue: 'デフォルト株式会社',
    },
    // ...
  ],
  modelSettings: {
    temperature: 0.7,
    maxTokens: 2048,
    topP: 0.9,
  },
  status: 'ACTIVE',
}
```

**レスポンス (200 OK):**
```typescript
{
  id: 'tpl_abc123',
  version: 4,  // 自動インクリメント
  // ... 全フィールド
}
```

#### 3. プロンプトテスト実行

**Endpoint:**
```
POST /api/v1/prompts/templates/{id}/test
```

**リクエスト:**
```typescript
{
  variables: {
    company_name: 'テスト株式会社',
    job_position: 'バックエンドエンジニア',
  },
  testMessages: [
    {
      role: 'user',
      content: 'こんにちは',
    }
  ],
  providerId: 'provider_bedrock_001',  // オプション
}
```

**レスポンス (200 OK):**
```typescript
{
  response: {
    role: 'assistant',
    content: 'こんにちは。本日は面接にお越しいただきありがとうございます...',
  },
  debug: {
    responseTime: 1.2,  // 秒
    tokensUsed: {
      input: 145,
      output: 89,
      total: 234,
    },
    cost: 0.0042,  // USD
    provider: 'AWS Bedrock (Claude Sonnet 4.6)',
  }
}
```

#### 4. AIプロバイダー一覧取得

**Endpoint:**
```
GET /api/v1/ai-providers
```

**レスポンス (200 OK):**
```typescript
{
  providers: [
    {
      id: 'provider_bedrock_001',
      name: 'AWS Bedrock (Claude Sonnet 4.6)',
      provider: 'BEDROCK',
      modelId: 'us.anthropic.claude-sonnet-4-6',
      priority: 1,
      status: 'ACTIVE',
      healthStatus: 'healthy',
      usage: {
        monthlyRequests: 12450,
        monthlyTokens: 5234000,
        monthlyCost: 1234.56,
      },
      pricing: {
        inputCostPer1M: 3.0,
        outputCostPer1M: 15.0,
      },
    },
    // ...
  ]
}
```

#### 5. AIプロバイダー設定更新

**Endpoint:**
```
PUT /api/v1/ai-providers/{id}
```

**リクエスト:**
```typescript
{
  priority: 1,
  status: 'ACTIVE',
  maxTokens: 4096,
  maxRPM: 1000,
}
```

#### 6. フォールバック設定

**Endpoint:**
```
PUT /api/v1/ai-providers/fallback
```

**リクエスト:**
```typescript
{
  enabled: true,
  conditions: {
    errorRateThreshold: 0.05,  // 5%
    latencyThreshold: 5000,    // 5秒
    quotaExceeded: true,
  },
  monthlyBudget: 5000,  // USD
  alertThreshold: 0.8,  // 80%
}
```

### UI実装

#### プロンプトテンプレート一覧ページ

**場所:** `apps/web/app/[locale]/admin/prompts/page.tsx`

```tsx
'use client';

import { useState, useEffect } from 'react';
import { getPromptTemplates, deletePromptTemplate } from '@/lib/api/prompts';
import type { PromptTemplate } from '@prance/shared';

export default function PromptTemplatesPage() {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [filter, setFilter] = useState({
    category: 'all',
    status: 'all',
  });

  useEffect(() => {
    const fetchTemplates = async () => {
      const data = await getPromptTemplates(filter);
      setTemplates(data.templates);
    };
    fetchTemplates();
  }, [filter]);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">AI Prompt Templates</h1>
        <a
          href="/admin/prompts/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + New Template
        </a>
      </div>

      {/* フィルター */}
      <div className="bg-white border rounded-lg p-4 mb-6">
        <div className="flex gap-4">
          <select
            value={filter.category}
            onChange={(e) => setFilter({ ...filter, category: e.target.value })}
            className="p-2 border rounded-lg"
          >
            <option value="all">All Categories</option>
            <option value="SYSTEM">System</option>
            <option value="SCENARIO">Scenario</option>
            <option value="EVALUATION">Evaluation</option>
          </select>
          <select
            value={filter.status}
            onChange={(e) => setFilter({ ...filter, status: e.target.value })}
            className="p-2 border rounded-lg"
          >
            <option value="all">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="DRAFT">Draft</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
      </div>

      {/* テンプレート一覧 */}
      <div className="space-y-4">
        {templates.map((template) => (
          <div key={template.id} className="bg-white border rounded-lg p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-xl font-semibold">{template.name}</h3>
                  <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                    v{template.version}
                  </span>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded ${
                      template.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-800'
                        : template.status === 'DRAFT'
                        ? 'bg-gray-100 text-gray-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {template.status}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>Category: {template.category}</span>
                  <span>•</span>
                  <span>Used in {template.usageCount} sessions</span>
                  <span>•</span>
                  <span>Updated: {new Date(template.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <a
                  href={`/admin/prompts/${template.id}/edit`}
                  className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
                >
                  Edit
                </a>
                <a
                  href={`/admin/prompts/${template.id}/test`}
                  className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
                >
                  Test
                </a>
                <button
                  onClick={() => handleDelete(template.id)}
                  className="px-3 py-1 text-sm text-red-600 border border-red-600 rounded hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

#### AIプロバイダー管理ページ

**場所:** `apps/web/app/[locale]/admin/ai-providers/page.tsx`

```tsx
'use client';

import { useState, useEffect } from 'react';
import { getAIProviders, updateAIProvider, updateFallbackSettings } from '@/lib/api/ai-providers';

export default function AIProvidersPage() {
  const [providers, setProviders] = useState<any[]>([]);
  const [fallbackSettings, setFallbackSettings] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      const data = await getAIProviders();
      setProviders(data.providers);
      setFallbackSettings(data.fallbackSettings);
    };
    fetchData();
  }, []);

  const handleStatusChange = async (providerId: string, newStatus: string) => {
    await updateAIProvider(providerId, { status: newStatus });
    // Re-fetch providers
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">AI Provider Management</h1>

      {/* プロバイダー一覧 */}
      <div className="space-y-4 mb-8">
        {providers.map((provider) => (
          <div key={provider.id} className="bg-white border rounded-lg p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div
                  className={`w-3 h-3 rounded-full mt-1.5 ${
                    provider.status === 'ACTIVE'
                      ? 'bg-green-500'
                      : provider.status === 'STANDBY'
                      ? 'bg-yellow-500'
                      : 'bg-gray-300'
                  }`}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold">{provider.name}</h3>
                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                      Priority: {provider.priority}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                    <div>
                      <span className="font-medium">Status:</span> {provider.status} |{' '}
                      {provider.healthStatus}
                    </div>
                    <div>
                      <span className="font-medium">Usage (month):</span>{' '}
                      {provider.usage?.monthlyRequests?.toLocaleString()} requests
                    </div>
                    <div>
                      <span className="font-medium">Cost:</span> $
                      {provider.usage?.monthlyCost?.toFixed(2)}
                    </div>
                    <div>
                      <span className="font-medium">Pricing:</span> $
                      {provider.pricing?.inputCostPer1M} / ${provider.pricing?.outputCostPer1M} per
                      1M tokens
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleStatusChange(provider.id, 'ACTIVE')}
                  className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
                  disabled={provider.status === 'ACTIVE'}
                >
                  Activate
                </button>
                <button
                  onClick={() => handleStatusChange(provider.id, 'STANDBY')}
                  className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
                >
                  Standby
                </button>
                <button
                  onClick={() => handleStatusChange(provider.id, 'DISABLED')}
                  className="px-3 py-1 text-sm text-red-600 border border-red-600 rounded hover:bg-red-50"
                >
                  Disable
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* フォールバック設定 */}
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Fallback Settings</h2>
        <label className="flex items-center gap-2 mb-4">
          <input
            type="checkbox"
            checked={fallbackSettings?.enabled}
            onChange={(e) =>
              setFallbackSettings({ ...fallbackSettings, enabled: e.target.checked })
            }
            className="rounded"
          />
          <span>Enable automatic fallback on provider failure</span>
        </label>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">Error Rate Threshold (%)</label>
            <input
              type="number"
              value={(fallbackSettings?.conditions?.errorRateThreshold || 0) * 100}
              onChange={(e) =>
                setFallbackSettings({
                  ...fallbackSettings,
                  conditions: {
                    ...fallbackSettings.conditions,
                    errorRateThreshold: parseFloat(e.target.value) / 100,
                  },
                })
              }
              className="w-full p-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Latency Threshold (ms)</label>
            <input
              type="number"
              value={fallbackSettings?.conditions?.latencyThreshold || 5000}
              onChange={(e) =>
                setFallbackSettings({
                  ...fallbackSettings,
                  conditions: {
                    ...fallbackSettings.conditions,
                    latencyThreshold: parseInt(e.target.value),
                  },
                })
              }
              className="w-full p-2 border rounded-lg"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Monthly Budget (USD)</label>
          <input
            type="number"
            value={fallbackSettings?.monthlyBudget || 5000}
            onChange={(e) =>
              setFallbackSettings({
                ...fallbackSettings,
                monthlyBudget: parseInt(e.target.value),
              })
            }
            className="w-full p-2 border rounded-lg"
          />
        </div>

        <button
          onClick={() => updateFallbackSettings(fallbackSettings)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
}
```

### セキュリティ考慮事項

#### 1. プロンプトインジェクション対策

```typescript
// 変数のサニタイゼーション
function sanitizeVariable(value: string): string {
  // システムプロンプトを上書きしようとする試みを検出
  const dangerousPatterns = [
    /ignore\s+(previous|all)\s+instructions?/i,
    /you\s+are\s+now/i,
    /system\s*:/i,
    /\[INST\]/i,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(value)) {
      throw new Error('Potential prompt injection detected');
    }
  }

  return value;
}
```

#### 2. APIキー管理

```typescript
// AWS Secrets Manager で暗号化保存
import { SecretsManager } from 'aws-sdk';

async function storeProviderCredentials(providerId: string, credentials: any) {
  const secretsManager = new SecretsManager();

  const secretArn = await secretsManager
    .createSecret({
      Name: `prance/ai-provider/${providerId}`,
      SecretString: JSON.stringify(credentials),
      KmsKeyId: process.env.KMS_KEY_ID,
    })
    .promise();

  return secretArn.ARN;
}
```

#### 3. アクセス制御

- プロンプト編集: `SUPER_ADMIN` のみ
- プロバイダー管理: `SUPER_ADMIN` のみ
- テスト実行: `SUPER_ADMIN` のみ
- バージョン履歴閲覧: 全管理者

---

## レポート・検索・分析機能

### 概要

候補者の全文検索、面接結果およびセッション解析結果を一覧表示し、各項目ごとにフィルタリング・ソーティングを行えます。選択した結果はExcelファイル（.xlsx）としてエクスポート可能です。

### 目的

**データドリブン意思決定:**
- 候補者のパフォーマンスを定量的に比較
- 採用基準の標準化と最適化
- チーム間での評価基準の共有

**業務効率化:**
- 条件に合致する候補者を即座に抽出
- レポート作成時間を90%削減（手動集計 → 自動エクスポート）
- 経営層への報告資料を1クリックで生成

**データ活用:**
- 過去データの傾向分析
- ATS連携による候補者追跡
- プロンプト改善のためのフィードバック収集

### 主要機能

| 機能                 | 説明                                       | 対象ユーザー         |
| -------------------- | ------------------------------------------ | -------------------- |
| 候補者検索           | 名前・メール・電話番号での全文検索         | CLIENT_ADMIN, CLIENT_USER |
| 高度なフィルタリング | 複数条件での絞り込み（AND/OR条件）         | CLIENT_ADMIN, CLIENT_USER |
| ソーティング         | 各列でのソート（昇順・降順）               | CLIENT_ADMIN, CLIENT_USER |
| Excelエクスポート    | フィルタ結果を.xlsx形式でダウンロード      | CLIENT_ADMIN, CLIENT_USER |
| 保存済みフィルター   | よく使う条件を保存・再利用                 | CLIENT_ADMIN, CLIENT_USER |
| 一括操作             | 選択した複数セッションの一括処理           | CLIENT_ADMIN         |

### 候補者検索機能

#### 概要

候補者の名前、メールアドレス、電話番号から瞬時に検索できる全文検索機能を提供します。大量の候補者データから目的の候補者を素早く見つけ出せます。

#### 検索対象フィールド

| フィールド       | 検索方式           | 例                          |
| ---------------- | ------------------ | --------------------------- |
| 候補者名（User） | 部分一致           | '田中' → 田中太郎, 田中花子 |
| ゲスト名         | 部分一致           | '山田' → 山田一郎           |
| メールアドレス   | 部分一致・完全一致 | '@example.com', 'tanaka@'   |
| 電話番号         | 部分一致           | '090-1234', '1234'          |
| シナリオ名       | 部分一致           | '技術面接'                  |
| 評価コメント     | 全文検索           | 'コミュニケーション力が高い' |

#### 検索実装方式

**PostgreSQL全文検索（tsvector）:**
```sql
-- tsvector列の追加（マイグレーション）
ALTER TABLE users ADD COLUMN search_vector tsvector;
ALTER TABLE guest_sessions ADD COLUMN search_vector tsvector;

-- インデックス作成
CREATE INDEX users_search_idx ON users USING GIN(search_vector);
CREATE INDEX guest_sessions_search_idx ON guest_sessions USING GIN(search_vector);

-- トリガーで自動更新
CREATE TRIGGER users_search_update BEFORE INSERT OR UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION
tsvector_update_trigger(search_vector, 'pg_catalog.simple', name, email, phone);
```

**検索クエリ例:**
```typescript
// Prisma raw query
const results = await prisma.$queryRaw`
  SELECT u.*, s.*, e.*
  FROM users u
  LEFT JOIN sessions s ON s.user_id = u.id
  LEFT JOIN evaluations e ON e.session_id = s.id
  WHERE u.search_vector @@ plainto_tsquery('simple', ${searchQuery})
     OR u.name ILIKE ${'%' + searchQuery + '%'}
     OR u.email ILIKE ${'%' + searchQuery + '%'}
  ORDER BY ts_rank(u.search_vector, plainto_tsquery('simple', ${searchQuery})) DESC
  LIMIT 50
`;
```

#### API設計

**Endpoint:**
```
GET /api/v1/candidates/search?q={query}&limit=50&offset=0
```

**認証:**
```
Authorization: Bearer <JWT>
```

**権限:**
- `CLIENT_ADMIN`: 組織内の全候補者
- `CLIENT_USER`: 自分が担当した候補者のみ

**クエリパラメータ:**
```typescript
{
  q: '田中',                    // 検索クエリ
  type?: 'user' | 'guest' | 'all',  // 検索対象（デフォルト: all）
  limit: 50,
  offset: 0,
}
```

**レスポンス (200 OK):**
```typescript
{
  results: [
    {
      type: 'user',
      user: {
        id: 'user_123',
        name: '田中太郎',
        email: 'tanaka@example.com',
        phone: '090-1234-5678',
      },
      sessions: [
        {
          id: 'session_456',
          scenarioName: '技術面接',
          totalScore: 85,
          startedAt: '2026-03-15T10:00:00Z',
        },
        // ...
      ],
      highlightFields: ['name'],  // マッチしたフィールド
    },
    {
      type: 'guest',
      guestSession: {
        id: 'guest_789',
        guestName: '田中花子',
        guestEmail: 'hanako.tanaka@example.com',
        status: 'COMPLETED',
      },
      evaluation: {
        totalScore: 78,
      },
      highlightFields: ['guestName', 'guestEmail'],
    },
    // ...
  ],
  pagination: {
    total: 15,
    limit: 50,
    offset: 0,
    hasMore: false,
  },
  searchTime: 0.045,  // 秒
}
```

#### UI実装

**検索バー（ヘッダーまたは一覧ページ）:**

```tsx
'use client';

import { useState } from 'react';
import { searchCandidates } from '@/lib/api/candidates';

export default function CandidateSearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery || searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const data = await searchCandidates({ q: searchQuery, limit: 10 });
      setResults(data.results);
      setShowResults(true);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // デバウンス処理
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    // 300ms後に検索実行
    setTimeout(() => {
      if (value === query) {
        handleSearch(value);
      }
    }, 300);
  };

  return (
    <div className="relative w-full max-w-xl">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setShowResults(true)}
          placeholder="候補者名、メールアドレス、電話番号で検索..."
          className="w-full px-4 py-2 pl-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <svg
          className="absolute left-3 top-3 h-5 w-5 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        {isSearching && (
          <div className="absolute right-3 top-3">
            <svg className="animate-spin h-5 w-5 text-blue-600" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
        )}
      </div>

      {/* 検索結果ドロップダウン */}
      {showResults && results.length > 0 && (
        <div className="absolute z-10 w-full mt-2 bg-white border rounded-lg shadow-lg max-h-96 overflow-y-auto">
          {results.map((result, index) => (
            <a
              key={index}
              href={
                result.type === 'user'
                  ? `/dashboard/users/${result.user.id}`
                  : `/dashboard/guest-sessions/${result.guestSession.id}`
              }
              className="block px-4 py-3 hover:bg-gray-50 border-b last:border-b-0"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">
                      {result.type === 'user' ? result.user.name : result.guestSession.guestName}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-xs rounded ${
                        result.type === 'user'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {result.type === 'user' ? 'User' : 'Guest'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {result.type === 'user' ? result.user.email : result.guestSession.guestEmail}
                  </p>
                  {result.sessions && result.sessions.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      {result.sessions.length} sessions • Avg score:{' '}
                      {Math.round(
                        result.sessions.reduce((sum: number, s: any) => sum + s.totalScore, 0) /
                          result.sessions.length
                      )}
                    </p>
                  )}
                </div>
              </div>
            </a>
          ))}

          {results.length === 10 && (
            <a
              href={`/dashboard/candidates?q=${encodeURIComponent(query)}`}
              className="block px-4 py-2 text-center text-sm text-blue-600 hover:bg-gray-50"
            >
              View all results →
            </a>
          )}
        </div>
      )}

      {/* 検索結果なし */}
      {showResults && query.length >= 2 && results.length === 0 && !isSearching && (
        <div className="absolute z-10 w-full mt-2 bg-white border rounded-lg shadow-lg p-4 text-center text-gray-500">
          No results found for "{query}"
        </div>
      )}
    </div>
  );
}
```

### データモデル

#### SavedFilter テーブル

```prisma
model SavedFilter {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  orgId           String
  organization    Organization @relation(fields: [orgId], references: [id])

  // フィルター情報
  name            String   // 'スコア80点以上の候補者'
  description     String?
  filterType      FilterType // 'SESSION', 'EVALUATION', 'GUEST'

  // フィルター条件（JSON）
  conditions      Json     // { field, operator, value }[]
  sortBy          String?  // 'totalScore', 'createdAt'
  sortOrder       SortOrder? // 'ASC', 'DESC'

  // 共有設定
  isPublic        Boolean  @default(false)
  sharedWith      String[] // ユーザーIDリスト

  // タイムスタンプ
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([userId, orgId])
  @@index([orgId, isPublic])
  @@map("saved_filters")
}

enum FilterType {
  SESSION         // セッション一覧
  EVALUATION      // 評価一覧
  GUEST           // ゲストセッション一覧
}

enum SortOrder {
  ASC
  DESC
}
```

### フィルタリング可能な項目

#### セッション（Session）

| フィールド        | 型       | 演算子                                    | 例                          |
| ----------------- | -------- | ----------------------------------------- | --------------------------- |
| status            | Enum     | =, !=, in                                 | COMPLETED, ERROR            |
| createdAt         | DateTime | =, !=, <, <=, >, >=, between              | 2026-03-01 ~ 2026-03-31     |
| startedAt         | DateTime | =, !=, <, <=, >, >=, between              | 過去7日間                   |
| endedAt           | DateTime | =, !=, <, <=, >, >=, between              | 本日                        |
| durationSec       | Number   | =, !=, <, <=, >, >=, between              | 1800 (30分)                 |
| scenarioId        | String   | =, !=, in                                 | シナリオA, シナリオB        |
| avatarId          | String   | =, !=, in                                 | アバター1, アバター2        |
| userId            | String   | =, !=, in                                 | 特定ユーザー                |

#### 評価（Evaluation）

| フィールド              | 型     | 演算子                   | 例                     |
| ----------------------- | ------ | ------------------------ | ---------------------- |
| totalScore              | Number | =, !=, <, <=, >, >=, between | 80以上                 |
| communicationScore      | Number | =, !=, <, <=, >, >=, between | 70-90                  |
| logicalThinkingScore    | Number | =, !=, <, <=, >, >=, between | 85以上                 |
| technicalScore          | Number | =, !=, <, <=, >, >=, between | 60以下                 |
| overallRating           | Enum   | =, !=, in                | EXCELLENT, GOOD        |
| aiFeedback              | String | contains, startsWith     | '優秀' を含む          |
| evaluatorName           | String | =, !=, contains          | '田中'                 |
| evaluatedAt             | DateTime | =, !=, <, <=, >, >=, between | 過去30日間             |

#### ゲストセッション（GuestSession）

| フィールド   | 型       | 演算子                   | 例                     |
| ------------ | -------- | ------------------------ | ---------------------- |
| status       | Enum     | =, !=, in                | COMPLETED, PENDING     |
| guestName    | String   | =, !=, contains          | '山田' を含む          |
| guestEmail   | String   | =, !=, contains          | @example.com           |
| expiresAt    | DateTime | =, !=, <, <=, >, >=, between | 期限切れ（過去）       |

### API設計

#### 1. セッション一覧取得（フィルタリング・ソーティング）

**Endpoint:**
```
GET /api/v1/sessions?filter={JSON}&sort={field}&order={ASC|DESC}&limit=50&offset=0
```

**認証:**
```
Authorization: Bearer <JWT>
```

**権限:**
- `CLIENT_ADMIN`: 組織内の全セッション
- `CLIENT_USER`: 自分のセッションのみ

**クエリパラメータ:**
```typescript
{
  filter: {
    // AND条件（配列内）
    conditions: [
      { field: 'totalScore', operator: '>=', value: 80 },
      { field: 'createdAt', operator: 'between', value: ['2026-03-01', '2026-03-31'] },
      { field: 'status', operator: 'in', value: ['COMPLETED'] }
    ],
    // OR条件（複数フィルターグループ）
    orConditions?: [
      [
        { field: 'scenarioId', operator: '=', value: 'scenario_abc' }
      ],
      [
        { field: 'scenarioId', operator: '=', value: 'scenario_xyz' }
      ]
    ]
  },
  sort: 'totalScore',
  order: 'DESC',
  limit: 50,
  offset: 0
}
```

**レスポンス (200 OK):**
```typescript
{
  sessions: [
    {
      id: 'session_123',
      userId: 'user_456',
      userName: '田中太郎',
      scenarioId: 'scenario_abc',
      scenarioName: '技術面接シナリオ',
      avatarId: 'avatar_001',
      avatarName: '面接官アバターA',
      status: 'COMPLETED',
      startedAt: '2026-03-15T10:00:00Z',
      endedAt: '2026-03-15T10:30:00Z',
      durationSec: 1800,
      evaluation: {
        totalScore: 85,
        communicationScore: 90,
        logicalThinkingScore: 82,
        technicalScore: 83,
        overallRating: 'EXCELLENT',
      },
      createdAt: '2026-03-15T09:50:00Z',
    },
    // ...
  ],
  pagination: {
    total: 245,
    limit: 50,
    offset: 0,
    hasMore: true,
  },
  summary: {
    totalSessions: 245,
    avgScore: 76.5,
    avgDuration: 1620, // 秒
    completionRate: 0.92, // 92%
  }
}
```

#### 2. Excelエクスポート

**Endpoint:**
```
POST /api/v1/sessions/export
```

**リクエスト:**
```typescript
{
  filter: {
    conditions: [
      { field: 'totalScore', operator: '>=', value: 80 },
      { field: 'createdAt', operator: 'between', value: ['2026-03-01', '2026-03-31'] }
    ]
  },
  sort: 'totalScore',
  order: 'DESC',
  columns: [
    'userName',
    'scenarioName',
    'totalScore',
    'communicationScore',
    'logicalThinkingScore',
    'technicalScore',
    'overallRating',
    'startedAt',
    'durationSec'
  ],
  format: 'xlsx', // 'xlsx' | 'csv'
  includeTranscript: false, // 文字起こしを含めるか
}
```

**レスポンス (200 OK):**
```typescript
{
  downloadUrl: 'https://prance-exports.s3.amazonaws.com/sessions_2026-03-15_123456.xlsx',
  fileName: 'sessions_2026-03-15_123456.xlsx',
  fileSize: 245678, // bytes
  recordCount: 87,
  expiresAt: '2026-03-15T15:00:00Z', // 1時間後に期限切れ
}
```

**Excel出力形式:**

| A: 候補者名 | B: シナリオ | C: 総合スコア | D: コミュニケーション | E: 論理的思考 | F: 技術力 | G: 総合評価 | H: 開始日時 | I: 所要時間（分） |
|------------|------------|--------------|---------------------|--------------|---------|-----------|-----------|------------------|
| 田中太郎    | 技術面接    | 85           | 90                  | 82           | 83      | EXCELLENT | 2026-03-15 10:00 | 30 |
| 鈴木花子    | 技術面接    | 82           | 85                  | 80           | 81      | GOOD      | 2026-03-15 11:00 | 28 |
| ...        | ...        | ...          | ...                 | ...          | ...     | ...       | ...       | ...              |

#### 3. 保存済みフィルター作成

**Endpoint:**
```
POST /api/v1/filters
```

**リクエスト:**
```typescript
{
  name: 'スコア80点以上の候補者',
  description: '高評価候補者のリスト',
  filterType: 'SESSION',
  conditions: [
    { field: 'totalScore', operator: '>=', value: 80 },
    { field: 'status', operator: '=', value: 'COMPLETED' }
  ],
  sortBy: 'totalScore',
  sortOrder: 'DESC',
  isPublic: false, // 組織内で共有するか
}
```

**レスポンス (200 OK):**
```typescript
{
  id: 'filter_abc123',
  name: 'スコア80点以上の候補者',
  filterType: 'SESSION',
  conditions: [ /* ... */ ],
  sortBy: 'totalScore',
  sortOrder: 'DESC',
  createdAt: '2026-03-15T12:00:00Z',
}
```

#### 4. 保存済みフィルター一覧取得

**Endpoint:**
```
GET /api/v1/filters?filterType=SESSION
```

**レスポンス (200 OK):**
```typescript
{
  filters: [
    {
      id: 'filter_abc123',
      name: 'スコア80点以上の候補者',
      description: '高評価候補者のリスト',
      filterType: 'SESSION',
      isPublic: false,
      createdBy: 'user_456',
      createdByName: '田中太郎',
      createdAt: '2026-03-15T12:00:00Z',
    },
    // ...
  ]
}
```

### UI実装

#### セッション一覧ページ（フィルタ・ソート機能付き）

**場所:** `apps/web/app/[locale]/dashboard/sessions/page.tsx`

```tsx
'use client';

import { useState, useEffect } from 'react';
import { getSessions, exportSessions } from '@/lib/api/sessions';
import { getSavedFilters, saveFilter } from '@/lib/api/filters';

export default function SessionsPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [filters, setFilters] = useState<any>({
    conditions: [],
  });
  const [sort, setSort] = useState({ field: 'createdAt', order: 'DESC' });
  const [savedFilters, setSavedFilters] = useState<any[]>([]);
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  useEffect(() => {
    fetchSessions();
    fetchSavedFilters();
  }, [filters, sort]);

  const fetchSessions = async () => {
    const data = await getSessions({
      filter: filters,
      sort: sort.field,
      order: sort.order,
    });
    setSessions(data.sessions);
  };

  const fetchSavedFilters = async () => {
    const data = await getSavedFilters('SESSION');
    setSavedFilters(data.filters);
  };

  const handleAddCondition = () => {
    setFilters({
      ...filters,
      conditions: [
        ...filters.conditions,
        { field: 'totalScore', operator: '>=', value: '' },
      ],
    });
  };

  const handleRemoveCondition = (index: number) => {
    const newConditions = [...filters.conditions];
    newConditions.splice(index, 1);
    setFilters({ ...filters, conditions: newConditions });
  };

  const handleUpdateCondition = (index: number, field: string, value: any) => {
    const newConditions = [...filters.conditions];
    newConditions[index] = { ...newConditions[index], [field]: value };
    setFilters({ ...filters, conditions: newConditions });
  };

  const handleExport = async () => {
    const result = await exportSessions({
      filter: filters,
      sort: sort.field,
      order: sort.order,
      columns: [
        'userName',
        'scenarioName',
        'totalScore',
        'communicationScore',
        'logicalThinkingScore',
        'technicalScore',
        'overallRating',
        'startedAt',
        'durationSec',
      ],
      format: 'xlsx',
    });

    // ダウンロード
    window.open(result.downloadUrl, '_blank');
  };

  const handleSaveFilter = async () => {
    const name = prompt('フィルター名を入力してください:');
    if (!name) return;

    await saveFilter({
      name,
      filterType: 'SESSION',
      conditions: filters.conditions,
      sortBy: sort.field,
      sortOrder: sort.order,
    });

    fetchSavedFilters();
  };

  const handleLoadFilter = (filter: any) => {
    setFilters({ conditions: filter.conditions });
    setSort({ field: filter.sortBy, order: filter.sortOrder });
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Session Reports</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            {showFilterPanel ? 'Hide Filters' : 'Show Filters'}
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            📊 Export to Excel
          </button>
        </div>
      </div>

      {/* フィルターパネル */}
      {showFilterPanel && (
        <div className="bg-white border rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Filters</h2>
            <button
              onClick={handleSaveFilter}
              className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
            >
              Save Filter
            </button>
          </div>

          {/* 保存済みフィルター */}
          {savedFilters.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Saved Filters:</label>
              <div className="flex gap-2 flex-wrap">
                {savedFilters.map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => handleLoadFilter(filter)}
                    className="px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                  >
                    {filter.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* フィルター条件 */}
          <div className="space-y-3">
            {filters.conditions.map((condition: any, index: number) => (
              <div key={index} className="flex gap-2 items-center">
                <select
                  value={condition.field}
                  onChange={(e) => handleUpdateCondition(index, 'field', e.target.value)}
                  className="p-2 border rounded-lg"
                >
                  <option value="totalScore">Total Score</option>
                  <option value="communicationScore">Communication</option>
                  <option value="logicalThinkingScore">Logical Thinking</option>
                  <option value="technicalScore">Technical</option>
                  <option value="status">Status</option>
                  <option value="createdAt">Created Date</option>
                  <option value="durationSec">Duration</option>
                </select>

                <select
                  value={condition.operator}
                  onChange={(e) => handleUpdateCondition(index, 'operator', e.target.value)}
                  className="p-2 border rounded-lg"
                >
                  <option value="=">=</option>
                  <option value="!=">!=</option>
                  <option value=">">{'>'}</option>
                  <option value=">=">{'>='}</option>
                  <option value="<">{'<'}</option>
                  <option value="<=">{'<='}</option>
                  <option value="between">Between</option>
                  <option value="contains">Contains</option>
                </select>

                <input
                  type="text"
                  value={condition.value}
                  onChange={(e) => handleUpdateCondition(index, 'value', e.target.value)}
                  className="flex-1 p-2 border rounded-lg"
                  placeholder="Value"
                />

                <button
                  onClick={() => handleRemoveCondition(index)}
                  className="px-3 py-2 text-red-600 border border-red-600 rounded hover:bg-red-50"
                >
                  ✕
                </button>
              </div>
            ))}

            <button
              onClick={handleAddCondition}
              className="px-4 py-2 text-sm border border-dashed rounded-lg hover:bg-gray-50"
            >
              + Add Condition
            </button>
          </div>
        </div>
      )}

      {/* セッション一覧テーブル */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th
                className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-gray-100"
                onClick={() =>
                  setSort({
                    field: 'userName',
                    order: sort.field === 'userName' && sort.order === 'ASC' ? 'DESC' : 'ASC',
                  })
                }
              >
                Candidate {sort.field === 'userName' && (sort.order === 'ASC' ? '↑' : '↓')}
              </th>
              <th
                className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-gray-100"
                onClick={() =>
                  setSort({
                    field: 'scenarioName',
                    order: sort.field === 'scenarioName' && sort.order === 'ASC' ? 'DESC' : 'ASC',
                  })
                }
              >
                Scenario {sort.field === 'scenarioName' && (sort.order === 'ASC' ? '↑' : '↓')}
              </th>
              <th
                className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-gray-100"
                onClick={() =>
                  setSort({
                    field: 'totalScore',
                    order: sort.field === 'totalScore' && sort.order === 'ASC' ? 'DESC' : 'ASC',
                  })
                }
              >
                Total Score {sort.field === 'totalScore' && (sort.order === 'ASC' ? '↑' : '↓')}
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium">Communication</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Logical</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Technical</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Rating</th>
              <th
                className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-gray-100"
                onClick={() =>
                  setSort({
                    field: 'startedAt',
                    order: sort.field === 'startedAt' && sort.order === 'ASC' ? 'DESC' : 'ASC',
                  })
                }
              >
                Date {sort.field === 'startedAt' && (sort.order === 'ASC' ? '↑' : '↓')}
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium">Duration</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => (
              <tr key={session.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 text-sm">{session.userName}</td>
                <td className="px-4 py-3 text-sm">{session.scenarioName}</td>
                <td className="px-4 py-3 text-sm font-semibold">
                  {session.evaluation?.totalScore || '-'}
                </td>
                <td className="px-4 py-3 text-sm">{session.evaluation?.communicationScore || '-'}</td>
                <td className="px-4 py-3 text-sm">{session.evaluation?.logicalThinkingScore || '-'}</td>
                <td className="px-4 py-3 text-sm">{session.evaluation?.technicalScore || '-'}</td>
                <td className="px-4 py-3 text-sm">
                  <span
                    className={`px-2 py-1 text-xs rounded ${
                      session.evaluation?.overallRating === 'EXCELLENT'
                        ? 'bg-green-100 text-green-800'
                        : session.evaluation?.overallRating === 'GOOD'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {session.evaluation?.overallRating || '-'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  {new Date(session.startedAt).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm">{Math.round(session.durationSec / 60)} min</td>
                <td className="px-4 py-3 text-sm">
                  <a
                    href={`/dashboard/sessions/${session.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    View
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

### Backend実装（Excelエクスポート）

**場所:** `infrastructure/lambda/sessions/export/index.ts`

```typescript
import { APIGatewayProxyHandler } from 'aws-lambda';
import { prisma } from '../../shared/database/prisma';
import { S3 } from 'aws-sdk';
import * as XLSX from 'xlsx';

const s3 = new S3();

export const handler: APIGatewayProxyHandler = async (event) => {
  const body = JSON.parse(event.body || '{}');
  const { filter, sort, order, columns, format, includeTranscript } = body;

  // フィルター条件を構築
  const whereClause = buildWhereClause(filter);

  // セッション取得
  const sessions = await prisma.session.findMany({
    where: whereClause,
    include: {
      user: true,
      scenario: true,
      avatar: true,
      evaluation: true,
      transcripts: includeTranscript,
    },
    orderBy: sort ? { [sort]: order || 'DESC' } : { createdAt: 'DESC' },
  });

  // Excelデータ生成
  const worksheetData = sessions.map((session) => {
    const row: any = {};

    if (columns.includes('userName')) row['候補者名'] = session.user.name;
    if (columns.includes('scenarioName')) row['シナリオ'] = session.scenario.name;
    if (columns.includes('totalScore')) row['総合スコア'] = session.evaluation?.totalScore || '';
    if (columns.includes('communicationScore'))
      row['コミュニケーション'] = session.evaluation?.communicationScore || '';
    if (columns.includes('logicalThinkingScore'))
      row['論理的思考'] = session.evaluation?.logicalThinkingScore || '';
    if (columns.includes('technicalScore'))
      row['技術力'] = session.evaluation?.technicalScore || '';
    if (columns.includes('overallRating'))
      row['総合評価'] = session.evaluation?.overallRating || '';
    if (columns.includes('startedAt'))
      row['開始日時'] = session.startedAt?.toISOString() || '';
    if (columns.includes('durationSec'))
      row['所要時間（分）'] = session.durationSec ? Math.round(session.durationSec / 60) : '';

    return row;
  });

  // Workbook作成
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(worksheetData);

  // 列幅自動調整
  const maxWidth = 50;
  const columnWidths = Object.keys(worksheetData[0] || {}).map((key) => {
    const maxLength = Math.max(
      key.length,
      ...worksheetData.map((row) => String(row[key] || '').length)
    );
    return { wch: Math.min(maxLength + 2, maxWidth) };
  });
  worksheet['!cols'] = columnWidths;

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sessions');

  // Excelファイル生成
  const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  // S3にアップロード
  const fileName = `sessions_${new Date().toISOString().split('T')[0]}_${Date.now()}.xlsx`;
  const s3Key = `exports/${fileName}`;

  await s3
    .putObject({
      Bucket: process.env.EXPORT_BUCKET!,
      Key: s3Key,
      Body: excelBuffer,
      ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ContentDisposition: `attachment; filename="${fileName}"`,
      Expires: new Date(Date.now() + 3600 * 1000), // 1時間後に期限切れ
    })
    .promise();

  // 署名付きURL生成
  const downloadUrl = s3.getSignedUrl('getObject', {
    Bucket: process.env.EXPORT_BUCKET!,
    Key: s3Key,
    Expires: 3600, // 1時間
  });

  return {
    statusCode: 200,
    body: JSON.stringify({
      downloadUrl,
      fileName,
      fileSize: excelBuffer.length,
      recordCount: sessions.length,
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    }),
  };
};

function buildWhereClause(filter: any) {
  if (!filter || !filter.conditions || filter.conditions.length === 0) {
    return {};
  }

  const conditions = filter.conditions.map((condition: any) => {
    const { field, operator, value } = condition;

    switch (operator) {
      case '=':
        return { [field]: value };
      case '!=':
        return { [field]: { not: value } };
      case '>':
        return { [field]: { gt: value } };
      case '>=':
        return { [field]: { gte: value } };
      case '<':
        return { [field]: { lt: value } };
      case '<=':
        return { [field]: { lte: value } };
      case 'between':
        return { [field]: { gte: value[0], lte: value[1] } };
      case 'contains':
        return { [field]: { contains: value } };
      case 'in':
        return { [field]: { in: Array.isArray(value) ? value : [value] } };
      default:
        return {};
    }
  });

  return { AND: conditions };
}
```

### セキュリティ考慮事項

#### 1. データアクセス制御

```typescript
// ユーザーロールに基づくフィルタリング
async function getSessionsWithPermission(userId: string, userRole: string, filter: any) {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  // CLIENT_USERは自分のセッションのみ
  if (userRole === 'CLIENT_USER') {
    filter.userId = userId;
  }

  // CLIENT_ADMINは組織内のセッション
  if (userRole === 'CLIENT_ADMIN') {
    filter.orgId = user.orgId;
  }

  // SUPER_ADMINは全アクセス可能

  return prisma.session.findMany({ where: filter });
}
```

#### 2. エクスポートファイルのセキュリティ

- S3署名付きURL（1時間の有効期限）
- ファイル自動削除（24時間後）
- アクセスログ記録（CloudTrail）

#### 3. SQLインジェクション対策

- Prismaのパラメータ化クエリ使用
- フィールド名のホワイトリスト検証

```typescript
const ALLOWED_FIELDS = [
  'totalScore',
  'communicationScore',
  'logicalThinkingScore',
  'technicalScore',
  'status',
  'createdAt',
  'startedAt',
  'durationSec',
];

function validateField(field: string): boolean {
  return ALLOWED_FIELDS.includes(field);
}
```

---

## データ管理・アーカイブ機能

### 概要

終了した募集要項（シナリオ）やゲストセッションをUI上で非表示にする**ソフトデリート機能**を提供します。データベースから物理削除せず、論理削除（アーカイブ）することで、必要に応じて復元が可能です。

### 目的

**データ整理:**
- 終了した募集要項を一覧から非表示にして、UI を整理
- アクティブなシナリオのみを表示して、業務効率を向上
- 誤って削除したデータの復元が可能

**コンプライアンス:**
- データ保持ポリシーに準拠（GDPR、個人情報保護法）
- 監査証跡の保持（誰が・いつ・何をアーカイブしたか）
- 完全削除前の猶予期間を設ける

**業務継続性:**
- 過去データの参照・分析が可能
- 同じ募集要項の再利用（アーカイブ解除）
- データ移行時の安全性確保

### 主要機能

| 機能                 | 説明                                       | 対象ユーザー   |
| -------------------- | ------------------------------------------ | -------------- |
| ソフトデリート       | UI上で非表示（論理削除）                   | CLIENT_ADMIN   |
| アーカイブ一覧       | アーカイブされたデータの閲覧               | CLIENT_ADMIN   |
| 復元機能             | アーカイブデータをアクティブに戻す         | CLIENT_ADMIN   |
| 完全削除             | データベースから物理削除（復元不可）       | SUPER_ADMIN    |
| 一括アーカイブ       | 複数データを一度にアーカイブ               | CLIENT_ADMIN   |
| 自動アーカイブ       | 期限切れデータの自動アーカイブ             | システム自動   |

### データモデル

#### アーカイブ対象データ

**1. Scenario（募集要項・シナリオ）**

```prisma
model Scenario {
  id          String       @id @default(uuid())
  userId      String?      @map("user_id")
  orgId       String       @map("org_id")
  title       String
  category    String
  language    String       @default("ja")
  visibility  Visibility   @default(PRIVATE)

  // アーカイブ関連フィールド（追加）
  isArchived  Boolean      @default(false) @map("is_archived")
  archivedAt  DateTime?    @map("archived_at")
  archivedBy  String?      @map("archived_by")  // User ID

  configJson  Json         @map("config_json")
  createdAt   DateTime     @default(now()) @map("created_at")
  updatedAt   DateTime     @updatedAt @map("updated_at")

  organization Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  sessions     Session[]

  @@index([orgId])
  @@index([category])
  @@index([isArchived])  // 追加
  @@map("scenarios")
}
```

**2. GuestSession（ゲストセッション）**

```prisma
model GuestSession {
  id              String   @id @default(cuid())
  sessionId       String   @unique
  accessToken     String   @unique
  accessPassword  String   // bcrypt hashed

  orgId           String
  scenarioId      String
  avatarId        String

  guestName       String?
  guestEmail      String?
  guestPhone      String?

  status          GuestSessionStatus @default(PENDING)
  expiresAt       DateTime?

  // アーカイブ関連フィールド（追加）
  isArchived      Boolean   @default(false) @map("is_archived")
  archivedAt      DateTime? @map("archived_at")
  archivedBy      String?   @map("archived_by")

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([orgId])
  @@index([status])
  @@index([isArchived])  // 追加
  @@map("guest_sessions")
}
```

**3. Avatar（アバター）**

```prisma
model Avatar {
  id          String       @id @default(uuid())
  userId      String?      @map("user_id")
  orgId       String       @map("org_id")
  name        String
  type        AvatarType
  style       AvatarStyle
  source      AvatarSource

  // アーカイブ関連フィールド（追加）
  isArchived  Boolean      @default(false) @map("is_archived")
  archivedAt  DateTime?    @map("archived_at")
  archivedBy  String?      @map("archived_by")

  modelUrl    String       @map("model_url")
  thumbnailUrl String?     @map("thumbnail_url")
  configJson  Json?        @map("config_json")
  tags        String[]     @default([])
  visibility  Visibility   @default(PRIVATE)
  allowCloning Boolean     @default(false) @map("allow_cloning")
  createdAt   DateTime     @default(now()) @map("created_at")

  user         User?        @relation(fields: [userId], references: [id], onDelete: SetNull)
  organization Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  sessions     Session[]

  @@index([orgId])
  @@index([userId])
  @@index([visibility])
  @@index([isArchived])  // 追加
  @@map("avatars")
}
```

#### 監査ログ（ArchiveLog）

```prisma
model ArchiveLog {
  id              String   @id @default(cuid())

  // 対象データ
  targetType      ArchiveTargetType  // 'SCENARIO', 'GUEST_SESSION', 'AVATAR'
  targetId        String
  targetName      String  // アーカイブ時の名前

  // 操作情報
  action          ArchiveAction  // 'ARCHIVE', 'RESTORE', 'DELETE'
  performedBy     String  // User ID
  performedByName String  // ユーザー名（スナップショット）

  orgId           String

  // 理由・メモ
  reason          String?
  notes           String?

  // タイムスタンプ
  performedAt     DateTime @default(now())

  @@index([targetType, targetId])
  @@index([orgId])
  @@index([performedAt])
  @@map("archive_logs")
}

enum ArchiveTargetType {
  SCENARIO
  GUEST_SESSION
  AVATAR
  USER
}

enum ArchiveAction {
  ARCHIVE   // アーカイブ（論理削除）
  RESTORE   // 復元
  DELETE    // 完全削除
}
```

### API設計

#### 1. シナリオをアーカイブ

**Endpoint:**
```
POST /api/v1/scenarios/{id}/archive
```

**認証:**
```
Authorization: Bearer <JWT>
```

**権限:**
- `CLIENT_ADMIN`: 自組織のシナリオ

**リクエスト:**
```typescript
{
  reason?: '募集終了のため',  // アーカイブ理由（オプション）
  notes?: '次回募集時に再利用予定',
}
```

**レスポンス (200 OK):**
```typescript
{
  id: 'scenario_123',
  title: '2024年度 新卒エンジニア採用',
  isArchived: true,
  archivedAt: '2026-03-15T12:00:00Z',
  archivedBy: 'user_456',
  archivedByName: '田中太郎',
}
```

#### 2. アーカイブ済みシナリオ一覧取得

**Endpoint:**
```
GET /api/v1/scenarios?includeArchived=true
```

**レスポンス (200 OK):**
```typescript
{
  scenarios: [
    {
      id: 'scenario_123',
      title: '2024年度 新卒エンジニア採用',
      isArchived: true,
      archivedAt: '2026-03-15T12:00:00Z',
      createdAt: '2026-01-01T00:00:00Z',
    },
    // ...
  ],
  pagination: { /* ... */ }
}
```

#### 3. アーカイブを復元

**Endpoint:**
```
POST /api/v1/scenarios/{id}/restore
```

**リクエスト:**
```typescript
{
  notes?: '2025年度募集で再利用',
}
```

**レスポンス (200 OK):**
```typescript
{
  id: 'scenario_123',
  title: '2024年度 新卒エンジニア採用',
  isArchived: false,
  archivedAt: null,
  archivedBy: null,
}
```

#### 4. 完全削除（物理削除）

**Endpoint:**
```
DELETE /api/v1/scenarios/{id}/permanent
```

**権限:**
- `SUPER_ADMIN` のみ

**確認:**
```typescript
{
  confirm: true,  // 必須
  reason: '個人情報保護法に基づく削除依頼',
}
```

**レスポンス (200 OK):**
```typescript
{
  message: 'Scenario permanently deleted',
  deletedAt: '2026-03-15T12:00:00Z',
}
```

#### 5. 一括アーカイブ

**Endpoint:**
```
POST /api/v1/scenarios/bulk-archive
```

**リクエスト:**
```typescript
{
  scenarioIds: ['scenario_123', 'scenario_456', 'scenario_789'],
  reason: '年度終了に伴う一括アーカイブ',
}
```

**レスポンス (200 OK):**
```typescript
{
  success: 3,
  failed: 0,
  results: [
    { id: 'scenario_123', status: 'archived' },
    { id: 'scenario_456', status: 'archived' },
    { id: 'scenario_789', status: 'archived' },
  ]
}
```

#### 6. 自動アーカイブ設定

**Endpoint:**
```
PUT /api/v1/organizations/{orgId}/auto-archive-settings
```

**リクエスト:**
```typescript
{
  enabled: true,
  rules: [
    {
      targetType: 'GUEST_SESSION',
      condition: 'expiresAt < now() AND status = COMPLETED',
      daysAfterExpiry: 30,  // 期限切れ30日後に自動アーカイブ
    },
    {
      targetType: 'SCENARIO',
      condition: 'updatedAt < now() - interval "180 days"',
      // 180日間更新されていないシナリオを自動アーカイブ
    }
  ]
}
```

### UI実装

#### シナリオ一覧ページ（アーカイブ機能付き）

**場所:** `apps/web/app/[locale]/dashboard/scenarios/page.tsx`

```tsx
'use client';

import { useState, useEffect } from 'react';
import { getScenarios, archiveScenario, restoreScenario } from '@/lib/api/scenarios';

export default function ScenariosPage() {
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    fetchScenarios();
  }, [showArchived]);

  const fetchScenarios = async () => {
    const data = await getScenarios({ includeArchived: showArchived });
    setScenarios(data.scenarios);
  };

  const handleArchive = async (scenarioId: string) => {
    if (!confirm('この募集要項をアーカイブしますか？\n※復元可能です')) return;

    const reason = prompt('アーカイブ理由を入力してください（任意）:');
    await archiveScenario(scenarioId, { reason });
    fetchScenarios();
  };

  const handleRestore = async (scenarioId: string) => {
    if (!confirm('この募集要項を復元しますか？')) return;

    await restoreScenario(scenarioId);
    fetchScenarios();
  };

  const handleBulkArchive = async () => {
    if (selectedIds.length === 0) {
      alert('アーカイブするシナリオを選択してください');
      return;
    }

    if (!confirm(`${selectedIds.length}件の募集要項をアーカイブしますか？`)) return;

    const reason = prompt('アーカイブ理由を入力してください（任意）:');
    // Bulk archive API call
    fetchScenarios();
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Scenarios</h1>
        <div className="flex gap-2">
          <label className="flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Show archived</span>
          </label>
          {selectedIds.length > 0 && (
            <button
              onClick={handleBulkArchive}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Archive selected ({selectedIds.length})
            </button>
          )}
          <a
            href="/dashboard/scenarios/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            + New Scenario
          </a>
        </div>
      </div>

      {/* シナリオ一覧 */}
      <div className="space-y-4">
        {scenarios.map((scenario) => (
          <div
            key={scenario.id}
            className={`bg-white border rounded-lg p-6 ${
              scenario.isArchived ? 'opacity-60 bg-gray-50' : ''
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(scenario.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedIds([...selectedIds, scenario.id]);
                    } else {
                      setSelectedIds(selectedIds.filter((id) => id !== scenario.id));
                    }
                  }}
                  className="mt-1 rounded"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold">{scenario.title}</h3>
                    {scenario.isArchived && (
                      <span className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded">
                        Archived
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{scenario.category}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>Language: {scenario.language}</span>
                    <span>•</span>
                    <span>Created: {new Date(scenario.createdAt).toLocaleDateString()}</span>
                    {scenario.isArchived && (
                      <>
                        <span>•</span>
                        <span>
                          Archived: {new Date(scenario.archivedAt).toLocaleDateString()}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                {!scenario.isArchived ? (
                  <>
                    <a
                      href={`/dashboard/scenarios/${scenario.id}/edit`}
                      className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
                    >
                      Edit
                    </a>
                    <button
                      onClick={() => handleArchive(scenario.id)}
                      className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
                    >
                      Archive
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleRestore(scenario.id)}
                    className="px-3 py-1 text-sm text-blue-600 border border-blue-600 rounded hover:bg-blue-50"
                  >
                    Restore
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Backend実装（アーカイブ処理）

**場所:** `infrastructure/lambda/scenarios/archive/index.ts`

```typescript
import { APIGatewayProxyHandler } from 'aws-lambda';
import { prisma } from '../../shared/database/prisma';
import { verifyJWT } from '../../shared/auth/jwt';

export const handler: APIGatewayProxyHandler = async (event) => {
  const scenarioId = event.pathParameters?.id;
  const body = JSON.parse(event.body || '{}');
  const { reason, notes } = body;

  // 認証
  const token = event.headers.Authorization?.replace('Bearer ', '');
  const user = await verifyJWT(token!);

  // 権限チェック（CLIENT_ADMIN以上）
  if (user.role !== 'CLIENT_ADMIN' && user.role !== 'SUPER_ADMIN') {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Insufficient permissions' }),
    };
  }

  // シナリオ取得
  const scenario = await prisma.scenario.findUnique({
    where: { id: scenarioId },
  });

  if (!scenario) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Scenario not found' }),
    };
  }

  // 組織IDチェック
  if (scenario.orgId !== user.orgId && user.role !== 'SUPER_ADMIN') {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Cannot archive scenario from another organization' }),
    };
  }

  // アーカイブ処理
  const archivedScenario = await prisma.scenario.update({
    where: { id: scenarioId },
    data: {
      isArchived: true,
      archivedAt: new Date(),
      archivedBy: user.id,
    },
  });

  // 監査ログ記録
  await prisma.archiveLog.create({
    data: {
      targetType: 'SCENARIO',
      targetId: scenarioId,
      targetName: scenario.title,
      action: 'ARCHIVE',
      performedBy: user.id,
      performedByName: user.name,
      orgId: scenario.orgId,
      reason,
      notes,
    },
  });

  return {
    statusCode: 200,
    body: JSON.stringify({
      id: archivedScenario.id,
      title: archivedScenario.title,
      isArchived: archivedScenario.isArchived,
      archivedAt: archivedScenario.archivedAt,
      archivedBy: archivedScenario.archivedBy,
    }),
  };
};
```

### セキュリティ考慮事項

#### 1. アクセス制御

```typescript
// CLIENT_ADMINは自組織のみ
if (user.role === 'CLIENT_ADMIN' && scenario.orgId !== user.orgId) {
  throw new Error('Unauthorized');
}

// SUPER_ADMINのみ完全削除可能
if (action === 'DELETE' && user.role !== 'SUPER_ADMIN') {
  throw new Error('Only SUPER_ADMIN can permanently delete');
}
```

#### 2. 監査証跡

- 全アーカイブ操作を `ArchiveLog` テーブルに記録
- 誰が・いつ・何を・なぜアーカイブしたかを追跡
- CloudTrail と連携して完全な監査ログを保持

#### 3. データ保持ポリシー

```typescript
// アーカイブ後90日で完全削除警告
const AUTO_DELETE_DAYS = 90;

// 定期実行Lambda（daily）
export async function checkAutoDelete() {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - AUTO_DELETE_DAYS);

  const oldArchives = await prisma.scenario.findMany({
    where: {
      isArchived: true,
      archivedAt: { lt: cutoffDate },
    },
  });

  // 管理者に通知
  for (const scenario of oldArchives) {
    await sendAdminNotification({
      type: 'AUTO_DELETE_WARNING',
      message: `Scenario "${scenario.title}" will be permanently deleted in 7 days`,
      scenarioId: scenario.id,
    });
  }
}
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

### Phase 3.0: エンタープライズ機能（推定7-8週間）

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

#### Week 4.5: レポート・分析機能

**Day 21.5-22: Backend（フィルタリング・API）**
- [ ] `SavedFilter` テーブル追加
- [ ] セッション一覧API（フィルタリング・ソーティング対応）
- [ ] フィルター条件パーサー実装
- [ ] 保存済みフィルターAPI（GET, POST, PUT, DELETE）

**Day 23: Backend（Excelエクスポート）**
- [ ] Excelエクスポート Lambda実装（XLSX.js使用）
- [ ] S3署名付きURL生成
- [ ] 列幅自動調整、スタイル設定
- [ ] ファイル自動削除（24時間後）

**Day 24-25: Frontend（一覧ページ）**
- [ ] セッション一覧ページ（フィルタパネル）
- [ ] 動的フィルター条件追加・削除
- [ ] ソート機能（クリックでASC/DESC切り替え）
- [ ] 保存済みフィルター管理UI

**Day 26: Frontend（エクスポート）**
- [ ] Excelエクスポートボタン
- [ ] 列選択ダイアログ
- [ ] エクスポート進行状況表示
- [ ] ダウンロード完了通知

**Day 26.5: 候補者検索機能**
- [ ] PostgreSQL全文検索（tsvector）設定
- [ ] 検索APIエンドポイント実装
- [ ] 検索バーUI（デバウンス処理）
- [ ] 検索結果ドロップダウン表示

#### Week 4.7: データ管理・アーカイブ機能

**Day 26.7-27: Backend（ソフトデリート）**
- [ ] ScenarioテーブルにisArchived, archivedAt, archivedByフィールド追加
- [ ] GuestSessionテーブルにアーカイブフィールド追加
- [ ] Avatarテーブルにアーカイブフィールド追加
- [ ] ArchiveLogテーブル作成
- [ ] アーカイブAPI（POST /scenarios/{id}/archive）実装

**Day 27.5: Backend（復元・完全削除）**
- [ ] 復元API（POST /scenarios/{id}/restore）実装
- [ ] 完全削除API（DELETE /scenarios/{id}/permanent）実装（SUPER_ADMIN専用）
- [ ] 一括アーカイブAPI実装
- [ ] 自動アーカイブ設定API実装

**Day 28: Frontend（アーカイブUI）**
- [ ] シナリオ一覧にアーカイブボタン追加
- [ ] 「アーカイブ済みを表示」チェックボックス
- [ ] 復元ボタン実装
- [ ] 一括選択・一括アーカイブUI
- [ ] アーカイブ理由入力ダイアログ

#### Week 5.7: AIプロンプト・プロバイダー管理

**Day 29-30: Backend（データモデル・API）**
- [ ] `PromptTemplate`, `PromptVersion`, `AIProvider` テーブル
- [ ] プロンプトテンプレートAPI（GET, POST, PUT, DELETE）
- [ ] AIプロバイダーAPI（GET, PUT）
- [ ] バージョン管理ロジック
- [ ] プロンプト変数の動的置換処理

**Day 31-32: プロバイダー統合**
- [ ] AWS Bedrock連携（Claude Sonnet 4.6）
- [ ] OpenAI連携（GPT-4 Turbo）
- [ ] Google AI連携（Gemini Pro）
- [ ] プロバイダー抽象化レイヤー
- [ ] フォールバックロジック実装

**Day 33-34: Frontend（プロンプト管理）**
- [ ] プロンプトテンプレート一覧ページ
- [ ] プロンプト編集ページ（変数定義、AI設定）
- [ ] リアルタイムテスト実行UI
- [ ] バージョン比較・ロールバック機能

**Day 35: Frontend（プロバイダー管理）**
- [ ] AIプロバイダー管理ページ
- [ ] 優先順位設定、ステータス切り替え
- [ ] フォールバック設定UI
- [ ] コスト管理・アラート設定

#### Week 6.7: 統合テスト・ドキュメント

**Day 36-37: 統合テスト**
- [ ] XLSX → ATS同期の全フロー
- [ ] ブランディング適用確認
- [ ] 候補者検索機能（全文検索パフォーマンス）
- [ ] ソフトデリート・復元・完全削除フロー
- [ ] レポートフィルタリング・Excelエクスポート確認
- [ ] AIプロンプト・プロバイダー切り替えテスト
- [ ] フォールバック動作確認
- [ ] パフォーマンステスト（1000候補者、複雑なフィルタ条件）

**Day 38-39: ドキュメント・トレーニング**
- [ ] ユーザーガイド作成
- [ ] ATS設定マニュアル（プロバイダー別）
- [ ] 候補者検索・データ管理ガイド
- [ ] レポート分析・Excelエクスポートガイド
- [ ] AIプロンプト編集ガイド
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
