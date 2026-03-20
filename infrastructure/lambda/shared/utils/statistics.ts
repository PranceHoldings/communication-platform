/**
 * 統計計算ユーティリティ
 *
 * ベンチマークシステムで使用する統計指標を計算
 */

export interface GroupStats {
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
  p25: number;
  p75: number;
  sampleSize: number;
}

/**
 * グループ統計を計算（平均、中央値、標準偏差など）
 */
export function calculateGroupStats(values: number[]): GroupStats {
  if (values.length === 0) {
    throw new Error('Cannot calculate stats for empty array');
  }

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;

  // 平均
  const mean = values.reduce((sum, val) => sum + val, 0) / n;

  // 中央値
  const median =
    n % 2 === 0 ? (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2 : sorted[Math.floor(n / 2)]!;

  // 標準偏差
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);

  // 四分位数
  const p25 = percentile(sorted, 25);
  const p75 = percentile(sorted, 75);

  return {
    mean,
    median,
    stdDev,
    min: sorted[0]!,
    max: sorted[n - 1]!,
    p25,
    p75,
    sampleSize: n,
  };
}

/**
 * パーセンタイル計算
 */
function percentile(sortedValues: number[], p: number): number {
  const index = (p / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index % 1;

  if (lower === upper) {
    return sortedValues[lower]!;
  }

  return sortedValues[lower]! * (1 - weight) + sortedValues[upper]! * weight;
}

/**
 * Z-score計算（標準化スコア）
 */
export function calculateZScore(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0;
  return (value - mean) / stdDev;
}

/**
 * 偏差値計算（日本の教育システムで使用）
 */
export function calculateDeviationValue(value: number, mean: number, stdDev: number): number {
  const zScore = calculateZScore(value, mean, stdDev);
  return 50 + 10 * zScore;
}

/**
 * パーセンタイル順位計算
 */
export function calculatePercentileRank(value: number, allValues: number[]): number {
  const belowCount = allValues.filter((v) => v < value).length;
  return (belowCount / allValues.length) * 100;
}

/**
 * 正規分布を仮定したパーセンタイル順位計算（効率的）
 * 大量のデータがある場合、全データを保持せずに平均と標準偏差から推定
 */
export function calculatePercentileRankFromStats(
  value: number,
  mean: number,
  stdDev: number
): number {
  if (stdDev === 0) return value >= mean ? 100 : 0;

  const zScore = calculateZScore(value, mean, stdDev);
  const percentile = 0.5 * (1 + erf(zScore / Math.sqrt(2)));
  return percentile * 100;
}

/**
 * Error function approximation (Abramowitz and Stegun method)
 * 正規分布の累積分布関数に使用
 */
function erf(x: number): number {
  const sign = x >= 0 ? 1 : -1;
  x = Math.abs(x);

  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return sign * y;
}

/**
 * Welfordのオンラインアルゴリズム（増分更新）
 * 大量データの平均・分散を効率的に計算
 *
 * 利点：
 * - メモリ使用量が一定（O(1)）
 * - 数値安定性が高い
 * - リアルタイム更新に適している
 */
export class OnlineStats {
  private count = 0;
  private mean = 0;
  private m2 = 0;

  update(value: number): void {
    this.count++;
    const delta = value - this.mean;
    this.mean += delta / this.count;
    const delta2 = value - this.mean;
    this.m2 += delta * delta2;
  }

  getMean(): number {
    return this.mean;
  }

  getVariance(): number {
    return this.count < 2 ? 0 : this.m2 / this.count;
  }

  getStdDev(): number {
    return Math.sqrt(this.getVariance());
  }

  getCount(): number {
    return this.count;
  }
}

/**
 * 成長率計算（パーセンテージ）
 */
export function calculateGrowthRate(oldValue: number, newValue: number): number {
  if (oldValue === 0) return newValue > 0 ? 100 : 0;
  return ((newValue - oldValue) / oldValue) * 100;
}

/**
 * 移動平均計算（Simple Moving Average）
 */
export function calculateMovingAverage(values: number[], windowSize: number): number[] {
  if (values.length < windowSize) {
    throw new Error('Not enough values for moving average');
  }

  const result: number[] = [];
  for (let i = 0; i <= values.length - windowSize; i++) {
    const window = values.slice(i, i + windowSize);
    const avg = window.reduce((sum, val) => sum + val, 0) / windowSize;
    result.push(avg);
  }
  return result;
}

/**
 * 相関係数計算（Pearson correlation coefficient）
 */
export function calculateCorrelation(xValues: number[], yValues: number[]): number {
  if (xValues.length !== yValues.length || xValues.length === 0) {
    throw new Error('Arrays must have the same non-zero length');
  }

  const n = xValues.length;
  const xMean = xValues.reduce((sum, val) => sum + val, 0) / n;
  const yMean = yValues.reduce((sum, val) => sum + val, 0) / n;

  let numerator = 0;
  let xDenominator = 0;
  let yDenominator = 0;

  for (let i = 0; i < n; i++) {
    const xDiff = xValues[i]! - xMean;
    const yDiff = yValues[i]! - yMean;
    numerator += xDiff * yDiff;
    xDenominator += xDiff * xDiff;
    yDenominator += yDiff * yDiff;
  }

  const denominator = Math.sqrt(xDenominator * yDenominator);
  return denominator === 0 ? 0 : numerator / denominator;
}
