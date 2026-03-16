/**
 * Create Test User Script
 *
 * Creates a test user in the database for E2E tests.
 * Run with: npx tsx tests/e2e/setup/create-test-user.ts
 */

import { PrismaClient } from '@prance/database';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const TEST_USER = {
  email: 'test@example.com',
  password: 'Test123!@#',
  name: 'Test User',
};

async function main() {
  console.log('Creating test user...');

  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: TEST_USER.email },
    });

    if (existingUser) {
      console.log('✅ Test user already exists:', TEST_USER.email);
      return;
    }

    // Get or create test organization
    let org = await prisma.organization.findFirst({
      where: { name: 'Test Organization' },
    });

    if (!org) {
      org = await prisma.organization.create({
        data: {
          name: 'Test Organization',
        },
      });
      console.log('✅ Created test organization');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(TEST_USER.password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: TEST_USER.email,
        name: TEST_USER.name,
        passwordHash,
        orgId: org.id,
        role: 'CLIENT_ADMIN',
      },
    });

    console.log('✅ Test user created successfully!');
    console.log('   Email:', user.email);
    console.log('   Password:', TEST_USER.password);
    console.log('   Organization:', org.name);
  } catch (error) {
    console.error('❌ Failed to create test user:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
