/**
 * Create E2E Test Scenario
 *
 * Creates a properly configured scenario for E2E testing with all required fields
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(__dirname, '../../../.env.local') });

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'admin@prance.com';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'Admin2026!Prance';

if (!API_URL) {
  console.error('❌ NEXT_PUBLIC_API_URL is not set in .env.local');
  process.exit(1);
}

async function login(): Promise<string> {
  console.log('🔐 Logging in as', TEST_USER_EMAIL);

  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Login failed: ${response.status} ${error}`);
  }

  const data = await response.json();
  const token = data.data?.tokens?.accessToken;
  console.log('✅ Login successful');
  return token;
}

async function createScenario(token: string) {
  const scenarioData = {
    title: 'E2E Test - Complete Scenario',
    category: 'interview',
    language: 'en',
    visibility: 'PUBLIC',
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
      description: 'E2E test scenario with all required fields properly configured',
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
  };

  console.log('\n📝 Creating E2E test scenario...');
  console.log('   Title:', scenarioData.title);

  const response = await fetch(`${API_URL}/scenarios`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(scenarioData),
  });

  console.log('   Response status:', response.status);

  if (!response.ok) {
    const error = await response.text();
    console.error('   Error response:', error);
    throw new Error(`Failed to create scenario: ${response.status}`);
  }

  const data = await response.json();
  const scenario = data.data || data;

  console.log('✅ Scenario created successfully!');
  console.log('   ID:', scenario.id);
  console.log('   Title:', scenario.title);

  return scenario;
}

async function main() {
  console.log('🔧 E2E Test Scenario Creator\n');
  console.log('═══════════════════════════════════════════');

  try {
    const token = await login();
    const scenario = await createScenario(token);

    console.log('\n═══════════════════════════════════════════');
    console.log('✅ Setup complete!\n');
    console.log('Scenario Details:');
    console.log(`- ID: ${scenario.id}`);
    console.log(`- Title: ${scenario.title}`);
    console.log(`- Language: ${scenario.language}`);
    console.log(`- Has systemPrompt: ${!!scenario.configJson?.systemPrompt}`);
    console.log(`- Has initialGreeting: ${!!scenario.initialGreeting}`);
    console.log('\n🧪 You can now run E2E tests with this scenario');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
