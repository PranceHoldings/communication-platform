/**
 * Test Data Seeding Script
 *
 * Creates:
 * - Test User (test@example.com / Test2026!)
 * - 2 Avatars (1 with cloning allowed, 1 without)
 * - 2 Scenarios (Interview Practice, Customer Support)
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from root .env.local
config({ path: resolve(__dirname, '../../../.env.local') });

import { PrismaClient } from '../../../packages/database/node_modules/.prisma/client/index.js';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting test data creation...\n');

  // Get or create organization
  let org = await prisma.organization.findFirst();
  if (!org) {
    console.log('Creating test organization...');
    org = await prisma.organization.create({
      data: {
        name: 'Test Organization',
      },
    });
    console.log(`✓ Created organization: ${org.name} (${org.id})\n`);
  } else {
    console.log(`Using existing organization: ${org.name} (${org.id})\n`);
  }

  // Get or create user
  let user = await prisma.user.findFirst({ where: { orgId: org.id } });
  if (!user) {
    console.log('Creating test user...');
    const testPassword = 'Test2026!';
    const hashedPassword = await bcrypt.hash(testPassword, 10);

    user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test User',
        passwordHash: hashedPassword,
        cognitoSub: 'test-cognito-sub-' + Date.now(),
        role: 'CLIENT_ADMIN',
        orgId: org.id,
      },
    });
    console.log(`✓ Created user: ${user.email} (${user.id})`);
    console.log(`  Password: ${testPassword}\n`);
  } else {
    console.log(`Using existing user: ${user.email} (${user.id})\n`);
  }

  // Create Avatars
  console.log('Creating avatars...');

  const avatar1 = await prisma.avatar.create({
    data: {
      name: 'Emma - Professional Interviewer',
      type: 'THREE_D',
      style: 'REALISTIC',
      source: 'PRESET',
      modelUrl: 'https://models.readyplayer.me/65f8b3e2c1d4a2001234abcd.glb',
      thumbnailUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emma',
      tags: ['professional', 'interviewer', 'realistic'],
      visibility: 'PUBLIC',
      allowCloning: true,
      orgId: user.orgId,
      userId: null, // System preset
    },
  });
  console.log(`✓ Created: ${avatar1.name} (ID: ${avatar1.id})`);

  const avatar2 = await prisma.avatar.create({
    data: {
      name: 'Yuki - Anime Support Agent',
      type: 'TWO_D',
      style: 'ANIME',
      source: 'GENERATED',
      modelUrl: 'https://models.example.com/yuki-live2d-model.json',
      thumbnailUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Yuki',
      tags: ['anime', 'support', 'friendly'],
      visibility: 'ORGANIZATION',
      allowCloning: false,
      orgId: user.orgId,
      userId: user.id,
    },
  });
  console.log(`✓ Created: ${avatar2.name} (ID: ${avatar2.id})`);

  // Create Scenarios
  console.log('\nCreating scenarios...');

  const scenario1 = await prisma.scenario.create({
    data: {
      title: 'Technical Interview - Software Engineer',
      category: 'interview',
      language: 'en',
      visibility: 'PUBLIC',
      orgId: user.orgId,
      userId: null, // System preset
      initialGreeting: 'Hello! I\'m Emma, and I\'ll be conducting your technical interview today. Let\'s start by having you tell me a bit about your software engineering experience.',
      silenceTimeout: 10,
      silencePromptTimeout: 15,
      enableSilencePrompt: true,
      silenceThreshold: 0.01,
      minSilenceDuration: 1500,
      showSilenceTimer: true,
      configJson: {
        difficulty: 'INTERMEDIATE',
        estimatedDuration: 1800, // 30 minutes
        description: 'Practice technical interview questions for software engineering positions',
        instructions: {
          objective: 'Assess candidate technical skills and problem-solving abilities',
          topics: ['Data structures', 'Algorithms', 'System design', 'Coding best practices'],
          format: 'Interactive Q&A with live coding exercises',
        },
        systemPrompt: `You are Emma, a professional technical interviewer at a leading tech company.
Your role is to conduct a technical interview for a Software Engineer position.

Key behaviors:
- Ask clear, technical questions about data structures, algorithms, and system design
- Listen carefully to candidate responses
- Provide hints if the candidate struggles, but don't give away answers
- Be professional, encouraging, and constructive
- Adjust difficulty based on candidate performance
- Conclude with constructive feedback

Start by introducing yourself and asking about the candidate's experience.`,
      },
    },
  });
  console.log(`✓ Created: ${scenario1.title} (ID: ${scenario1.id})`);

  const scenario2 = await prisma.scenario.create({
    data: {
      title: 'Customer Support - Product Issue Resolution',
      category: 'customer_service',
      language: 'en',
      visibility: 'ORGANIZATION',
      orgId: user.orgId,
      userId: user.id,
      initialGreeting: 'Hi, this is Yuki from customer support. I understand you\'re having an issue with your product. Could you please describe what\'s happening?',
      silenceTimeout: 8,
      silencePromptTimeout: 12,
      enableSilencePrompt: true,
      silenceThreshold: 0.01,
      minSilenceDuration: 1500,
      showSilenceTimer: true,
      configJson: {
        difficulty: 'BEGINNER',
        estimatedDuration: 900, // 15 minutes
        description: 'Handle customer complaints and resolve product issues professionally',
        instructions: {
          objective: 'Practice professional customer service skills',
          scenarios: ['Product defect', 'Service complaint', 'Refund request'],
          skills: ['Active listening', 'Empathy', 'Problem solving', 'Clear communication'],
        },
        systemPrompt: `You are Yuki, a friendly customer support representative.
You have received a product that doesn't work properly and you're calling customer support.

Key behaviors:
- Express frustration appropriately (not too aggressive, but clearly upset)
- Explain the problem clearly
- Ask for solutions or compensation
- React positively to good customer service
- Become more cooperative when treated with respect and empathy
- End the call satisfied if the issue is resolved well

Start by calling the support line and explaining your issue with the product.`,
      },
    },
  });
  console.log(`✓ Created: ${scenario2.title} (ID: ${scenario2.id})`);

  console.log('\n✅ Test data created successfully!');
  console.log('\n═══════════════════════════════════════════');
  console.log('Test User Credentials:');
  console.log('📧 Email:    test@example.com');
  console.log('🔐 Password: Test2026!');
  console.log('═══════════════════════════════════════════');
  console.log('\nSummary:');
  console.log(`- Avatars: ${[avatar1.name, avatar2.name].join(', ')}`);
  console.log(`- Scenarios: ${[scenario1.title, scenario2.title].join(', ')}`);
  console.log('\nYou can now:');
  console.log('1. Login at: https://dev.app.prance.jp/login');
  console.log('2. View avatars at: https://dev.app.prance.jp/dashboard/avatars');
  console.log('3. Create a session at: https://dev.app.prance.jp/dashboard/sessions/new');
}

main()
  .catch(error => {
    console.error('Error creating test data:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
