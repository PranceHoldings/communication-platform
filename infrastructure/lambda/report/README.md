# Report Generation Module

PDFレポート生成機能の実装

## 📁 ファイル構成

```
report/
├── types.ts                  # 型定義
├── charts.ts                 # チャート生成（Chart.js + Canvas）
├── generator.ts              # PDF生成ロジック
├── ai-suggestions.ts         # AI改善提案生成（AWS Bedrock）
├── test-data.ts             # テストデータ
├── test-generate.ts         # PDF生成テスト
├── test-ai-suggestions.ts   # AI提案生成テスト
├── index.ts                 # エクスポート
├── templates/
│   ├── default-template.tsx  # メインPDFテンプレート
│   ├── styles.ts            # スタイル定義
│   ├── components/          # 再利用可能コンポーネント
│   │   ├── Header.tsx
│   │   ├── ScoreCircle.tsx
│   │   ├── ScoreBar.tsx
│   │   ├── TranscriptSection.tsx
│   │   └── Footer.tsx
│   └── index.ts
└── README.md
```

## 🎨 PDFテンプレート構成

### Page 1: サマリー
- 総合スコア（円形グラフ）
- セッション情報（日時、所要時間、ユーザー）
- カテゴリ別スコア（4項目グリッド）

### Page 2: スコア詳細
- レーダーチャート（カテゴリ別スコア）
- スコアバー（カテゴリ別評価）
- 詳細スコア一覧

### Page 3: 強みと改善点
- あなたの強み（自動抽出）
- AI改善提案（AWS Bedrock Claude生成、パーソナライズ）
- スコア推移チャート

### Page 4: 会話記録
- トランスクリプト（最大30件）
- 発言者、タイムスタンプ、テキスト

## 📦 使用方法

### 基本的な使い方

```typescript
import { generateAndUploadReport } from './generator';
import { ReportData } from './types';

// レポートデータを準備
const reportData: ReportData = {
  session: { /* ... */ },
  score: { /* ... */ },
  emotionAnalysis: [ /* ... */ ],
  audioAnalysis: [ /* ... */ ],
  transcript: [ /* ... */ ],
  aiSuggestions: [ /* ... */ ],
  chartUrls: { radarChart: '', timelineChart: '' },
};

// PDFを生成してS3にアップロード
const { pdfUrl, pdfKey } = await generateAndUploadReport(reportData);

console.log('PDF URL:', pdfUrl);
console.log('PDF Key:', pdfKey);
```

### ローカルでPDF生成

```typescript
import { generateReport } from './generator';
import { writeFileSync } from 'fs';

const pdfBuffer = await generateReport(reportData);
writeFileSync('./output.pdf', pdfBuffer);
```

### 署名付きURLの取得

```typescript
import { getSignedDownloadUrl } from './generator';

const signedUrl = await getSignedDownloadUrl(pdfKey);
// 有効期限: 1時間
```

### AI改善提案の生成

```typescript
import { generateAISuggestions } from './ai-suggestions';

// セッションデータからAI改善提案を生成
const suggestions = await generateAISuggestions(reportData);

// 出力例:
// [
//   '具体的な数字や事例を交えると、より説得力が増します...',
//   '質問に対する回答の構成を「結論→理由→具体例」の順に...',
//   'フィラー語を減らすために、少し間を取ってから...',
//   '重要なポイントを強調する際は、声のトーンやスピード...',
//   '感情表現が豊かなので、さらに自信を持って話すと...'
// ]
```

**AI提案の特徴:**

- **パーソナライズ**: セッションデータ（スコア、感情、音声、会話）を総合的に分析
- **具体的**: 明日から実践できる具体的な行動を提案
- **測定可能**: 可能な限り数値目標を含める
- **ポジティブ**: 建設的で励ます表現
- **自動フォールバック**: AI生成失敗時はスコアベースの提案を使用

## 🎨 チャート生成

### レーダーチャート

```typescript
import { generateRadarChart } from './charts';

const chartBuffer = await generateRadarChart({
  emotion: 80,
  audio: 72,
  content: 78,
  delivery: 70,
});
```

### タイムラインチャート

```typescript
import { generateTimelineChart } from './charts';

const chartBuffer = await generateTimelineChart({
  timestamps: [30, 60, 90, 120],
  emotionScores: [85, 78, 72, 80],
  audioScores: [75, 78, 70, 76],
});
```

## 🧪 テスト

### PDF生成テスト

```bash
# ローカルでPDF生成テスト
cd infrastructure/lambda/report
pnpm exec ts-node test-generate.ts
```

```typescript
import { sampleReportData } from './test-data';
import { generateReport } from './generator';

// サンプルデータでPDF生成
const pdf = await generateReport(sampleReportData);
console.log('PDF size:', pdf.length);
```

### AI改善提案生成テスト

```bash
# AI提案生成テスト（AWS認証情報が必要）
cd infrastructure/lambda/report
pnpm exec ts-node test-ai-suggestions.ts
```

```typescript
import { generateAISuggestions } from './ai-suggestions';
import { sampleReportData } from './test-data';

// AI改善提案を生成
const suggestions = await generateAISuggestions(sampleReportData);
console.log('Suggestions:', suggestions);
```

## 🔧 カスタマイズ

### スタイルの変更

`templates/styles.ts` を編集:

```typescript
export const colors = {
  primary: '#6366f1',  // メインカラー
  secondary: '#10b981', // セカンダリカラー
  // ...
};
```

### 新しいコンポーネントの追加

1. `templates/components/` に新しいコンポーネントを作成
2. `templates/components/index.ts` にエクスポートを追加
3. `default-template.tsx` で使用

### 新しいテンプレートの作成

1. `templates/custom-template.tsx` を作成
2. `generator.ts` で選択できるように修正

```typescript
export async function generateReport(
  data: ReportData,
  options: ReportGenerationOptions = {}
): Promise<Buffer> {
  const template = options.template === 'custom'
    ? <CustomTemplate data={data} />
    : <DefaultReportTemplate data={data} />;

  return await renderToBuffer(template);
}
```

## 📝 環境変数

```bash
AWS_REGION=us-east-1
BEDROCK_REGION=us-east-1
STORAGE_BUCKET_NAME=prance-storage-dev
DATABASE_URL=postgresql://...
```

## 🚀 実装状況

- ✅ Task 2.3.1: React-PDFテンプレート作成（完了）
- ✅ Task 2.3.2: Lambda API統合（完了）
- ✅ Task 2.3.3: AI改善提案生成（完了）
- ⏳ Task 2.3.4: フロントエンドUI実装（次のタスク）

## 📚 依存関係

- `@react-pdf/renderer` - PDF生成
- `chart.js` - チャート生成
- `canvas` - Node.js Canvas API
- `@aws-sdk/client-s3` - S3アップロード
- `@aws-sdk/s3-request-presigner` - 署名付きURL
- `@aws-sdk/client-bedrock-runtime` - AI改善提案生成（Claude Sonnet 4）
- `@prisma/client` - データベースアクセス
