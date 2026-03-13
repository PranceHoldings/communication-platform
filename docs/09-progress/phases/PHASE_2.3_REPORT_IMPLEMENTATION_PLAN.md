# Phase 2.3 実装計画 - レポート生成機能

**作成日:** 2026-03-13
**ステータス:** 実装中
**推定期間:** 1-2週間（7-14日）
**前提条件:** Task 2.1-2.2完了（録画・解析機能実装済み）

---

## 📋 目次

1. [実装概要](#実装概要)
2. [データ構造確認](#データ構造確認)
3. [Task 2.3.1: レポートテンプレート](#task-231-レポートテンプレート)
4. [Task 2.3.2: AI改善提案](#task-232-ai改善提案)
5. [Task 2.3.3: レポート管理UI](#task-233-レポート管理ui)
6. [完了条件](#完了条件)

---

## 実装概要

Phase 2.3では、セッション録画・解析データを基にPDFレポートを生成する機能を実装します。

### 主要機能

1. **PDFレポート生成**
   - React-PDFでテンプレート作成
   - スコア可視化（レーダーチャート、バーチャート）
   - トランスクリプト・改善提案統合

2. **AI改善提案**
   - AWS Bedrock Claude統合
   - スコアベースのパーソナライズド提案
   - 強み・改善点の自動抽出

3. **レポート管理UI**
   - レポート一覧・生成・ダウンロード
   - 共有リンク生成
   - プレビュー機能

---

## データ構造確認

### 既存のPrismaモデル（Task 2.2で実装済み）

#### 1. EmotionAnalysis（表情・感情解析）
```typescript
interface EmotionAnalysis {
  id: string;
  sessionId: string;
  timestamp: number; // セッション開始からの秒数

  // AWS Rekognition結果
  emotions: Array<{ Type: string; Confidence: number }>; // [{ Type: 'HAPPY', Confidence: 95.5 }]
  dominantEmotion: string; // 'HAPPY', 'SAD', 'ANGRY', etc.

  // 顔の詳細
  eyesOpen: boolean;
  mouthOpen: boolean;
  pose: { Pitch: number; Roll: number; Yaw: number };

  // 品質
  confidence: number;
  brightness: number;
  sharpness: number;
}
```

#### 2. AudioAnalysis（音声特徴解析）
```typescript
interface AudioAnalysis {
  id: string;
  sessionId: string;
  timestamp: number;

  // 音声特徴量
  pitch: number; // 平均ピッチ (Hz)
  pitchVariance: number;
  volume: number; // 平均音量 (dB)
  speakingRate: number; // words per minute
  pauseCount: number;
  pauseDuration: number; // 平均ポーズ時間 (秒)

  // 音声品質
  clarity: number; // 0-1
  confidence: number; // STT信頼度

  // フィラー語
  fillerWords: string[]; // ["um", "uh", "ええと"]
  fillerCount: number;
}
```

#### 3. SessionScore（セッションスコア）
```typescript
interface SessionScore {
  id: string;
  sessionId: string;

  // 総合スコア
  overallScore: number; // 0-100

  // カテゴリ別スコア
  emotionScore: number; // 0-100
  audioScore: number; // 0-100
  contentScore: number; // 0-100
  deliveryScore: number; // 0-100

  // 詳細スコア（感情）
  emotionStability: number;
  emotionPositivity: number;
  confidence: number;
  engagement: number;

  // 詳細スコア（音声）
  clarity: number;
  fluency: number;
  pacing: number;
  volume: number;

  // 詳細スコア（コンテンツ）
  relevance: number;
  structure: number;
  completeness: number;

  // 改善ポイント
  strengths: string[]; // ["良好な感情コントロール"]
  improvements: string[]; // ["フィラー語を減らす"]

  // メタデータ
  calculatedAt: Date;
  version: string; // "1.0"
}
```

---

## Task 2.3.1: レポートテンプレート

### 推定期間: 4-5日

### 実装内容

#### Day 1-2: React-PDF基本実装

**実装ファイル:**
- `infrastructure/lambda/report/templates/default-template.tsx`（新規）
- `infrastructure/lambda/report/generator.ts`（新規）
- `infrastructure/lambda/report/types.ts`（新規）
- `infrastructure/lambda/report/charts.ts`（新規）

**技術スタック:**
- `@react-pdf/renderer` - PDF生成
- `recharts` → Canvas変換 - チャート生成
- `canvas` - Node.js Canvas API（Lambda Layer）

**PDFテンプレート構成:**

```typescript
// default-template.tsx
import { Document, Page, Text, View, Image } from '@react-pdf/renderer';

interface ReportData {
  session: {
    id: string;
    startedAt: Date;
    endedAt: Date;
    duration: number;
    user: { name: string };
    scenario: { title: string };
  };
  score: SessionScore;
  emotionAnalysis: EmotionAnalysis[];
  audioAnalysis: AudioAnalysis[];
  transcript: Transcript[];
  improvements: string[]; // AI生成
}

export function DefaultReportTemplate({ data }: { data: ReportData }) {
  return (
    <Document>
      {/* Page 1: Summary */}
      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <Text style={styles.title}>セッションレポート</Text>
          <Text style={styles.subtitle}>{data.session.scenario.title}</Text>

          {/* Overall Score Circle */}
          <View style={styles.scoreCircle}>
            <Text style={styles.scoreValue}>{data.score.overallScore}</Text>
            <Text style={styles.scoreLabel}>総合スコア</Text>
          </View>

          {/* Session Info */}
          <View style={styles.infoGrid}>
            <Text>日時: {formatDate(data.session.startedAt)}</Text>
            <Text>所要時間: {formatDuration(data.session.duration)}</Text>
            <Text>ユーザー: {data.session.user.name}</Text>
          </View>
        </View>
      </Page>

      {/* Page 2: Score Details */}
      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>スコア詳細</Text>

          {/* Radar Chart (as image) */}
          <Image src={data.radarChartUrl} style={styles.chart} />

          {/* Category Scores */}
          <View style={styles.scoreGrid}>
            <ScoreBar label="感情" score={data.score.emotionScore} />
            <ScoreBar label="音声" score={data.score.audioScore} />
            <ScoreBar label="内容" score={data.score.contentScore} />
            <ScoreBar label="表現" score={data.score.deliveryScore} />
          </View>
        </View>
      </Page>

      {/* Page 3: Strengths & Improvements */}
      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>強みと改善点</Text>

          <View style={styles.strengthsSection}>
            <Text style={styles.subsectionTitle}>強み</Text>
            {data.score.strengths.map((strength, i) => (
              <Text key={i} style={styles.bulletPoint}>
                ✓ {strength}
              </Text>
            ))}
          </View>

          <View style={styles.improvementsSection}>
            <Text style={styles.subsectionTitle}>改善提案（AI生成）</Text>
            {data.improvements.map((improvement, i) => (
              <Text key={i} style={styles.bulletPoint}>
                → {improvement}
              </Text>
            ))}
          </View>
        </View>
      </Page>

      {/* Page 4: Transcript */}
      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>会話ログ</Text>
          {data.transcript.map((line, i) => (
            <View key={i} style={styles.transcriptLine}>
              <Text style={styles.timestamp}>{formatTimestamp(line.timestamp)}</Text>
              <Text style={styles.speaker}>{line.speaker === 'USER' ? 'あなた' : 'AI'}</Text>
              <Text style={styles.text}>{line.text}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}
```

**チャート生成（Canvas → PNG）:**

```typescript
// charts.ts
import { createCanvas } from 'canvas';
import { Chart } from 'chart.js/auto';

export async function generateRadarChart(scores: {
  emotion: number;
  audio: number;
  content: number;
  delivery: number;
}): Promise<Buffer> {
  const canvas = createCanvas(400, 400);
  const ctx = canvas.getContext('2d');

  new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['感情', '音声', '内容', '表現'],
      datasets: [{
        label: 'スコア',
        data: [scores.emotion, scores.audio, scores.content, scores.delivery],
        backgroundColor: 'rgba(99, 102, 241, 0.2)',
        borderColor: 'rgb(99, 102, 241)',
      }],
    },
    options: {
      scales: {
        r: {
          beginAtZero: true,
          max: 100,
        },
      },
    },
  });

  return canvas.toBuffer('image/png');
}
```

**PDF生成Lambda関数:**

```typescript
// generator.ts
import { renderToBuffer } from '@react-pdf/renderer';
import { DefaultReportTemplate } from './templates/default-template';
import { generateRadarChart } from './charts';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export async function generateReport(sessionId: string): Promise<string> {
  // 1. Fetch data from database
  const data = await fetchReportData(sessionId);

  // 2. Generate charts
  const radarChartBuffer = await generateRadarChart({
    emotion: data.score.emotionScore,
    audio: data.score.audioScore,
    content: data.score.contentScore,
    delivery: data.score.deliveryScore,
  });

  // 3. Upload chart to S3
  const chartUrl = await uploadChartToS3(radarChartBuffer, sessionId);

  // 4. Generate PDF
  const pdfBuffer = await renderToBuffer(
    <DefaultReportTemplate data={{ ...data, radarChartUrl: chartUrl }} />
  );

  // 5. Upload PDF to S3
  const pdfUrl = await uploadPdfToS3(pdfBuffer, sessionId);

  // 6. Save report metadata to database
  await saveReportMetadata(sessionId, pdfUrl);

  return pdfUrl;
}
```

#### Day 3: Lambda CDK統合

**実装ファイル:**
- `infrastructure/lib/report-lambda-stack.ts`（新規）
- `infrastructure/lambda/report/generate/index.ts`（新規）

**CDK Stack:**

```typescript
// report-lambda-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';

export class ReportLambdaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ReportLambdaStackProps) {
    super(scope, id, props);

    // Canvas Lambda Layer (for chart generation)
    const canvasLayer = new lambda.LayerVersion(this, 'CanvasLayer', {
      code: lambda.Code.fromAsset('layers/canvas'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_22_X],
      description: 'Canvas library for chart generation',
    });

    // Report Generator Lambda
    const reportGeneratorFn = new nodejs.NodejsFunction(this, 'ReportGenerator', {
      entry: 'lambda/report/generate/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 2048, // High memory for PDF generation
      timeout: cdk.Duration.seconds(300), // 5 minutes
      layers: [canvasLayer],
      environment: {
        BUCKET_NAME: props.storageBucket.bucketName,
        DATABASE_URL: props.databaseSecret.secretValueFromJson('connectionString').unsafeUnwrap(),
      },
    });

    // Grant S3 permissions
    props.storageBucket.grantReadWrite(reportGeneratorFn);
  }
}
```

#### Day 4-5: API統合・テスト

**実装ファイル:**
- `infrastructure/lambda/report/generate/index.ts`（API handler）
- `apps/web/lib/api/reports.ts`（フロントエンドAPIクライアント）

**API Endpoint:**
- `POST /api/v1/sessions/{sessionId}/report` - レポート生成トリガー
- `GET /api/v1/sessions/{sessionId}/report` - レポート取得

**完了条件:**
- ✅ PDF生成成功（全ページ表示）
- ✅ チャート画像生成成功
- ✅ S3保存成功
- ✅ API経由でレポート生成可能

---

## Task 2.3.2: AI改善提案

### 推定期間: 2-3日

### 実装内容

#### Day 1-2: AWS Bedrock統合

**実装ファイル:**
- `infrastructure/lambda/shared/ai/improvement-suggestions.ts`（新規）
- `infrastructure/lambda/report/ai-analyzer.ts`（新規）

**AI改善提案生成:**

```typescript
// improvement-suggestions.ts
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

interface ImprovementSuggestionInput {
  score: SessionScore;
  emotionAnalysis: EmotionAnalysis[];
  audioAnalysis: AudioAnalysis[];
  transcript: Transcript[];
}

export async function generateImprovementSuggestions(
  input: ImprovementSuggestionInput
): Promise<string[]> {
  const prompt = buildPrompt(input);

  const client = new BedrockRuntimeClient({ region: 'us-east-1' });
  const response = await client.send(
    new InvokeModelCommand({
      modelId: 'us.anthropic.claude-sonnet-4-0:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    })
  );

  const result = JSON.parse(new TextDecoder().decode(response.body));
  return parseImprovements(result.content[0].text);
}

function buildPrompt(input: ImprovementSuggestionInput): string {
  return `
あなたは面接コーチです。以下のセッション分析結果に基づいて、具体的な改善提案を3-5個生成してください。

# セッション情報
- シナリオ: 面接練習
- 総合スコア: ${input.score.overallScore}/100

# カテゴリ別スコア
- 感情: ${input.score.emotionScore}/100
- 音声: ${input.score.audioScore}/100
- 内容: ${input.score.contentScore}/100
- 表現: ${input.score.deliveryScore}/100

# 詳細分析
## 感情
- 安定性: ${input.score.emotionStability}/100
- ポジティブさ: ${input.score.emotionPositivity}/100
- 自信: ${input.score.confidence}/100

## 音声
- 明瞭さ: ${input.score.clarity}/100
- 流暢さ: ${input.score.fluency}/100
- ペース: ${input.score.pacing}/100
- フィラー語回数: ${input.audioAnalysis.reduce((sum, a) => sum + (a.fillerCount || 0), 0)}回

# 改善提案の要件
1. 具体的で実行可能な提案にしてください
2. スコアが低いカテゴリに焦点を当ててください
3. ポジティブな言い回しを使用してください
4. 各提案は1-2文で簡潔にまとめてください

# 出力形式
- 提案1
- 提案2
- 提案3
（必要に応じて4-5個）
`;
}

function parseImprovements(text: string): string[] {
  return text
    .split('\n')
    .filter(line => line.trim().startsWith('-'))
    .map(line => line.trim().replace(/^-\s*/, ''))
    .filter(line => line.length > 0);
}
```

#### Day 3: 統合・テスト

**統合ポイント:**
- レポート生成時にAI提案を自動生成
- SessionScoreに改善提案を保存
- PDFレポートに埋め込み

**完了条件:**
- ✅ AI提案生成成功（3-5個の提案）
- ✅ プロンプト最適化完了
- ✅ レポートに統合成功

---

## Task 2.3.3: レポート管理UI

### 推定期間: 2-3日

### 実装内容

#### Day 1-2: レポート一覧・詳細ページ

**実装ファイル:**
- `apps/web/app/dashboard/reports/page.tsx`（新規）
- `apps/web/app/dashboard/reports/[id]/page.tsx`（新規）
- `apps/web/components/report-viewer.tsx`（新規）
- `apps/web/lib/api/reports.ts`（新規）

**レポート一覧ページ:**

```typescript
// apps/web/app/dashboard/reports/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { listReports, generateReport } from '@/lib/api/reports';
import Link from 'next/link';

export default function ReportsPage() {
  const { t } = useI18n();
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    const data = await listReports();
    setReports(data.reports);
    setIsLoading(false);
  };

  const handleGenerateReport = async (sessionId: string) => {
    await generateReport(sessionId);
    await loadReports();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('reports.list.title')}</h1>

      {/* Reports Table */}
      <table className="min-w-full divide-y divide-gray-200">
        <thead>
          <tr>
            <th>{t('reports.list.session')}</th>
            <th>{t('reports.list.score')}</th>
            <th>{t('reports.list.date')}</th>
            <th>{t('reports.list.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {reports.map(report => (
            <tr key={report.id}>
              <td>{report.session.scenario.title}</td>
              <td>{report.score.overallScore}/100</td>
              <td>{formatDate(report.generatedAt)}</td>
              <td>
                <Link href={`/dashboard/reports/${report.id}`}>
                  {t('common.view')}
                </Link>
                <a href={report.pdfUrl} download>
                  {t('reports.actions.download')}
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**レポート詳細ページ:**

```typescript
// apps/web/app/dashboard/reports/[id]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getReport } from '@/lib/api/reports';
import { ReportViewer } from '@/components/report-viewer';

export default function ReportDetailPage() {
  const params = useParams();
  const [report, setReport] = useState(null);

  useEffect(() => {
    loadReport();
  }, [params.id]);

  const loadReport = async () => {
    const data = await getReport(params.id as string);
    setReport(data);
  };

  if (!report) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <ReportViewer report={report} />
    </div>
  );
}
```

#### Day 3: 共有機能・ダウンロード

**実装内容:**
- 共有リンク生成（CloudFront署名付きURL）
- ダウンロードボタン
- PDFプレビュー（iframe or PDF.js）

**完了条件:**
- ✅ レポート一覧表示成功
- ✅ ダウンロード機能動作
- ✅ 共有リンク生成成功
- ✅ プレビュー機能動作

---

## 完了条件

### Phase 2.3全体

- ✅ PDFレポート生成成功
- ✅ チャート表示成功
- ✅ AI改善提案生成成功
- ✅ レポート一覧・詳細UI実装
- ✅ ダウンロード・共有機能動作
- ✅ E2Eテスト作成・合格

### 技術要件

- ✅ React-PDF統合完了
- ✅ Canvas Layer作成完了
- ✅ AWS Bedrock統合完了
- ✅ S3署名付きURL生成完了
- ✅ Lambda関数デプロイ完了

### 品質要件

- ✅ PDFレイアウト美しい
- ✅ AI提案が有用
- ✅ ページロード高速（<3秒）
- ✅ エラーハンドリング完全

---

## 次のステップ

Phase 2.3完了後：
1. Phase 3（本番環境対応）
2. Phase 4（追加機能）
3. Phase 1.5-1.6（実用化対応）

---

**作成日:** 2026-03-13 20:30 JST
**次回レビュー:** Day 3（チャート生成完了時）
