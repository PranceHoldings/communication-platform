import { APIGatewayProxyHandler } from 'aws-lambda';
import { prisma } from '../../shared/database/prisma';
import { getUserFromEvent } from '../../shared/auth/jwt';
import { successResponse, errorResponse } from '../../shared/utils/response';

/**
 * DELETE /api/v1/avatars/{id}
 *
 * Delete an avatar
 */
export const handler: APIGatewayProxyHandler = async event => {
  console.log('Delete avatar request:', JSON.stringify(event, null, 2));

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

    // Check if avatar exists
    const existingAvatar = await prisma.avatar.findUnique({
      where: { id: avatarId },
      select: {
        id: true,
        orgId: true,
        userId: true,
        name: true,
        source: true,
      },
    });

    if (!existingAvatar) {
      return errorResponse(404, 'Avatar not found');
    }

    // Log avatar and user details for debugging
    console.log('Avatar details:', {
      avatarId: existingAvatar.id,
      avatarOrgId: existingAvatar.orgId,
      avatarSource: existingAvatar.source,
      userOrgId: user.orgId,
      userRole: user.role,
    });

    // Access control: Only allow deleting own organization's avatars
    // SUPER_ADMIN can delete any
    // PRESET avatars can only be deleted by SUPER_ADMIN
    // Others can only delete their org's avatars
    if (user.role !== 'SUPER_ADMIN') {
      if (existingAvatar.source === 'PRESET') {
        return errorResponse(403, 'Access denied: Only super admins can delete PRESET avatars');
      }
      if (existingAvatar.orgId !== user.orgId) {
        return errorResponse(
          403,
          'Access denied: You can only delete avatars from your organization'
        );
      }
    }

    // Delete avatar (no session check - sessions will simply not display deleted avatars)
    await prisma.avatar.delete({
      where: { id: avatarId },
    });

    console.log(`Avatar deleted: ${avatarId} by user ${user.userId}`);

    return successResponse({
      message: 'Avatar deleted successfully',
      id: avatarId,
    });
  } catch (error) {
    console.error('Error deleting avatar:', error);
    return errorResponse(
      500,
      'Failed to delete avatar',
      error instanceof Error ? error.message : undefined
    );
  }
};
