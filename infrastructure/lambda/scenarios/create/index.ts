import { APIGatewayProxyHandler } from 'aws-lambda';
import { prisma } from '../../shared/database/prisma';
import { getUserFromEvent } from '../../shared/auth/jwt';
import { successResponse, errorResponse } from '../../shared/utils/response';

// Supported languages (source of truth: packages/shared/src/language/index.ts)
const SUPPORTED_LANGUAGES = ['ja', 'en', 'zh-CN', 'zh-TW', 'ko', 'es', 'pt', 'fr', 'de', 'it'];

/**
 * POST /api/v1/scenarios
 *
 * Create a new scenario
 *
 * Request Body:
 * {
 *   "title": "string",
 *   "category": "string",
 *   "configJson": {},
 *   "language": "ja" | "en" (optional, default: "ja"),
 *   "visibility": "PRIVATE" | "ORGANIZATION" | "PUBLIC" (optional, default: "PRIVATE")
 * }
 */
export const handler: APIGatewayProxyHandler = async event => {
  console.log('Create scenario request:', JSON.stringify(event, null, 2));

  try {
    // Get authenticated user
    const user = getUserFromEvent(event);
    if (!user) {
      return errorResponse(401, 'Unauthorized');
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

    // Validate required fields
    if (!title) {
      return errorResponse(400, 'Validation Error', 'title is required');
    }

    if (!category) {
      return errorResponse(400, 'Validation Error', 'category is required');
    }

    if (!configJson) {
      return errorResponse(400, 'Validation Error', 'configJson is required');
    }

    // Validate configJson is an object
    if (typeof configJson !== 'object' || Array.isArray(configJson)) {
      return errorResponse(400, 'Validation Error', 'configJson must be an object');
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

    // Create scenario
    const scenario = await prisma.scenario.create({
      data: {
        userId: user.userId,
        orgId: user.orgId,
        title,
        category,
        configJson,
        language: language || LANGUAGE_DEFAULTS.SUPPORTED_LANGUAGES[0], // Default: first supported language ('ja')
        visibility: visibility || 'PRIVATE',
        // Silence management fields (optional, will use DB defaults if not provided)
        initialGreeting,
        silenceTimeout,
        silencePromptTimeout,
        enableSilencePrompt,
        showSilenceTimer,
        silenceThreshold,
        minSilenceDuration,
      },
      select: {
        id: true,
        title: true,
        category: true,
        language: true,
        visibility: true,
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

    console.log(`Scenario created: ${scenario.id} by user ${user.userId}`);

    return successResponse(scenario, 201);
  } catch (error) {
    console.error('Error creating scenario:', error);
    return errorResponse(
      500,
      'Failed to create scenario',
      error instanceof Error ? error.message : undefined
    );
  }
};
