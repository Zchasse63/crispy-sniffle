import type { Locator, Page } from "@playwright/test";

/**
 * Page Object Model for the Scout Discovery (home) page.
 * Covers: NL search bar, example chips, sticky count bar, parse badges,
 * query chip, view-mode toggle, and overall reset.
 */
export class DiscoveryPage {
  readonly page: Page;

  // Search form
  readonly searchInput: Locator;
  readonly submitButton: Locator;
  readonly searchForm: Locator;

  // Sticky count bar
  readonly stickyBar: Locator;
  readonly gymCountSpan: Locator;

  // Parse badges
  readonly aiParsedBadge: Locator;
  readonly quickParsedBadge: Locator;

  // Query chip
  readonly queryChip: Locator;
  readonly clearSearchButton: Locator;

  // View mode toggle
  readonly viewModeGroup: Locator;
  readonly listButton: Locator;
  readonly mapButton: Locator;

  // Results grid
  readonly gymCards: Locator;

  // Weak-match banner
  readonly weakMatchBanner: Locator;

  constructor(page: Page) {
    this.page = page;

    this.searchInput = page.locator('input[aria-label="Describe your ideal gym"]');
    this.submitButton = page.getByRole("button", { name: "Scout it" });
    this.searchForm = page.locator('form[role="search"]');

    this.stickyBar = page.locator("div.sticky.top-16");
    this.gymCountSpan = this.stickyBar.locator("span.font-mono.text-xs").first();

    this.aiParsedBadge = page.getByText("AI-parsed");
    this.quickParsedBadge = page.getByText("Quick-parsed");

    this.queryChip = this.stickyBar.locator("span.font-mono").filter({
      has: page.locator('button[aria-label="Clear search"]'),
    });
    this.clearSearchButton = page.locator('button[aria-label="Clear search"]');

    this.viewModeGroup = page.getByRole("group", { name: "View mode" });
    this.listButton = this.viewModeGroup.getByRole("button", { name: "List" });
    this.mapButton = this.viewModeGroup.getByRole("button", { name: "Map" });

    this.gymCards = page.locator('a[href^="/gym/"]');

    this.weakMatchBanner = page.locator("div.rounded-xl.border.border-pool\\/30");
  }

  /**
   * Example chips below the search form.
   * Only rendered when rawQuery === "" (no active search).
   */
  exampleChips(): Locator {
    return this.searchForm.locator("+ div button");
  }

  async goto(): Promise<void> {
    await this.page.goto("/");
    // Wait for the search input to be present — confirms React has hydrated
    await this.searchInput.waitFor({ state: "visible" });
  }

  /**
   * Type a query and submit the form.
   * Awaits parse completion (spinner disappears from submit button).
   * Uses a 25s timeout to accommodate slow AI edge function responses.
   */
  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.submitButton.click();
    // Wait for parse to complete: spinner disappears from submit button.
    // Timeout: 25s — AI edge function can take up to ~10s; fallback is instant.
    await this.page.waitForFunction(
      () => {
        const btn = document.querySelector('button[type="submit"]');
        return btn && !btn.querySelector(".animate-spin");
      },
      undefined,
      { timeout: 25_000 },
    );
  }

  /** Click one of the example chips by its full text label. */
  async clickExampleChip(text: string): Promise<void> {
    await this.page.getByRole("button", { name: text, exact: true }).click();
    await this.page.waitForFunction(
      () => {
        const btn = document.querySelector('button[type="submit"]');
        return btn && !btn.querySelector(".animate-spin");
      },
      undefined,
      { timeout: 25_000 },
    );
  }

  /** Read the current gym count from the sticky bar (returns the number). */
  async getGymCount(): Promise<number> {
    const text = await this.gymCountSpan.textContent();
    const match = text?.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /** Check whether the AI-parsed or Quick-parsed badge is visible. */
  async parseBadgeVisible(): Promise<boolean> {
    const ai = await this.aiParsedBadge.isVisible();
    const quick = await this.quickParsedBadge.isVisible();
    return ai || quick;
  }

  async resetViaQueryChip(): Promise<void> {
    await this.clearSearchButton.click();
    await this.searchInput.waitFor({ state: "visible" });
  }

  async switchToMapView(): Promise<void> {
    await this.mapButton.click();
  }

  async switchToListView(): Promise<void> {
    await this.listButton.click();
  }
}
