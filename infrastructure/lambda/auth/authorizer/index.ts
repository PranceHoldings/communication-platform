/**
 * JWT Lambda Authorizer
 * API Gatewayリクエストの認証・認可を行う
 */

import {
  APIGatewayAuthorizerResult,
  APIGatewayTokenAuthorizerEvent,
  PolicyDocument,
  Statement,
} from 'aws-lambda';
import { verifyToken } from '../../shared/auth/jwt';
import { JWTPayload } from '../../shared/types';

/**
 * IAMポリシードキュメントを生成
 */
const generatePolicy = (
  principalId: string,
  effect: 'Allow' | 'Deny',
  resource: string,
  context?: Record<string, string | number | boolean>
): APIGatewayAuthorizerResult => {
  const statement: Statement = {
    Action: 'execute-api:Invoke',
    Effect: effect,
    Resource: resource,
  };

  const policyDocument: PolicyDocument = {
    Version: '2012-10-17',
    Statement: [statement],
  };

  return {
    principalId,
    policyDocument,
    context,
  };
};

/**
 * Lambda Authorizer ハンドラー
 */
export const handler = async (
  event: APIGatewayTokenAuthorizerEvent
): Promise<APIGatewayAuthorizerResult> => {
  console.log('Authorizer invoked:', {
    type: event.type,
    methodArn: event.methodArn,
  });

  // デバッグ: JWT_SECRETの最初と最後の5文字をログ出力
  const jwtSecret = process.env.JWT_SECRET || 'not-set';
  console.log('JWT_SECRET (masked):', jwtSecret.substring(0, 5) + '...' + jwtSecret.substring(jwtSecret.length - 5));

  try {
    // Authorization headerからトークンを抽出
    const token = event.authorizationToken;

    if (!token) {
      console.error('No authorization token provided');
      throw new Error('Unauthorized');
    }

    // "Bearer " プレフィックスを削除
    const tokenValue = token.startsWith('Bearer ') ? token.substring(7) : token;

    // JWTトークンを検証
    const decoded: JWTPayload = verifyToken(tokenValue);

    console.log('Token verified successfully:', {
      userId: decoded.userId,
      role: decoded.role,
      orgId: decoded.orgId,
    });

    // メソッドARNから全てのリソースへのアクセスを許可するワイルドカードARNを生成
    const tmp = event.methodArn.split(':');
    const apiGatewayArnTmp = tmp[5].split('/');
    const awsAccountId = tmp[4];
    const region = tmp[3];
    const restApiId = apiGatewayArnTmp[0];
    const stage = apiGatewayArnTmp[1];
    const wildcard = `arn:aws:execute-api:${region}:${awsAccountId}:${restApiId}/${stage}/*/*`;

    // Generate Allow policy with authentication context
    // IMPORTANT: Context field names should match Prisma schema (orgId, not organizationId)
    return generatePolicy(decoded.userId, 'Allow', wildcard, {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      orgId: decoded.orgId, // Prisma: User.orgId
    });
  } catch (error) {
    console.error('Authorization failed:', error);

    // トークンが無効な場合はDenyポリシーを返す
    // Note: principalIdは必須だが、認証失敗時は"user"などのダミー値を使用
    throw new Error('Unauthorized');
  }
};
