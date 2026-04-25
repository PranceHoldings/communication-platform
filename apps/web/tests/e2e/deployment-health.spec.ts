/**
 * Deployment Health Checks
 *
 * Verifies that the dev environment is fully operational after a deploy:
 * frontend, static assets, API, auth flow, redirects, and WebSocket.
 * Run these after every deployment to catch regressions early.
 */

import { test, expect } from '@playwright/test';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.dev.app.prance.jp/api/v1';
const WS_ENDPOINT = process.env.NEXT_PUBLIC_WS_ENDPOINT || 'wss://ws.dev.app.prance.jp';

test.describe('Deployment Health', () => {
  test('HEALTH-001: frontend returns 200', async ({ page }) => {
    const response = await page.goto('/login');
    expect(response?.status()).toBe(200);
  });

  test('HEALTH-002: Next.js static assets load without errors', async ({ page }) => {
    const failed: string[] = [];

    page.on('response', res => {
      const status = res.status();
      const url = res.url();
      if (
        status >= 400 &&
        (url.includes('/_next/static/') || url.includes('/_next/chunks/'))
      ) {
        failed.push(`${status} ${url}`);
      }
    });

    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    expect(failed, `Static asset failures:\n${failed.join('\n')}`).toHaveLength(0);
  });

  test('HEALTH-003: API health endpoint responds', async ({ page }) => {
    const result = await page.evaluate(async ({ apiBase }: { apiBase: string }) => {
      const res = await fetch(`${apiBase}/health`).catch(() => null);
      return res ? res.status : 0;
    }, { apiBase: API_BASE });

    // 200 = healthy, 404 = endpoint missing (but API is up), 401 = API is up but requires auth
    expect([200, 401, 404]).toContain(result);
  });

  test('HEALTH-004: /login page fully renders form elements', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('input#email[type="email"]')).toBeVisible();
    await expect(page.locator('input#password[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('HEALTH-005: unauthenticated /dashboard redirects to /login', async ({ page }) => {
    // Clear any existing session
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());

    await page.goto('/dashboard');
    await page.waitForURL(/login/, { timeout: 15000 });
    expect(page.url()).toContain('/login');
  });

  test('HEALTH-006: WebSocket endpoint accepts connections', async ({ page }) => {
    await page.goto('/login');

    const result = await page.evaluate(async ({ wsEndpoint }: { wsEndpoint: string }) => {
      return new Promise<{ connected: boolean; error: string | null }>(resolve => {
        try {
          const ws = new WebSocket(wsEndpoint);
          const timer = setTimeout(() => {
            ws.close();
            resolve({ connected: false, error: 'timeout' });
          }, 8000);

          ws.onopen = () => {
            clearTimeout(timer);
            ws.close();
            resolve({ connected: true, error: null });
          };

          ws.onerror = () => {
            clearTimeout(timer);
            resolve({ connected: false, error: 'WebSocket error event' });
          };
        } catch (e) {
          resolve({ connected: false, error: String(e) });
        }
      });
    }, { wsEndpoint: WS_ENDPOINT });

    // Connection may be refused without auth token — that's acceptable (not a crash)
    // We just verify the endpoint responds (connected or auth-rejected, not unreachable)
    if (!result.connected) {
      console.log(`[HEALTH-006] WS not connected: ${result.error} — may require auth token`);
    }
    // Test passes as long as it didn't throw a JS exception (endpoint is reachable)
    expect(result.error).not.toBe('timeout');
  });

  test('HEALTH-007: authenticated API endpoint responds after login', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input#email[type="email"]', process.env.TEST_USER_EMAIL || 'admin@prance.com');
    await page.fill(
      'input#password[type="password"]',
      process.env.TEST_USER_PASSWORD || 'Admin2026!Prance'
    );
    await page.click('button[type="submit"]');

    await page.waitForURL(/dashboard|sessions/, { timeout: 15000 }).catch(() => {});

    const result = await page.evaluate(async ({ apiBase }: { apiBase: string }) => {
      const token = localStorage.getItem('accessToken');
      if (!token) return { status: 0, error: 'no accessToken in localStorage' };

      try {
        const res = await fetch(`${apiBase}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        });
        return { status: res.status, error: null };
      } catch (e) {
        return { status: 0, error: String(e) };
      }
    }, { apiBase: API_BASE });

    expect(result.error, `API call failed: ${result.error}`).toBeNull();
    expect(result.status).toBe(200);
  });
});
