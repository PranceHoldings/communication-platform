/**
 * WebSocket $disconnect Handler
 * Handles WebSocket disconnection and cleanup
 *
 * On disconnect: reads the DynamoDB connection record to find the sessionId,
 * then marks any ACTIVE session as COMPLETED so it never stays stuck as ACTIVE.
 */

import { APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { getAwsRegion, getConnectionsTableName } from '../../shared/config';
import { prisma } from '../../shared/database/prisma';

const dynamoDb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: getAwsRegion() })
);

const CONNECTIONS_TABLE = getConnectionsTableName();

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
    // Read connection data BEFORE deleting so we can find the sessionId
    let sessionId: string | undefined;
    try {
      const getResult = await dynamoDb.send(
        new GetCommand({
          TableName: CONNECTIONS_TABLE,
          Key: { connection_id: connectionId },
        })
      );
      sessionId = getResult.Item?.sessionId as string | undefined;
      console.log(`Connection ${connectionId} was for session: ${sessionId ?? '(none)'}`);
    } catch (readErr) {
      console.error('Failed to read connection data on disconnect:', readErr);
    }

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

    // If there was an active session, mark it as COMPLETED so it doesn't stay stuck
    if (sessionId) {
      try {
        const session = await prisma.session.findUnique({
          where: { id: sessionId },
          select: { status: true, startedAt: true },
        });

        if (session && session.status === 'ACTIVE') {
          const endedAt = new Date();
          const durationSec = Math.floor(
            (endedAt.getTime() - new Date(session.startedAt).getTime()) / 1000
          );
          await prisma.session.update({
            where: { id: sessionId },
            data: { status: 'COMPLETED', endedAt, durationSec },
          });
          console.log(`Session ${sessionId} marked COMPLETED on WebSocket disconnect (duration: ${durationSec}s)`);
        } else if (session) {
          console.log(`Session ${sessionId} already in status ${session.status}, no update needed`);
        }
      } catch (dbErr) {
        console.error(`Failed to update session ${sessionId} on disconnect:`, dbErr);
        // Non-critical: stale session cleanup in list/get APIs will catch this
      } finally {
        await prisma.$disconnect();
      }
    }

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
