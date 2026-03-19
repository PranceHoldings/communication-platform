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
}

/**
 * Known test session with recordings for E2E tests
 * This session has been prepared with COMPLETED status and recordings
 */
const KNOWN_TEST_SESSION_WITH_RECORDING = '44040076-ebb5-4579-b019-e81c0ad1713c';

export const test = base.extend<SessionFixture>({
  testSessionId: async ({ authenticatedPage }, use) => {
    // Fetch any session from the API
    try {
      const accessToken = await authenticatedPage.evaluate(() => {
        return localStorage.getItem('accessToken');
      });

      if (!accessToken) {
        throw new Error('No access token found in localStorage');
      }

      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL ||
        'https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1';

      console.log(`🔑 Access Token: ${accessToken.substring(0, 20)}...`);
      console.log(`🌐 API URL: ${apiUrl}/sessions?limit=1`);

      const response = await authenticatedPage.request.get(`${apiUrl}/sessions?limit=1`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      console.log(`📡 Response Status: ${response.status()}`);

      if (!response.ok()) {
        const body = await response.text();
        console.log(`❌ Response Body: ${body}`);
        throw new Error(`API request failed: ${response.status()} ${response.statusText()}`);
      }

      const data = await response.json();
      console.log(`📦 Sessions API Response: ${JSON.stringify(data).substring(0, 300)}...`);

      const sessions = data.data?.sessions || data.sessions || [];
      console.log(`📊 Found ${sessions.length} sessions`);

      if (sessions.length === 0) {
        throw new Error(
          'No sessions found in database. Please create at least one session before running E2E tests.'
        );
      }

      const sessionId = sessions[0].id;
      console.log(`✅ Using test session ID: ${sessionId}`);

      await use(sessionId);
    } catch (error) {
      console.error('Failed to fetch test session:', error);
      throw new Error(
        'Could not fetch test session. Ensure the API is running and at least one session exists.'
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

      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL ||
        'https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1';

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
});

export { expect } from '@playwright/test';
