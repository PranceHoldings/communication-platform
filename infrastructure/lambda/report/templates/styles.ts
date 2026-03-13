/**
 * PDF Report Styles
 *
 * StyleSheet definitions for React-PDF templates
 */

import { StyleSheet, Font } from '@react-pdf/renderer';

// Register fonts (Note: In production, you'll need to provide font files)
// For now, we'll use the default fonts
// Font.register({
//   family: 'NotoSansJP',
//   src: '/path/to/NotoSansJP-Regular.ttf',
// });

export const colors = {
  primary: '#6366f1', // Indigo
  secondary: '#10b981', // Green
  text: {
    primary: '#111827',
    secondary: '#6b7280',
    muted: '#9ca3af',
  },
  background: {
    primary: '#ffffff',
    secondary: '#f9fafb',
    accent: '#eff6ff',
  },
  border: '#e5e7eb',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
};

export const styles = StyleSheet.create({
  // Page styles
  page: {
    flexDirection: 'column',
    backgroundColor: colors.background.primary,
    padding: 40,
    fontFamily: 'Helvetica',
  },

  // Header styles
  header: {
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  headerInfo: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 8,
  },

  // Section styles
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 12,
  },

  // Score circle (overall score)
  scoreCircleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 24,
  },
  scoreCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.background.accent,
    borderWidth: 8,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: colors.primary,
  },
  scoreLabel: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 8,
  },

  // Info grid
  infoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    padding: 16,
    backgroundColor: colors.background.secondary,
    borderRadius: 8,
  },
  infoItem: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 10,
    color: colors.text.muted,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: 12,
    color: colors.text.primary,
    fontWeight: 'bold',
  },

  // Score bar
  scoreBarContainer: {
    marginBottom: 16,
  },
  scoreBarLabel: {
    fontSize: 12,
    color: colors.text.primary,
    marginBottom: 6,
    fontWeight: 'bold',
  },
  scoreBarBackground: {
    height: 24,
    backgroundColor: colors.background.secondary,
    borderRadius: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: 24,
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  scoreBarValue: {
    position: 'absolute',
    right: 8,
    top: 4,
    fontSize: 11,
    color: colors.text.primary,
    fontWeight: 'bold',
  },

  // Chart image
  chartImage: {
    width: '100%',
    height: 300,
    marginVertical: 16,
    objectFit: 'contain',
  },

  // Bullet points
  bulletContainer: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingLeft: 8,
  },
  bulletPoint: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 6,
    marginRight: 8,
  },
  bulletText: {
    flex: 1,
    fontSize: 11,
    color: colors.text.primary,
    lineHeight: 1.5,
  },

  // Strengths and improvements
  strengthsSection: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: colors.background.accent,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
  },
  improvementsSection: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
  },

  // Transcript
  transcriptContainer: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: colors.background.secondary,
    borderRadius: 6,
  },
  transcriptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  transcriptSpeaker: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.primary,
  },
  transcriptTimestamp: {
    fontSize: 9,
    color: colors.text.muted,
  },
  transcriptText: {
    fontSize: 10,
    color: colors.text.primary,
    lineHeight: 1.6,
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerText: {
    fontSize: 9,
    color: colors.text.muted,
  },
  pageNumber: {
    fontSize: 9,
    color: colors.text.muted,
  },

  // Category score grid
  categoryScoreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  categoryScoreItem: {
    width: '48%',
    marginBottom: 16,
    padding: 12,
    backgroundColor: colors.background.secondary,
    borderRadius: 6,
  },
  categoryScoreLabel: {
    fontSize: 11,
    color: colors.text.secondary,
    marginBottom: 6,
  },
  categoryScoreValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
  },

  // Detailed scores
  detailedScoresGrid: {
    marginTop: 16,
  },
  detailedScoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailedScoreLabel: {
    fontSize: 10,
    color: colors.text.primary,
  },
  detailedScoreValue: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.primary,
  },
});
