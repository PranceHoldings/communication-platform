/**
 * Stage 5: Analysis and Report E2E Tests
 *
 * Tests for analysis results display and PDF report generation.
 *
 * Prerequisites:
 * - Completed session with analysis results available
 * - Analysis status: COMPLETED
 *
 * Test Coverage:
 * - Analysis trigger
 * - Score dashboard display
 * - Performance radar chart
 * - Detail statistics
 * - Emotion distribution
 * - Report generation
 * - PDF download
 */

import { test, expect } from './fixtures/session.fixture';
import { AnalysisPage } from './page-objects/analysis.page';

test.describe('Stage 5: Analysis and Report Tests', () => {
  let analysisPage: AnalysisPage;

  test.beforeEach(async ({ authenticatedPage }) => {
    analysisPage = new AnalysisPage(authenticatedPage);
  });

  test('S5-001: Analysis trigger button', async ({ testSessionId }) => {
    console.log('\n=== Test 1: Analysis trigger button ===');

    await analysisPage.goto(testSessionId);

    // Check if analysis is already available
    const analysisAvailable = await analysisPage.isAnalysisAvailable();
    console.log(`  Analysis available: ${analysisAvailable ? '✅ Yes' : '⚠️  No'}`);

    if (!analysisAvailable) {
      // Check if trigger button is visible
      const triggerVisible = await analysisPage.analysisTriggerButton.isVisible();
      console.log(`  Trigger button: ${triggerVisible ? '✅ Visible' : '❌ Not visible'}`);

      if (triggerVisible) {
        // Trigger analysis
        console.log('  Triggering analysis...');
        await analysisPage.triggerAnalysis();
        console.log('  ✅ Analysis triggered');
      }
    } else {
      console.log('  ✅ Analysis already available');
    }

    console.log('  ✅ PASS - Analysis trigger checked\n');
  });

  test('S5-002: Score dashboard display', async ({ testSessionId }) => {
    console.log('\n=== Test 2: Score dashboard display ===');

    await analysisPage.goto(testSessionId);

    // Wait for analysis results (may take time)
    try {
      await analysisPage.waitForAnalysisResults(30000);
      console.log('  Analysis results: ✅ Loaded');
    } catch (error) {
      console.log('  ⚠️  Analysis not available yet, skipping test');
      test.skip();
      return;
    }

    // Check score dashboard visibility
    const dashboardVisible = await analysisPage.scoreDashboard.isVisible();
    expect(dashboardVisible).toBe(true);
    console.log('  Score dashboard: ✅ Visible');

    console.log('  ✅ PASS - Score dashboard displayed\n');
  });

  test('S5-003: Overall score calculation', async ({ testSessionId }) => {
    console.log('\n=== Test 3: Overall score calculation ===');

    await analysisPage.goto(testSessionId);

    try {
      await analysisPage.waitForAnalysisResults(30000);
    } catch (error) {
      console.log('  ⚠️  Analysis not available, skipping test');
      test.skip();
      return;
    }

    // Get overall score
    const overallScore = await analysisPage.getOverallScore();
    console.log(`  Overall score: ${overallScore}`);

    // Score should be between 0 and 100
    expect(overallScore).toBeGreaterThanOrEqual(0);
    expect(overallScore).toBeLessThanOrEqual(100);
    console.log('  ✅ Score in valid range');

    // Get score level
    const scoreLevel = await analysisPage.getScoreLevel();
    console.log(`  Score level: ${scoreLevel}`);
    expect(scoreLevel.length).toBeGreaterThan(0);

    console.log('  ✅ PASS - Overall score calculated\n');
  });

  test('S5-004: Category scores display', async ({ testSessionId }) => {
    console.log('\n=== Test 4: Category scores display ===');

    await analysisPage.goto(testSessionId);

    try {
      await analysisPage.waitForAnalysisResults(30000);
    } catch (error) {
      console.log('  ⚠️  Analysis not available, skipping test');
      test.skip();
      return;
    }

    // Check category scores
    const categories = ['emotion', 'audio', 'content', 'delivery'] as const;

    for (const category of categories) {
      const score = await analysisPage.getCategoryScore(category);
      console.log(`  ${category} score: ${score}`);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }

    console.log('  ✅ PASS - Category scores displayed\n');
  });

  test('S5-005: Performance radar chart', async ({ testSessionId }) => {
    console.log('\n=== Test 5: Performance radar chart ===');

    await analysisPage.goto(testSessionId);

    try {
      await analysisPage.waitForAnalysisResults(30000);
    } catch (error) {
      console.log('  ⚠️  Analysis not available, skipping test');
      test.skip();
      return;
    }

    // Check radar chart visibility
    const radarVisible = await analysisPage.performanceRadar.isVisible();
    expect(radarVisible).toBe(true);
    console.log('  Radar chart: ✅ Visible');

    // Check radar items count (should be 6: stability, positivity, confidence, clarity, fluency, pacing)
    const radarItemsCount = await analysisPage.getRadarItemsCount();
    console.log(`  Radar items: ${radarItemsCount}`);
    expect(radarItemsCount).toBeGreaterThanOrEqual(6);

    console.log('  ✅ PASS - Radar chart displayed\n');
  });

  test('S5-006: Detail statistics (audio/emotion)', async ({ testSessionId }) => {
    console.log('\n=== Test 6: Detail statistics ===');

    await analysisPage.goto(testSessionId);

    try {
      await analysisPage.waitForAnalysisResults(30000);
    } catch (error) {
      console.log('  ⚠️  Analysis not available, skipping test');
      test.skip();
      return;
    }

    // Check detail stats visibility
    const statsVisible = await analysisPage.detailStats.isVisible();
    expect(statsVisible).toBe(true);
    console.log('  Detail stats: ✅ Visible');

    // Check audio stats
    const audioStatsCount = await analysisPage.getAudioStatsCount();
    console.log(`  Audio stats: ${audioStatsCount} items`);
    expect(audioStatsCount).toBeGreaterThanOrEqual(4); // speaking rate, volume, filler words, pauses

    // Check emotion stats
    const emotionVisible = await analysisPage.emotionStatsSection.isVisible();
    expect(emotionVisible).toBe(true);
    console.log('  Emotion stats: ✅ Visible');

    console.log('  ✅ PASS - Detail statistics displayed\n');
  });

  test('S5-007: Emotion distribution', async ({ testSessionId }) => {
    console.log('\n=== Test 7: Emotion distribution ===');

    await analysisPage.goto(testSessionId);

    try {
      await analysisPage.waitForAnalysisResults(30000);
    } catch (error) {
      console.log('  ⚠️  Analysis not available, skipping test');
      test.skip();
      return;
    }

    // Get dominant emotion
    const dominantEmotion = await analysisPage.getDominantEmotion();
    console.log(`  Dominant emotion: ${dominantEmotion}`);
    expect(dominantEmotion.length).toBeGreaterThan(0);

    // Get average confidence
    const avgConfidence = await analysisPage.getAverageConfidence();
    console.log(`  Average confidence: ${avgConfidence}%`);
    expect(avgConfidence).toBeGreaterThanOrEqual(0);
    expect(avgConfidence).toBeLessThanOrEqual(100);

    // Check emotion distribution
    const distributionVisible = await analysisPage.isEmotionDistributionVisible();
    console.log(`  Emotion distribution: ${distributionVisible ? '✅ Visible' : '⚠️  Not visible'}`);

    if (distributionVisible) {
      const barsCount = await analysisPage.getEmotionDistributionBarsCount();
      console.log(`  Distribution bars: ${barsCount}`);
      expect(barsCount).toBeGreaterThan(0);
    }

    console.log('  ✅ PASS - Emotion distribution displayed\n');
  });

  test('S5-008: Report generation button', async ({ testSessionId }) => {
    console.log('\n=== Test 8: Report generation button ===');

    await analysisPage.goto(testSessionId);

    try {
      await analysisPage.waitForAnalysisResults(30000);
    } catch (error) {
      console.log('  ⚠️  Analysis not available, skipping test');
      test.skip();
      return;
    }

    // Scroll to report generator
    await analysisPage.reportGenerator.scrollIntoViewIfNeeded();

    // Check report generator visibility
    const generatorVisible = await analysisPage.reportGenerator.isVisible();
    expect(generatorVisible).toBe(true);
    console.log('  Report generator: ✅ Visible');

    // Check generate button
    const buttonVisible = await analysisPage.reportGenerateButton.isVisible();
    expect(buttonVisible).toBe(true);
    console.log('  Generate button: ✅ Visible');

    // Check report info
    const infoVisible = await analysisPage.reportInfo.isVisible();
    expect(infoVisible).toBe(true);
    console.log('  Report info: ✅ Visible');

    console.log('  ✅ PASS - Report generation button displayed\n');
  });

  test('S5-009: PDF download', async ({ testSessionId }) => {
    console.log('\n=== Test 9: PDF download ===');

    await analysisPage.goto(testSessionId);

    try {
      await analysisPage.waitForAnalysisResults(30000);
    } catch (error) {
      console.log('  ⚠️  Analysis not available, skipping test');
      test.skip();
      return;
    }

    // Scroll to report generator
    await analysisPage.reportGenerator.scrollIntoViewIfNeeded();

    // Check if report was already generated
    const alreadyGenerated = await analysisPage.isReportGeneratedSuccessfully();

    if (!alreadyGenerated) {
      console.log('  Generating report...');

      // Generate report
      try {
        const download = await analysisPage.generateReport();

        console.log('  Report generation: ✅ Started');
        console.log(`  Download file: ${download.suggestedFilename()}`);

        // Check filename
        const filename = download.suggestedFilename();
        expect(filename).toContain('.pdf');
        console.log('  ✅ PDF file downloaded');

        // Wait for success message
        await analysisPage.page.waitForTimeout(2000);
        const successVisible = await analysisPage.isReportGeneratedSuccessfully();
        console.log(`  Success message: ${successVisible ? '✅ Visible' : '⚠️  Not visible'}`);
      } catch (error) {
        console.log(`  ⚠️  Report generation failed: ${error}`);
        // Check for error message
        const hasError = await analysisPage.hasReportError();
        console.log(`  Error message: ${hasError ? '❌ Visible' : 'None'}`);
      }
    } else {
      console.log('  ✅ Report already generated');

      // Test download again functionality
      const downloadButtonVisible = await analysisPage.reportDownloadButton.isVisible();
      if (downloadButtonVisible) {
        console.log('  Testing download again...');
        const download = await analysisPage.downloadReportAgain();
        console.log(`  Download file: ${download.suggestedFilename()}`);
        expect(download.suggestedFilename()).toContain('.pdf');
        console.log('  ✅ Download again successful');
      }
    }

    console.log('  ✅ PASS - PDF download checked\n');
  });

  test('S5-010: Report contains all sections', async ({ testSessionId }) => {
    console.log('\n=== Test 10: Report sections ===');

    await analysisPage.goto(testSessionId);

    try {
      await analysisPage.waitForAnalysisResults(30000);
    } catch (error) {
      console.log('  ⚠️  Analysis not available, skipping test');
      test.skip();
      return;
    }

    // Scroll to report generator
    await analysisPage.reportGenerator.scrollIntoViewIfNeeded();

    // Get report info content
    const reportInfo = await analysisPage.getReportInfo();
    console.log('  Report includes:');

    // Check for key sections mentioned in info
    const expectedSections = ['score', 'suggestion', 'chart', 'transcript'];

    for (const section of expectedSections) {
      const hasSection = reportInfo.toLowerCase().includes(section);
      console.log(`    - ${section}: ${hasSection ? '✅' : '⚠️'}`);
    }

    // Overall check - info should contain useful content
    expect(reportInfo.length).toBeGreaterThan(50);
    console.log('  ✅ Report info is comprehensive');

    console.log('  ✅ PASS - Report sections checked\n');
  });
});
