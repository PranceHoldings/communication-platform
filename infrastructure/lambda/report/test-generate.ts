/**
 * Test PDF Generation
 *
 * Simple script to test PDF generation locally
 * Usage: npx ts-node test-generate.ts
 */

import { writeFileSync } from 'fs';
import { join } from 'path';
import { generateReport } from './generator';
import { sampleReportData } from './test-data';

async function main() {
  console.log('[Test] Starting PDF generation test...');

  try {
    // Generate PDF
    console.log('[Test] Generating PDF with sample data...');
    const pdfBuffer = await generateReport(sampleReportData);

    // Save to file
    const outputPath = join(__dirname, 'test-output.pdf');
    writeFileSync(outputPath, pdfBuffer);

    console.log('[Test] ✅ PDF generated successfully!');
    console.log('[Test] Output file:', outputPath);
    console.log('[Test] File size:', pdfBuffer.length, 'bytes');
  } catch (error) {
    console.error('[Test] ❌ PDF generation failed:', error);
    process.exit(1);
  }
}

main();
