import { APIGatewayProxyHandler } from 'aws-lambda';
import { getUserFromEvent } from '../../shared/auth/jwt';
import { successResponse, errorResponse, setRequestOrigin } from '../../shared/utils/response';
import {
  previewScenario,
  generateSampleConversation,
  ScenarioPreviewRequest,
} from '../../shared/scenario/preview';

/**
 * POST /api/v1/scenarios/preview
 *
 * Preview scenario without executing it
 * Phase 1.6.1 Day 36: Test Mode implementation
 */
export const handler: APIGatewayProxyHandler = async event => {
  console.log('Scenario preview request:', JSON.stringify(event, null, 2));

  try {
    setRequestOrigin(event.headers?.Origin || event.headers?.origin);
    // Get authenticated user
    const user = getUserFromEvent(event);
    if (!user) {
      return errorResponse(401, 'Unauthorized');
    }

    // Parse request body
    if (!event.body) {
      return errorResponse(400, 'Request body is required');
    }

    const request: ScenarioPreviewRequest = JSON.parse(event.body);

    // Validate required fields
    if (!request.title || !request.systemPrompt || !request.language) {
      return errorResponse(400, 'Missing required fields: title, systemPrompt, language');
    }

    console.log('[Preview] Processing preview request:', {
      title: request.title,
      language: request.language,
      hasVariables: !!request.variables,
      hasVariableValues: !!request.variableValues,
      hasConversationFlow: !!request.conversationFlow,
    });

    // Generate preview
    const previewResult = previewScenario(request);

    // Generate sample conversation
    const sampleConversation = generateSampleConversation(
      request.systemPrompt,
      request.initialGreeting,
      5
    );

    console.log('[Preview] Preview generated:', {
      isValid: previewResult.validation.isValid,
      errorCount: previewResult.validation.errors.length,
      warningCount: previewResult.warnings.length,
      recommendationCount: previewResult.recommendations.length,
      detectedVariableCount: previewResult.detectedVariables?.length || 0,
    });

    return successResponse({
      preview: previewResult,
      sampleConversation,
    });
  } catch (error) {
    console.error('Error previewing scenario:', error);
    return errorResponse(
      500,
      'Failed to preview scenario',
      error instanceof Error ? error.message : undefined
    );
  }
};
