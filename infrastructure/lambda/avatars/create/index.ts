import { APIGatewayProxyHandler } from 'aws-lambda';
import { prisma } from '../../shared/database/prisma';
import { getUserFromEvent } from '../../shared/auth/jwt';
import { successResponse, errorResponse } from '../../shared/utils/response';

/**
 * POST /api/v1/avatars
 *
 * Create a new avatar
 *
 * Request Body:
 * {
 *   "name": "string",
 *   "type": "TWO_D" | "THREE_D",
 *   "style": "ANIME" | "REALISTIC",
 *   "source": "PRESET" | "GENERATED" | "ORG_CUSTOM",
 *   "modelUrl": "string",
 *   "thumbnailUrl": "string" (optional),
 *   "configJson": {} (optional),
 *   "tags": ["string"] (optional),
 *   "visibility": "PRIVATE" | "ORGANIZATION" | "PUBLIC" (optional, default: "PRIVATE"),
 *   "allowCloning": boolean (optional, default: false)
 * }
 */
export const handler: APIGatewayProxyHandler = async (event) => {
  console.log('Create avatar request:', JSON.stringify(event, null, 2));

  try {
    // Get authenticated user
    const user = getUserFromEvent(event);
    if (!user) {
      return errorResponse(401, 'Unauthorized');
    }

    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { name, type, style, source, modelUrl, thumbnailUrl, configJson, tags, visibility, allowCloning } = body;

    // Validate required fields
    if (!name) {
      return errorResponse(400, 'Validation Error', 'name is required');
    }

    if (!type) {
      return errorResponse(400, 'Validation Error', 'type is required');
    }

    if (!['TWO_D', 'THREE_D'].includes(type)) {
      return errorResponse(400, 'Validation Error', 'type must be TWO_D or THREE_D');
    }

    if (!style) {
      return errorResponse(400, 'Validation Error', 'style is required');
    }

    if (!['ANIME', 'REALISTIC'].includes(style)) {
      return errorResponse(400, 'Validation Error', 'style must be ANIME or REALISTIC');
    }

    if (!source) {
      return errorResponse(400, 'Validation Error', 'source is required');
    }

    if (!['PRESET', 'GENERATED', 'ORG_CUSTOM'].includes(source)) {
      return errorResponse(400, 'Validation Error', 'source must be PRESET, GENERATED, or ORG_CUSTOM');
    }

    // Only SUPER_ADMIN can create PRESET avatars
    if (source === 'PRESET' && user.role !== 'SUPER_ADMIN') {
      return errorResponse(403, 'Forbidden', 'Only super admins can create preset avatars');
    }

    if (!modelUrl) {
      return errorResponse(400, 'Validation Error', 'modelUrl is required');
    }

    // Validate visibility if provided
    if (visibility && !['PRIVATE', 'ORGANIZATION', 'PUBLIC'].includes(visibility)) {
      return errorResponse(400, 'Validation Error', 'visibility must be PRIVATE, ORGANIZATION, or PUBLIC');
    }

    // Validate configJson if provided
    if (configJson && (typeof configJson !== 'object' || Array.isArray(configJson))) {
      return errorResponse(400, 'Validation Error', 'configJson must be an object');
    }

    // Validate tags if provided
    if (tags && !Array.isArray(tags)) {
      return errorResponse(400, 'Validation Error', 'tags must be an array');
    }

    // Create avatar
    const avatar = await prisma.avatar.create({
      data: {
        userId: user.userId,
        orgId: user.orgId,
        name,
        type,
        style,
        source,
        modelUrl,
        thumbnailUrl: thumbnailUrl || null,
        configJson: configJson || null,
        tags: tags || [],
        visibility: visibility || 'PRIVATE',
        allowCloning: allowCloning || false,
      },
      select: {
        id: true,
        name: true,
        type: true,
        style: true,
        source: true,
        modelUrl: true,
        thumbnailUrl: true,
        tags: true,
        visibility: true,
        allowCloning: true,
        createdAt: true,
        userId: true,
        orgId: true,
      },
    });

    console.log(`Avatar created: ${avatar.id} by user ${user.userId}`);

    return successResponse(avatar, 201);
  } catch (error) {
    console.error('Error creating avatar:', error);
    return errorResponse(500, 'Failed to create avatar', error instanceof Error ? error.message : undefined);
  }
};
