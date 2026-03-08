# 解析モジュール

**バージョン:** 1.0
**最終更新:** 2026-03-05
**ステータス:** 設計完了

---

## 目次

1. [概要](#概要)
2. [感情・非言語解析パイプライン](#感情非言語解析パイプライン)
3. [解析データ構造](#解析データ構造)
4. [評価ルーブリック設定](#評価ルーブリック設定)

---

## 概要

解析モジュールは、セッション終了後にユーザーのパフォーマンスを多角的に分析します。

### 主要機能

| 機能               | 説明                               | プロバイダ            |
| ------------------ | ---------------------------------- | --------------------- |
| **感情解析**       | 表情から感情を推定                 | AWS Rekognition       |
| **音声特徴解析**   | 話す速度、声のトーン、間合い       | Azure Speech Services |
| **非言語行動解析** | アイコンタクト、姿勢、ジェスチャー | MediaPipe             |
| **内容評価**       | 会話内容の論理性、適切性           | Claude API            |

---

## 感情・非言語解析パイプライン

```
録画映像 (user.webm)
     │
     ▼
フレーム抽出 (1fps)
     │
     ▼
AWS Rekognition Face Analysis
  ├─ 感情検出 (happy, sad, angry, surprised, confused)
  ├─ 視線方向 (eyeDirection)
  └─ 表情詳細 (smile, eyesOpen, mouthOpen)
     │
     ▼
タイムスタンプ付き感情データ
     │
     ▼
DynamoDB保存 (analyses テーブル)
```

### 音声特徴解析

```typescript
interface VoiceFeatures {
  averageWPM: number; // Words Per Minute
  silenceDuration: number; // 総沈黙時間（秒）
  speechRate: 'too_fast' | 'appropriate' | 'too_slow';
  volume: number; // 平均音量
  pitch: number; // 平均ピッチ
  clarity: number; // 発音の明瞭さ (0-1)
}
```

---

## 解析データ構造

```typescript
interface SessionAnalysis {
  id: string;
  sessionId: string;

  // 感情分析
  emotionTimeline: EmotionDataPoint[];
  dominantEmotion: string;

  // 音声特徴
  voiceFeatures: VoiceFeatures;

  // 非言語行動
  eyeContactRatio: number; // 0.0 - 1.0
  postureScore: number; // 0-100

  // 内容評価
  contentScores: {
    metric: string;
    score: number; // 0-100
    feedback: string;
  }[];

  // 総合評価
  overallScore: number; // 0-100

  createdAt: Date;
}
```

---

## 評価ルーブリック設定

管理者・ユーザーがカスタム評価基準を設定できます。

```yaml
evaluation_criteria:
  - metric: '論理的説明力'
    weight: 0.30
    rubric: |
      - 5点: 具体例を3つ以上挙げて論理的に説明
      - 4点: 具体例を2つ挙げて説明
      - 3点: 具体例を1つ挙げて説明
      - 2点: 抽象的な説明のみ
      - 1点: 説明が不明瞭

  - metric: 'アイコンタクト'
    weight: 0.20
    rubric: |
      - 5点: 80%以上カメラを見ている
      - 4点: 60-80%
      - 3点: 40-60%
      - 2点: 20-40%
      - 1点: 20%未満
```

---

**最終更新:** 2026-03-05
