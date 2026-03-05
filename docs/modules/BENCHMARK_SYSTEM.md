# プロファイルベンチマークシステム

**バージョン:** 1.0
**最終更新:** 2026-03-05
**ステータス:** 設計完了

---

## 目次

1. [概要](#概要)
2. [ベンチマークの種類](#ベンチマークの種類)
3. [ベンチマーク計算ロジック](#ベンチマーク計算ロジック)
4. [UI設計](#ui設計)
5. [成長トラッキング](#成長トラッキング)
6. [プライバシー保護](#プライバシー保護)
7. [実装ガイド](#実装ガイド)

---

## 概要

プロファイルベンチマークシステムは、ユーザーのセッション結果を匿名化された**同じプロファイル**（年齢層、職種、業界等）のユーザーグループと比較し、客観的な評価と改善提案を提供する機能です。

### 主要機能

| 機能 | 説明 |
| ---- | ---- |
| **プロファイル比較** | 同じプロファイルグループ内での順位・偏差値表示 |
| **成長トラッキング** | 過去のセッションとの比較、成長グラフ |
| **パーソナライズド改善提案** | AIによる具体的なアドバイス生成 |
| **プライバシー保護** | 完全匿名化、最小人数制限（N≥10） |
| **リアルタイム更新** | 新しいセッション追加時の自動再計算 |
| **多次元評価** | スキル別・カテゴリ別の詳細ベンチマーク |

### ユースケース

#### 就職・採用支援
```
シナリオ: ソフトウェアエンジニア（中級）面接練習
プロファイル: 20代後半、3-5年経験、IT業界

ベンチマーク結果:
- 技術的説明力: 65点（偏差値52、上位40%）
- コミュニケーション: 78点（偏差値58、上位25%）
- 問題解決能力: 55点（偏差値48、上位60%）

改善提案:
「問題解決能力が同プロファイルの平均を下回っています。
具体的な事例を用いた説明を増やすと効果的です。」
```

#### 語学学習
```
シナリオ: ビジネス英会話（中級）
プロファイル: 30代前半、TOEIC 600-750、ビジネスパーソン

ベンチマーク結果:
- 発音明瞭度: 72点（偏差値55、上位30%）
- 語彙多様性: 58点（偏差値47、上位65%）
- 流暢性: 80点（偏差値61、上位20%）

改善提案:
「流暢性は優れていますが、語彙のバリエーションを増やすと
さらに高評価が得られます。類義語の使い分けを意識しましょう。」
```

---

## ベンチマークの種類

### 1. 絶対評価（Absolute Scoring）

セッション単体での評価（0-100点スケール）

```typescript
interface AbsoluteScore {
  metric: string; // '技術的説明力'
  score: number; // 65 (0-100)
  rubric: string; // 評価基準
  evidence: string[]; // 根拠となる会話内容
}
```

### 2. 相対評価（Relative Benchmarking）

同じプロファイルグループ内での比較

```typescript
interface RelativeBenchmark {
  metric: string;
  userScore: number; // 65
  groupStats: {
    mean: number; // 68.5（平均）
    median: number; // 70（中央値）
    stdDev: number; // 12.3（標準偏差）
    min: number; // 30
    max: number; // 95
  };
  percentile: number; // 40（上位40%）
  zScore: number; // -0.28（標準化スコア）
  deviationValue: number; // 52（偏差値）
}
```

### 3. 時系列比較（Temporal Comparison）

過去のセッションとの比較

```typescript
interface TemporalComparison {
  metric: string;
  sessions: {
    sessionId: string;
    date: Date;
    score: number;
  }[];
  trend: 'improving' | 'declining' | 'stable';
  changeRate: number; // +12.5%（前回比）
  totalChange: number; // +18.0%（初回比）
}
```

---

## ベンチマーク計算ロジック

### プロファイル定義

```typescript
interface UserProfile {
  // 基本属性（匿名化）
  ageGroup: '10s' | '20s' | '30s' | '40s' | '50s+';
  experienceLevel: 'entry' | 'junior' | 'mid' | 'senior' | 'expert';
  industry?: string; // 'IT', 'Finance', 'Healthcare', etc.
  jobFunction?: string; // 'Engineer', 'Sales', 'Marketing', etc.

  // シナリオ属性
  scenarioCategory: string; // 'job_interview', 'language', etc.
  scenarioDifficulty: 'easy' | 'medium' | 'hard';
  language: string; // 'ja', 'en', etc.
}

// プロファイルハッシュ生成（グループ化用）
function generateProfileHash(profile: UserProfile): string {
  const key = [
    profile.ageGroup,
    profile.experienceLevel,
    profile.industry || 'any',
    profile.jobFunction || 'any',
    profile.scenarioCategory,
    profile.scenarioDifficulty,
    profile.language,
  ].join('_');

  return crypto.createHash('sha256').update(key).digest('hex').substring(0, 16);
}
```

### ベンチマーク計算フロー

```
セッション完了
  ↓
1. ユーザープロファイル抽出
  ↓
2. プロファイルハッシュ生成
  ↓
3. DynamoDB: 同じハッシュのセッションを検索（N≥10）
  ↓
4. 統計値計算（平均、中央値、標準偏差）
  ↓
5. 相対評価算出（偏差値、パーセンタイル）
  ↓
6. キャッシュ保存（1日有効）
  ↓
7. レポート生成
```

### 統計計算アルゴリズム

```typescript
// 統計値計算
function calculateGroupStats(scores: number[]): GroupStats {
  const n = scores.length;

  if (n < 10) {
    throw new Error('Insufficient data for benchmarking (minimum 10 sessions required)');
  }

  // 平均（Mean）
  const mean = scores.reduce((sum, s) => sum + s, 0) / n;

  // 中央値（Median）
  const sorted = [...scores].sort((a, b) => a - b);
  const median = n % 2 === 0
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    : sorted[Math.floor(n / 2)];

  // 標準偏差（Standard Deviation）
  const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);

  return {
    mean,
    median,
    stdDev,
    min: Math.min(...scores),
    max: Math.max(...scores),
    count: n,
  };
}

// Z-Score（標準化スコア）
function calculateZScore(score: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0;
  return (score - mean) / stdDev;
}

// 偏差値（Deviation Value）
function calculateDeviationValue(zScore: number): number {
  return Math.round(50 + (zScore * 10));
}

// パーセンタイル（Percentile）
function calculatePercentile(score: number, scores: number[]): number {
  const sorted = [...scores].sort((a, b) => a - b);
  const belowCount = sorted.filter(s => s < score).length;
  return Math.round((belowCount / sorted.length) * 100);
}

// メイン関数
function calculateBenchmark(
  userScore: number,
  profileHash: string,
  metric: string
): RelativeBenchmark {
  // 1. 同じプロファイルのスコアを取得
  const groupScores = getGroupScores(profileHash, metric);

  // 2. 統計値計算
  const stats = calculateGroupStats(groupScores);

  // 3. 相対評価算出
  const zScore = calculateZScore(userScore, stats.mean, stats.stdDev);
  const deviationValue = calculateDeviationValue(zScore);
  const percentile = calculatePercentile(userScore, groupScores);

  return {
    metric,
    userScore,
    groupStats: stats,
    percentile,
    zScore,
    deviationValue,
  };
}
```

### キャッシュ戦略（DynamoDB）

```typescript
// DynamoDBテーブル: BenchmarkCache
interface BenchmarkCacheItem {
  PK: string; // 'PROFILE#{profileHash}'
  SK: string; // 'METRIC#{metricName}#DATE#{YYYY-MM-DD}'

  profileHash: string;
  metric: string;
  date: string; // YYYY-MM-DD

  // 統計データ
  stats: GroupStats;
  sampleSize: number; // N

  // キャッシュ管理
  ttl: number; // UNIX timestamp（1日後に自動削除）
  updatedAt: string;
}

// キャッシュ取得・更新
async function getBenchmarkCache(
  profileHash: string,
  metric: string
): Promise<BenchmarkCacheItem | null> {
  const today = new Date().toISOString().split('T')[0];

  const result = await dynamodb.get({
    TableName: 'BenchmarkCache',
    Key: {
      PK: `PROFILE#${profileHash}`,
      SK: `METRIC#${metric}#DATE#${today}`,
    },
  });

  return result.Item as BenchmarkCacheItem | null;
}

// キャッシュ更新（新しいセッション追加時）
async function updateBenchmarkCache(
  profileHash: string,
  metric: string,
  newScore: number
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const cache = await getBenchmarkCache(profileHash, metric);

  if (!cache) {
    // 初回キャッシュ作成
    const groupScores = await getGroupScores(profileHash, metric);
    const stats = calculateGroupStats([...groupScores, newScore]);

    await dynamodb.put({
      TableName: 'BenchmarkCache',
      Item: {
        PK: `PROFILE#${profileHash}`,
        SK: `METRIC#${metric}#DATE#${today}`,
        profileHash,
        metric,
        date: today,
        stats,
        sampleSize: groupScores.length + 1,
        ttl: Math.floor(Date.now() / 1000) + 86400, // 24時間後
        updatedAt: new Date().toISOString(),
      },
    });
  } else {
    // 既存キャッシュを更新（増分計算）
    const updatedStats = updateStatsIncremental(cache.stats, newScore, cache.sampleSize);

    await dynamodb.update({
      TableName: 'BenchmarkCache',
      Key: {
        PK: `PROFILE#${profileHash}`,
        SK: `METRIC#${metric}#DATE#${today}`,
      },
      UpdateExpression: 'SET stats = :stats, sampleSize = :size, updatedAt = :time',
      ExpressionAttributeValues: {
        ':stats': updatedStats,
        ':size': cache.sampleSize + 1,
        ':time': new Date().toISOString(),
      },
    });
  }
}

// 増分統計更新（オンラインアルゴリズム）
function updateStatsIncremental(
  currentStats: GroupStats,
  newScore: number,
  currentN: number
): GroupStats {
  const newN = currentN + 1;

  // 新しい平均
  const newMean = (currentStats.mean * currentN + newScore) / newN;

  // 新しい分散（Welford's online algorithm）
  const delta = newScore - currentStats.mean;
  const delta2 = newScore - newMean;
  const newVariance = (currentStats.stdDev ** 2 * currentN + delta * delta2) / newN;
  const newStdDev = Math.sqrt(newVariance);

  return {
    mean: newMean,
    median: currentStats.median, // 再計算が必要（近似値として現在値を維持）
    stdDev: newStdDev,
    min: Math.min(currentStats.min, newScore),
    max: Math.max(currentStats.max, newScore),
    count: newN,
  };
}
```

---

## UI設計

### ベンチマークダッシュボード

```
┌──────────────────────────────────────────────────────────────┐
│ ベンチマーク分析                         [📊 詳細レポート]   │
├──────────────────────────────────────────────────────────────┤
│ プロファイル: 20代後半・中級エンジニア・IT業界               │
│ 比較対象: 同プロファイル 127名（過去30日間）                 │
│                                                               │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ 総合評価                                                      │
│ ┌────────────────────────────────────────────────────────┐   │
│ │              あなた      グループ平均                  │   │
│ │  総合スコア   72点        68.5点    [偏差値: 53]       │   │
│ │  順位        51位 / 127名 (上位40%)                    │   │
│ │                                                        │   │
│ │  ┌──────────────────────────────────────────────┐    │   │
│ │  │ あなた ●                                      │    │   │
│ │  ├──────┬─────────┬─────────┬─────────┬───────┤    │   │
│ │  │ 下位  │  平均以下 │   平均   │  平均以上 │  上位 │    │   │
│ │  │ 25%   │          │    ↑     │          │  25%  │    │   │
│ │  └──────┴─────────┴─────────┴─────────┴───────┘    │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ スキル別ベンチマーク                                          │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ 技術的説明力            65点  [偏差値: 52] 上位40%     │   │
│ │ ████████████████░░░░░░░░░░░░░░░░░░░░                   │   │
│ │ グループ平均: 68.5点                                   │   │
│ │ [詳細] [成長グラフ]                                    │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ コミュニケーション      78点  [偏差値: 58] 上位25% ⭐  │   │
│ │ ██████████████████████████░░░░░░░░░░░░                 │   │
│ │ グループ平均: 65.2点                                   │   │
│ │ [詳細] [成長グラフ]                                    │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ 問題解決能力            55点  [偏差値: 48] 上位60% ⚠️  │   │
│ │ ██████████████░░░░░░░░░░░░░░░░░░░░░░░░                 │   │
│ │ グループ平均: 62.8点                                   │   │
│ │ [詳細] [成長グラフ]                                    │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ 🎯 パーソナライズド改善提案                                   │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ 優先度: 高                                             │   │
│ │ 📌 問題解決能力の強化                                  │   │
│ │ あなたの問題解決能力スコアは同プロファイル平均を       │   │
│ │ 7.8点下回っています。以下の改善策を推奨します：        │   │
│ │                                                        │   │
│ │ 1. 具体的な事例を用いた説明                           │   │
│ │    - STAR法（状況・課題・行動・結果）を活用           │   │
│ │    - 数値・データを含めた説明を心がける               │   │
│ │                                                        │   │
│ │ 2. 論理的思考プロセスの可視化                         │   │
│ │    - 「なぜ」「どのように」を明確に説明               │   │
│ │    - 複数の選択肢を比較検討した過程を示す             │   │
│ │                                                        │   │
│ │ 📈 推定改善効果: +10-15点（3-5セッション後）          │   │
│ └────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### 詳細スキル分析

```
┌──────────────────────────────────────────────────────────────┐
│ スキル詳細: 技術的説明力                         [戻る]      │
├──────────────────────────────────────────────────────────────┤
│ あなたのスコア: 65点                                          │
│ グループ平均: 68.5点 (N=127)                                  │
│ 偏差値: 52 | 順位: 51位/127名 (上位40%)                       │
│                                                               │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ 分布グラフ                                                    │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ 人数                                                   │   │
│ │  30│                                                   │   │
│ │    │             ┌───┐                               │   │
│ │  20│       ┌───┐ │   │                               │   │
│ │    │ ┌───┐ │   │ │   │ ┌───┐                         │   │
│ │  10│ │   │ │   │ │   │ │   │ ┌───┐                   │   │
│ │    │ │   │ │   │ │ ● │ │   │ │   │                   │   │
│ │   0└─┴───┴─┴───┴─┴───┴─┴───┴─┴───┴───────            │   │
│ │    30  40  50  60  70  80  90 100 点                  │   │
│ │                        ↑ あなた                        │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ 成長トラッキング                                              │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ スコア                                                 │   │
│ │  80│                                        ○          │   │
│ │    │                             ○──────●              │   │
│ │  60│                  ○──────○                         │   │
│ │    │       ○──────○                                    │   │
│ │  40│   ○                                                │   │
│ │    │                                                   │   │
│ │  20│                                                   │   │
│ │    └───┬───┬───┬───┬───┬───                          │   │
│ │      1回目 2回目 3回目 4回目 5回目 今回                   │   │
│ │                                                        │   │
│ │ 📈 成長率: +18.0% (初回比: 55→65点)                    │   │
│ │ 📊 トレンド: 改善中 (+10点/5セッション)               │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ 強みと改善点                                                  │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ ✅ 強み                                                 │   │
│ │ - 専門用語を適切に使用できている（上位30%）           │   │
│ │ - 論理的な文章構成（上位35%）                         │   │
│ │                                                        │   │
│ │ ⚠️ 改善点                                               │   │
│ │ - 具体例の不足（下位45%）                             │   │
│ │ - 説明の簡潔さ（下位40%）                             │   │
│ └────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

---

## 成長トラッキング

### 時系列データ管理

```typescript
// DynamoDBテーブル: UserSessionHistory
interface UserSessionHistory {
  PK: string; // 'USER#{userId}'
  SK: string; // 'SESSION#{timestamp}#{sessionId}'

  userId: string;
  sessionId: string;
  timestamp: number; // UNIX timestamp

  // シナリオ情報
  scenarioId: string;
  scenarioCategory: string;
  scenarioDifficulty: string;

  // プロファイル（その時点）
  profileHash: string;

  // スコア
  scores: {
    metric: string;
    absoluteScore: number;
    relativeBenchmark: RelativeBenchmark;
  }[];

  // メタデータ
  duration: number; // seconds
}

// 成長トレンド分析
async function analyzeGrowthTrend(
  userId: string,
  metric: string,
  limit: number = 10
): Promise<TemporalComparison> {
  // 1. 過去のセッション履歴を取得
  const sessions = await dynamodb.query({
    TableName: 'UserSessionHistory',
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: {
      ':pk': `USER#${userId}`,
    },
    ScanIndexForward: false, // 新しい順
    Limit: limit,
  });

  // 2. 該当メトリックのスコアを抽出
  const sessionScores = sessions.Items.map(item => {
    const score = item.scores.find(s => s.metric === metric);
    return {
      sessionId: item.sessionId,
      date: new Date(item.timestamp),
      score: score?.absoluteScore || 0,
    };
  }).reverse(); // 古い順に並び替え

  if (sessionScores.length < 2) {
    return {
      metric,
      sessions: sessionScores,
      trend: 'stable',
      changeRate: 0,
      totalChange: 0,
    };
  }

  // 3. トレンド分析
  const firstScore = sessionScores[0].score;
  const lastScore = sessionScores[sessionScores.length - 1].score;
  const previousScore = sessionScores[sessionScores.length - 2].score;

  const changeRate = ((lastScore - previousScore) / previousScore) * 100;
  const totalChange = ((lastScore - firstScore) / firstScore) * 100;

  // トレンド判定（線形回帰）
  const trend = calculateTrend(sessionScores.map(s => s.score));

  return {
    metric,
    sessions: sessionScores,
    trend,
    changeRate,
    totalChange,
  };
}

// 線形回帰によるトレンド判定
function calculateTrend(scores: number[]): 'improving' | 'declining' | 'stable' {
  const n = scores.length;
  const xMean = (n - 1) / 2;
  const yMean = scores.reduce((sum, s) => sum + s, 0) / n;

  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    const xDiff = i - xMean;
    const yDiff = scores[i] - yMean;
    numerator += xDiff * yDiff;
    denominator += xDiff * xDiff;
  }

  const slope = numerator / denominator;

  if (slope > 2) return 'improving';
  if (slope < -2) return 'declining';
  return 'stable';
}
```

### 改善提案生成（AI）

```typescript
// AIによるパーソナライズド改善提案
async function generateImprovementSuggestions(
  userId: string,
  sessionId: string,
  benchmarks: RelativeBenchmark[]
): Promise<ImprovementSuggestion[]> {
  // 1. 改善が必要な領域を特定（平均以下、または下位50%）
  const weakAreas = benchmarks.filter(b =>
    b.userScore < b.groupStats.mean || b.percentile > 50
  );

  if (weakAreas.length === 0) {
    return [{
      priority: 'low',
      title: '優れたパフォーマンス',
      description: 'すべての評価項目で平均以上のスコアを達成しています。この調子で継続してください。',
      estimatedImprovement: null,
    }];
  }

  // 2. 優先順位付け（改善余地が大きい順）
  const prioritized = weakAreas.sort((a, b) => {
    const gapA = a.groupStats.mean - a.userScore;
    const gapB = b.groupStats.mean - b.userScore;
    return gapB - gapA; // 降順
  });

  // 3. トップ3の改善領域に対してAIで提案生成
  const suggestions: ImprovementSuggestion[] = [];

  for (const area of prioritized.slice(0, 3)) {
    const prompt = `
あなたは優秀なキャリアコーチです。以下のベンチマーク結果を分析し、具体的な改善提案を生成してください。

**評価項目:** ${area.metric}
**ユーザースコア:** ${area.userScore}点
**グループ平均:** ${area.groupStats.mean}点
**差分:** ${(area.groupStats.mean - area.userScore).toFixed(1)}点下回っている
**偏差値:** ${area.deviationValue}
**順位:** 上位${area.percentile}%

**改善提案の要件:**
1. 具体的で実践可能なアクション（3-5個）
2. なぜその行動が効果的かの説明
3. 推定改善効果（点数の予測）
4. 実践期間の目安（セッション回数）

JSON形式で回答してください。
    `;

    const aiResponse = await callClaude(prompt);
    const parsed = JSON.parse(aiResponse);

    suggestions.push({
      priority: suggestions.length === 0 ? 'high' : suggestions.length === 1 ? 'medium' : 'low',
      title: `${area.metric}の強化`,
      description: parsed.description,
      actions: parsed.actions,
      estimatedImprovement: parsed.estimatedImprovement,
      sessionsRequired: parsed.sessionsRequired,
    });
  }

  return suggestions;
}

interface ImprovementSuggestion {
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  actions?: string[];
  estimatedImprovement: string | null; // '+10-15点'
  sessionsRequired?: number;
}
```

---

## プライバシー保護

### 匿名化とデータ保護

```typescript
// プライバシー保護の原則
const PRIVACY_RULES = {
  // 最小人数制限（統計的信頼性とプライバシー保護）
  MIN_GROUP_SIZE: 10,

  // 個人識別不可能な属性のみ使用
  ALLOWED_ATTRIBUTES: [
    'ageGroup',      // 10年単位
    'experienceLevel', // 段階評価
    'industry',      // 業界カテゴリ
    'jobFunction',   // 職種カテゴリ
    'scenarioCategory',
    'scenarioDifficulty',
    'language',
  ],

  // 禁止属性（個人識別リスク）
  FORBIDDEN_ATTRIBUTES: [
    'email',
    'name',
    'organizationName',
    'specificCompany',
    'detailedLocation', // 都道府県まで
  ],
};

// ベンチマーク取得時のプライバシーチェック
async function getBenchmarkWithPrivacyCheck(
  profileHash: string,
  metric: string
): Promise<RelativeBenchmark | null> {
  // 1. グループサイズを確認
  const groupSize = await getGroupSize(profileHash);

  if (groupSize < PRIVACY_RULES.MIN_GROUP_SIZE) {
    // グループサイズが小さすぎる → ベンチマーク非表示
    logger.info(`Group too small for benchmarking: ${groupSize} < ${PRIVACY_RULES.MIN_GROUP_SIZE}`);
    return null;
  }

  // 2. ベンチマーク計算
  const benchmark = await calculateBenchmark(userScore, profileHash, metric);

  // 3. 個人識別リスクチェック（k-匿名性）
  const isAnonymous = checkKAnonymity(benchmark, PRIVACY_RULES.MIN_GROUP_SIZE);

  if (!isAnonymous) {
    logger.warn(`K-anonymity violation detected for ${profileHash}`);
    return null;
  }

  return benchmark;
}

// k-匿名性チェック
function checkKAnonymity(benchmark: RelativeBenchmark, k: number): boolean {
  // 同じスコアを持つユーザーがk人以上いるか確認
  const sameScoreCount = benchmark.groupStats.count;
  return sameScoreCount >= k;
}
```

### GDPR・CCPA対応

```typescript
// データ削除リクエスト対応
async function handleDataDeletionRequest(userId: string): Promise<void> {
  // 1. ユーザーの全セッション履歴を削除
  await dynamodb.query({
    TableName: 'UserSessionHistory',
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: { ':pk': `USER#${userId}` },
  }).then(async (result) => {
    for (const item of result.Items) {
      await dynamodb.delete({
        TableName: 'UserSessionHistory',
        Key: { PK: item.PK, SK: item.SK },
      });
    }
  });

  // 2. ベンチマークキャッシュから該当データを除外（再計算）
  // Note: 匿名化されているため、個人特定は不可能
  // → キャッシュは自然にTTL期限切れで削除される

  // 3. Aurora DBから個人データ削除
  await prisma.user.delete({ where: { id: userId } });

  logger.info(`User data deleted: ${userId}`);
}
```

---

## 実装ガイド

### Step Functions ワークフロー

```yaml
# ベンチマーク計算ワークフロー
StartAt: ExtractProfile
States:
  ExtractProfile:
    Type: Task
    Resource: arn:aws:lambda:...:function:ExtractProfile
    Next: GenerateProfileHash

  GenerateProfileHash:
    Type: Task
    Resource: arn:aws:lambda:...:function:GenerateProfileHash
    Next: CheckGroupSize

  CheckGroupSize:
    Type: Task
    Resource: arn:aws:lambda:...:function:CheckGroupSize
    Next: GroupSizeDecision

  GroupSizeDecision:
    Type: Choice
    Choices:
      - Variable: $.groupSize
        NumericGreaterThanEquals: 10
        Next: CalculateBenchmark
    Default: SkipBenchmark

  CalculateBenchmark:
    Type: Task
    Resource: arn:aws:lambda:...:function:CalculateBenchmark
    Next: GenerateImprovementSuggestions

  GenerateImprovementSuggestions:
    Type: Task
    Resource: arn:aws:lambda:...:function:GenerateImprovementSuggestions
    Next: UpdateCache

  UpdateCache:
    Type: Task
    Resource: arn:aws:lambda:...:function:UpdateBenchmarkCache
    Next: Success

  SkipBenchmark:
    Type: Pass
    Result: "Group size too small"
    End: true

  Success:
    Type: Succeed
```

### API エンドポイント

```typescript
// GET /api/v1/sessions/:sessionId/benchmark
export const getBenchmark: APIGatewayProxyHandler = async (event) => {
  const { sessionId } = event.pathParameters;
  const { userId } = event.requestContext.authorizer;

  // 1. セッション情報取得
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { scenario: true, user: true },
  });

  if (!session || session.userId !== userId) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) };
  }

  // 2. プロファイル生成
  const profile = extractUserProfile(session.user, session.scenario);
  const profileHash = generateProfileHash(profile);

  // 3. ベンチマーク取得（キャッシュから）
  const benchmarks = await Promise.all(
    session.evaluationScores.map(async (score) => {
      const cache = await getBenchmarkCache(profileHash, score.metric);

      if (!cache) {
        return null; // グループサイズ不足
      }

      return calculateBenchmark(score.value, profileHash, score.metric);
    })
  );

  // 4. 成長トレンド分析
  const trends = await Promise.all(
    session.evaluationScores.map(score =>
      analyzeGrowthTrend(userId, score.metric, 10)
    )
  );

  // 5. 改善提案生成
  const suggestions = await generateImprovementSuggestions(
    userId,
    sessionId,
    benchmarks.filter(b => b !== null)
  );

  return {
    statusCode: 200,
    body: JSON.stringify({
      profileHash, // デバッグ用（本番では非公開）
      groupSize: benchmarks[0]?.groupStats.count || 0,
      benchmarks,
      trends,
      suggestions,
    }),
  };
};
```

---

## まとめ

プロファイルベンチマークシステムは、以下の価値を提供します：

✅ **客観的評価**: 同じプロファイルとの比較により、自己評価バイアスを排除
✅ **具体的な改善提案**: AIによるパーソナライズドアドバイス
✅ **成長の可視化**: 時系列グラフで進捗を追跡
✅ **プライバシー保護**: 完全匿名化、最小人数制限（N≥10）
✅ **リアルタイム更新**: 新しいデータの自動反映

このシステムにより、ユーザーは自分の強み・弱みを客観的に把握し、効果的な学習・トレーニングが可能になります。

---

**関連ドキュメント:**
- [レポートモジュール](REPORT_MODULE.md)
- [解析モジュール](ANALYSIS_MODULE.md)
- [データベース設計](../development/DATABASE_DESIGN.md)
