import { APIGatewayProxyHandler } from 'aws-lambda';
import { prisma } from '../../shared/database/prisma';
import { getUserFromEvent } from '../../shared/auth/jwt';
import { successResponse, errorResponse, setRequestOrigin } from '../../shared/utils/response';

/**
 * GET /api/v1/avatars/{id}
 *
 * Get avatar details by ID
 */
export const handler: APIGatewayProxyHandler = async event => {
  console.log('Get avatar request:', JSON.stringify(event, null, 2));

  try {
    setRequestOrigin(event.headers?.Origin || event.headers?.origin);
    // Get authenticated user
    const user = getUserFromEvent(event);
    if (!user) {
      return errorResponse(401, 'Unauthorized');
    }

    // Get avatar ID from path parameters
    const avatarId = event.pathParameters?.id;
    if (!avatarId) {
      return errorResponse(400, 'Avatar ID is required');
    }

    // Get avatar from database
    const avatar = await prisma.avatar.findUnique({
      where: { id: avatarId },
      select: {
        id: true,
        name: true,
        type: true,
        style: true,
        source: true,
        modelUrl: true,
        thumbnailUrl: true,
        configJson: true,
        tags: true,
        visibility: true,
        allowCloning: true,
        createdAt: true,
        userId: true,
        orgId: true,
      },
    });

    if (!avatar) {
      return errorResponse(404, 'Avatar not found');
    }

    // Verify user has access to this avatar
    // User can access if: same org OR avatar is PRESET OR avatar is PUBLIC
    const hasAccess =
      avatar.orgId === user.orgId || avatar.source === 'PRESET' || avatar.visibility === 'PUBLIC';

    if (!hasAccess) {
      return errorResponse(403, 'Access denied to this avatar');
    }

    console.log(`Avatar retrieved: ${avatar.id}`);

    return successResponse(avatar);
  } catch (error) {
    console.error('Error getting avatar:', error);
    return errorResponse(
      500,
      'Failed to get avatar',
      error instanceof Error ? error.message : undefined
    );
  }
};
