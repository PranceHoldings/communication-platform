/**
 * Score Circle Component
 *
 * Displays the overall score in a large circle
 */

import { View, Text } from '@react-pdf/renderer';
import { styles } from '../styles';

interface ScoreCircleProps {
  score: number;
  label?: string;
}

export function ScoreCircle({ score, label = '総合スコア' }: ScoreCircleProps) {
  return (
    <View style={styles.scoreCircleContainer}>
      <View style={styles.scoreCircle}>
        <Text style={styles.scoreValue}>{Math.round(score)}</Text>
      </View>
      <Text style={styles.scoreLabel}>{label}</Text>
    </View>
  );
}
