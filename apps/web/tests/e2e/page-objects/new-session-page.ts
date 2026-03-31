import { Page, Locator } from '@playwright/test';

/**
 * NewSessionPage Page Object
 *
 * Represents the multi-step session creation form:
 * Step 1: Scenario Selection
 * Step 2: Avatar Selection
 * Step 3: Options (metadata)
 *
 * URL: /dashboard/sessions/new
 */
export class NewSessionPage {
  readonly page: Page;

  // Step indicators
  readonly step1Indicator: Locator;
  readonly step2Indicator: Locator;
  readonly step3Indicator: Locator;

  // Scenario step
  readonly scenarioSearchInput: Locator;
  readonly scenarioCards: Locator;

  // Avatar step
  readonly avatarSearchInput: Locator;
  readonly avatarTypeFilter: Locator;
  readonly avatarStyleFilter: Locator;
  readonly avatarCards: Locator;

  // Options step
  readonly metadataInput: Locator;

  // Navigation buttons
  readonly cancelButton: Locator;
  readonly backButton: Locator;
  readonly nextButton: Locator;
  readonly createButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Step indicators (numbered circles in progress bar)
    this.step1Indicator = page.locator('.w-8.h-8.rounded-full >> nth=0');
    this.step2Indicator = page.locator('.w-8.h-8.rounded-full >> nth=1');
    this.step3Indicator = page.locator('.w-8.h-8.rounded-full >> nth=2');

    // Scenario selection elements
    this.scenarioSearchInput = page.locator('input[type="text"]').first();
    this.scenarioCards = page.locator('.grid.grid-cols-1 > div').first().locator('> div');

    // Avatar selection elements
    this.avatarSearchInput = page.locator('input[type="text"]').first();
    this.avatarTypeFilter = page.locator('select').nth(0);
    this.avatarStyleFilter = page.locator('select').nth(1);
    this.avatarCards = page.locator('.grid.grid-cols-1 > div').nth(1).locator('> div');

    // Options step
    this.metadataInput = page.locator('textarea');

    // Navigation buttons
    this.cancelButton = page.locator('button').filter({ hasText: /cancel|キャンセル/i });
    this.backButton = page.locator('button').filter({ hasText: /back|戻る/i });
    this.nextButton = page.locator('button').filter({ hasText: /next|次へ/i });
    this.createButton = page.locator('button').filter({ hasText: /start|create|開始|作成/i });
  }

  /**
   * Navigate to the new session page
   */
  async goto() {
    await this.page.goto('/dashboard/sessions/new');
    await this.page.waitForLoadState('networkidle');

    // Wait for page title to be visible
    await this.page.waitForSelector('h1', { state: 'visible', timeout: 10000 });
  }

  /**
   * Check if currently on scenario selection step
   */
  async isOnScenarioStep(): Promise<boolean> {
    const step1Classes = await this.step1Indicator.getAttribute('class');
    return step1Classes?.includes('border-indigo-600') ?? false;
  }

  /**
   * Check if currently on avatar selection step
   */
  async isOnAvatarStep(): Promise<boolean> {
    const step2Classes = await this.step2Indicator.getAttribute('class');
    return step2Classes?.includes('border-indigo-600') ?? false;
  }

  /**
   * Check if currently on options step
   */
  async isOnOptionsStep(): Promise<boolean> {
    const step3Classes = await this.step3Indicator.getAttribute('class');
    return step3Classes?.includes('border-indigo-600') ?? false;
  }

  /**
   * Select a scenario by index (0-based)
   * @param index - Scenario card index (default: 0 for first scenario)
   */
  async selectScenario(index = 0) {
    // Wait for the scenario grid to be visible (after loading state)
    await this.page.waitForSelector('.grid.grid-cols-1 > div.border', { state: 'visible', timeout: 10000 });

    // Select the card directly (grid > card div)
    const scenarioCard = this.page.locator('.grid.grid-cols-1 > div.border').nth(index);
    await scenarioCard.waitFor({ state: 'visible', timeout: 10000 });
    await scenarioCard.click();

    // Wait for selection to be visually confirmed (border color change)
    await this.page.waitForFunction(
      (idx) => {
        const cards = document.querySelectorAll('.grid.grid-cols-1 > div.border');
        const card = cards[idx];
        return card?.classList.contains('border-indigo-600');
      },
      index,
      { timeout: 5000 }
    );
  }

  /**
   * Search for scenarios
   * @param query - Search query
   */
  async searchScenario(query: string) {
    await this.scenarioSearchInput.fill(query);
    // Wait for search results to update
    await this.page.waitForTimeout(500);
  }

  /**
   * Click next button to proceed to next step
   */
  async clickNext() {
    await this.nextButton.waitFor({ state: 'visible', timeout: 5000 });
    await this.nextButton.click();

    // Wait for navigation animation
    await this.page.waitForTimeout(300);
  }

  /**
   * Select an avatar by index (0-based)
   * @param index - Avatar card index (default: 0 for first avatar)
   */
  async selectAvatar(index = 0) {
    // Wait for avatar grid to be visible (after loading state)
    await this.page.waitForSelector('.grid.grid-cols-1 > div.border', { state: 'visible', timeout: 10000 });

    // Avatar cards have .border class directly on the grid children
    const avatarCard = this.page.locator('.grid.grid-cols-1 > div.border').nth(index);
    await avatarCard.waitFor({ state: 'visible', timeout: 10000 });
    await avatarCard.click();

    // Wait for selection to be visually confirmed
    await this.page.waitForFunction(
      (idx) => {
        const cards = document.querySelectorAll('.grid.grid-cols-1 > div.border');
        const card = cards[idx];
        return card?.classList.contains('border-indigo-600');
      },
      index,
      { timeout: 5000 }
    );
  }

  /**
   * Search for avatars
   * @param query - Search query
   */
  async searchAvatar(query: string) {
    await this.avatarSearchInput.fill(query);
    await this.page.waitForTimeout(500);
  }

  /**
   * Filter avatars by type
   * @param type - Avatar type ('TWO_D' | 'THREE_D' | '')
   */
  async filterAvatarByType(type: 'TWO_D' | 'THREE_D' | '') {
    await this.avatarTypeFilter.selectOption(type);
    await this.page.waitForTimeout(500);
  }

  /**
   * Filter avatars by style
   * @param style - Avatar style ('ANIME' | 'REALISTIC' | '')
   */
  async filterAvatarByStyle(style: 'ANIME' | 'REALISTIC' | '') {
    await this.avatarStyleFilter.selectOption(style);
    await this.page.waitForTimeout(500);
  }

  /**
   * Click back button to return to previous step
   */
  async clickBack() {
    await this.backButton.waitFor({ state: 'visible', timeout: 5000 });
    await this.backButton.click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Set metadata JSON
   * @param metadata - Metadata object or JSON string
   */
  async setMetadata(metadata: Record<string, unknown> | string) {
    const metadataStr = typeof metadata === 'string' ? metadata : JSON.stringify(metadata, null, 2);
    await this.metadataInput.fill(metadataStr);
  }

  /**
   * Click create/start button to create session
   * @returns Promise that resolves with the created session ID
   */
  async clickCreate(): Promise<string> {
    await this.createButton.waitFor({ state: 'visible', timeout: 5000 });
    await this.createButton.click();

    // Wait for navigation to session detail page
    await this.page.waitForURL('**/dashboard/sessions/*', { timeout: 30000 });

    // Extract session ID from URL
    const url = this.page.url();
    const match = url.match(/\/dashboard\/sessions\/([^\/]+)/);
    return match ? (match[1] ?? '') : '';
  }

  /**
   * Complete full flow: select scenario, select avatar, and create session
   * @param scenarioIndex - Scenario card index (default: 0)
   * @param avatarIndex - Avatar card index (default: 0)
   * @param metadata - Optional metadata
   * @returns Promise that resolves with the created session ID
   */
  async createSession(scenarioIndex = 0, avatarIndex = 0, metadata?: Record<string, unknown>): Promise<string> {
    // Step 1: Select scenario
    await this.selectScenario(scenarioIndex);
    await this.clickNext();

    // Step 2: Select avatar
    await this.selectAvatar(avatarIndex);
    await this.clickNext();

    // Step 3: Options (optional metadata)
    if (metadata) {
      await this.setMetadata(metadata);
    }

    // Create session
    return await this.clickCreate();
  }

  /**
   * Cancel session creation and return to sessions list
   */
  async cancel() {
    await this.cancelButton.click();
    await this.page.waitForURL('**/dashboard/sessions', { timeout: 10000 });
  }
}
