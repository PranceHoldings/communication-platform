/**
 * Prismaクライアント
 * Lambda関数間で共有されるシングルトンインスタンス
 */

import { PrismaClient } from '@prisma/client';

// グローバルにPrismaクライアントを保持（Lambda コールド/ウォームスタート対応）
declare global {
  var prisma: PrismaClient | undefined;
}

/**
 * Prismaクライアントのシングルトンインスタンス
 */
export const prisma =
  global.prisma ||
  new PrismaClient({
    log: process.env.ENVIRONMENT === 'dev' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.ENVIRONMENT !== 'production') {
  global.prisma = prisma;
}

/**
 * Lambda終了時にPrisma接続をクリーンアップ
 */
export const disconnectPrisma = async (): Promise<void> => {
  await prisma.$disconnect();
};
