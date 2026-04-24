/**
 * WebSocket $disconnect Handler
 * Handles WebSocket disconnection and cleanup
 *
 * On disconnect: reads the DynamoDB connection record to find the sessionId,
 * then marks any ACTIVE session as COMPLETED so it never stays stuck as ACTIVE.
 * If video chunks were being recorded, triggers async video processing.
 */

import { APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { getAwsRegion, getConnectionsTableName } from '../../shared/config';
import { getOptionalEnv } from '../../shared/utils/env-validator';
import { prisma } from '../../shared/database/prisma';

const dynamoDb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: getAwsRegion() })
);
const lambdaClient = new LambdaClient({ region: getAwsRegion() });

const CONNECTIONS_TABLE = getConnectionsTableName();
const VIDEO_PROCESSOR_FUNCTION = getOptionalEnv('VIDEO_PROCESSOR_FUNCTION_NAME', '');

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
    // Read connection data BEFORE deleting so we can find sessionId and videoChunksCount
    let sessionId: string | undefined;
    let videoChunksCount = 0;
    try {
      const getResult = await dynamoDb.send(
        new GetCommand({
          TableName: CONNECTIONS_TABLE,
          Key: { connection_id: connectionId },
        })
      );
      sessionId = getResult.Item?.sessionId as string | undefined;
      videoChunksCount = (getResult.Item?.videoChunksCount as number) || 0;
      console.log(`Connection ${connectionId} was for session: ${sessionId ?? '(none)'}, videoChunksCount: ${videoChunksCount}`);
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

      // If video chunks were recorded but session_end never triggered processing,
      // invoke the video processor Lambda asynchronously so the recording gets combined.
      if (videoChunksCount > 0 && VIDEO_PROCESSOR_FUNCTION) {
        try {
          const payload = JSON.stringify({
            type: 'process_video_on_disconnect',
            sessionId,
            videoChunksCount,
          });
          await lambdaClient.send(
            new InvokeCommand({
              FunctionName: VIDEO_PROCESSOR_FUNCTION,
              InvocationType: 'Event', // async — don't wait for result
              Payload: Buffer.from(payload),
            })
          );
          console.log(`Triggered async video processing for session ${sessionId} (${videoChunksCount} chunks)`);
        } catch (invokeErr) {
          console.error(`Failed to trigger video processing for session ${sessionId}:`, invokeErr);
        }
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
