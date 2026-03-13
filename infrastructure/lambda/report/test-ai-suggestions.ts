/**
 * Test AI Suggestions Generation
 *
 * Simple script to test AI improvement suggestions generation
 * Usage: npx ts-node test-ai-suggestions.ts
 */

import { generateAISuggestions } from './ai-suggestions';
import { sampleReportData } from './test-data';

async function main() {
  console.log('[Test] Starting AI suggestions generation test...');

  try {
    // Generate AI suggestions
    console.log('[Test] Generating AI suggestions with sample data...');
    const suggestions = await generateAISuggestions(sampleReportData);

    console.log('[Test] ✅ AI suggestions generated successfully!');
    console.log('[Test] Number of suggestions:', suggestions.length);
    console.log('\n[Test] Generated suggestions:\n');
    suggestions.forEach((suggestion, index) => {
      console.log(`${index + 1}. ${suggestion}`);
    });
  } catch (error) {
    console.error('[Test] ❌ AI suggestions generation failed:', error);
    process.exit(1);
  }
}

main();
