/**
 * WebSocket $default Handler
 * Handles all WebSocket messages (route selection)
 */

import { APIGatewayProxyResultV2 } from 'aws-lambda';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';

const ENDPOINT = process.env.WEBSOCKET_ENDPOINT!;

const apiGateway = new ApiGatewayManagementApiClient({
  endpoint: ENDPOINT,
});

interface WebSocketMessage {
  type: string;
  [key: string]: unknown;
}

interface WebSocketEvent {
  requestContext: {
    connectionId: string;
    [key: string]: unknown;
  };
  body?: string;
  [key: string]: unknown;
}

export const handler = async (
  event: WebSocketEvent
): Promise<APIGatewayProxyResultV2> => {
  console.log('WebSocket Default Handler Event:', JSON.stringify(event, null, 2));

  const connectionId = event.requestContext.connectionId;
  const body = event.body;

  try {
    if (!body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing message body' }),
      };
    }

    const message: WebSocketMessage = JSON.parse(body);
    console.log('Received message:', message);

    // Route message based on type
    switch (message.type) {
      case 'ping':
        await sendToConnection(connectionId, {
          type: 'pong',
          timestamp: Date.now(),
        });
        break;

      case 'authenticate':
        // Already authenticated in $connect, just acknowledge
        await sendToConnection(connectionId, {
          type: 'authenticated',
          message: 'Already authenticated',
        });
        break;

      case 'audio_chunk':
        // TODO: Forward to STT service
        console.log('Audio chunk received:', message);
        break;

      case 'speech_end':
        // TODO: Process final transcription
        console.log('Speech end:', message);
        break;

      case 'user_speech':
        // TODO: Send to AI for response generation
        console.log('User speech:', message);
        await sendToConnection(connectionId, {
          type: 'processing_update',
          stage: 'generating_response',
          progress: 0.5,
        });
        break;

      case 'session_end':
        // TODO: Finalize session, generate report
        console.log('Session end:', message);
        await sendToConnection(connectionId, {
          type: 'session_complete',
          message: 'Session ended successfully',
        });
        break;

      default:
        console.warn('Unknown message type:', message.type);
        await sendToConnection(connectionId, {
          type: 'error',
          code: 'UNKNOWN_MESSAGE_TYPE',
          message: `Unknown message type: ${message.type}`,
        });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Message processed' }),
    };
  } catch (error) {
    console.error('Default handler error:', error);

    try {
      await sendToConnection(connectionId, {
        type: 'error',
        code: 'INTERNAL_ERROR',
        message: 'Failed to process message',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    } catch (sendError) {
      console.error('Failed to send error message:', sendError);
    }

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};

async function sendToConnection(connectionId: string, data: unknown): Promise<void> {
  try {
    await apiGateway.send(
      new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: Buffer.from(JSON.stringify(data)),
      })
    );
    console.log(`Sent message to connection ${connectionId}:`, data);
  } catch (error) {
    console.error(`Failed to send message to connection ${connectionId}:`, error);
    throw error;
  }
}
