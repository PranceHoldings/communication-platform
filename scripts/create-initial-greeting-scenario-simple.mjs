#!/usr/bin/env node
/**
 * Creates a simple test scenario with initial greeting (no cloning)
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1';
const EMAIL = 'admin@prance.com';
const PASSWORD = 'Admin2026!Prance';

async function login() {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.status}`);
  }

  const data = await response.json();
  return data.data.tokens.accessToken;
}

async function createScenario(accessToken) {
  const scenario = {
    title: '[E2E Test] Initial Greeting Test',
    category: 'interview',
    language: 'en',
    description: 'Test scenario with initial greeting for E2E Part 2 tests',
    initialGreeting: 'Hello! Welcome to your interview session. My name is AI Assistant. How are you feeling today?',
    enableSilencePrompt: true,
    showSilenceTimer: true,
    silenceTimeout: 10,
    silenceThreshold: 0.05,
    minSilenceDuration: 500,
    visibility: 'PRIVATE',
    configJson: {},
  };

  const response = await fetch(`${API_URL}/scenarios`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(scenario),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Create scenario failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  return data.data;
}

async function getFirstAvatar(accessToken) {
  const response = await fetch(`${API_URL}/avatars?limit=1`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Get avatars failed: ${response.status}`);
  }

  const data = await response.json();
  const avatars = data.data?.avatars || data.data || [];

  if (avatars.length === 0) {
    throw new Error('No avatars found');
  }

  return avatars[0].id;
}

async function createSession(accessToken, scenarioId, avatarId) {
  const session = {
    scenarioId,
    avatarId,
    scheduledFor: null,
  };

  const response = await fetch(`${API_URL}/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(session),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Create session failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  return data.data;
}

async function main() {
  try {
    console.log('🔐 Logging in...');
    const accessToken = await login();
    console.log('✅ Login successful');

    console.log('🎭 Fetching avatar...');
    const avatarId = await getFirstAvatar(accessToken);
    console.log(`✅ Using avatar: ${avatarId}`);

    console.log('📝 Creating scenario with initial greeting...');
    const scenario = await createScenario(accessToken);
    console.log(`✅ Scenario created: ${scenario.id}`);
    console.log(`   Title: ${scenario.title}`);
    console.log(`   Initial Greeting: ${scenario.initialGreeting}`);

    console.log('🎬 Creating test session...');
    const session = await createSession(accessToken, scenario.id, avatarId);
    console.log(`✅ Session created: ${session.id}`);

    console.log('\n📋 Summary:');
    console.log(`Scenario ID: ${scenario.id}`);
    console.log(`Session ID: ${session.id}`);
    console.log(`Avatar ID: ${avatarId}`);
    console.log('\n✅ Ready for Stage 3 Part 2 tests!');

    // Write IDs to file for test usage
    const fs = await import('fs');
    const testData = {
      scenarioId: scenario.id,
      sessionId: session.id,
      avatarId: avatarId,
      createdAt: new Date().toISOString(),
      initialGreeting: scenario.initialGreeting,
    };
    fs.writeFileSync(
      '/workspaces/prance-communication-platform/apps/web/tests/e2e/test-data/greeting-scenario.json',
      JSON.stringify(testData, null, 2)
    );
    console.log('✅ Test data saved to: apps/web/tests/e2e/test-data/greeting-scenario.json');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
