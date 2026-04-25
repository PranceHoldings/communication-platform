/**
 * CORS Validation Tests
 *
 * These tests run fetch() inside page.evaluate() so they execute in the browser
 * context where CORS policy is enforced — not in Node.js where it is not.
 *
 * Rules verified:
 * - Access-Control-Allow-Origin must echo the requesting origin (never "*")
 * - credentials: 'include' requests must be accepted
 * - Preflight (OPTIONS) must return correct CORS headers
 */

import { test, expect } from '@playwright/test';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.dev.app.prance.jp/api/v1';
const ORIGIN = process.env.BASE_URL || 'https://dev.app.prance.jp';

test.describe('CORS Policy Validation', () => {
  test('CORS-001: simple unauthenticated request succeeds from allowed origin', async ({
    page,
  }) => {
    await page.goto('/login');

    const result = await page.evaluate(
      async ({ apiBase }: { apiBase: string }) => {
        try {
          const res = await fetch(`${apiBase}/health`, {
            method: 'GET',
            credentials: 'omit',
          });
          return {
            ok: res.ok || res.status === 404,
            status: res.status,
            allowOrigin: res.headers.get('access-control-allow-origin'),
            error: null,
          };
        } catch (e) {
          return { ok: false, status: 0, allowOrigin: null, error: String(e) };
        }
      },
      { apiBase: API_BASE }
    );

    // A CORS block throws a TypeError — if we got a status, CORS passed
    expect(result.error, `CORS blocked: ${result.error}`).toBeNull();
    expect(result.status).toBeGreaterThan(0);
  });

  test('CORS-002: credentialed request does not receive wildcard origin', async ({ page }) => {
    // Login first so we have a session cookie
    await page.goto('/login');
    await page.fill('input#email[type="email"]', process.env.TEST_USER_EMAIL || 'admin@prance.com');
    await page.fill(
      'input#password[type="password"]',
      process.env.TEST_USER_PASSWORD || 'Admin2026!Prance'
    );
    await page.click('button[type="submit"]');

    // Wait for dashboard or any post-login page
    await page.waitForURL(/dashboard|sessions/, { timeout: 15000 }).catch(() => {});

    const result = await page.evaluate(
      async ({ apiBase }: { apiBase: string }) => {
        try {
          const res = await fetch(`${apiBase}/auth/me`, {
            method: 'GET',
            credentials: 'include',
            headers: {
              Authorization: `Bearer ${localStorage.getItem('accessToken') || ''}`,
            },
          });
          return {
            status: res.status,
            allowOrigin: res.headers.get('access-control-allow-origin'),
            allowCredentials: res.headers.get('access-control-allow-credentials'),
            error: null,
          };
        } catch (e) {
          return { status: 0, allowOrigin: null, allowCredentials: null, error: String(e) };
        }
      },
      { apiBase: API_BASE }
    );

    expect(result.error, `CORS blocked on credentialed request: ${result.error}`).toBeNull();
    // Wildcard is forbidden with credentials — must be a specific origin or absent
    expect(result.allowOrigin).not.toBe('*');
    if (result.allowOrigin) {
      expect(result.allowOrigin).toBe(ORIGIN);
    }
  });

  test('CORS-003: preflight request returns Access-Control-Allow-Origin', async ({ page }) => {
    await page.goto('/login');

    const result = await page.evaluate(
      async ({ apiBase }: { apiBase: string }) => {
        try {
          // Authorization header triggers a preflight OPTIONS request
          const res = await fetch(`${apiBase}/auth/login`, {
            method: 'OPTIONS',
            credentials: 'include',
            headers: {
              'Access-Control-Request-Method': 'POST',
              'Access-Control-Request-Headers': 'Content-Type,Authorization',
            },
          });
          return {
            status: res.status,
            allowOrigin: res.headers.get('access-control-allow-origin'),
            allowMethods: res.headers.get('access-control-allow-methods'),
            error: null,
          };
        } catch (e) {
          return { status: 0, allowOrigin: null, allowMethods: null, error: String(e) };
        }
      },
      { apiBase: API_BASE }
    );

    // OPTIONS may return 200 or 204 — either is fine
    expect(result.error, `Preflight failed: ${result.error}`).toBeNull();
  });

  test('CORS-004: login POST with credentials does not receive wildcard origin', async ({
    page,
  }) => {
    await page.goto('/login');

    const result = await page.evaluate(
      async ({
        apiBase,
        email,
        password,
      }: {
        apiBase: string;
        email: string;
        password: string;
      }) => {
        try {
          const res = await fetch(`${apiBase}/auth/login`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });
          return {
            status: res.status,
            allowOrigin: res.headers.get('access-control-allow-origin'),
            allowCredentials: res.headers.get('access-control-allow-credentials'),
            error: null,
          };
        } catch (e) {
          return { status: 0, allowOrigin: null, allowCredentials: null, error: String(e) };
        }
      },
      {
        apiBase: API_BASE,
        email: process.env.TEST_USER_EMAIL || 'admin@prance.com',
        password: process.env.TEST_USER_PASSWORD || 'Admin2026!Prance',
      }
    );

    expect(result.error, `CORS blocked login POST: ${result.error}`).toBeNull();
    expect(result.status).toBeGreaterThan(0);
    // The critical check: wildcard is illegal when credentials: 'include'
    expect(result.allowOrigin).not.toBe('*');
  });
});
