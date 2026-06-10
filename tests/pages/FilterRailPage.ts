import type { Locator, Page } from "@playwright/test";

/**
 * POM for the desktop Filter Rail (aside > div.rounded-xl).
 * Covers: amenity checkboxes, day pass slider, clear-all, weak-match banner,
 * relax chips, and the Near Me section.
 */
export class FilterRailPage {
  readonly page: Page;
  readonly rail: Locator;

  // Clear all
  readonly clearAllButton: Locator;

  // Day pass
  readonly dayPassSlider: Locator;
  readonly dayPassDisplay: Locator;

  // Weak-match banner (lives in main, not in the rail, but scoped here for convenience)
  readonly weakMatchBanner: Locator;

  // Near Me
  readonly driveButton: Locator;
  readonly walkButton: Locator;

  constructor(page: Page) {
    this.page = page;
    // Desktop rail is the first rounded-xl div inside the aside
    this.rail = page.locator("aside").locator("div.rounded-xl.border").first();

    this.clearAllButton = this.rail.getByRole("button", { name: "Clear all" });

    this.dayPassSlider = page.locator('input[type="range"][aria-label="Maximum day pass price"]');
    this.dayPassDisplay = page.locator("span").filter({ hasText: /Any price|≤ \$/ }).first();

    // Weak-match banner lives in <main>, triggered by over-constrained filters
    this.weakMatchBanner = page.locator("div.rounded-xl.border.border-pool\\/30").first();

    // Near Me buttons
    this.driveButton = page.getByRole("button", { name: "Drive" });
    this.walkButton = page.getByRole("button", { name: "Walk" });
  }

  /** Get a checkbox label by its visible text (e.g. "Sauna"). */
  amenityLabel(name: string): Locator {
    return this.rail.locator("label").filter({ hasText: name });
  }

  /** Get the hidden checkbox input inside an amenity label. */
  amenityCheckbox(name: string): Locator {
    return this.amenityLabel(name).locator('input[type="checkbox"]');
  }

  /** Toggle an amenity on/off by clicking its label. */
  async toggleAmenity(name: string): Promise<void> {
    await this.amenityLabel(name).click();
  }

  /** Check whether an amenity checkbox is checked. */
  async isAmenityChecked(name: string): Promise<boolean> {
    return this.amenityCheckbox(name).isChecked();
  }

  /**
   * Set the day pass slider to a specific value.
   * Uses Playwright's fill on the range input (works cross-browser).
   */
  async setDayPass(value: number): Promise<void> {
    await this.dayPassSlider.fill(String(value));
    // Trigger the change event so React's onChange fires
    await this.dayPassSlider.dispatchEvent("input");
  }

  async clickClearAll(): Promise<void> {
    await this.clearAllButton.click();
  }

  /** Get all visible relax chips in the weak-match banner. */
  relaxChips(): Locator {
    return this.weakMatchBanner.getByRole("button");
  }

  /** Click a specific relax chip by its label text. */
  async clickRelaxChip(label: string): Promise<void> {
    await this.weakMatchBanner.getByRole("button", { name: label }).click();
  }

  /** Minute chips in the Near Me section. */
  minuteChip(minutes: number): Locator {
    return this.rail.getByRole("button", { name: `${minutes} min` });
  }
}
