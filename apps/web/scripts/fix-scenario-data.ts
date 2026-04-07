/**
 * Fix Scenario Data via API
 *
 * Adds missing required fields to existing scenarios:
 * - configJson.systemPrompt (required, >= 20 chars)
 * - initialGreeting (recommended)
 * - silence management fields
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

interface Scenario {
  id: string;
  title: string;
  category: string;
  language: string;
  configJson: any;
  initialGreeting?: string | null;
  silenceTimeout?: number | null;
  silencePromptTimeout?: number | null;
  enableSilencePrompt?: boolean | null;
  silenceThreshold?: number | null;
  minSilenceDuration?: number | null;
  showSilenceTimer?: boolean | null;
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
  console.log('✅ Login successful');
  const token = data.data?.tokens?.accessToken || data.data?.accessToken || data.accessToken;
  if (!token) {
    console.error('   Full response:', JSON.stringify(data, null, 2));
    throw new Error('No access token in response');
  }
  console.log('   Token (first 20 chars):', token.substring(0, 20));
  return token;
}

async function getScenarios(token: string): Promise<Scenario[]> {
  console.log('\n📥 Fetching scenarios...');
  console.log('   URL:', `${API_URL}/scenarios?limit=100`);
  console.log('   Token (first 20 chars):', token.substring(0, 20));

  const response = await fetch(`${API_URL}/scenarios?limit=100`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  console.log('   Response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('   Error response:', errorText);
    throw new Error(`Failed to fetch scenarios: ${response.status}`);
  }

  const data = await response.json();
  const scenarios = data.data?.scenarios || data.scenarios || [];
  console.log(`✅ Found ${scenarios.length} scenarios`);
  return scenarios;
}

async function updateScenario(token: string, scenarioId: string, updates: Partial<Scenario>): Promise<void> {
  console.log(`   Sending updates:`, JSON.stringify(updates, null, 2).substring(0, 500));

  const response = await fetch(`${API_URL}/scenarios/${scenarioId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });

  console.log(`   Response status:`, response.status);

  if (!response.ok) {
    const error = await response.text();
    console.error(`   Error response:`, error);
    throw new Error(`Failed to update scenario: ${response.status} ${error}`);
  }
}

function needsUpdate(scenario: Scenario): boolean {
  const configJson = scenario.configJson || {};
  const systemPrompt = configJson.systemPrompt;

  // Check if systemPrompt is missing or too short
  if (!systemPrompt || systemPrompt.length < 20) {
    return true;
  }

  // Check if recommended fields are missing
  if (!scenario.initialGreeting) {
    return true;
  }

  if (scenario.silenceTimeout === null || scenario.silenceTimeout === undefined) {
    return true;
  }

  return false;
}

function generateSystemPrompt(scenario: Scenario): string {
  const { title, category } = scenario;

  // Generate a comprehensive system prompt based on scenario type
  if (category === 'interview') {
    return `You are a professional interviewer conducting a ${title}.

Your role is to:
- Ask clear, relevant questions about the candidate's background and skills
- Listen carefully to their responses
- Provide follow-up questions based on their answers
- Be professional, encouraging, and constructive
- Help the candidate showcase their abilities

Start by introducing yourself and explaining the interview process.`;
  }

  if (category === 'customer_service') {
    return `You are a customer service representative for ${title}.

Your role is to:
- Listen empathetically to customer concerns
- Ask clarifying questions to understand the issue
- Provide helpful solutions or escalate when needed
- Maintain a friendly and professional demeanor
- Ensure customer satisfaction

Start by greeting the customer and asking how you can help them today.`;
  }

  // Default general-purpose prompt
  return `You are an AI assistant for the scenario: ${title}.

Your role is to:
- Engage in natural, helpful conversation
- Listen carefully to user input
- Provide relevant responses based on the context
- Be professional and courteous
- Help users achieve their goals in this scenario

Start by introducing yourself and the purpose of this session.`;
}

function generateInitialGreeting(scenario: Scenario): string {
  const { title, category } = scenario;

  if (category === 'interview') {
    return `Hello! Thank you for joining this ${title}. I'll be conducting your interview today. Let's begin by having you introduce yourself.`;
  }

  if (category === 'customer_service') {
    return `Hi! Welcome to our customer support. I'm here to help you with any questions or issues you have. How can I assist you today?`;
  }

  return `Hello! Welcome to this session. I'm here to help you with ${title}. Let's get started!`;
}

async function main() {
  console.log('🔧 Scenario Data Fix Tool\n');
  console.log('═══════════════════════════════════════════');

  try {
    // Login
    const token = await login();

    // Fetch scenarios
    const scenarios = await getScenarios(token);

    // Identify scenarios needing updates
    const scenariosToUpdate = scenarios.filter(needsUpdate);

    if (scenariosToUpdate.length === 0) {
      console.log('\n✅ All scenarios are properly configured!');
      return;
    }

    console.log(`\n⚠️  Found ${scenariosToUpdate.length} scenarios needing updates:\n`);
    scenariosToUpdate.forEach((s, i) => {
      console.log(`${i + 1}. ${s.title} (${s.id})`);
      const issues = [];
      if (!s.configJson?.systemPrompt || s.configJson.systemPrompt.length < 20) {
        issues.push('systemPrompt missing/too short');
      }
      if (!s.initialGreeting) {
        issues.push('initialGreeting missing');
      }
      if (s.silenceTimeout === null || s.silenceTimeout === undefined) {
        issues.push('silenceTimeout not set');
      }
      console.log(`   Issues: ${issues.join(', ')}`);
    });

    console.log('\n🔄 Updating scenarios...\n');

    // Update each scenario
    for (const scenario of scenariosToUpdate) {
      console.log(`📝 Updating: ${scenario.title}`);

      const configJson = scenario.configJson || {};

      // Add system prompt if missing or too short
      if (!configJson.systemPrompt || configJson.systemPrompt.length < 20) {
        configJson.systemPrompt = generateSystemPrompt(scenario);
        console.log(`   ✓ Added systemPrompt (${configJson.systemPrompt.length} chars)`);
      }

      const updates: Partial<Scenario> = {
        configJson,
      };

      // Add initialGreeting if missing
      if (!scenario.initialGreeting) {
        updates.initialGreeting = generateInitialGreeting(scenario);
        console.log(`   ✓ Added initialGreeting`);
      }

      // Add silence management fields if missing
      if (scenario.silenceTimeout === null || scenario.silenceTimeout === undefined) {
        updates.silenceTimeout = 10; // 10 seconds default
        console.log(`   ✓ Set silenceTimeout: 10s`);
      }

      if (scenario.silencePromptTimeout === null || scenario.silencePromptTimeout === undefined) {
        updates.silencePromptTimeout = 15; // 15 seconds default
      }

      if (scenario.enableSilencePrompt === null || scenario.enableSilencePrompt === undefined) {
        updates.enableSilencePrompt = true;
      }

      if (scenario.silenceThreshold === null || scenario.silenceThreshold === undefined) {
        updates.silenceThreshold = 0.01; // Very low threshold
      }

      if (scenario.minSilenceDuration === null || scenario.minSilenceDuration === undefined) {
        updates.minSilenceDuration = 1500; // 1.5 seconds
      }

      if (scenario.showSilenceTimer === null || scenario.showSilenceTimer === undefined) {
        updates.showSilenceTimer = true;
      }

      await updateScenario(token, scenario.id, updates);
      console.log(`   ✅ Updated successfully\n`);
    }

    console.log('═══════════════════════════════════════════');
    console.log('✅ All scenarios updated successfully!\n');
    console.log('Summary:');
    console.log(`- Updated: ${scenariosToUpdate.length} scenarios`);
    console.log(`- Total: ${scenarios.length} scenarios`);
    console.log('\n🧪 You can now run E2E tests:');
    console.log('   npm run test:e2e -- websocket-connection.spec.ts');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
