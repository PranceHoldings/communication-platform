import { APIGatewayProxyHandler } from 'aws-lambda';
import { prisma } from '../../shared/database/prisma';
import { getUserFromEvent } from '../../shared/auth/jwt';
import { successResponse, errorResponse } from '../../shared/utils/response';

/**
 * DELETE /api/v1/scenarios/{id}
 *
 * Delete a scenario
 */
export const handler: APIGatewayProxyHandler = async (event) => {
  console.log('Delete scenario request:', JSON.stringify(event, null, 2));

  try {
    // Get authenticated user
    const user = getUserFromEvent(event);
    if (!user) {
      return errorResponse(401, 'Unauthorized');
    }

    // Get scenario ID from path
    const scenarioId = event.pathParameters?.id;
    if (!scenarioId) {
      return errorResponse(400, 'Scenario ID is required');
    }

    // Check if scenario exists
    const existingScenario = await prisma.scenario.findUnique({
      where: { id: scenarioId },
      select: {
        id: true,
        orgId: true,
        userId: true,
        title: true,
      },
    });

    if (!existingScenario) {
      return errorResponse(404, 'Scenario not found');
    }

    // Access control: Only allow deleting own organization's scenarios
    // SUPER_ADMIN can delete any, others can only delete their org's scenarios
    if (user.role !== 'SUPER_ADMIN' && existingScenario.orgId !== user.orgId) {
      return errorResponse(403, 'Access denied: You can only delete scenarios from your organization');
    }

    // Delete scenario (no session check - sessions will simply not display deleted scenarios)
    await prisma.scenario.delete({
      where: { id: scenarioId },
    });

    console.log(`Scenario deleted: ${scenarioId} by user ${user.userId}`);

    return successResponse({
      message: 'Scenario deleted successfully',
      id: scenarioId,
    });
  } catch (error) {
    console.error('Error deleting scenario:', error);
    return errorResponse(500, 'Failed to delete scenario', error instanceof Error ? error.message : undefined);
  }
};
