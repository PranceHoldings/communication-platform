import { Page, Locator } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;
  readonly newSessionButton: Locator;
  readonly scenarioManagementLink: Locator;
  readonly sessionsList: Locator;

  constructor(page: Page) {
    this.page = page;
    this.newSessionButton = page.locator('[data-testid="new-session-button"]');
    this.scenarioManagementLink = page.locator('a[href*="/scenarios"]');
    this.sessionsList = page.locator('[data-testid="sessions-list"]');
  }

  async goto() {
    await this.page.goto('/dashboard');
  }

  async createNewSession() {
    await this.newSessionButton.click();
  }

  async goToScenarioManagement() {
    await this.scenarioManagementLink.click();
  }
}
