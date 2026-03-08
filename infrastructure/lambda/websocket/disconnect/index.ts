/**
 * WebSocket $disconnect Handler
 * Handles WebSocket disconnection and cleanup
 */

import { APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const dynamoDb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION })
);

const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE_NAME!;

interface WebSocketEvent {
  requestContext: {
    connectionId: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export const handler = async (event: WebSocketEvent): Promise<APIGatewayProxyResultV2> => {
  console.log('WebSocket Disconnect Event:', JSON.stringify(event, null, 2));

  const connectionId = event.requestContext.connectionId;

  try {
    // Remove connection from DynamoDB
    await dynamoDb.send(
      new DeleteCommand({
        TableName: CONNECTIONS_TABLE,
        Key: {
          connection_id: connectionId,
        },
      })
    );

    console.log(`Connection ${connectionId} removed`);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Disconnected' }),
    };
  } catch (error) {
    console.error('Disconnect handler error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
