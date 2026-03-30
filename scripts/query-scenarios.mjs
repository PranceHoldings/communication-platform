#!/usr/bin/env node
import { PrismaClient } from '@prance/database';

const prisma = new PrismaClient();

async function main() {
  try {
    const scenarios = await prisma.scenario.findMany({
      where: {
        orgId: '8d4cab88-ab01-41e0-a59c-b93aeabfdbe6'
      },
      select: {
        id: true,
        title: true,
        initialGreeting: true,
        category: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });

    console.log('Found scenarios:', scenarios.length);
    console.log(JSON.stringify(scenarios, null, 2));
  } catch (error) {
    console.error('Error querying scenarios:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
