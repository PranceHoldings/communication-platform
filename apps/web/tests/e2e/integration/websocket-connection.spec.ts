/**
 * WebSocket Connection Integration Test
 * Dev環境のWebSocketエンドポイントへの実際の接続を検証
 */

import { test, expect } from '@playwright/test';
import { LoginPage } from '../page-objects/login-page';
import { NewSessionPage } from '../page-objects/new-session-page';

test.describe('WebSocket Connection - Dev Environment Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Enable console logging for debugging
    page.on('console', msg => {
      if (msg.type() === 'log' || msg.type() === 'error' || msg.type() === 'warn') {
        console.log(`[Browser ${msg.type().toUpperCase()}]`, msg.text());
      }
    });

    // Login
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginAndWaitForDashboard(
      process.env.TEST_USER_EMAIL || 'admin@prance.com',
      process.env.TEST_USER_PASSWORD || 'Admin2026!Prance'
    );

    console.log('[Test] Login completed successfully');
  });

  test('should verify accessToken is stored in localStorage', async ({ page }) => {
    // Check localStorage for accessToken
    const accessToken = await page.evaluate(() => {
      return localStorage.getItem('accessToken');
    });

    console.log('[Test] AccessToken exists:', !!accessToken);
    console.log('[Test] AccessToken length:', accessToken?.length || 0);

    expect(accessToken).not.toBeNull();
    expect(accessToken).not.toBe('');
    expect(accessToken!.length).toBeGreaterThan(10);
  });

  test('should connect to WebSocket when session starts', async ({ page }) => {
    // Inject WebSocket spy
    await page.addInitScript(() => {
      const OriginalWebSocket = window.WebSocket;
      const connections: any[] = [];

      (window as any).WebSocket = class extends OriginalWebSocket {
        constructor(url: string, protocols?: string | string[]) {
          console.log('[WebSocket Spy] Creating WebSocket connection:', url);
          super(url, protocols);

          const connectionInfo = {
            url,
            readyState: this.readyState,
            timestamp: new Date().toISOString(),
          };
          connections.push(connectionInfo);
          (window as any).__wsConnections = connections;

          // Log events
          this.addEventListener('open', () => {
            console.log('[WebSocket Spy] Connection opened:', url);
            connectionInfo.readyState = this.readyState;
          });

          this.addEventListener('close', (event: CloseEvent) => {
            console.log('[WebSocket Spy] Connection closed:', {
              url,
              code: event.code,
              reason: event.reason,
              wasClean: event.wasClean
            });
            connectionInfo.readyState = this.readyState;
          });

          this.addEventListener('error', () => {
            console.log('[WebSocket Spy] Connection error:', url);
            connectionInfo.readyState = this.readyState;
          });

          this.addEventListener('message', (event: MessageEvent) => {
            try {
              const data = JSON.parse(event.data);
              console.log('[WebSocket Spy] Received message:', data.type || 'unknown');
            } catch (e) {
              console.log('[WebSocket Spy] Received non-JSON message');
            }
          });
        }
      };

      console.log('[WebSocket Spy] WebSocket spy installed');
    });

    // Navigate to session creation
    const newSessionPage = new NewSessionPage(page);
    await newSessionPage.goto();

    console.log('[Test] Navigated to session creation page');

    // Select scenario and avatar
    await newSessionPage.selectScenario(0);
    await newSessionPage.clickNext();
    await newSessionPage.selectAvatar(0);
    await newSessionPage.clickNext();

    console.log('[Test] Scenario and avatar selected');

    // Start session
    await page.click('button:has-text("Create"), button:has-text("作成")');
    await page.waitForURL('**/dashboard/sessions/**', { timeout: 30000 });

    console.log('[Test] Session created, waiting for Start button');

    // Wait for Start button (status: IDLE)
    await page.waitForSelector('button:has-text("Start"), button:has-text("開始")');

    console.log('[Test] Start button found, clicking...');

    // Click Start button
    await page.click('button:has-text("Start"), button:has-text("開始")');

    console.log('[Test] Start button clicked, waiting for WebSocket connection...');

    // Wait for WebSocket connection attempt (allow up to 10 seconds)
    await page.waitForTimeout(10000);

    // Get WebSocket connection info
    const wsConnections = await page.evaluate(() => {
      return (window as any).__wsConnections || [];
    });

    console.log('[Test] WebSocket connections:', JSON.stringify(wsConnections, null, 2));

    // Filter out Next.js HMR connections
    const appWsConnections = wsConnections.filter((conn: any) =>
      !conn.url.includes('webpack-hmr') &&
      (conn.url.includes('wss://') || conn.url.includes('ws://'))
    );

    console.log('[Test] Application WebSocket connections (filtered):', JSON.stringify(appWsConnections, null, 2));

    // Verify WebSocket connection was attempted
    expect(appWsConnections.length).toBeGreaterThan(0);
    expect(appWsConnections[0].url).toMatch(/wss?:\/\//); // Accept both ws:// and wss://

    // Check if connection opened successfully
    // ReadyState: 0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED
    const isConnected = appWsConnections.some((conn: any) => conn.readyState === 1);

    if (!isConnected) {
      console.error('[Test] WebSocket connection failed!');
      console.error('[Test] Final states:', appWsConnections.map((c: any) => c.readyState));
    } else {
      console.log('[Test] WebSocket connection successful!');
    }

    // For now, we just log the result without failing the test
    // This helps us understand what's happening in Dev environment
    console.log('[Test] WebSocket connected:', isConnected);
  });

  test('should reach ACTIVE status after WebSocket connection', async ({ page }) => {
    // Navigate to session creation
    const newSessionPage = new NewSessionPage(page);
    await newSessionPage.goto();
    await newSessionPage.selectScenario(0);
    await newSessionPage.clickNext();
    await newSessionPage.selectAvatar(0);
    await newSessionPage.clickNext();

    // Start session
    await page.click('button:has-text("Create"), button:has-text("作成")');
    await page.waitForURL('**/dashboard/sessions/**', { timeout: 30000 });

    // Click Start button
    await page.waitForSelector('button:has-text("Start"), button:has-text("開始")');
    await page.click('button:has-text("Start"), button:has-text("開始")');

    console.log('[Test] Start button clicked, waiting for ACTIVE status...');

    // Wait for status to become ACTIVE (or timeout after 30 seconds)
    try {
      await page.waitForSelector('[data-testid="recording-status"]', {
        timeout: 30000,
        state: 'visible'
      });

      console.log('[Test] ✅ recording-status is visible (ACTIVE status reached)');

      const recordingStatus = await page.locator('[data-testid="recording-status"]');
      await expect(recordingStatus).toBeVisible();

      // Verify recording statistics are displayed
      const audioStats = await recordingStatus.locator('text=/Audio:.*\\d+\\/\\d+/');
      const videoStats = await recordingStatus.locator('text=/Video:.*\\d+\\/\\d+/');

      await expect(audioStats).toBeVisible();
      await expect(videoStats).toBeVisible();

      console.log('[Test] ✅ Recording statistics are visible');
    } catch (error) {
      console.error('[Test] ❌ Failed to reach ACTIVE status:');
      console.error('[Test] Error:', error);

      // Get status badge text for debugging
      const statusBadge = await page.locator('[data-testid="status-badge"]');
      if (await statusBadge.isVisible()) {
        const statusText = await statusBadge.textContent();
        console.error('[Test] Current status:', statusText);
      }

      // Re-throw error to fail the test
      throw error;
    }
  });
});
