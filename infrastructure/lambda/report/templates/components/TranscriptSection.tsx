/**
 * Transcript Section Component
 *
 * Displays conversation transcript
 */

import { View, Text } from '@react-pdf/renderer';
import { styles } from '../styles';

interface TranscriptItem {
  timestamp: number;
  speaker: 'USER' | 'ASSISTANT';
  text: string;
}

interface TranscriptSectionProps {
  transcripts: TranscriptItem[];
  maxItems?: number;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function TranscriptSection({ transcripts, maxItems = 20 }: TranscriptSectionProps) {
  const displayTranscripts = transcripts.slice(0, maxItems);

  return (
    <View>
      {displayTranscripts.map((item, index) => (
        <View key={index} style={styles.transcriptContainer}>
          <View style={styles.transcriptHeader}>
            <Text style={styles.transcriptSpeaker}>
              {item.speaker === 'USER' ? 'あなた' : 'AI'}
            </Text>
            <Text style={styles.transcriptTimestamp}>{formatTime(item.timestamp)}</Text>
          </View>
          <Text style={styles.transcriptText}>{item.text}</Text>
        </View>
      ))}
      {transcripts.length > maxItems && (
        <Text style={{ fontSize: 10, color: '#6b7280', marginTop: 8, textAlign: 'center' }}>
          ... 他 {transcripts.length - maxItems} 件の発言
        </Text>
      )}
    </View>
  );
}
