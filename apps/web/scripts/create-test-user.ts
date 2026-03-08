/**
 * Create Test User Account
 *
 * Creates a CLIENT_ADMIN user account with:
 * - Email: test@example.com
 * - Password: Test2026!
 */

import { PrismaClient } from '../../../packages/database/node_modules/.prisma/client/index.js';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Creating Test User account...\n');

  // Check if test user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: 'test@example.com' },
  });

  if (existingUser) {
    console.log('❌ Test user already exists:');
    console.log(`   Email: ${existingUser.email}`);
    console.log(`   Name: ${existingUser.name}`);
    console.log(`   ID: ${existingUser.id}\n`);
    return;
  }

  // Create Test Organization
  console.log('Creating Test Organization...');
  const org = await prisma.organization.create({
    data: {
      name: 'Test Organization',
    },
  });
  console.log(`✓ Created organization: ${org.name} (${org.id})\n`);

  // Hash password
  const email = 'test@example.com';
  const password = 'Test2026!';
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create test user
  console.log('Creating CLIENT_ADMIN user...');
  const user = await prisma.user.create({
    data: {
      email,
      name: 'Test User',
      passwordHash: hashedPassword,
      cognitoSub: 'test-user-' + Date.now(),
      role: 'CLIENT_ADMIN',
      orgId: org.id,
    },
  });

  console.log('✅ Test User account created successfully!\n');
  console.log('═══════════════════════════════════════════');
  console.log('📧 Email:    test@example.com');
  console.log('🔐 Password: Test2026!');
  console.log('👤 Role:     CLIENT_ADMIN');
  console.log('🆔 User ID:  ' + user.id);
  console.log('🏢 Org ID:   ' + org.id);
  console.log('═══════════════════════════════════════════\n');
}

main()
  .catch(e => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
