/**
 * AWS Bedrock - Claude AI Integration
 * Conversational AI responses using Claude Sonnet
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelCommandInput,
} from '@aws-sdk/client-bedrock-runtime';

export interface BedrockConfig {
  region: string;
  modelId: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface GenerateResponseOptions {
  userMessage: string;
  conversationHistory?: ConversationMessage[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIResponse {
  text: string;
  stopReason: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

export class BedrockAI {
  private client: BedrockRuntimeClient;
  private modelId: string;

  constructor(private options: BedrockConfig) {
    this.client = new BedrockRuntimeClient({
      region: options.region,
    });
    this.modelId = options.modelId;
  }

  /**
   * Generate AI response based on user input and conversation context
   */
  async generateResponse(
    options: GenerateResponseOptions
  ): Promise<AIResponse> {
    const {
      userMessage,
      conversationHistory = [],
      systemPrompt,
      temperature = 0.7,
      maxTokens = 2048,
    } = options;

    try {
      // Build message array
      const messages: ConversationMessage[] = [
        ...conversationHistory,
        {
          role: 'user',
          content: userMessage,
        },
      ];

      // Prepare request body
      const requestBody = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: maxTokens,
        temperature,
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        ...(systemPrompt && { system: systemPrompt }),
      };

      const input: InvokeModelCommandInput = {
        modelId: this.modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(requestBody),
      };

      console.log('[BedrockAI] Invoking model:', {
        modelId: this.modelId,
        messageCount: messages.length,
        userMessageLength: userMessage.length,
      });

      const command = new InvokeModelCommand(input);
      const response = await this.client.send(command);

      if (!response.body) {
        throw new Error('No response body from Bedrock');
      }

      // Parse response
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      console.log('[BedrockAI] Response received:', {
        stopReason: responseBody.stop_reason,
        inputTokens: responseBody.usage?.input_tokens,
        outputTokens: responseBody.usage?.output_tokens,
      });

      // Extract text from content blocks
      const text =
        responseBody.content
          ?.filter((block: any) => block.type === 'text')
          .map((block: any) => block.text)
          .join('') || '';

      return {
        text,
        stopReason: responseBody.stop_reason,
        usage: {
          inputTokens: responseBody.usage?.input_tokens || 0,
          outputTokens: responseBody.usage?.output_tokens || 0,
        },
      };
    } catch (error) {
      console.error('[BedrockAI] Failed to generate response:', error);
      throw error instanceof Error
        ? error
        : new Error('Failed to generate AI response');
    }
  }

  /**
   * Generate response with scenario-specific system prompt
   */
  async generateScenarioResponse(
    userMessage: string,
    scenarioPrompt: string,
    conversationHistory: ConversationMessage[] = []
  ): Promise<AIResponse> {
    return this.generateResponse({
      userMessage,
      conversationHistory,
      systemPrompt: scenarioPrompt,
      temperature: 0.8, // Slightly higher for more natural conversations
      maxTokens: 1024,
    });
  }

  /**
   * Generate evaluation/feedback for user's response
   */
  async generateEvaluation(
    userMessage: string,
    expectedResponse: string,
    evaluationCriteria: string[]
  ): Promise<AIResponse> {
    const systemPrompt = `You are an expert evaluator. Analyze the user's response against the expected response and provide constructive feedback.

Expected Response: ${expectedResponse}

Evaluation Criteria:
${evaluationCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Provide:
1. Overall score (0-100)
2. Strengths
3. Areas for improvement
4. Specific recommendations

Format your response as JSON with these fields: score, strengths, improvements, recommendations.`;

    return this.generateResponse({
      userMessage: `User's response: ${userMessage}`,
      systemPrompt,
      temperature: 0.3, // Lower temperature for consistent evaluation
      maxTokens: 2048,
    });
  }

  /**
   * Stream AI response (for real-time streaming - future implementation)
   * Note: Bedrock streaming requires different SDK setup
   */
  async *streamResponse(
    options: GenerateResponseOptions
  ): AsyncGenerator<string> {
    // TODO: Implement streaming using InvokeModelWithResponseStreamCommand
    // For now, return non-streaming response
    const response = await this.generateResponse(options);
    yield response.text;
  }
}
