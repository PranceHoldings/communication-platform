/**
 * Analysis Page Object Model
 *
 * Encapsulates selectors and actions for Analysis and Report components.
 */

import { Page, Locator } from '@playwright/test';

export class AnalysisPage {
  readonly page: Page;

  // Score Dashboard
  readonly scoreDashboard: Locator;
  readonly overallScore: Locator;
  readonly scoreLevel: Locator;
  readonly categoryScores: Locator;
  readonly strengthsSection: Locator;
  readonly improvementsSection: Locator;

  // Performance Radar
  readonly performanceRadar: Locator;
  readonly radarChart: Locator;
  readonly radarLegend: Locator;
  readonly radarItems: Locator;

  // Detail Stats
  readonly detailStats: Locator;
  readonly audioStatsSection: Locator;
  readonly audioStats: Locator;
  readonly emotionStatsSection: Locator;
  readonly dominantEmotion: Locator;
  readonly averageConfidence: Locator;
  readonly emotionDistribution: Locator;

  // Report Generator
  readonly reportGenerator: Locator;
  readonly reportGenerateButton: Locator;
  readonly reportDownloadButton: Locator;
  readonly reportSuccessMessage: Locator;
  readonly reportErrorMessage: Locator;
  readonly reportInfo: Locator;

  // Analysis Trigger (on session detail page)
  readonly analysisTriggerButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Score Dashboard
    this.scoreDashboard = page.locator('[data-testid="score-dashboard"]');
    this.overallScore = page.locator('[data-testid="overall-score"]');
    this.scoreLevel = page.locator('[data-testid="score-level"]');
    this.categoryScores = page.locator('[data-testid="category-scores"]');
    this.strengthsSection = page.locator('[data-testid="strengths-section"]');
    this.improvementsSection = page.locator('[data-testid="improvements-section"]');

    // Performance Radar
    this.performanceRadar = page.locator('[data-testid="performance-radar"]');
    this.radarChart = page.locator('[data-testid="radar-chart"]');
    this.radarLegend = page.locator('[data-testid="radar-legend"]');
    this.radarItems = page.locator('[data-testid^="radar-item-"]');

    // Detail Stats
    this.detailStats = page.locator('[data-testid="detail-stats"]');
    this.audioStatsSection = page.locator('[data-testid="audio-stats-section"]');
    this.audioStats = page.locator('[data-testid^="audio-stat-"]');
    this.emotionStatsSection = page.locator('[data-testid="emotion-stats-section"]');
    this.dominantEmotion = page.locator('[data-testid="dominant-emotion"]');
    this.averageConfidence = page.locator('[data-testid="average-confidence"]');
    this.emotionDistribution = page.locator('[data-testid="emotion-distribution"]');

    // Report Generator
    this.reportGenerator = page.locator('[data-testid="report-generator"]');
    this.reportGenerateButton = page.locator('[data-testid="report-generate-button"]');
    this.reportDownloadButton = page.locator('[data-testid="report-download-button"]');
    this.reportSuccessMessage = page.locator('[data-testid="report-success-message"]');
    this.reportErrorMessage = page.locator('[data-testid="report-error-message"]');
    this.reportInfo = page.locator('[data-testid="report-info"]');

    // Analysis Trigger
    this.analysisTriggerButton = page.locator('[data-testid="analysis-trigger-button"]');
  }

  /**
   * Navigate to session detail page
   */
  async goto(sessionId: string) {
    await this.page.goto(`/dashboard/sessions/${sessionId}`);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Trigger analysis for session
   */
  async triggerAnalysis() {
    await this.analysisTriggerButton.click();
    // Wait for analysis to start
    await this.page.waitForTimeout(2000);
  }

  /**
   * Wait for analysis results to be visible
   */
  async waitForAnalysisResults(timeout: number = 30000) {
    await this.scoreDashboard.waitFor({ state: 'visible', timeout });
  }

  /**
   * Check if analysis is available
   */
  async isAnalysisAvailable(): Promise<boolean> {
    return await this.scoreDashboard.isVisible();
  }

  /**
   * Get overall score value
   */
  async getOverallScore(): Promise<number> {
    const text = await this.overallScore.textContent();
    return parseInt(text || '0', 10);
  }

  /**
   * Get score level text
   */
  async getScoreLevel(): Promise<string> {
    return await this.scoreLevel.textContent() || '';
  }

  /**
   * Get category score by index
   */
  async getCategoryScore(category: 'emotion' | 'audio' | 'content' | 'delivery'): Promise<number> {
    const categoryElement = this.page.locator(`[data-testid="category-score-${category}"]`);
    const text = await categoryElement.textContent();
    // Extract number from text
    const match = text?.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  }

  /**
   * Get strengths count
   */
  async getStrengthsCount(): Promise<number> {
    const items = this.strengthsSection.locator('[data-testid^="strength-"]');
    return await items.count();
  }

  /**
   * Get improvements count
   */
  async getImprovementsCount(): Promise<number> {
    const items = this.improvementsSection.locator('[data-testid^="improvement-"]');
    return await items.count();
  }

  /**
   * Get radar items count
   */
  async getRadarItemsCount(): Promise<number> {
    return await this.radarItems.count();
  }

  /**
   * Get audio stats count
   */
  async getAudioStatsCount(): Promise<number> {
    return await this.audioStats.count();
  }

  /**
   * Get dominant emotion text
   */
  async getDominantEmotion(): Promise<string> {
    const text = await this.dominantEmotion.textContent();
    // Extract emotion name (capitalize first letter)
    const match = text?.match(/[A-Z][a-z]+/);
    return match ? match[0] : '';
  }

  /**
   * Get average confidence value
   */
  async getAverageConfidence(): Promise<number> {
    const text = await this.averageConfidence.textContent();
    const match = text?.match(/(\d+)%/);
    return match ? parseInt(match[1]!, 10) : 0;
  }

  /**
   * Check if emotion distribution is visible
   */
  async isEmotionDistributionVisible(): Promise<boolean> {
    return await this.emotionDistribution.isVisible();
  }

  /**
   * Get emotion distribution bars count
   */
  async getEmotionDistributionBarsCount(): Promise<number> {
    const bars = this.emotionDistribution.locator('[data-testid^="emotion-bar-"]');
    return await bars.count();
  }

  /**
   * Generate report
   */
  async generateReport() {
    // Get download promise before clicking
    const downloadPromise = this.page.waitForEvent('download', { timeout: 60000 });

    await this.reportGenerateButton.click();

    // Wait for download to start
    const download = await downloadPromise;

    return download;
  }

  /**
   * Check if report generation is in progress
   */
  async isReportGenerating(): Promise<boolean> {
    const buttonText = await this.reportGenerateButton.textContent();
    return buttonText?.includes('Generating') || buttonText?.includes('生成中') || false;
  }

  /**
   * Check if report was generated successfully
   */
  async isReportGeneratedSuccessfully(): Promise<boolean> {
    return await this.reportSuccessMessage.isVisible();
  }

  /**
   * Check if report generation failed
   */
  async hasReportError(): Promise<boolean> {
    return await this.reportErrorMessage.isVisible();
  }

  /**
   * Download report again (after generation)
   */
  async downloadReportAgain() {
    const downloadPromise = this.page.waitForEvent('download', { timeout: 30000 });

    await this.reportDownloadButton.click();

    const download = await downloadPromise;
    return download;
  }

  /**
   * Get report info content
   */
  async getReportInfo(): Promise<string> {
    return await this.reportInfo.textContent() || '';
  }
}
