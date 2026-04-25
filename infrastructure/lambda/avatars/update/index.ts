import { APIGatewayProxyHandler } from 'aws-lambda';
import { prisma } from '../../shared/database/prisma';
import { getUserFromEvent } from '../../shared/auth/jwt';
import { successResponse, errorResponse, setRequestOrigin } from '../../shared/utils/response';

/**
 * PUT /api/v1/avatars/{id}
 *
 * Update an existing avatar
 *
 * Request Body:
 * {
 *   "name": "string" (optional),
 *   "type": "TWO_D" | "THREE_D" (optional),
 *   "style": "ANIME" | "REALISTIC" (optional),
 *   "source": "PRESET" | "GENERATED" | "ORG_CUSTOM" (optional),
 *   "modelUrl": "string" (optional),
 *   "thumbnailUrl": "string" (optional),
 *   "configJson": {} (optional),
 *   "tags": ["string"] (optional),
 *   "visibility": "PRIVATE" | "ORGANIZATION" | "PUBLIC" (optional),
 *   "allowCloning": boolean (optional)
 * }
 */
export const handler: APIGatewayProxyHandler = async event => {
  console.log('Update avatar request:', JSON.stringify(event, null, 2));

  try {
    setRequestOrigin(event.headers?.Origin || event.headers?.origin);
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

    // Check if avatar exists and get current data
    const existingAvatar = await prisma.avatar.findUnique({
      where: { id: avatarId },
      select: {
        id: true,
        orgId: true,
        userId: true,
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

    // Access control: Only allow updating own organization's avatars
    // SUPER_ADMIN can update any
    // PRESET avatars can only be updated by SUPER_ADMIN
    // Others can only update their org's avatars
    if (user.role !== 'SUPER_ADMIN') {
      if (existingAvatar.source === 'PRESET') {
        return errorResponse(403, 'Access denied: Only super admins can update PRESET avatars');
      }
      if (existingAvatar.orgId !== user.orgId) {
        return errorResponse(
          403,
          'Access denied: You can only update avatars from your organization'
        );
      }
    }

    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const {
      name,
      type,
      style,
      source,
      modelUrl,
      thumbnailUrl,
      configJson,
      tags,
      visibility,
      allowCloning,
    } = body;

    // Validate type if provided
    if (type && !['TWO_D', 'THREE_D'].includes(type)) {
      return errorResponse(400, 'Validation Error', 'type must be TWO_D or THREE_D');
    }

    // Validate style if provided
    if (style && !['ANIME', 'REALISTIC'].includes(style)) {
      return errorResponse(400, 'Validation Error', 'style must be ANIME or REALISTIC');
    }

    // Validate source if provided
    if (source && !['PRESET', 'GENERATED', 'ORG_CUSTOM'].includes(source)) {
      return errorResponse(
        400,
        'Validation Error',
        'source must be PRESET, GENERATED, or ORG_CUSTOM'
      );
    }

    // Only SUPER_ADMIN can change source to PRESET
    if (source === 'PRESET' && user.role !== 'SUPER_ADMIN') {
      return errorResponse(403, 'Forbidden', 'Only super admins can set source to PRESET');
    }

    // Validate visibility if provided
    if (visibility && !['PRIVATE', 'ORGANIZATION', 'PUBLIC'].includes(visibility)) {
      return errorResponse(
        400,
        'Validation Error',
        'visibility must be PRIVATE, ORGANIZATION, or PUBLIC'
      );
    }

    // Validate configJson if provided
    if (configJson !== undefined && configJson !== null) {
      if (typeof configJson !== 'object' || Array.isArray(configJson)) {
        return errorResponse(400, 'Validation Error', 'configJson must be an object');
      }
    }

    // Validate tags if provided
    if (tags && !Array.isArray(tags)) {
      return errorResponse(400, 'Validation Error', 'tags must be an array');
    }

    // Build update data object (only include provided fields)
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type;
    if (style !== undefined) updateData.style = style;
    if (source !== undefined) updateData.source = source;
    if (modelUrl !== undefined) updateData.modelUrl = modelUrl;
    if (thumbnailUrl !== undefined) updateData.thumbnailUrl = thumbnailUrl;
    if (configJson !== undefined) updateData.configJson = configJson;
    if (tags !== undefined) updateData.tags = tags;
    if (visibility !== undefined) updateData.visibility = visibility;
    if (allowCloning !== undefined) updateData.allowCloning = allowCloning;

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      return errorResponse(400, 'No fields to update');
    }

    // Update avatar
    const avatar = await prisma.avatar.update({
      where: { id: avatarId },
      data: updateData,
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

    console.log(`Avatar updated: ${avatar.id} by user ${user.userId}`);

    return successResponse(avatar);
  } catch (error) {
    console.error('Error updating avatar:', error);
    return errorResponse(
      500,
      'Failed to update avatar',
      error instanceof Error ? error.message : undefined
    );
  }
};
