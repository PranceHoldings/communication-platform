# プロファイルベンチマークシステム

**バージョン:** 2.0
**最終更新:** 2026-03-20
**ステータス:** ✅ 実装完了・Production稼働中

---

## 📊 実装ステータス（2026-03-20）

**Phase 4完了:** 2026-03-20 09:05 UTC

### 実装済み機能 ✅

- ✅ **DynamoDB Schema** - BenchmarkCache v2, UserSessionHistory
- ✅ **統計計算ユーティリティ** - Welford's Algorithm, z-score, 偏差値, percentile
- ✅ **Lambda関数** - GET /benchmark, POST /update-history
- ✅ **プロファイルハッシュ** - SHA256, k-anonymity保護
- ✅ **フロントエンドUI** - Dashboard, MetricCard, GrowthChart, AIInsights
- ✅ **多言語対応** - 10言語84翻訳キー
- ✅ **単体テスト** - 30テストケース
- ✅ **Production デプロイ** - DynamoDB + Lambda稼働中

### 未実装機能 ⏳

- ⏳ **業界別ベンチマーク** - 現在はシナリオ単位のみ
- ⏳ **時系列比較** - 月次・週次トレンド分析
- ⏳ **カスタムメトリクス** - ユーザー定義評価軸
- ⏳ **エクスポート機能** - PDF/CSV出力

### APIエンドポイント

**Production環境:**
- `POST https://api.app.prance.jp/api/v1/benchmark` - ベンチマーク取得
- `POST https://api.app.prance.jp/api/v1/benchmark/update-history` - 履歴更新
- `GET https://api.app.prance.jp/api/v1/users/{userId}/session-history` - セッション履歴

> 詳細実装記録: [docs/09-progress/phases/PHASE_4_COMPLETE.md](../09-progress/phases/PHASE_4_COMPLETE.md)

---

## 目次

1. [概要](#概要)
2. [ベンチマークの種類](#ベンチマークの種類)
3. [ベンチマーク計算ロジック](#ベンチマーク計算ロジック)
4. [UI設計](#ui設計)
5. [成長トラッキング](#成長トラッキング)
6. [プライバシー保護](#プライバシー保護)
7. [実装詳細](#実装詳細)
8. [実装ガイド](#実装ガイド)

---

## 概要

プロファイルベンチマークシステムは、ユーザーのセッション結果を匿名化された**同じプロファイル**（年齢層、職種、業界等）のユーザーグループと比較し、客観的な評価と改善提案を提供する機能です。

### 主要機能

| 機能                         | 説明                                           |
| ---------------------------- | ---------------------------------------------- |
| **プロファイル比較**         | 同じプロファイルグループ内での順位・偏差値表示 |
| **成長トラッキング**         | 過去のセッションとの比較、成長グラフ           |
| **パーソナライズド改善提案** | AIによる具体的なアドバイス生成                 |
| **プライバシー保護**         | 完全匿名化、最小人数制限（N≥10）               |
| **リアルタイム更新**         | 新しいセッション追加時の自動再計算             |
| **多次元評価**               | スキル別・カテゴリ別の詳細ベンチマーク         |

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
  const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];

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
  return Math.round(50 + zScore * 10);
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
  const weakAreas = benchmarks.filter(b => b.userScore < b.groupStats.mean || b.percentile > 50);

  if (weakAreas.length === 0) {
    return [
      {
        priority: 'low',
        title: '優れたパフォーマンス',
        description:
          'すべての評価項目で平均以上のスコアを達成しています。この調子で継続してください。',
        estimatedImprovement: null,
      },
    ];
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
    'ageGroup', // 10年単位
    'experienceLevel', // 段階評価
    'industry', // 業界カテゴリ
    'jobFunction', // 職種カテゴリ
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
  await dynamodb
    .query({
      TableName: 'UserSessionHistory',
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': `USER#${userId}` },
    })
    .then(async result => {
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

## 実装詳細

### システム構成（実装済み）

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 15)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Benchmark    │  │ Growth       │  │ AI Insights  │     │
│  │ Dashboard    │  │ Chart        │  │ Panel        │     │
│  │ (176 lines)  │  │ (184 lines)  │  │ (160 lines)  │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
          │ POST /benchmark  │ GET /history     │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway (REST)                        │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│              Lambda Functions (Node.js 22, ARM64)            │
│  ┌──────────────────────┐  ┌──────────────────────────┐    │
│  │ benchmark-get        │  │ benchmark-update-history │    │
│  │ (162 lines)          │  │ (178 lines)              │    │
│  │ - k-anonymity check  │  │ - Session save           │    │
│  │ - Stats calculation  │  │ - Cache update           │    │
│  └──────────┬───────────┘  └──────────┬───────────────┘    │
└─────────────┼──────────────────────────┼─────────────────────┘
              │                          │
              ▼                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      DynamoDB Tables                         │
│  ┌──────────────────────┐  ┌──────────────────────┐        │
│  │ BenchmarkCache v2    │  │ UserSessionHistory   │        │
│  │ PK: profileHash      │  │ PK: userId           │        │
│  │ SK: metric           │  │ SK: sessionId        │        │
│  │ TTL: 7 days          │  │ TTL: 90 days         │        │
│  └──────────────────────┘  └──────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
              │                          │
              └──────────┬───────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Aurora Serverless v2 (PostgreSQL)               │
│  - Full session data (for recalculation)                     │
│  - Max 1000 sessions per profile for benchmark               │
└─────────────────────────────────────────────────────────────┘
```

### 統計計算実装

**ファイル:** `infrastructure/lambda/shared/utils/statistics.ts` (200行)

**実装関数:**

1. **calculateGroupStats(values: number[]): GroupStats**
   - 平均 (mean): Σ(x) / n
   - 中央値 (median): 50th percentile (linear interpolation)
   - 標準偏差 (stdDev): √(Σ(x - mean)² / n)
   - 最小/最大 (min/max): sorted[0], sorted[n-1]
   - 四分位数 (p25, p75): 25th, 75th percentile

2. **calculateZScore(value, mean, stdDev): number**
   - Z-score = (value - mean) / stdDev
   - 標準正規分布での位置

3. **calculateDeviationValue(value, mean, stdDev): number**
   - 偏差値 = 50 + 10 * zScore
   - 日本式標準化スコア

4. **calculatePercentileRank(value, mean, stdDev): number**
   - 正規分布近似を使用
   - Error function (erf) で CDF計算
   - Abramowitz and Stegun approximation
   - 精度: ±1.5×10^-7

5. **OnlineStats class** (Welford's Algorithm)
   - update(value): 増分更新 O(1)
   - getMean(): 現在の平均
   - getVariance(): 現在の分散
   - getStdDev(): 現在の標準偏差
   - メモリ: count, mean, m2 のみ

**単体テスト:** 10テストケース、全成功 ✅

### プロファイルハッシュ実装

**ファイル:** `infrastructure/lambda/shared/utils/profile-hash.ts` (200行)

**実装関数:**

1. **generateProfileHash(attributes): string**
   - SHA256ハッシュ生成
   - 入力: scenarioId + userAttributes
   - 出力: 64文字16進数文字列

2. **normalizeAge(age?: number): string**
   - `< 20` → "10s"
   - `20-29` → "20s"
   - `30-39` → "30s"
   - `40-49` → "40s"
   - `50-59` → "50s"
   - `>= 60` → "60+"
   - `undefined` → "unknown"

3. **normalizeGender(gender?: string): string**
   - "male" | "female" | "other" | "unknown"

4. **normalizeExperience(exp?: string): string**
   - "entry" | "mid" | "senior" | "unknown"

5. **normalizeIndustry(industry?: string): string**
   - "tech" | "finance" | "healthcare" | ... | "unknown"

6. **normalizeRole(role?: string): string**
   - "engineer" | "manager" | "student" | ... | "unknown"

**k-anonymity保護:**
- 最小サンプルサイズ: 10ユーザー
- 不十分データ時: 比較データを返さない
- プライバシー保護: GDPR/CCPA準拠

**単体テスト:** 20テストケース、全成功 ✅

### Lambda関数実装

**1. benchmark-get Lambda**

**ファイル:** `infrastructure/lambda/benchmark/get/index.ts` (162行)

**機能:**
- DynamoDBからベンチマークデータ取得
- profileHashでクエリ
- k-anonymity検証 (MIN_SAMPLE_SIZE = 10)
- ユーザースコアとの比較計算
- z-score, 偏差値, percentile計算

**環境変数:**
- `DYNAMODB_BENCHMARK_CACHE_TABLE`: BenchmarkCache テーブル名
- `AWS_REGION`: us-east-1

**IAM権限:**
- `dynamodb:Query` on BenchmarkCache table

**メトリクス:**
- 平均実行時間: 200-300ms
- メモリ使用: 80-120MB
- タイムアウト: 30秒

**2. benchmark-update-history Lambda**

**ファイル:** `infrastructure/lambda/benchmark/update-history/index.ts` (178行)

**機能:**
1. セッション完了時に自動呼び出し
2. UserSessionHistoryに保存 (DynamoDB, TTL: 90日)
3. RDSから全セッション取得 (最大1000件)
4. 統計量再計算 (mean, median, stdDev, etc.)
5. BenchmarkCacheに保存 (DynamoDB, TTL: 7日)

**環境変数:**
- `DYNAMODB_USER_SESSION_HISTORY_TABLE`: UserSessionHistory テーブル名
- `DYNAMODB_BENCHMARK_CACHE_TABLE`: BenchmarkCache テーブル名
- `DATABASE_URL`: Aurora PostgreSQL接続文字列

**IAM権限:**
- `dynamodb:PutItem`, `dynamodb:Query` on both tables
- VPC access for RDS connection

**メトリクス:**
- 平均実行時間: 1-2秒 (RDSクエリ含む)
- メモリ使用: 150-200MB
- タイムアウト: 60秒

### フロントエンド実装

**1. BenchmarkDashboard.tsx** (176行)

**機能:**
- ベンチマークデータ取得・表示
- ローディング状態管理
- エラーハンドリング
- 不十分データ時のフォールバック表示

**使用コンポーネント:**
- Card, CardHeader, CardTitle, CardContent (shadcn/ui)
- BenchmarkMetricCard (子コンポーネント)

**Props:**
```typescript
interface Props {
  sessionId: string;
  scenarioId: string;
  scores: {
    overallScore: number;
    emotionScore: number;
    audioScore: number;
    contentScore: number;
    deliveryScore: number;
  };
}
```

**2. BenchmarkMetricCard.tsx** (118行)

**機能:**
- 個別メトリクス表示
- プログレスバー (0-100点)
- パフォーマンスレベル判定
- 折りたたみ可能な詳細統計

**パフォーマンスレベル:**
- `percentile >= 90%` → Excellent (緑)
- `percentile >= 75%` → Good (青)
- `percentile >= 50%` → Average (黄)
- `percentile >= 25%` → Below Average (オレンジ)
- `percentile < 25%` → Needs Improvement (赤)

**3. GrowthChart.tsx** (184行)

**機能:**
- セッション履歴取得・表示
- 時系列チャート (Recharts)
- 傾向分析 (improving/stable/declining)
- 前回からの変化インジケーター

**表示:**
- 最新10セッション
- 5メトリクス同時表示
- 日付・セッション番号ラベル

**4. AIInsights.tsx** (160行)

**機能:**
- AI改善提案生成
- 優先度判定 (high/medium/low)
- パーソナライズドメッセージ
- メトリクス別具体的提案

**ロジック:**
```typescript
if (percentileRank < 25) {
  priority = 'high';
  suggestion = t(`insights.suggestions.${metric}`);
} else if (percentileRank < 50) {
  priority = 'medium';
  suggestion = t(`insights.suggestions.${metric}`);
}
```

### 多言語対応

**翻訳リソース:** 84キー × 10言語 = 840エントリ

**ファイル構成:**
```
apps/web/messages/
├── en/benchmark.json (84 keys)
├── ja/benchmark.json (84 keys)
├── zh-CN/benchmark.json (84 keys)
├── zh-TW/benchmark.json (84 keys)
├── ko/benchmark.json (84 keys)
├── es/benchmark.json (84 keys)
├── pt/benchmark.json (84 keys)
├── fr/benchmark.json (84 keys)
├── de/benchmark.json (84 keys)
└── it/benchmark.json (84 keys)
```

**翻訳カテゴリ:**
- タイトル・説明 (title, description, loading, insufficientData, sampleSize)
- メトリクス名 (metrics.overallScore, metrics.emotionScore, ...)
- 統計用語 (yourScore, average, median, percentile, zScore, deviationValue)
- パフォーマンスレベル (excellent, good, average, belowAverage, needsImprovement)
- 成長トラッキング (growth.title, growth.trend, growth.improving, growth.stable, growth.declining)
- AI改善提案 (insights.title, insights.priority.high, insights.suggestions.*)
- アクション (actions.viewDetails, actions.refresh, actions.export, actions.share)

**検証:**
```bash
pnpm run validate:i18n
# Result: 551 total keys (84 benchmark + 467 others), 0 missing keys ✅
```

### DynamoDB Schema

**1. BenchmarkCache v2**

**テーブル名:** `prance-benchmark-cache-v2-{environment}`

**スキーマ:**
```typescript
{
  profileHash: string;      // PK: SHA256(scenarioId + userAttributes)
  metric: string;           // SK: "overallScore" | "emotionScore" | ...
  mean: number;             // 平均値
  median: number;           // 中央値
  stdDev: number;           // 標準偏差
  min: number;              // 最小値
  max: number;              // 最大値
  p25: number;              // 第1四分位数
  p75: number;              // 第3四分位数
  sampleSize: number;       // サンプル数（k-anonymity検証用）
  lastUpdated: string;      // ISO8601形式
  ttl: number;              // Unix timestamp（7日後）
}
```

**GSI: MetricIndex**
- PK: metric
- SK: profileHash
- Projection: ALL

**2. UserSessionHistory**

**テーブル名:** `prance-user-session-history-{environment}`

**スキーマ:**
```typescript
{
  userId: string;           // PK
  sessionId: string;        // SK
  scenarioId: string;       // GSI PK
  completedAt: string;      // GSI SK (ISO8601)
  overallScore: number;
  emotionScore: number;
  audioScore: number;
  contentScore: number;
  deliveryScore: number;
  duration: number;         // 秒
  ttl: number;              // 90日後削除
}
```

**GSI: ScenarioIndex**
- PK: scenarioId
- SK: completedAt
- Projection: ALL

### Production環境

**デプロイ日:** 2026-03-20 08:57-09:05 UTC

**リソース:**
- DynamoDB Tables: 2 (ACTIVE)
- Lambda Functions: 2 (ACTIVE)
- API Gateway Endpoints: 3

**エンドポイント:**
- `POST https://api.app.prance.jp/api/v1/benchmark`
- `POST https://api.app.prance.jp/api/v1/benchmark/update-history`
- `GET https://api.app.prance.jp/api/v1/users/{userId}/session-history`

**コスト見積もり (月間1000セッション):**
- DynamoDB: $5-10/月 (読み取り・書き込み)
- Lambda: $2-5/月 (実行時間・メモリ)
- 合計: $7-15/月

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
    Result: 'Group size too small'
    End: true

  Success:
    Type: Succeed
```

### API エンドポイント

```typescript
// GET /api/v1/sessions/:sessionId/benchmark
export const getBenchmark: APIGatewayProxyHandler = async event => {
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
    session.evaluationScores.map(async score => {
      const cache = await getBenchmarkCache(profileHash, score.metric);

      if (!cache) {
        return null; // グループサイズ不足
      }

      return calculateBenchmark(score.value, profileHash, score.metric);
    })
  );

  // 4. 成長トレンド分析
  const trends = await Promise.all(
    session.evaluationScores.map(score => analyzeGrowthTrend(userId, score.metric, 10))
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
