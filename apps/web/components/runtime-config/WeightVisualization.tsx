/**
 * Weight Visualization Component
 * Displays weight distribution as a progress bar with percentages
 */

import { getWeightGroup } from '@/lib/utils/runtime-config-validation';

interface WeightVisualizationProps {
  currentKey: string;
  newValue: number;
  allWeights: Record<string, any>;
}

export function WeightVisualization({
  currentKey,
  newValue,
  allWeights,
}: WeightVisualizationProps) {
  const weightGroup = getWeightGroup(currentKey);
  if (!weightGroup) return null;

  // Calculate weights with new value
  const weights: Record<string, number> = {};
  let sum = 0;

  weightGroup.forEach((key) => {
    const value = key === currentKey ? newValue : (allWeights[key] ?? 0);
    const numValue = typeof value === 'number' ? value : 0;
    weights[key] = numValue;
    sum += numValue;
  });

  // Calculate percentages
  const percentages: Record<string, number> = {};
  weightGroup.forEach((key) => {
    percentages[key] = sum > 0 ? ((weights[key] ?? 0) / sum) * 100 : 0;
  });

  // Color palette
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-purple-500',
  ];

  // Check if sum is valid
  const isValid = Math.abs(sum - 1.0) <= 0.001;
  const sumColor = isValid ? 'text-green-600' : 'text-red-600';

  return (
    <div className="space-y-3">
      {/* Sum indicator */}
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Total Sum:</span>
        <span className={`font-mono font-bold ${sumColor}`}>
          {sum.toFixed(4)} {isValid ? '✓' : '✗'}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-8 flex rounded-md overflow-hidden">
        {weightGroup.map((key, index) => {
          const percentage = percentages[key] ?? 0;
          if (percentage === 0) return null;

          return (
            <div
              key={key}
              className={`${colors[index % colors.length]} flex items-center justify-center text-xs text-white font-medium transition-all`}
              style={{ width: `${percentage}%` }}
              title={`${key}: ${(weights[key] ?? 0).toFixed(3)} (${percentage.toFixed(1)}%)`}
            >
              {percentage >= 10 && `${percentage.toFixed(0)}%`}
            </div>
          );
        })}
      </div>

      {/* Weight details */}
      <div className="grid grid-cols-2 gap-2 text-sm">
        {weightGroup.map((key, index) => (
          <div
            key={key}
            className={`flex items-center gap-2 p-2 rounded ${
              key === currentKey ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200' : ''
            }`}
          >
            <div className={`w-3 h-3 rounded ${colors[index % colors.length]}`} />
            <div className="flex-1 min-w-0">
              <div className="font-mono text-xs truncate">{key}</div>
              <div className="font-mono font-bold">
                {(weights[key] ?? 0).toFixed(3)} ({(percentages[key] ?? 0).toFixed(1)}%)
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Validation hint */}
      {!isValid && (
        <p className="text-xs text-red-600">
          Adjust weights so they sum to exactly 1.0
        </p>
      )}
    </div>
  );
}
