/**
 * Report Footer Component
 */

import { View, Text } from '@react-pdf/renderer';
import { styles } from '../styles';

interface FooterProps {
  pageNumber: number;
  totalPages: number;
}

export function Footer({ pageNumber, totalPages }: FooterProps) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>
        Prance Communication Platform - セッションレポート
      </Text>
      <Text style={styles.pageNumber}>
        {pageNumber} / {totalPages}
      </Text>
    </View>
  );
}
