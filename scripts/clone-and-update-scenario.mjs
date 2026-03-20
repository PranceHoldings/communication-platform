#!/usr/bin/env node
/**
 * Clones an existing scenario and updates it with initial greeting
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

async function getFirstScenario(accessToken) {
  const response = await fetch(`${API_URL}/scenarios?limit=1`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Get scenarios failed: ${response.status}`);
  }

  const data = await response.json();
  const scenarios = data.data?.scenarios || [];

  if (scenarios.length === 0) {
    throw new Error('No scenarios found');
  }

  return scenarios[0];
}

async function cloneScenario(accessToken, scenarioId) {
  const response = await fetch(`${API_URL}/scenarios/${scenarioId}/clone`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Clone scenario failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  return data.data;
}

async function updateScenario(accessToken, scenarioId, updates) {
  const response = await fetch(`${API_URL}/scenarios/${scenarioId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Update scenario failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  return data.data;
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

    console.log('📖 Fetching existing scenario...');
    const existingScenario = await getFirstScenario(accessToken);
    console.log(`✅ Found scenario: ${existingScenario.id} - ${existingScenario.title}`);

    console.log('📋 Cloning scenario...');
    const clonedScenario = await cloneScenario(accessToken, existingScenario.id);
    console.log(`✅ Cloned scenario: ${clonedScenario.id}`);

    console.log('✏️  Updating scenario with initial greeting...');
    const updates = {
      title: '[E2E Test] Initial Greeting Scenario',
      initialGreeting: 'Hello! Welcome to your interview session. My name is AI Assistant. How are you feeling today?',
      showSilenceTimer: true,
      enableSilencePrompt: true,
    };

    const updatedScenario = await updateScenario(accessToken, clonedScenario.id, updates);
    console.log(`✅ Updated scenario: ${updatedScenario.title}`);
    console.log(`   Initial Greeting: ${updatedScenario.initialGreeting}`);

    console.log('🎬 Creating test session...');
    const session = await createSession(accessToken, updatedScenario.id, existingScenario.avatarId || '89c0236b-a02b-4cf3-ba50-4385f9d937ef');
    console.log(`✅ Session created: ${session.id}`);

    console.log('\n📋 Summary:');
    console.log(`Scenario ID: ${updatedScenario.id}`);
    console.log(`Session ID: ${session.id}`);
    console.log(`Avatar ID: ${existingScenario.avatarId || '89c0236b-a02b-4cf3-ba50-4385f9d937ef'}`);
    console.log('\n✅ Ready for Stage 3 Part 2 tests!');

    // Write IDs to file for test usage
    const fs = await import('fs');
    const testData = {
      scenarioId: updatedScenario.id,
      sessionId: session.id,
      avatarId: existingScenario.avatarId || '89c0236b-a02b-4cf3-ba50-4385f9d937ef',
      createdAt: new Date().toISOString(),
      initialGreeting: updatedScenario.initialGreeting,
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
