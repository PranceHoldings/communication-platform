/**
 * Create Super Admin Account
 *
 * Creates a SUPER_ADMIN user account with:
 * - Email: admin@prance.com
 * - Password: Admin2026!Prance
 * - Role: SUPER_ADMIN
 * - Organization: Platform Administration
 */

import { PrismaClient } from '../../../packages/database/node_modules/.prisma/client/index.js';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Creating Super Admin account...\n');

  // Check if super admin already exists
  const existingAdmin = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN' },
  });

  if (existingAdmin) {
    console.log('❌ Super Admin already exists:');
    console.log(`   Email: ${existingAdmin.email}`);
    console.log(`   Name: ${existingAdmin.name}`);
    console.log(`   ID: ${existingAdmin.id}\n`);
    console.log('ℹ️  If you need to reset the password, please update manually in the database.');
    return;
  }

  // Create Platform Administration organization
  console.log('Creating Platform Administration organization...');
  const org = await prisma.organization.create({
    data: {
      name: 'Platform Administration',
    },
  });
  console.log(`✓ Created organization: ${org.name} (${org.id})\n`);

  // Hash password
  const email = 'admin@prance.com';
  const password = 'Admin2026!Prance';
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create super admin user
  console.log('Creating SUPER_ADMIN user...');
  const admin = await prisma.user.create({
    data: {
      email,
      name: 'Platform Administrator',
      passwordHash: hashedPassword,
      cognitoSub: 'super-admin-' + Date.now(),
      role: 'SUPER_ADMIN',
      orgId: org.id,
    },
  });

  console.log('✅ Super Admin account created successfully!\n');
  console.log('═══════════════════════════════════════════');
  console.log('📧 Email:    admin@prance.com');
  console.log('🔐 Password: Admin2026!Prance');
  console.log('👤 Role:     SUPER_ADMIN');
  console.log('🆔 User ID:  ' + admin.id);
  console.log('🏢 Org ID:   ' + org.id);
  console.log('═══════════════════════════════════════════\n');
  console.log('⚠️  IMPORTANT: Store these credentials securely!');
  console.log('⚠️  Change the password after first login.\n');
}

main()
  .catch(e => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
