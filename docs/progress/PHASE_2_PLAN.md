# Phase 2 実装プラン - 録画・解析・レポート機能

**作成日:** 2026-03-06
**ステータス:** 計画中
**推定期間:** 4-6週間
**前提条件:** Phase 1完了（音声会話パイプライン動作確認済み）

---

## 📋 目次

1. [全体目標](#全体目標)
2. [アーキテクチャ概要](#アーキテクチャ概要)
3. [実装タスク](#実装タスク)
4. [技術スタック](#技術スタック)
5. [完了条件](#完了条件)

---

## 全体目標

Phase 2では、セッション中の**録画・解析・レポート生成**機能を実装します。これにより、ユーザーは会話セッション後に詳細なフィードバックとスコアリングを受け取ることができます。

### 主要機能

1. **録画機能**
   - アバター映像とユーザーカメラの同時録画
   - リアルタイム映像合成
   - S3保存・CloudFront配信

2. **解析機能**
   - 表情・感情解析（AWS Rekognition）
   - 音声特徴解析（音高・速度・間・ピッチ）
   - 非言語行動解析（視線・姿勢）

3. **レポート生成機能**
   - カスタマイズ可能なテンプレート
   - スコアリングアルゴリズム
   - AI駆動の改善提案
   - PDF出力

---

## アーキテクチャ概要

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser (Frontend)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Avatar View  │  │ User Camera  │  │ Canvas API   │     │
│  │ (Three.js)   │  │ (MediaStream)│  │ (Composite)  │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            │                                 │
│                   ┌────────▼────────┐                       │
│                   │ MediaRecorder   │                       │
│                   │ (Video+Audio)   │                       │
│                   └────────┬────────┘                       │
└────────────────────────────┼──────────────────────────────┘
                             │
                             │ WebSocket (Chunks)
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Lambda (Backend)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Video Chunk  │  │ Frame Extract│  │ Rekognition  │     │
│  │ Handler      │→ │ (ffmpeg)     │→ │ Analysis     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Audio        │  │ Voice        │  │ Score        │     │
│  │ Analysis     │  │ Features     │  │ Calculation  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Storage & CDN                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ S3 Bucket    │  │ DynamoDB     │  │ CloudFront   │     │
│  │ (Video/PDF)  │  │ (Analysis)   │  │ (Delivery)   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

---

## 実装タスク

### Task 2.1: 録画機能実装（2-3週間）

#### 2.1.1 フロントエンド映像キャプチャ（1週間）

**実装内容:**
- Canvas APIでアバター + ユーザーカメラ合成
- MediaRecorder APIで映像録画
- WebSocketで動画チャンク送信（1秒ごと）
- 録画状態管理（Recording/Paused/Stopped）

**ファイル:**
- `apps/web/hooks/useVideoRecorder.ts` （新規作成）
- `apps/web/components/session-player/video-composer.tsx` （新規作成）
- `apps/web/components/session-player/index.tsx` （拡張）

**技術詳細:**
```typescript
// useVideoRecorder.ts
interface UseVideoRecorderOptions {
  avatarCanvasRef: RefObject<HTMLCanvasElement>;
  userVideoRef: RefObject<HTMLVideoElement>;
  onChunk: (chunk: Blob, timestamp: number) => void;
  compositeLayout: 'side-by-side' | 'picture-in-picture';
}

// Canvas合成例（Picture-in-Picture）
ctx.drawImage(avatarCanvas, 0, 0, width, height);
ctx.drawImage(userVideo, width - 240, height - 180, 240, 180);
```

**完了条件:**
- ✅ Canvas合成が正常動作
- ✅ 両方の映像が録画される
- ✅ WebSocketで1秒ごとにチャンク送信
- ✅ 録画開始・停止が正常動作

---

#### 2.1.2 Lambda動画処理（1週間）

**実装内容:**
- 動画チャンクをS3に保存
- セッション終了時にチャンク結合（ffmpeg）
- 最終動画をS3に保存
- CloudFront署名付きURL生成

**ファイル:**
- `infrastructure/lambda/websocket/default/video-processor.ts` （新規作成）
- `infrastructure/lambda/websocket/default/index.ts` （拡張）

**技術詳細:**
```typescript
// video-processor.ts
export class VideoProcessor {
  async combineChunks(
    sessionId: string,
    chunkKeys: string[]
  ): Promise<string> {
    // ffmpeg -f concat -safe 0 -i list.txt -c copy output.mp4
    const ffmpeg = require('fluent-ffmpeg');
    // ... 実装
  }

  async generateSignedUrl(
    videoKey: string,
    expiresIn: number = 3600
  ): Promise<string> {
    const cloudfront = new AWS.CloudFront.Signer(...);
    return cloudfront.getSignedUrl(...);
  }
}
```

**Lambda設定:**
- メモリ: 3008MB（動画処理のため増強）
- タイムアウト: 300秒（5分）
- 一時ストレージ: /tmp（512MB → 10GB）

**完了条件:**
- ✅ 動画チャンク保存成功
- ✅ ffmpegで結合成功
- ✅ CloudFront署名付きURL生成成功
- ✅ 動画再生確認

---

#### 2.1.3 録画再生UI（3日）

**実装内容:**
- セッション詳細ページに録画プレイヤー追加
- シークバー・再生速度調整
- タイムスタンプ付きトランスクリプト表示

**ファイル:**
- `apps/web/components/session-player/video-player.tsx` （新規作成）
- `apps/web/app/dashboard/sessions/[id]/page.tsx` （拡張）

**完了条件:**
- ✅ 動画再生が正常動作
- ✅ シークバーで移動可能
- ✅ トランスクリプトと動画が同期

---

### Task 2.2: 解析機能実装（2-3週間）

#### 2.2.1 表情・感情解析（1週間）

**実装内容:**
- AWS Rekognition統合
- フレーム抽出（1秒ごと）
- 表情・感情スコアリング
- 時系列データ保存

**ファイル:**
- `infrastructure/lambda/shared/analysis/rekognition.ts` （新規作成）
- `infrastructure/lambda/websocket/default/frame-analyzer.ts` （新規作成）

**技術詳細:**
```typescript
// rekognition.ts
export class RekognitionAnalyzer {
  async analyzeFrame(imageBuffer: Buffer): Promise<EmotionAnalysis> {
    const rekognition = new AWS.Rekognition();
    const result = await rekognition.detectFaces({
      Image: { Bytes: imageBuffer },
      Attributes: ['ALL']
    }).promise();

    return {
      emotions: result.FaceDetails[0].Emotions,
      confidence: result.FaceDetails[0].Confidence,
      // ... その他
    };
  }
}
```

**完了条件:**
- ✅ Rekognition APIが正常動作
- ✅ 表情・感情データ取得成功
- ✅ DynamoDBに時系列保存成功

---

#### 2.2.2 音声特徴解析（1週間）

**実装内容:**
- Web Audio API統合
- 音高・速度・間・ピッチ解析
- フィラーワード検出
- 話速計算

**ファイル:**
- `apps/web/lib/audio-analysis.ts` （新規作成）
- `apps/web/hooks/useAudioAnalysis.ts` （新規作成）

**技術詳細:**
```typescript
// audio-analysis.ts
export class AudioAnalyzer {
  private audioContext: AudioContext;
  private analyser: AnalyserNode;

  analyzePitch(): number {
    // AutocorrelationアルゴリズムでF0検出
    const buffer = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(buffer);
    return this.autoCorrelate(buffer, this.audioContext.sampleRate);
  }

  detectFillerWords(transcript: string): FillerWord[] {
    // "um", "uh", "like", "you know" 検出
    const patterns = /\b(um|uh|like|you know|sort of)\b/gi;
    // ... 実装
  }
}
```

**完了条件:**
- ✅ 音高検出成功
- ✅ 話速計算成功
- ✅ フィラーワード検出成功

---

#### 2.2.3 スコアリングアルゴリズム（3日）

**実装内容:**
- 総合スコア計算
- カテゴリ別スコア（声・表情・内容・流暢さ）
- ベンチマーク比較

**ファイル:**
- `infrastructure/lambda/shared/scoring/algorithm.ts` （新規作成）

**スコアリング基準:**
```typescript
interface SessionScore {
  overall: number; // 0-100
  categories: {
    voice: {
      clarity: number;      // 明瞭さ
      pace: number;         // 話速
      pitch: number;        // 音高バリエーション
      fillers: number;      // フィラーワード
    };
    emotion: {
      engagement: number;   // エンゲージメント
      confidence: number;   // 自信
      appropriateness: number; // 適切さ
    };
    content: {
      relevance: number;    // 関連性
      completeness: number; // 完全性
      structure: number;    // 構造
    };
    fluency: {
      pauses: number;       // 間の適切さ
      flow: number;         // 流暢さ
    };
  };
}
```

**完了条件:**
- ✅ スコア計算成功
- ✅ カテゴリ別スコア生成成功
- ✅ ベンチマーク比較成功

---

### Task 2.3: レポート生成機能（1-2週間）

#### 2.3.1 レポートテンプレート（1週間）

**実装内容:**
- React-PDFでテンプレート作成
- カスタマイズ可能なセクション
- グラフ・チャート統合

**ファイル:**
- `infrastructure/lambda/report/templates/default.tsx` （新規作成）
- `infrastructure/lambda/report/generator.ts` （新規作成）

**テンプレート構成:**
```
1. サマリー
   - 総合スコア
   - 日付・時間
   - シナリオ情報

2. スコア詳細
   - カテゴリ別レーダーチャート
   - 時系列グラフ

3. 強み・改善点
   - AI生成フィードバック
   - 具体的な改善提案

4. トランスクリプト
   - 全会話ログ
   - タイムスタンプ付き

5. ベンチマーク比較
   - 過去のセッションとの比較
   - 業界平均との比較
```

**完了条件:**
- ✅ PDF生成成功
- ✅ グラフ表示成功
- ✅ カスタマイズ機能動作

---

#### 2.3.2 AI改善提案（3日）

**実装内容:**
- AWS Bedrock Claude統合
- スコアベースのプロンプト生成
- パーソナライズされた改善提案

**ファイル:**
- `infrastructure/lambda/shared/ai/improvement-suggestions.ts` （新規作成）

**完了条件:**
- ✅ AI提案生成成功
- ✅ プロンプト最適化完了

---

#### 2.3.3 レポート管理UI（3日）

**実装内容:**
- レポート一覧ページ
- ダウンロードボタン
- 共有機能

**ファイル:**
- `apps/web/app/dashboard/reports/page.tsx` （新規作成）
- `apps/web/components/report-viewer.tsx` （新規作成）

**完了条件:**
- ✅ レポート一覧表示成功
- ✅ ダウンロード機能動作
- ✅ 共有リンク生成成功

---

## 技術スタック

### フロントエンド
- **Canvas API** - 映像合成
- **MediaRecorder API** - 録画
- **Web Audio API** - 音声解析
- **Chart.js** - データ可視化
- **React-PDF** - PDFテンプレート（クライアント側プレビュー）

### バックエンド
- **AWS Lambda** - サーバーレス処理
- **ffmpeg** - 動画処理
- **AWS Rekognition** - 顔検出・感情解析
- **AWS Bedrock Claude** - AI改善提案
- **Puppeteer** - PDF生成（サーバー側）

### ストレージ
- **S3** - 動画・PDF保存
- **DynamoDB** - 解析データ保存
- **CloudFront** - 署名付きURL配信

---

## 完了条件

### Phase 2全体完了基準

#### 必須機能
- ✅ 録画機能が正常動作（アバター + ユーザーカメラ）
- ✅ 動画再生が正常動作
- ✅ 表情・感情解析が正常動作
- ✅ 音声解析が正常動作
- ✅ スコア計算が正常動作
- ✅ レポートPDF生成が正常動作
- ✅ AI改善提案が正常動作

#### パフォーマンス基準
- ✅ 動画結合時間: 10秒以内（1分の録画）
- ✅ レポート生成時間: 30秒以内
- ✅ Lambda実行時間: 5分以内（動画処理）
- ✅ PDFファイルサイズ: 5MB以下

#### エンドツーエンドテスト
1. セッション開始 → 録画開始
2. 会話実施（1-2分）
3. セッション終了 → 解析自動開始
4. 30秒後: レポート生成完了
5. レポートダウンロード成功
6. 動画再生成功

---

## 次回セッション開始時

```bash
# START_HERE.mdを確認
cat START_HERE.md

# Phase 2のタスク選択
# Option A: 録画機能から開始（推奨）
# Option B: 解析機能から開始
# Option C: レポート機能から開始
```

**推奨開始タスク:** Task 2.1.1 フロントエンド映像キャプチャ
