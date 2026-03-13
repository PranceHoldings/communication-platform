/**
 * Maintenance Lambda: Populate Scenario Default Values
 *
 * This one-time Lambda function populates silence management default values
 * for existing scenarios that have NULL values due to migration timing.
 *
 * Problem: Week 1 migration added columns with DEFAULT constraints, but
 * PostgreSQL only applies defaults to NEW rows, not existing rows.
 *
 * Trigger: Manual invocation via AWS Lambda Console or CLI:
 *   aws lambda invoke --function-name prance-populate-scenario-defaults-dev \
 *     --payload '{}' /tmp/result.json && cat /tmp/result.json
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Default values from schema
const DEFAULTS = {
  silenceTimeout: 10,
  enableSilencePrompt: true,
  showSilenceTimer: false,
  silenceThreshold: 0.05,
  minSilenceDuration: 500,
};

interface LambdaResponse {
  statusCode: number;
  body: string;
}

export const handler = async (): Promise<LambdaResponse> => {
  console.log('[populate-defaults] Starting maintenance task...');

  try {
    // Find all scenarios with NULL silence management fields
    const scenariosWithNulls = await prisma.scenario.findMany({
      where: {
        OR: [
          { silenceTimeout: null },
          { enableSilencePrompt: null },
          { showSilenceTimer: null },
          { silenceThreshold: null },
          { minSilenceDuration: null },
        ],
      },
      select: {
        id: true,
        title: true,
        silenceTimeout: true,
        enableSilencePrompt: true,
        showSilenceTimer: true,
        silenceThreshold: true,
        minSilenceDuration: true,
      },
    });

    if (scenariosWithNulls.length === 0) {
      console.log('[populate-defaults] ✅ No scenarios need updating');
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'No scenarios need updating. All fields are populated.',
          scenariosUpdated: 0,
        }),
      };
    }

    console.log(`[populate-defaults] Found ${scenariosWithNulls.length} scenarios with NULL values`);
    scenariosWithNulls.forEach((s, idx) => {
      console.log(`  ${idx + 1}. "${s.title}" (${s.id})`);
      console.log(`     silenceTimeout: ${s.silenceTimeout ?? 'NULL'}`);
      console.log(`     enableSilencePrompt: ${s.enableSilencePrompt ?? 'NULL'}`);
      console.log(`     showSilenceTimer: ${s.showSilenceTimer ?? 'NULL'}`);
      console.log(`     silenceThreshold: ${s.silenceThreshold ?? 'NULL'}`);
      console.log(`     minSilenceDuration: ${s.minSilenceDuration ?? 'NULL'}`);
    });

    // Update each scenario with NULL values
    const updatedScenarios: string[] = [];
    const errors: Array<{ id: string; title: string; error: string }> = [];

    for (const scenario of scenariosWithNulls) {
      try {
        // Build update data - only update NULL fields
        const updateData: any = {};
        if (scenario.silenceTimeout === null) {
          updateData.silenceTimeout = DEFAULTS.silenceTimeout;
        }
        if (scenario.enableSilencePrompt === null) {
          updateData.enableSilencePrompt = DEFAULTS.enableSilencePrompt;
        }
        if (scenario.showSilenceTimer === null) {
          updateData.showSilenceTimer = DEFAULTS.showSilenceTimer;
        }
        if (scenario.silenceThreshold === null) {
          updateData.silenceThreshold = DEFAULTS.silenceThreshold;
        }
        if (scenario.minSilenceDuration === null) {
          updateData.minSilenceDuration = DEFAULTS.minSilenceDuration;
        }

        if (Object.keys(updateData).length > 0) {
          await prisma.scenario.update({
            where: { id: scenario.id },
            data: updateData,
          });
          console.log(`  ✅ Updated "${scenario.title}" (${Object.keys(updateData).length} fields)`);
          updatedScenarios.push(scenario.title);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`  ❌ Failed to update "${scenario.title}":`, errorMessage);
        errors.push({
          id: scenario.id,
          title: scenario.title,
          error: errorMessage,
        });
      }
    }

    // Verify the update
    const remainingNulls = await prisma.scenario.count({
      where: {
        OR: [
          { silenceTimeout: null },
          { enableSilencePrompt: null },
          { showSilenceTimer: null },
          { silenceThreshold: null },
          { minSilenceDuration: null },
        ],
      },
    });

    console.log('[populate-defaults] ========================================');
    console.log(`[populate-defaults] ✅ Successfully updated: ${updatedScenarios.length} scenarios`);
    console.log(`[populate-defaults] ❌ Failed to update: ${errors.length} scenarios`);
    console.log(`[populate-defaults] ⚠️  Remaining NULL values: ${remainingNulls} scenarios`);
    console.log('[populate-defaults] ========================================');

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        scenariosUpdated: updatedScenarios.length,
        scenariosFailed: errors.length,
        remainingNulls,
        updatedScenarios,
        errors: errors.length > 0 ? errors : undefined,
      }),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[populate-defaults] ❌ Fatal error:', errorMessage);

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: errorMessage,
      }),
    };
  } finally {
    await prisma.$disconnect();
  }
};
