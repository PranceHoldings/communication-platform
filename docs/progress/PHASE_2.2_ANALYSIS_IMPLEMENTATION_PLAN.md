# Phase 2.2 解析機能実装計画

**作成日:** 2026-03-09
**ステータス:** 実装中
**推定期間:** 1-2週間
**前提条件:** Phase 2.1（録画機能）完了

---

## 📋 目次

1. [実装状況サマリー](#実装状況サマリー)
2. [実装計画](#実装計画)
3. [タスク詳細](#タスク詳細)
4. [完了条件](#完了条件)

---

## 実装状況サマリー

### ✅ 完了済み（基盤コンポーネント）

#### データベーススキーマ
- `packages/database/prisma/schema.prisma`
  - ✅ `EmotionAnalysis` モデル定義
  - ✅ `AudioAnalysis` モデル定義
  - ✅ `SessionScore` モデル定義

#### マイグレーションファイル
- `infrastructure/lambda/migrations/`
  - ✅ `add-emotion-analysis.sql` - emotion_analysesテーブル作成
  - ✅ `add-audio-analysis.sql` - audio_analysesテーブル作成
  - ✅ `add-session-score.sql` - session_scoresテーブル作成

#### コア解析ライブラリ
- `infrastructure/lambda/shared/analysis/`
  - ✅ `rekognition.ts` (391行) - AWS Rekognition完全統合
    - `RekognitionAnalyzer` クラス
    - `analyzeFrame()` - Buffer/S3から顔検出・感情解析
    - `getEmotionSummary()` - 統計計算
  - ✅ `score-calculator.ts` (549行) - スコア計算完全実装
    - `ScoreCalculator` クラス
    - `calculateScore()` - 総合スコア計算
    - `calculateEmotionScore()` - 感情スコア
    - `calculateAudioScore()` - 音声スコア
    - `calculateContentScore()` - コンテンツスコア
    - `SCORING_PRESETS` - 5つのプリセット

#### フレーム解析
- `infrastructure/lambda/websocket/default/`
  - ✅ `frame-analyzer.ts` (328行) - フレーム抽出・解析完全実装
    - `FrameAnalyzer` クラス
    - `analyzeVideo()` - 動画からフレーム抽出→Rekognition解析
    - `extractFrames()` - ffmpegでフレーム抽出
    - `getVideoDuration()` - 動画時間取得

### ⏸️ 未完了（統合・UI）

#### Step 1: データベースマイグレーション
- [ ] Prisma Client再生成
- [ ] マイグレーション実行（3テーブル作成）
- [ ] Lambda関数デプロイ

#### Step 2: 音声解析実装
- [ ] フロントエンド: Web Audio API統合
- [ ] バックエンド: 音声特徴抽出ロジック

#### Step 3: セッション終了時の自動解析トリガー
- [ ] WebSocketハンドラー拡張（session_end時）
- [ ] 非同期解析処理（Step Functions検討）

#### Step 4: API実装
- [ ] GET /sessions/:id/analysis - 解析結果取得
- [ ] POST /sessions/:id/analyze - 手動解析トリガー
- [ ] GET /sessions/:id/score - スコア取得

#### Step 5: フロントエンドUI
- [ ] 解析結果ダッシュボード
- [ ] 感情タイムライン表示
- [ ] 音声特徴グラフ
- [ ] スコアカード

---

## 実装計画

### 全体フロー

```
セッション終了
  ↓
WebSocket: session_end
  ↓
Lambda: セッション終了処理
  ↓
┌─────────────────────────────────────────────┐
│ Step 1: 録画ファイルのS3確認                 │
│ - s3Key確認                                  │
│ - 録画状態確認（COMPLETED）                  │
└─────────────────┬───────────────────────────┘
                  ↓
┌─────────────────────────────────────────────┐
│ Step 2: 表情・感情解析（FrameAnalyzer）      │
│ - フレーム抽出（1秒ごと）                     │
│ - AWS Rekognition解析                        │
│ - DynamoDB: emotion_analyses保存             │
└─────────────────┬───────────────────────────┘
                  ↓
┌─────────────────────────────────────────────┐
│ Step 3: 音声特徴解析（AudioAnalyzer）        │
│ - トランスクリプト取得                        │
│ - 音高・速度・フィラー語解析                   │
│ - DynamoDB: audio_analyses保存               │
└─────────────────┬───────────────────────────┘
                  ↓
┌─────────────────────────────────────────────┐
│ Step 4: スコア計算（ScoreCalculator）        │
│ - 感情・音声データ集約                        │
│ - 総合スコア計算                              │
│ - DynamoDB: session_scores保存               │
└─────────────────┬───────────────────────────┘
                  ↓
┌─────────────────────────────────────────────┐
│ Step 5: セッションステータス更新             │
│ - status: ACTIVE → COMPLETED                 │
│ - metadataJson: 解析完了フラグ追加           │
└─────────────────────────────────────────────┘
```

---

## タスク詳細

### Task 2.2.1: データベースマイグレーション実行（1時間）

#### 実行手順

```bash
# Step 1: Prisma Client再生成
cd /workspaces/prance-communication-platform/packages/database
npx prisma generate

# Step 2: Lambda関数デプロイ（マイグレーション適用）
cd ../../infrastructure
npm run cdk -- deploy Prance-dev-ApiLambda --require-approval never

# Step 3: データベースマイグレーション実行
aws lambda invoke --function-name prance-db-migration-dev \
  --payload '{}' /tmp/migration-result.json
cat /tmp/migration-result.json

# Step 4: マイグレーション成功確認
psql $DATABASE_URL -c "\d emotion_analyses"
psql $DATABASE_URL -c "\d audio_analyses"
psql $DATABASE_URL -c "\d session_scores"
```

#### 完了条件
- ✅ 3つのテーブルがデータベースに作成されている
- ✅ 外部キー制約が正しく設定されている
- ✅ インデックスが作成されている
- ✅ Prisma Clientで型定義が利用可能

---

### Task 2.2.2: 音声解析実装（3-4日）

#### 2.2.2-A: バックエンド音声解析ロジック（2日）

**新規ファイル:**
- `infrastructure/lambda/shared/analysis/audio-analyzer.ts`

**実装内容:**

```typescript
export interface AudioFeatures {
  pitch: number; // Hz
  pitchVariance: number;
  volume: number; // dB
  volumeVariance: number;
  speakingRate: number; // WPM
  pauseCount: number;
  pauseDuration: number; // seconds
  clarity: number; // 0-1
  confidence: number; // STT confidence
  fillerWords: string[];
  fillerCount: number;
}

export class AudioAnalyzer {
  /**
   * Analyze audio features from transcript and audio data
   */
  async analyzeAudio(
    sessionId: string,
    transcripts: Transcript[]
  ): Promise<AudioAnalysis[]> {
    const analyses: AudioAnalysis[] = [];

    for (const transcript of transcripts) {
      // Calculate features for each transcript segment
      const features = this.extractFeatures(transcript);

      analyses.push({
        id: crypto.randomUUID(),
        sessionId,
        transcriptId: transcript.id,
        timestamp: transcript.timestampStart,
        ...features,
        createdAt: new Date(),
      });
    }

    return analyses;
  }

  /**
   * Extract audio features from transcript
   */
  private extractFeatures(transcript: Transcript): AudioFeatures {
    // Speaking rate (WPM)
    const duration = transcript.timestampEnd - transcript.timestampStart;
    const wordCount = transcript.text.split(/\s+/).length;
    const speakingRate = (wordCount / duration) * 60;

    // Filler words detection
    const fillerWords = this.detectFillerWords(transcript.text);

    // Calculate pause duration (estimated from transcript)
    const pauseDuration = this.estimatePauseDuration(transcript);

    return {
      pitch: 0, // Placeholder - would need audio signal
      pitchVariance: 0,
      volume: 0, // Placeholder
      volumeVariance: 0,
      speakingRate,
      pauseCount: 0,
      pauseDuration,
      clarity: transcript.confidence || 0.8,
      confidence: transcript.confidence || 0.8,
      fillerWords,
      fillerCount: fillerWords.length,
    };
  }

  /**
   * Detect filler words in text
   */
  private detectFillerWords(text: string): string[] {
    const fillerPatterns = [
      // English
      /\b(um|uh|like|you know|sort of|kind of|i mean|actually|basically)\b/gi,
      // Japanese
      /\b(えー|あー|その|なんか|まあ)\b/gi,
    ];

    const fillers: string[] = [];
    fillerPatterns.forEach((pattern) => {
      const matches = text.match(pattern);
      if (matches) {
        fillers.push(...matches);
      }
    });

    return fillers;
  }

  private estimatePauseDuration(transcript: Transcript): number {
    // Simple heuristic: longer gaps between words suggest longer pauses
    const words = transcript.text.split(/\s+/);
    const duration = transcript.timestampEnd - transcript.timestampStart;
    const avgPause = duration / Math.max(words.length, 1);
    return avgPause;
  }
}
```

**テストケース:**

```typescript
// test/audio-analyzer.test.ts
describe('AudioAnalyzer', () => {
  it('should detect English filler words', () => {
    const analyzer = new AudioAnalyzer();
    const transcript = {
      text: 'Um, I think, like, you know, it is good',
      timestampStart: 0,
      timestampEnd: 5,
      confidence: 0.9,
    };
    const features = analyzer['extractFeatures'](transcript);
    expect(features.fillerCount).toBeGreaterThan(0);
  });

  it('should calculate speaking rate', () => {
    const analyzer = new AudioAnalyzer();
    const transcript = {
      text: 'This is a test sentence with ten words here',
      timestampStart: 0,
      timestampEnd: 3, // 3 seconds
      confidence: 0.9,
    };
    const features = analyzer['extractFeatures'](transcript);
    // 10 words / 3 seconds * 60 = 200 WPM
    expect(features.speakingRate).toBeCloseTo(200, 0);
  });
});
```

#### 2.2.2-B: フロントエンド音声解析（1-2日）

**新規ファイル:**
- `apps/web/lib/audio-analysis.ts`
- `apps/web/hooks/useAudioAnalysis.ts`

**実装内容:**

```typescript
// apps/web/lib/audio-analysis.ts
export class ClientAudioAnalyzer {
  private audioContext: AudioContext;
  private analyser: AnalyserNode;

  constructor() {
    this.audioContext = new AudioContext();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
  }

  /**
   * Analyze pitch using autocorrelation
   */
  analyzePitch(audioBuffer: AudioBuffer): number {
    const data = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;

    return this.autoCorrelate(data, sampleRate);
  }

  /**
   * Autocorrelation algorithm for pitch detection
   */
  private autoCorrelate(buffer: Float32Array, sampleRate: number): number {
    const SIZE = buffer.length;
    const MAX_SAMPLES = Math.floor(SIZE / 2);
    let bestOffset = -1;
    let bestCorrelation = 0;
    let rms = 0;

    // Calculate RMS
    for (let i = 0; i < SIZE; i++) {
      const val = buffer[i];
      rms += val * val;
    }
    rms = Math.sqrt(rms / SIZE);

    // Not enough signal
    if (rms < 0.01) return -1;

    // Find correlation
    let lastCorrelation = 1;
    for (let offset = 1; offset < MAX_SAMPLES; offset++) {
      let correlation = 0;

      for (let i = 0; i < MAX_SAMPLES; i++) {
        correlation += Math.abs(buffer[i] - buffer[i + offset]);
      }

      correlation = 1 - correlation / MAX_SAMPLES;

      if (correlation > 0.9 && correlation > lastCorrelation) {
        const foundGoodCorrelation =
          correlation > bestCorrelation && correlation > 0.95;
        if (foundGoodCorrelation) {
          bestCorrelation = correlation;
          bestOffset = offset;
        }
      }

      lastCorrelation = correlation;
    }

    if (bestOffset === -1) return -1;

    const fundamentalFreq = sampleRate / bestOffset;
    return fundamentalFreq;
  }
}
```

---

### Task 2.2.3: 統合処理実装（2-3日）

#### 新規ファイル
- `infrastructure/lambda/websocket/default/analysis-orchestrator.ts`

**実装内容:**

```typescript
export class AnalysisOrchestrator {
  private frameAnalyzer: FrameAnalyzer;
  private audioAnalyzer: AudioAnalyzer;
  private scoreCalculator: ScoreCalculator;
  private prisma: PrismaClient;

  constructor(config: {
    s3Client: S3Client;
    bucket: string;
    region: string;
  }) {
    this.frameAnalyzer = new FrameAnalyzer({
      s3Client: config.s3Client,
      bucket: config.bucket,
      region: config.region,
    });
    this.audioAnalyzer = new AudioAnalyzer();
    this.scoreCalculator = new ScoreCalculator();
    this.prisma = new PrismaClient();
  }

  /**
   * Orchestrate full analysis pipeline
   */
  async analyzeSession(sessionId: string): Promise<void> {
    console.log('[AnalysisOrchestrator] Starting analysis', { sessionId });

    try {
      // Step 1: Get session and recording info
      const session = await this.prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          recordings: true,
          transcripts: true,
        },
      });

      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      const combinedRecording = session.recordings.find(
        (r) => r.type === 'COMBINED' && r.processingStatus === 'COMPLETED'
      );

      if (!combinedRecording) {
        throw new Error('No completed combined recording found');
      }

      // Step 2: Emotion analysis (frame extraction + Rekognition)
      console.log('[AnalysisOrchestrator] Step 2: Emotion analysis');
      const videoAnalysisResult = await this.frameAnalyzer.analyzeVideo(
        sessionId,
        combinedRecording.s3Key,
        { interval: 1, maxFrames: 60 } // Max 60 frames (1 min)
      );

      // Save emotion analyses
      const emotionAnalyses = await Promise.all(
        videoAnalysisResult.frames.map((frame) =>
          this.prisma.emotionAnalysis.create({
            data: {
              sessionId,
              recordingId: combinedRecording.id,
              timestamp: frame.timestamp,
              frameUrl: frame.frameUrl,
              emotions: frame.analysis.emotions,
              dominantEmotion: frame.analysis.dominantEmotion,
              ageRange: frame.analysis.ageRange,
              gender: frame.analysis.gender,
              genderConfidence: frame.analysis.genderConfidence,
              eyesOpen: frame.analysis.eyesOpen,
              eyesOpenConfidence: frame.analysis.eyesOpenConfidence,
              mouthOpen: frame.analysis.mouthOpen,
              mouthOpenConfidence: frame.analysis.mouthOpenConfidence,
              pose: frame.analysis.pose,
              confidence: frame.analysis.confidence,
              brightness: frame.analysis.quality?.brightness,
              sharpness: frame.analysis.quality?.sharpness,
              processingTimeMs: frame.processingTimeMs,
            },
          })
        )
      );

      console.log('[AnalysisOrchestrator] Emotion analyses saved', {
        count: emotionAnalyses.length,
      });

      // Step 3: Audio analysis
      console.log('[AnalysisOrchestrator] Step 3: Audio analysis');
      const audioAnalyses = await this.audioAnalyzer.analyzeAudio(
        sessionId,
        session.transcripts
      );

      // Save audio analyses
      await Promise.all(
        audioAnalyses.map((analysis) =>
          this.prisma.audioAnalysis.create({ data: analysis })
        )
      );

      console.log('[AnalysisOrchestrator] Audio analyses saved', {
        count: audioAnalyses.length,
      });

      // Step 4: Score calculation
      console.log('[AnalysisOrchestrator] Step 4: Score calculation');
      const scoreResult = this.scoreCalculator.calculateScore(
        emotionAnalyses,
        audioAnalyses,
        { preset: 'default' }
      );

      // Save session score
      await this.prisma.sessionScore.create({
        data: {
          sessionId,
          overallScore: scoreResult.overallScore,
          emotionScore: scoreResult.emotionScore,
          audioScore: scoreResult.audioScore,
          contentScore: scoreResult.contentScore,
          deliveryScore: scoreResult.deliveryScore,
          emotionStability: scoreResult.emotionDetails.stability,
          emotionPositivity: scoreResult.emotionDetails.positivity,
          confidence: scoreResult.emotionDetails.confidence,
          engagement: scoreResult.emotionDetails.engagement,
          clarity: scoreResult.audioDetails.clarity,
          fluency: scoreResult.audioDetails.fluency,
          pacing: scoreResult.audioDetails.pacing,
          volume: scoreResult.audioDetails.volume,
          relevance: scoreResult.contentDetails.relevance,
          structure: scoreResult.contentDetails.structure,
          completeness: scoreResult.contentDetails.completeness,
          strengths: scoreResult.strengths,
          improvements: scoreResult.improvements,
          version: '1.0',
        },
      });

      console.log('[AnalysisOrchestrator] Session score saved', {
        overallScore: scoreResult.overallScore,
      });

      // Step 5: Update session status
      await this.prisma.session.update({
        where: { id: sessionId },
        data: {
          status: 'COMPLETED',
          metadataJson: {
            ...(session.metadataJson as object),
            analysisCompleted: true,
            analysisCompletedAt: new Date().toISOString(),
          },
        },
      });

      console.log('[AnalysisOrchestrator] Analysis completed successfully');
    } catch (error) {
      console.error('[AnalysisOrchestrator] Analysis failed:', error);

      // Update session with error status
      await this.prisma.session.update({
        where: { id: sessionId },
        data: {
          status: 'ERROR',
          metadataJson: {
            analysisError: error instanceof Error ? error.message : 'Unknown error',
            analysisErrorAt: new Date().toISOString(),
          },
        },
      });

      throw error;
    }
  }
}
```

#### WebSocketハンドラー統合

**ファイル:** `infrastructure/lambda/websocket/default/index.ts`

**変更内容:**

```typescript
// session_end ハンドラーに追加
case 'session_end':
  // ... 既存の処理 ...

  // 🆕 解析処理をトリガー（非同期）
  if (process.env.ENABLE_AUTO_ANALYSIS === 'true') {
    console.log('[WebSocket] Triggering automatic analysis', { sessionId });

    // オプション1: Lambda非同期呼び出し
    const lambda = new LambdaClient({ region: process.env.AWS_REGION });
    await lambda.send(
      new InvokeCommand({
        FunctionName: 'prance-session-analysis-dev',
        InvocationType: 'Event', // 非同期
        Payload: JSON.stringify({ sessionId }),
      })
    );

    // オプション2: Step Functions実行（推奨 - タイムアウト対策）
    // const sfn = new SFNClient({ region: process.env.AWS_REGION });
    // await sfn.send(
    //   new StartExecutionCommand({
    //     stateMachineArn: process.env.ANALYSIS_STATE_MACHINE_ARN,
    //     input: JSON.stringify({ sessionId }),
    //   })
    // );
  }
  break;
```

---

### Task 2.2.4: API実装（1-2日）

#### 新規Lambda関数

**ファイル:** `infrastructure/lambda/sessions/analysis/get.ts`

```typescript
/**
 * GET /sessions/:id/analysis
 * セッションの解析結果を取得
 */
export const handler = async (event: APIGatewayProxyEvent) => {
  const sessionId = event.pathParameters?.id;

  if (!sessionId) {
    return createErrorResponse(400, 'Session ID is required');
  }

  try {
    const prisma = new PrismaClient();

    // Get all analysis data
    const [emotionAnalyses, audioAnalyses, sessionScore] = await Promise.all([
      prisma.emotionAnalysis.findMany({
        where: { sessionId },
        orderBy: { timestamp: 'asc' },
      }),
      prisma.audioAnalysis.findMany({
        where: { sessionId },
        orderBy: { timestamp: 'asc' },
      }),
      prisma.sessionScore.findUnique({
        where: { sessionId },
      }),
    ]);

    return {
      statusCode: 200,
      body: JSON.stringify({
        sessionId,
        emotionAnalyses,
        audioAnalyses,
        sessionScore,
      }),
    };
  } catch (error) {
    console.error('Error fetching analysis:', error);
    return createErrorResponse(500, 'Failed to fetch analysis');
  }
};
```

**ファイル:** `infrastructure/lambda/sessions/analysis/trigger.ts`

```typescript
/**
 * POST /sessions/:id/analyze
 * セッションの解析を手動でトリガー
 */
export const handler = async (event: APIGatewayProxyEvent) => {
  const sessionId = event.pathParameters?.id;

  if (!sessionId) {
    return createErrorResponse(400, 'Session ID is required');
  }

  try {
    // Trigger analysis Lambda
    const lambda = new LambdaClient({ region: process.env.AWS_REGION });
    await lambda.send(
      new InvokeCommand({
        FunctionName: 'prance-session-analysis-dev',
        InvocationType: 'Event',
        Payload: JSON.stringify({ sessionId }),
      })
    );

    return {
      statusCode: 202,
      body: JSON.stringify({
        message: 'Analysis triggered',
        sessionId,
      }),
    };
  } catch (error) {
    console.error('Error triggering analysis:', error);
    return createErrorResponse(500, 'Failed to trigger analysis');
  }
};
```

#### CDK Stack更新

`infrastructure/lib/api-lambda-stack.ts` に追加:

```typescript
// Analysis Lambda
const sessionAnalysisLambda = new lambda.Function(this, 'SessionAnalysis', {
  functionName: `prance-session-analysis-${stage}`,
  runtime: lambda.Runtime.NODEJS_22_X,
  architecture: lambda.Architecture.ARM_64,
  handler: 'index.handler',
  code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/sessions/analysis')),
  memorySize: 3008, // High memory for video processing
  timeout: Duration.minutes(5),
  environment: {
    DATABASE_URL: dbSecret.secretValueFromJson('DATABASE_URL').unsafeUnwrap(),
    S3_BUCKET: storageStack.bucket.bucketName,
    AWS_REGION: this.region,
  },
  layers: [sharedLayer],
});

// Grant S3 access
storageStack.bucket.grantRead(sessionAnalysisLambda);

// API Routes
sessionsResource.addMethod('GET', new apigw.LambdaIntegration(getAnalysisLambda));
sessionsResource.addMethod('POST', new apigw.LambdaIntegration(triggerAnalysisLambda));
```

---

### Task 2.2.5: フロントエンドUI実装（2-3日）

#### 新規コンポーネント

**ファイル:** `apps/web/components/analysis/score-dashboard.tsx`

```typescript
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadarChart } from '@/components/charts/radar-chart';
import { LineChart } from '@/components/charts/line-chart';

interface ScoreDashboardProps {
  sessionScore: SessionScore;
  emotionAnalyses: EmotionAnalysis[];
  audioAnalyses: AudioAnalysis[];
}

export function ScoreDashboard({
  sessionScore,
  emotionAnalyses,
  audioAnalyses,
}: ScoreDashboardProps) {
  // Radar chart data
  const radarData = {
    labels: ['Emotion', 'Audio', 'Content', 'Delivery'],
    datasets: [
      {
        label: 'Score',
        data: [
          sessionScore.emotionScore,
          sessionScore.audioScore,
          sessionScore.contentScore,
          sessionScore.deliveryScore,
        ],
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderColor: 'rgb(59, 130, 246)',
      },
    ],
  };

  // Emotion timeline data
  const emotionTimelineData = emotionAnalyses.map((analysis) => ({
    timestamp: analysis.timestamp,
    emotion: analysis.dominantEmotion,
    confidence: analysis.confidence,
  }));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Overall Score */}
      <Card>
        <CardHeader>
          <CardTitle>Overall Score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-6xl font-bold text-center">
            {sessionScore.overallScore}
          </div>
          <div className="text-center text-muted-foreground">out of 100</div>
        </CardContent>
      </Card>

      {/* Category Scores */}
      <Card>
        <CardHeader>
          <CardTitle>Category Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <RadarChart data={radarData} />
        </CardContent>
      </Card>

      {/* Emotion Timeline */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Emotion Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <LineChart data={emotionTimelineData} />
        </CardContent>
      </Card>

      {/* Strengths */}
      <Card>
        <CardHeader>
          <CardTitle>Strengths</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-2">
            {sessionScore.strengths.map((strength, i) => (
              <li key={i}>{strength}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Improvements */}
      <Card>
        <CardHeader>
          <CardTitle>Areas for Improvement</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-2">
            {sessionScore.improvements.map((improvement, i) => (
              <li key={i}>{improvement}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
```

**ファイル:** `apps/web/app/dashboard/sessions/[id]/analysis/page.tsx`

```typescript
import { ScoreDashboard } from '@/components/analysis/score-dashboard';

export default async function SessionAnalysisPage({
  params,
}: {
  params: { id: string };
}) {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/sessions/${params.id}/analysis`,
    {
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    return <div>Analysis not available</div>;
  }

  const { sessionScore, emotionAnalyses, audioAnalyses } = await response.json();

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Session Analysis</h1>
      <ScoreDashboard
        sessionScore={sessionScore}
        emotionAnalyses={emotionAnalyses}
        audioAnalyses={audioAnalyses}
      />
    </div>
  );
}
```

---

## 完了条件

### Task 2.2.1: データベースマイグレーション
- [x] 3つのテーブルがデータベースに作成されている
- [x] Prisma Clientで型定義が利用可能
- [x] Lambda関数がデプロイされている

### Task 2.2.2: 音声解析
- [ ] AudioAnalyzer実装完了
- [ ] フィラーワード検出が動作
- [ ] 話速計算が動作
- [ ] 単体テスト合格

### Task 2.2.3: 統合処理
- [ ] AnalysisOrchestrator実装完了
- [ ] セッション終了時に自動解析トリガー
- [ ] EmotionAnalysis保存成功
- [ ] AudioAnalysis保存成功
- [ ] SessionScore保存成功

### Task 2.2.4: API実装
- [ ] GET /sessions/:id/analysis 動作
- [ ] POST /sessions/:id/analyze 動作
- [ ] エラーハンドリング実装

### Task 2.2.5: フロントエンドUI
- [ ] ScoreDashboard表示成功
- [ ] Radarチャート表示
- [ ] Emotionタイムライン表示
- [ ] Strengths/Improvements表示

### エンドツーエンドテスト
- [ ] セッション実施 → 録画 → 解析 → スコア表示が一貫して動作
- [ ] 解析処理時間 < 2分（1分の録画）
- [ ] エラーハンドリング動作確認

---

## 次のステップ

1. **Task 2.2.1実行** - データベースマイグレーション
2. **Task 2.2.2開始** - 音声解析実装
3. **Task 2.2.3開始** - 統合処理実装
4. **Task 2.2.4開始** - API実装
5. **Task 2.2.5開始** - フロントエンドUI実装

**推奨開始:** Task 2.2.1（データベースマイグレーション）から順次実行
