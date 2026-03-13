/**
 * Report Header Component
 */

import { View, Text } from '@react-pdf/renderer';
import { styles } from '../styles';

interface HeaderProps {
  title: string;
  subtitle: string;
  date: string;
  generatedAt: string;
}

export function Header({ title, subtitle, date, generatedAt }: HeaderProps) {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>セッションレポート</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <View style={styles.headerInfo}>
        <Text>セッション日時: {date}</Text>
        <Text>レポート生成: {generatedAt}</Text>
      </View>
    </View>
  );
}
