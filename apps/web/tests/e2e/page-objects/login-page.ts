import { Page, Locator } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('input#email[type="email"]');
    this.passwordInput = page.locator('input#password[type="password"]');
    this.loginButton = page.locator('button[type="submit"]');
    this.errorMessage = page.locator('[role="alert"]');
  }

  async goto() {
    await this.page.goto('/login');
    await this.page.waitForLoadState('networkidle');
  }

  async login(email: string, password: string, waitForNavigation = true) {
    await this.emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginButton.click();

    if (waitForNavigation) {
      // Wait for navigation to dashboard after successful login
      await this.page.waitForURL('**/dashboard**', { timeout: 30000 });
      // Wait for network to be idle after navigation
      await this.page.waitForLoadState('networkidle', { timeout: 10000 });
    }
  }

  async isLoggedIn() {
    await this.page.waitForURL('/dashboard', { timeout: 15000 });
    return true;
  }

  async loginAndWaitForDashboard(email: string, password: string) {
    await this.login(email, password, true);
    // Additional verification that dashboard is fully loaded
    await this.page.waitForSelector('[data-testid="dashboard-header"], h1', { timeout: 10000 });
  }
}
