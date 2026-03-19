/**
 * WebSocket $connect Handler
 * Handles initial WebSocket connection and authentication
 */

import { APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { verifyToken } from '../../shared/auth/jwt';
import { getDynamoDbConnectionTtlSeconds } from '../../shared/utils/env-validator';

const dynamoDb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION })
);

const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE_NAME!;

// Extended event type with query string parameters
interface WebSocketConnectEvent {
  requestContext: {
    connectionId: string;
    [key: string]: unknown;
  };
  queryStringParameters?: Record<string, string>;
  headers?: Record<string, string>;
  [key: string]: unknown;
}

export const handler = async (event: WebSocketConnectEvent): Promise<APIGatewayProxyResultV2> => {
  console.log('WebSocket Connect Event:', JSON.stringify(event, null, 2));

  const connectionId = event.requestContext.connectionId;
  const timestamp = Date.now();

  try {
    // Extract token from query parameters or headers
    const token =
      event.queryStringParameters?.token ||
      event.headers?.Authorization?.replace('Bearer ', '') ||
      event.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      console.error('No token provided');
      return {
        statusCode: 401,
        body: JSON.stringify({ message: 'Unauthorized: No token provided' }),
      };
    }

    // Verify JWT token
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) {
      console.error('Invalid token');
      return {
        statusCode: 401,
        body: JSON.stringify({ message: 'Unauthorized: Invalid token' }),
      };
    }

    const userId = decoded.userId;
    const orgId = decoded.orgId;

    // Store connection in DynamoDB
    await dynamoDb.send(
      new PutCommand({
        TableName: CONNECTIONS_TABLE,
        Item: {
          connection_id: connectionId,
          userId: userId,
          org_id: orgId,
          connected_at: timestamp,
          ttl: Math.floor(timestamp / 1000) + getDynamoDbConnectionTtlSeconds(),
        },
      })
    );

    console.log(`Connection ${connectionId} established for user ${userId}`);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Connected', connectionId }),
    };
  } catch (error) {
    console.error('Connect handler error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
