import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

/**
 * ヘルスチェックLambda関数
 * API Gatewayからの呼び出しに対して200 OKを返す
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Health check request:', JSON.stringify(event, null, 2));

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      status: 'healthy',
      environment: process.env.ENVIRONMENT || 'unknown',
      timestamp: new Date().toISOString(),
      version: '0.1.0-alpha',
    }),
  };
};
