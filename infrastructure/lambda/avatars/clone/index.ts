import { APIGatewayProxyHandler } from 'aws-lambda';
import { prisma } from '../../shared/database/prisma';
import { getUserFromEvent } from '../../shared/auth/jwt';
import { successResponse, errorResponse } from '../../shared/utils/response';

/**
 * POST /api/v1/avatars/{id}/clone
 *
 * Clone a public avatar with cloning enabled
 * Creates a copy as ORG_CUSTOM avatar in user's organization
 *
 * Access Requirements:
 * - Original avatar must be PUBLIC
 * - Original avatar must have allowCloning = true
 * - Original avatar must be from a different organization
 */
export const handler: APIGatewayProxyHandler = async (event) => {
  console.log('Clone avatar request:', JSON.stringify(event, null, 2));

  try {
    // Get authenticated user
    const user = getUserFromEvent(event);
    if (!user) {
      return errorResponse(401, 'Unauthorized');
    }

    // Get avatar ID from path
    const avatarId = event.pathParameters?.id;
    if (!avatarId) {
      return errorResponse(400, 'Avatar ID is required');
    }

    // Get the source avatar
    const sourceAvatar = await prisma.avatar.findUnique({
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
        orgId: true,
      },
    });

    if (!sourceAvatar) {
      return errorResponse(404, 'Avatar not found');
    }

    // Validate cloning requirements
    if (sourceAvatar.visibility !== 'PUBLIC') {
      return errorResponse(403, 'Avatar must be PUBLIC to clone');
    }

    if (!sourceAvatar.allowCloning) {
      return errorResponse(403, 'Avatar cloning is not allowed by the owner');
    }

    if (sourceAvatar.orgId === user.orgId) {
      return errorResponse(400, 'Cannot clone avatars from your own organization');
    }

    // Create cloned avatar in user's organization
    const clonedAvatar = await prisma.avatar.create({
      data: {
        userId: user.userId,
        orgId: user.orgId,
        name: `${sourceAvatar.name} (Clone)`,
        type: sourceAvatar.type,
        style: sourceAvatar.style,
        source: 'ORG_CUSTOM', // Cloned avatars are always ORG_CUSTOM
        modelUrl: sourceAvatar.modelUrl,
        thumbnailUrl: sourceAvatar.thumbnailUrl,
        configJson: sourceAvatar.configJson,
        tags: sourceAvatar.tags,
        visibility: 'PRIVATE', // Cloned avatars start as PRIVATE
        allowCloning: false, // Cloned avatars cannot be cloned by default
      },
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

    console.log(`Avatar cloned: ${clonedAvatar.id} from ${sourceAvatar.id} by user ${user.userId}`);

    return successResponse(
      {
        avatar: clonedAvatar,
        sourceAvatarId: sourceAvatar.id,
      },
      201
    );
  } catch (error) {
    console.error('Error cloning avatar:', error);
    return errorResponse(500, 'Failed to clone avatar', error instanceof Error ? error.message : undefined);
  }
};
