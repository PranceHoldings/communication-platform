import { APIGatewayProxyHandler } from 'aws-lambda';
import { prisma } from '../../shared/database/prisma';
import { getUserFromEvent } from '../../shared/auth/jwt';
import { successResponse, errorResponse } from '../../shared/utils/response';

/**
 * GET /api/v1/scenarios/{id}
 *
 * Get scenario details by ID
 */
export const handler: APIGatewayProxyHandler = async event => {
  console.log('Get scenario request:', JSON.stringify(event, null, 2));

  try {
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

    // Get scenario from database
    const scenario = await prisma.scenario.findUnique({
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
        enableSilencePrompt: true,
        showSilenceTimer: true,
        silenceThreshold: true,
        minSilenceDuration: true,
      },
    });

    if (!scenario) {
      return errorResponse(404, 'Scenario not found');
    }

    // Verify user has access to this scenario
    // User can access if: same org OR scenario is PUBLIC
    const hasAccess = scenario.orgId === user.orgId || scenario.visibility === 'PUBLIC';

    if (!hasAccess) {
      return errorResponse(403, 'Access denied to this scenario');
    }

    console.log(`Scenario retrieved: ${scenario.id}`);

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
