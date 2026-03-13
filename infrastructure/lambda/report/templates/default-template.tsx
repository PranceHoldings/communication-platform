/**
 * Default Report Template
 *
 * Main PDF report template with 4 pages:
 * 1. Summary (overall score, session info)
 * 2. Score Details (radar chart, category scores)
 * 3. Strengths & Improvements (AI-generated)
 * 4. Transcript
 */

import { Document, Page, View, Text, Image } from '@react-pdf/renderer';
import { styles, colors } from './styles';
import {
  Header,
  ScoreCircle,
  ScoreBar,
  TranscriptSection,
  Footer,
} from './components';
import { ReportData } from '../types';

interface DefaultTemplateProps {
  data: ReportData;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}時間${mins}分${secs}秒`;
  } else if (mins > 0) {
    return `${mins}分${secs}秒`;
  } else {
    return `${secs}秒`;
  }
}

export function DefaultReportTemplate({ data }: DefaultTemplateProps) {
  return (
    <Document>
      {/* Page 1: Summary */}
      <Page size="A4" style={styles.page}>
        <Header
          title="セッションレポート"
          subtitle={data.session.scenario.title}
          date={formatDate(data.session.startedAt)}
          generatedAt={formatDate(new Date())}
        />

        {/* Overall Score Circle */}
        <ScoreCircle score={data.score.overall} />

        {/* Session Info Grid */}
        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>ユーザー</Text>
            <Text style={styles.infoValue}>{data.session.user.name}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>シナリオ</Text>
            <Text style={styles.infoValue}>{data.session.scenario.title}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>所要時間</Text>
            <Text style={styles.infoValue}>{formatDuration(data.session.duration)}</Text>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>カテゴリ別スコア</Text>
          <View style={styles.categoryScoreGrid}>
            <View style={styles.categoryScoreItem}>
              <Text style={styles.categoryScoreLabel}>感情</Text>
              <Text style={styles.categoryScoreValue}>{Math.round(data.score.emotion)}</Text>
            </View>
            <View style={styles.categoryScoreItem}>
              <Text style={styles.categoryScoreLabel}>音声</Text>
              <Text style={styles.categoryScoreValue}>{Math.round(data.score.audio)}</Text>
            </View>
            <View style={styles.categoryScoreItem}>
              <Text style={styles.categoryScoreLabel}>内容</Text>
              <Text style={styles.categoryScoreValue}>{Math.round(data.score.content)}</Text>
            </View>
            <View style={styles.categoryScoreItem}>
              <Text style={styles.categoryScoreLabel}>表現</Text>
              <Text style={styles.categoryScoreValue}>{Math.round(data.score.delivery)}</Text>
            </View>
          </View>
        </View>

        <Footer pageNumber={1} totalPages={4} />
      </Page>

      {/* Page 2: Score Details */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>スコア詳細分析</Text>

        {/* Radar Chart */}
        {data.chartUrls.radarChart && (
          <View style={styles.section}>
            <Image src={data.chartUrls.radarChart} style={styles.chartImage} />
          </View>
        )}

        {/* Category Score Bars */}
        <View style={styles.section}>
          <Text style={styles.subsectionTitle}>カテゴリ別評価</Text>
          <ScoreBar label="感情 - 表情・感情表現" score={data.score.emotion} color={colors.primary} />
          <ScoreBar label="音声 - 話し方・発声" score={data.score.audio} color={colors.secondary} />
          <ScoreBar label="内容 - 話の内容・論理性" score={data.score.content} color="#f59e0b" />
          <ScoreBar label="表現 - 表現力・説得力" score={data.score.delivery} color="#8b5cf6" />
        </View>

        {/* Detailed Scores */}
        {(data.score.emotionStability !== null ||
          data.score.clarity !== null ||
          data.score.relevance !== null) && (
          <View style={styles.section}>
            <Text style={styles.subsectionTitle}>詳細スコア</Text>
            <View style={styles.detailedScoresGrid}>
              {data.score.emotionStability !== null && (
                <View style={styles.detailedScoreRow}>
                  <Text style={styles.detailedScoreLabel}>感情の安定性</Text>
                  <Text style={styles.detailedScoreValue}>
                    {Math.round(data.score.emotionStability)}
                  </Text>
                </View>
              )}
              {data.score.emotionPositivity !== null && (
                <View style={styles.detailedScoreRow}>
                  <Text style={styles.detailedScoreLabel}>ポジティブ度</Text>
                  <Text style={styles.detailedScoreValue}>
                    {Math.round(data.score.emotionPositivity)}
                  </Text>
                </View>
              )}
              {data.score.confidence !== null && (
                <View style={styles.detailedScoreRow}>
                  <Text style={styles.detailedScoreLabel}>自信度</Text>
                  <Text style={styles.detailedScoreValue}>
                    {Math.round(data.score.confidence)}
                  </Text>
                </View>
              )}
              {data.score.clarity !== null && (
                <View style={styles.detailedScoreRow}>
                  <Text style={styles.detailedScoreLabel}>明瞭度</Text>
                  <Text style={styles.detailedScoreValue}>{Math.round(data.score.clarity)}</Text>
                </View>
              )}
              {data.score.fluency !== null && (
                <View style={styles.detailedScoreRow}>
                  <Text style={styles.detailedScoreLabel}>流暢さ</Text>
                  <Text style={styles.detailedScoreValue}>{Math.round(data.score.fluency)}</Text>
                </View>
              )}
              {data.score.pacing !== null && (
                <View style={styles.detailedScoreRow}>
                  <Text style={styles.detailedScoreLabel}>話すペース</Text>
                  <Text style={styles.detailedScoreValue}>{Math.round(data.score.pacing)}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        <Footer pageNumber={2} totalPages={4} />
      </Page>

      {/* Page 3: Strengths & Improvements */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>強みと改善点</Text>

        {/* Strengths */}
        <View style={styles.strengthsSection}>
          <Text style={styles.subsectionTitle}>✓ あなたの強み</Text>
          {data.score.strengths.length > 0 ? (
            data.score.strengths.map((strength, index) => (
              <View key={index} style={styles.bulletContainer}>
                <View style={[styles.bulletPoint, { backgroundColor: colors.success }]} />
                <Text style={styles.bulletText}>{strength}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.bulletText}>データ不足のため、強みを判定できませんでした。</Text>
          )}
        </View>

        {/* AI-Generated Improvements */}
        <View style={styles.improvementsSection}>
          <Text style={styles.subsectionTitle}>→ 改善提案（AI生成）</Text>
          {data.aiSuggestions.length > 0 ? (
            data.aiSuggestions.map((suggestion, index) => (
              <View key={index} style={styles.bulletContainer}>
                <View style={[styles.bulletPoint, { backgroundColor: colors.warning }]} />
                <Text style={styles.bulletText}>{suggestion}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.bulletText}>
              AI改善提案を生成できませんでした。セッションデータを確認してください。
            </Text>
          )}
        </View>

        {/* Timeline Chart (if available) */}
        {data.chartUrls.timelineChart && (
          <View style={styles.section}>
            <Text style={styles.subsectionTitle}>スコア推移</Text>
            <Image src={data.chartUrls.timelineChart} style={styles.chartImage} />
          </View>
        )}

        <Footer pageNumber={3} totalPages={4} />
      </Page>

      {/* Page 4: Transcript */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>会話記録</Text>

        {data.transcript.length > 0 ? (
          <TranscriptSection transcripts={data.transcript} maxItems={30} />
        ) : (
          <View style={{ padding: 40, textAlign: 'center' }}>
            <Text style={{ fontSize: 12, color: colors.text.secondary }}>
              会話記録がありません。
            </Text>
          </View>
        )}

        <Footer pageNumber={4} totalPages={4} />
      </Page>
    </Document>
  );
}
