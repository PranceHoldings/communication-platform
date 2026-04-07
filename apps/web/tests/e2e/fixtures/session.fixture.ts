/**
 * Session Fixture for E2E Tests
 *
 * Provides a valid test session ID from the database for E2E tests.
 * For recording tests (Stage 4), provides a session with completed recordings.
 */

import { test as base } from './auth.fixture';

interface SessionFixture {
  testSessionId: string;
  testSessionWithRecordingId: string;
  testSessionWithTimerId: string;
  greetingTestSessionId: string;
}

/**
 * Greeting scenario and avatar IDs for stage3-part2 tests.
 * The scenario has initialGreeting + systemPrompt configured.
 */
const GREETING_SCENARIO_ID = '4c781d7a-3bba-483f-88a2-c929ba6480e4';
const GREETING_AVATAR_ID = 'af54feb4-86e3-4597-ae78-3a40b14f545a';

/**
 * Known test session with recordings for E2E tests
 * This session has been prepared with COMPLETED status and recordings
 */
const KNOWN_TEST_SESSION_WITH_RECORDING = '44040076-ebb5-4579-b019-e81c0ad1713c';

/**
 * E2E Test scenario with initialGreeting + systemPrompt configured.
 * Used by testSessionId fixture for Stage 3 full E2E tests.
 * Scenario: "E2E Test - Complete Scenario"
 */
const E2E_TEST_SCENARIO_ID = '050dcffe-d4c6-4ddf-9c88-fff799220d73';
const E2E_TEST_AVATAR_ID = 'af54feb4-86e3-4597-ae78-3a40b14f545a';

export const test = base.extend<SessionFixture>({
  testSessionId: async ({ authenticatedPage }, use) => {
    // Provide a session where the SessionPlayer UI is rendered (status = ACTIVE).
    // Strategy:
    //   1. Check recent sessions for an ACTIVE one.
    //   2. If none exists, create a fresh session using the most recent session's
    //      scenarioId + avatarId so we always have a predictable ACTIVE session.
    try {
      const accessToken = await authenticatedPage.evaluate(() => {
        return localStorage.getItem('accessToken');
      });

      if (!accessToken) {
        throw new Error('No access token found in localStorage');
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      if (!apiUrl) {
        throw new Error(
          'NEXT_PUBLIC_API_URL environment variable is required for E2E tests. ' +
            'Please set it in .env.local or configure it in your environment.'
        );
      }

      const authHeaders = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      };

      console.log(`🔑 Access Token: ${accessToken.substring(0, 20)}...`);
      console.log(`🌐 API URL: ${apiUrl}/sessions?limit=10`);

      const response = await authenticatedPage.request.get(`${apiUrl}/sessions?limit=10`, {
        headers: authHeaders,
      });

      console.log(`📡 Response Status: ${response.status()}`);

      if (!response.ok()) {
        const body = await response.text();
        console.log(`❌ Response Body: ${body}`);
        throw new Error(`API request failed: ${response.status()} ${response.statusText()}`);
      }

      const data = await response.json();
      const sessions = data.data?.sessions || data.sessions || [];
      console.log(`📊 Found ${sessions.length} sessions`);

      // Prefer an ACTIVE session — it renders SessionPlayer (the component under test)
      const activeSession = sessions.find((s: any) => s.status === 'ACTIVE');
      if (activeSession) {
        console.log(`✅ Found ACTIVE session: ${activeSession.id}`);
        await use(activeSession.id);
        return;
      }

      // No ACTIVE session — create one so the page shows SessionPlayer
      console.log('⚠️  No ACTIVE session found. Creating a fresh session for UI tests...');

      if (sessions.length === 0) {
        throw new Error(
          'No sessions found in database. Please create at least one session before running E2E tests.'
        );
      }

      // Always create new sessions with the known E2E test scenario for predictable behavior
      const createResponse = await authenticatedPage.request.post(`${apiUrl}/sessions`, {
        headers: authHeaders,
        data: { scenarioId: E2E_TEST_SCENARIO_ID, avatarId: E2E_TEST_AVATAR_ID },
      });

      if (!createResponse.ok()) {
        // Fall back to any session if creation fails
        console.warn(`⚠️  Session creation failed (${createResponse.status()}). Falling back to most recent session.`);
        console.log(`✅ Using fallback session ID: ${sessions[0].id}`);
        await use(sessions[0].id);
        return;
      }

      const created = await createResponse.json();
      const newSessionId = (created.data || created).id;
      console.log(`✅ Created fresh ACTIVE session: ${newSessionId}`);
      await use(newSessionId);

    } catch (error) {
      console.error('Failed to fetch/create test session:', error);
      throw new Error(
        'Could not obtain a test session. Ensure the API is running and at least one session exists.'
      );
    }
  },

  testSessionWithRecordingId: async ({ authenticatedPage }, use) => {
    // Try to use the known test session with recordings first
    try {
      const accessToken = await authenticatedPage.evaluate(() => {
        return localStorage.getItem('accessToken');
      });

      if (!accessToken) {
        throw new Error('No access token found in localStorage');
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      if (!apiUrl) {
        throw new Error(
          'NEXT_PUBLIC_API_URL environment variable is required for E2E tests. ' +
            'Please set it in .env.local or configure it in your environment.'
        );
      }

      console.log(`🔑 Access Token (Recording): ${accessToken.substring(0, 20)}...`);

      // Step 1: Try to fetch the known test session directly
      console.log(`🎯 Attempting to use known test session: ${KNOWN_TEST_SESSION_WITH_RECORDING}`);

      const knownSessionResponse = await authenticatedPage.request.get(
        `${apiUrl}/sessions/${KNOWN_TEST_SESSION_WITH_RECORDING}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (knownSessionResponse.ok()) {
        const knownSessionData = await knownSessionResponse.json();
        const knownSession = knownSessionData.data || knownSessionData;

        console.log(`🔍 Known session status: ${knownSession.status}`);
        console.log(`🔍 Known session recordings count: ${knownSession.recordings?.length || 0}`);

        // Validate that the known session has recordings
        if (
          knownSession.status === 'COMPLETED' &&
          knownSession.recordings &&
          Array.isArray(knownSession.recordings) &&
          knownSession.recordings.length > 0
        ) {
          const recordingCount = knownSession.recordings.length;
          console.log(`✅ Using known test session: ${KNOWN_TEST_SESSION_WITH_RECORDING} (${recordingCount} recordings)`);
          await use(KNOWN_TEST_SESSION_WITH_RECORDING);
          return;
        } else {
          console.warn(`⚠️  Known test session exists but doesn't have recordings. Falling back to search...`);
        }
      } else {
        console.warn(`⚠️  Known test session not found (${knownSessionResponse.status()}). Falling back to search...`);
      }

      // Step 2: Fallback - Search for any session with recordings
      console.log(`🔍 Searching for sessions with recordings (limit: 50)...`);

      const response = await authenticatedPage.request.get(`${apiUrl}/sessions?limit=50`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      console.log(`📡 Response Status (Recording): ${response.status()}`);

      if (!response.ok()) {
        const body = await response.text();
        console.log(`❌ Response Body (Recording): ${body}`);
        throw new Error(`API request failed: ${response.status()} ${response.statusText()}`);
      }

      const data = await response.json();
      const sessions = data.data?.sessions || data.sessions || [];
      console.log(`📊 Found ${sessions.length} total sessions`);

      // Filter for sessions with recordings
      const sessionsWithRecordings = sessions.filter((session: any) => {
        return (
          session.status === 'COMPLETED' &&
          session.recordings &&
          Array.isArray(session.recordings) &&
          session.recordings.length > 0
        );
      });

      console.log(`🎬 Found ${sessionsWithRecordings.length} sessions with recordings`);

      if (sessionsWithRecordings.length === 0) {
        console.warn('⚠️  No sessions with recordings found. Attempting to use fallback...');

        // Fallback: try to find any COMPLETED session
        const completedSessions = sessions.filter((s: any) => s.status === 'COMPLETED');

        if (completedSessions.length > 0) {
          const sessionId = completedSessions[0].id;
          console.log(`⚠️  Using fallback COMPLETED session: ${sessionId} (may not have recordings)`);
          await use(sessionId);
          return;
        }

        // Last resort: use any session
        if (sessions.length > 0) {
          const sessionId = sessions[0].id;
          console.log(`⚠️  Using fallback session: ${sessionId} (may not be completed)`);
          await use(sessionId);
          return;
        }

        throw new Error(
          'No sessions with recordings found. Please complete a session with recording before running Stage 4 tests.'
        );
      }

      const sessionId = sessionsWithRecordings[0].id;
      const recordingCount = sessionsWithRecordings[0].recordings?.length || 0;
      console.log(`✅ Using test session with recording: ${sessionId} (${recordingCount} recordings)`);

      await use(sessionId);
    } catch (error) {
      console.error('Failed to fetch test session with recording:', error);
      throw new Error(
        'Could not fetch test session with recording. Ensure at least one completed session with recording exists.'
      );
    }
  },

  testSessionWithTimerId: async ({ authenticatedPage }, use) => {
    // For silence timer tests (S2-003, S2-004, S2-005)
    // Note: In mock environment, timer visibility is controlled by scenario.showSilenceTimer
    // Since we cannot modify the scenario from E2E tests, these tests should verify
    // the timer behavior when it's visible, or be skipped if not visible.
    // In Stage 3 (real integration), we can create a dedicated scenario with timer enabled.

    // For now, use the same session as testSessionId
    // Timer tests will check visibility first and skip assertions if not visible
    try {
      const accessToken = await authenticatedPage.evaluate(() => {
        return localStorage.getItem('accessToken');
      });

      if (!accessToken) {
        throw new Error('No access token found in localStorage');
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      if (!apiUrl) {
        throw new Error(
          'NEXT_PUBLIC_API_URL environment variable is required for E2E tests.'
        );
      }

      const response = await authenticatedPage.request.get(`${apiUrl}/sessions?limit=1`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok()) {
        throw new Error(`API request failed: ${response.status()}`);
      }

      const data = await response.json();
      const sessions = data.data?.sessions || data.sessions || [];

      if (sessions.length === 0) {
        throw new Error('No sessions found for timer tests.');
      }

      const sessionId = sessions[0].id;
      console.log(`✅ Using session for timer tests: ${sessionId} (timer visibility depends on scenario settings)`);

      await use(sessionId);
    } catch (error) {
      console.error('Failed to fetch test session for timer:', error);
      throw new Error('Could not fetch test session for timer tests.');
    }
  },

  greetingTestSessionId: async ({ authenticatedPage }, use) => {
    // Always create a fresh ACTIVE session using the greeting scenario.
    // A new session is required per test because each test run completes the session
    // (changing status to COMPLETED), which makes the session unusable for subsequent runs.
    try {
      const accessToken = await authenticatedPage.evaluate(() => {
        return localStorage.getItem('accessToken');
      });

      if (!accessToken) {
        throw new Error('No access token found in localStorage');
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) {
        throw new Error('NEXT_PUBLIC_API_URL is required');
      }

      const authHeaders = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      };

      console.log(`🎙️  Creating fresh session for greeting test (scenario: ${GREETING_SCENARIO_ID})`);

      const createResponse = await authenticatedPage.request.post(`${apiUrl}/sessions`, {
        headers: authHeaders,
        data: { scenarioId: GREETING_SCENARIO_ID, avatarId: GREETING_AVATAR_ID },
      });

      if (!createResponse.ok()) {
        const body = await createResponse.text();
        throw new Error(`Failed to create greeting test session: ${createResponse.status()} - ${body}`);
      }

      const created = await createResponse.json();
      const newSessionId = (created.data || created).id;
      console.log(`✅ Created fresh greeting test session: ${newSessionId}`);

      await use(newSessionId);
    } catch (error) {
      console.error('Failed to create greeting test session:', error);
      throw new Error(`Could not create greeting test session: ${error}`);
    }
  },
});

export { expect } from '@playwright/test';
