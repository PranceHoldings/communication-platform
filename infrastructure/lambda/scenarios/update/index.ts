import { APIGatewayProxyHandler } from 'aws-lambda';
import { prisma } from '../../shared/database/prisma';
import { getUserFromEvent } from '../../shared/auth/jwt';
import { successResponse, errorResponse } from '../../shared/utils/response';
import { LANGUAGE_DEFAULTS } from '../../shared/config/defaults';
import { invalidateScenarioCache } from '../../shared/scenario/cache';

/**
 * PUT /api/v1/scenarios/{id}
 *
 * Update an existing scenario
 *
 * Request Body:
 * {
 *   "title": "string" (optional),
 *   "category": "string" (optional),
 *   "configJson": {} (optional),
 *   "language": "ja" | "en" (optional),
 *   "visibility": "PRIVATE" | "ORGANIZATION" | "PUBLIC" (optional)
 * }
 */
export const handler: APIGatewayProxyHandler = async event => {
  console.log('Update scenario request:', JSON.stringify(event, null, 2));

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

    // Check if scenario exists and get current data
    const existingScenario = await prisma.scenario.findUnique({
      where: { id: scenarioId },
      select: {
        id: true,
        orgId: true,
        userId: true,
      },
    });

    if (!existingScenario) {
      return errorResponse(404, 'Scenario not found');
    }

    // Access control: Only allow updating own organization's scenarios
    // SUPER_ADMIN can update any, others can only update their org's scenarios
    if (user.role !== 'SUPER_ADMIN' && existingScenario.orgId !== user.orgId) {
      return errorResponse(
        403,
        'Access denied: You can only update scenarios from your organization'
      );
    }

    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const {
      title,
      category,
      configJson,
      language,
      visibility,
      // Silence management fields
      initialGreeting,
      silenceTimeout,
      silencePromptTimeout,
      enableSilencePrompt,
      showSilenceTimer,
      silenceThreshold,
      minSilenceDuration,
    } = body;

    // Validate configJson if provided
    if (configJson !== undefined) {
      if (typeof configJson !== 'object' || Array.isArray(configJson)) {
        return errorResponse(400, 'Validation Error', 'configJson must be an object');
      }
    }

    // Validate visibility if provided
    if (visibility && !['PRIVATE', 'ORGANIZATION', 'PUBLIC'].includes(visibility)) {
      return errorResponse(
        400,
        'Validation Error',
        'visibility must be PRIVATE, ORGANIZATION, or PUBLIC'
      );
    }

    // Validate language if provided (ISO 639-1 format: 'ja', 'en', 'zh-CN', etc.)
    if (language && !LANGUAGE_DEFAULTS.SUPPORTED_LANGUAGES.includes(language)) {
      return errorResponse(
        400,
        'Validation Error',
        `language must be one of: ${LANGUAGE_DEFAULTS.SUPPORTED_LANGUAGES.join(', ')}`
      );
    }

    // Build update data object (only include provided fields)
    // 🔴 CRITICAL: Use 'in' operator to detect null values for "use default" setting
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (category !== undefined) updateData.category = category;
    if (configJson !== undefined) updateData.configJson = configJson;
    if (language !== undefined) updateData.language = language;
    if (visibility !== undefined) updateData.visibility = visibility;
    // Silence management fields (null = use organization default)
    if ('initialGreeting' in body) updateData.initialGreeting = initialGreeting;
    if ('silenceTimeout' in body) updateData.silenceTimeout = silenceTimeout;
    if ('silencePromptTimeout' in body) updateData.silencePromptTimeout = silencePromptTimeout;
    if ('enableSilencePrompt' in body) updateData.enableSilencePrompt = enableSilencePrompt;
    if ('showSilenceTimer' in body) updateData.showSilenceTimer = showSilenceTimer;
    if ('silenceThreshold' in body) updateData.silenceThreshold = silenceThreshold;
    if ('minSilenceDuration' in body) updateData.minSilenceDuration = minSilenceDuration;

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      return errorResponse(400, 'No fields to update');
    }

    // Update scenario
    const scenario = await prisma.scenario.update({
      where: { id: scenarioId },
      data: updateData,
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

    console.log(`Scenario updated: ${scenario.id} by user ${user.userId}`);

    // Phase 1.6.1 Day 36: Invalidate cache after update
    invalidateScenarioCache(scenarioId).catch(error => {
      console.error('[Update] Failed to invalidate cache:', error);
      // Non-blocking: cache invalidation failure should not fail the update
    });

    return successResponse(scenario);
  } catch (error) {
    console.error('Error updating scenario:', error);
    return errorResponse(
      500,
      'Failed to update scenario',
      error instanceof Error ? error.message : undefined
    );
  }
};
