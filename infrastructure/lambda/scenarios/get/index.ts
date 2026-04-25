import { APIGatewayProxyHandler } from 'aws-lambda';
import { prisma } from '../../shared/database/prisma';
import { getUserFromEvent } from '../../shared/auth/jwt';
import { successResponse, errorResponse, setRequestOrigin } from '../../shared/utils/response';
import { getScenarioWithCache, CachedScenario } from '../../shared/scenario/cache';

/**
 * GET /api/v1/scenarios/{id}
 *
 * Get scenario details by ID
 */
export const handler: APIGatewayProxyHandler = async event => {
  console.log('Get scenario request:', JSON.stringify(event, null, 2));

  try {
    setRequestOrigin(event.headers?.Origin || event.headers?.origin);
    // Get authenticated user
    const user = getUserFromEvent(event);
    if (!user) {
      return errorResponse(401, 'Unauthorized');
    }

    // Get scenario ID from path parameters
    const scenarioId = event.pathParameters?.id;
    if (!scenarioId) {
      return errorResponse(400, 'Scenario ID is required');
    }

    // Phase 1.6.1 Day 36: Get scenario with cache
    const scenario = await getScenarioWithCache(scenarioId, async () => {
      // Fetch from database (cache miss)
      const dbScenario = await prisma.scenario.findUnique({
        where: { id: scenarioId },
        select: {
          id: true,
          title: true,
          category: true,
          language: true,
          visibility: true,
          configJson: true,
          createdAt: true,
          userId: true,
          orgId: true,
          // Silence management fields
          initialGreeting: true,
          silenceTimeout: true,
          silencePromptTimeout: true,
          enableSilencePrompt: true,
          showSilenceTimer: true,
          silenceThreshold: true,
          minSilenceDuration: true,
        },
      });

      if (!dbScenario) {
        throw new Error('Scenario not found');
      }

      // Convert to CachedScenario format
      const systemPrompt =
        typeof dbScenario.configJson === 'object' && dbScenario.configJson !== null
          ? (dbScenario.configJson as any).systemPrompt || ''
          : '';

      const variables =
        typeof dbScenario.configJson === 'object' && dbScenario.configJson !== null
          ? (dbScenario.configJson as any).variables
          : undefined;

      const conversationFlow =
        typeof dbScenario.configJson === 'object' && dbScenario.configJson !== null
          ? (dbScenario.configJson as any).conversationFlow
          : undefined;

      return {
        scenarioId: dbScenario.id,
        title: dbScenario.title,
        systemPrompt,
        language: dbScenario.language,
        initialGreeting: dbScenario.initialGreeting || undefined,
        variables,
        conversationFlow,
        cachedAt: Date.now(),
        ttl: 0, // Will be set by cache.ts
      };
    });

    // Re-fetch from database for access control check
    const dbScenario = await prisma.scenario.findUnique({
      where: { id: scenarioId },
      select: {
        orgId: true,
        visibility: true,
      },
    });

    if (!dbScenario) {
      return errorResponse(404, 'Scenario not found');
    }

    // Verify user has access to this scenario
    // User can access if: same org OR scenario is PUBLIC
    const hasAccess = dbScenario.orgId === user.orgId || dbScenario.visibility === 'PUBLIC';

    if (!hasAccess) {
      return errorResponse(403, 'Access denied to this scenario');
    }

    console.log(`Scenario retrieved (cached): ${scenario.scenarioId}`);

    return successResponse(scenario);
  } catch (error) {
    console.error('Error getting scenario:', error);
    return errorResponse(
      500,
      'Failed to get scenario',
      error instanceof Error ? error.message : undefined
    );
  }
};
// Force rebuild - Wed Mar 11 11:32:13 PM UTC 2026
