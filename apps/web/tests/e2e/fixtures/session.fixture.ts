/**
 * Session Fixture for E2E Tests
 *
 * Provides a valid test session ID from the database for E2E tests.
 */

import { test as base } from './auth.fixture';

interface SessionFixture {
  testSessionId: string;
}

export const test = base.extend<SessionFixture>({
  testSessionId: async ({ authenticatedPage }, use) => {
    // Fetch sessions from the API using the authenticated page context
    try {
      // Get access token from localStorage
      const accessToken = await authenticatedPage.evaluate(() => {
        return localStorage.getItem('accessToken');
      });

      if (!accessToken) {
        throw new Error('No access token found in localStorage');
      }

      // Use the AWS API Gateway URL (loaded from .env.local via playwright.config.ts)
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

      // Check if response has data property (API v1 format)
      const sessions = data.data?.sessions || data.sessions || [];
      console.log(`📊 Found ${sessions.length} sessions`);

      if (sessions.length === 0) {
        throw new Error(
          'No sessions found in database. Please create at least one session before running E2E tests.'
        );
      }

      const sessionId = sessions[0].id;
      console.log(`✅ Using test session ID: ${sessionId}`);

      // Provide session ID to test
      await use(sessionId);
    } catch (error) {
      console.error('Failed to fetch test session:', error);
      throw new Error(
        'Could not fetch test session. Ensure the API is running and at least one session exists.'
      );
    }
  },
});

export { expect } from '@playwright/test';
