import {
  calculateGroupStats,
  calculateZScore,
  calculateDeviationValue,
  calculatePercentileRank,
  calculatePercentileRankFromStats,
  OnlineStats,
  calculateGrowthRate,
  calculateMovingAverage,
  calculateCorrelation,
} from '../statistics';

describe('Statistics Utils', () => {
  describe('calculateGroupStats', () => {
    it('calculates correct stats for sample data', () => {
      const values = [60, 70, 75, 80, 85, 90, 95];
      const stats = calculateGroupStats(values);

      expect(stats.mean).toBeCloseTo(79.29, 2);
      expect(stats.median).toBe(80);
      expect(stats.min).toBe(60);
      expect(stats.max).toBe(95);
      expect(stats.sampleSize).toBe(7);
      expect(stats.stdDev).toBeGreaterThan(0);
    });

    it('handles single value', () => {
      const values = [50];
      const stats = calculateGroupStats(values);

      expect(stats.mean).toBe(50);
      expect(stats.median).toBe(50);
      expect(stats.min).toBe(50);
      expect(stats.max).toBe(50);
      expect(stats.stdDev).toBe(0);
      expect(stats.sampleSize).toBe(1);
    });

    it('handles even number of values (median)', () => {
      const values = [10, 20, 30, 40];
      const stats = calculateGroupStats(values);

      expect(stats.median).toBe(25); // Average of 20 and 30
    });

    it('throws error for empty array', () => {
      expect(() => calculateGroupStats([])).toThrow('Cannot calculate stats for empty array');
    });

    it('calculates quartiles correctly', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const stats = calculateGroupStats(values);

      expect(stats.p25).toBeCloseTo(3.25, 1);
      expect(stats.p75).toBeCloseTo(7.75, 1);
    });
  });

  describe('calculateZScore', () => {
    it('calculates z-score correctly', () => {
      const zScore = calculateZScore(85, 75, 10);
      expect(zScore).toBe(1.0);
    });

    it('handles negative z-score', () => {
      const zScore = calculateZScore(65, 75, 10);
      expect(zScore).toBe(-1.0);
    });

    it('returns 0 when stdDev is 0', () => {
      const zScore = calculateZScore(50, 50, 0);
      expect(zScore).toBe(0);
    });

    it('handles zero mean', () => {
      const zScore = calculateZScore(10, 0, 5);
      expect(zScore).toBe(2.0);
    });
  });

  describe('calculateDeviationValue', () => {
    it('calculates deviation value correctly', () => {
      const devValue = calculateDeviationValue(85, 75, 10);
      expect(devValue).toBe(60); // 50 + 10 * 1.0
    });

    it('returns 50 for mean value', () => {
      const devValue = calculateDeviationValue(75, 75, 10);
      expect(devValue).toBe(50);
    });

    it('returns below 50 for below-average value', () => {
      const devValue = calculateDeviationValue(65, 75, 10);
      expect(devValue).toBe(40);
    });

    it('handles stdDev of 0', () => {
      const devValue = calculateDeviationValue(50, 50, 0);
      expect(devValue).toBe(50); // z-score is 0
    });
  });

  describe('calculatePercentileRank', () => {
    it('calculates percentile rank correctly', () => {
      const allValues = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      const rank = calculatePercentileRank(55, allValues);

      expect(rank).toBe(50); // 5 values below 55 out of 10 total
    });

    it('returns 0 for minimum value', () => {
      const allValues = [10, 20, 30, 40, 50];
      const rank = calculatePercentileRank(10, allValues);

      expect(rank).toBe(0);
    });

    it('returns 100 for maximum value', () => {
      const allValues = [10, 20, 30, 40, 50];
      const rank = calculatePercentileRank(51, allValues);

      expect(rank).toBe(100);
    });
  });

  describe('calculatePercentileRankFromStats', () => {
    it('approximates percentile rank from stats', () => {
      // 正規分布を仮定: mean=75, stdDev=10
      const rank = calculatePercentileRankFromStats(85, 75, 10);

      // z-score = 1.0 → 約84%ile
      expect(rank).toBeGreaterThan(80);
      expect(rank).toBeLessThan(90);
    });

    it('returns 50 for mean value', () => {
      const rank = calculatePercentileRankFromStats(75, 75, 10);
      expect(rank).toBeCloseTo(50, 0);
    });

    it('handles stdDev of 0', () => {
      const rankAbove = calculatePercentileRankFromStats(60, 50, 0);
      const rankEqual = calculatePercentileRankFromStats(50, 50, 0);
      const rankBelow = calculatePercentileRankFromStats(40, 50, 0);

      expect(rankAbove).toBe(100);
      expect(rankEqual).toBeGreaterThanOrEqual(0);
      expect(rankBelow).toBe(0);
    });
  });

  describe('OnlineStats', () => {
    it('calculates mean correctly with incremental updates', () => {
      const stats = new OnlineStats();

      stats.update(10);
      expect(stats.getMean()).toBe(10);

      stats.update(20);
      expect(stats.getMean()).toBe(15);

      stats.update(30);
      expect(stats.getMean()).toBe(20);
    });

    it('calculates variance and stdDev correctly', () => {
      const stats = new OnlineStats();

      [10, 20, 30, 40, 50].forEach((val) => stats.update(val));

      expect(stats.getMean()).toBe(30);
      expect(stats.getVariance()).toBeCloseTo(200, 0); // Population variance
      expect(stats.getStdDev()).toBeCloseTo(14.14, 1);
    });

    it('returns 0 variance for single value', () => {
      const stats = new OnlineStats();
      stats.update(50);

      expect(stats.getVariance()).toBe(0);
      expect(stats.getStdDev()).toBe(0);
    });

    it('tracks count correctly', () => {
      const stats = new OnlineStats();

      expect(stats.getCount()).toBe(0);
      stats.update(10);
      expect(stats.getCount()).toBe(1);
      stats.update(20);
      expect(stats.getCount()).toBe(2);
    });
  });

  describe('calculateGrowthRate', () => {
    it('calculates positive growth rate', () => {
      const rate = calculateGrowthRate(50, 75);
      expect(rate).toBe(50); // 50% increase
    });

    it('calculates negative growth rate', () => {
      const rate = calculateGrowthRate(100, 80);
      expect(rate).toBe(-20); // 20% decrease
    });

    it('handles zero old value', () => {
      const rate = calculateGrowthRate(0, 50);
      expect(rate).toBe(100);
    });

    it('returns 0 for no change', () => {
      const rate = calculateGrowthRate(50, 50);
      expect(rate).toBe(0);
    });
  });

  describe('calculateMovingAverage', () => {
    it('calculates 3-period moving average', () => {
      const values = [10, 20, 30, 40, 50];
      const ma = calculateMovingAverage(values, 3);

      expect(ma).toEqual([20, 30, 40]); // [avg(10,20,30), avg(20,30,40), avg(30,40,50)]
    });

    it('throws error for insufficient values', () => {
      const values = [10, 20];
      expect(() => calculateMovingAverage(values, 3)).toThrow('Not enough values for moving average');
    });

    it('handles window size equal to array length', () => {
      const values = [10, 20, 30];
      const ma = calculateMovingAverage(values, 3);

      expect(ma).toEqual([20]);
    });
  });

  describe('calculateCorrelation', () => {
    it('calculates perfect positive correlation', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 6, 8, 10]; // y = 2x

      const corr = calculateCorrelation(x, y);
      expect(corr).toBeCloseTo(1.0, 5);
    });

    it('calculates perfect negative correlation', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [10, 8, 6, 4, 2]; // y = -2x + 12

      const corr = calculateCorrelation(x, y);
      expect(corr).toBeCloseTo(-1.0, 5);
    });

    it('calculates no correlation', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [5, 5, 5, 5, 5]; // constant

      const corr = calculateCorrelation(x, y);
      expect(corr).toBe(0);
    });

    it('throws error for mismatched array lengths', () => {
      const x = [1, 2, 3];
      const y = [1, 2];

      expect(() => calculateCorrelation(x, y)).toThrow('Arrays must have the same non-zero length');
    });

    it('throws error for empty arrays', () => {
      expect(() => calculateCorrelation([], [])).toThrow('Arrays must have the same non-zero length');
    });
  });
});
