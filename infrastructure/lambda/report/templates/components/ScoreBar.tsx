/**
 * Score Bar Component
 *
 * Horizontal bar showing score from 0-100
 */

import { View, Text } from '@react-pdf/renderer';
import { styles } from '../styles';

interface ScoreBarProps {
  label: string;
  score: number;
  color?: string;
}

export function ScoreBar({ label, score, color = '#6366f1' }: ScoreBarProps) {
  const percentage = Math.max(0, Math.min(100, score));

  return (
    <View style={styles.scoreBarContainer}>
      <Text style={styles.scoreBarLabel}>{label}</Text>
      <View style={styles.scoreBarBackground}>
        <View
          style={[
            styles.scoreBarFill,
            {
              width: `${percentage}%`,
              backgroundColor: color,
            },
          ]}
        />
        <Text style={styles.scoreBarValue}>{Math.round(score)}</Text>
      </View>
    </View>
  );
}
