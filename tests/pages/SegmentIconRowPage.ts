import type { Locator, Page } from "@playwright/test";

/**
 * POM for the Segment Icon Row (nav[aria-label="Gym types"]).
 * Covers: button enumeration, hard-filter toggle, soft/dashed state.
 */
export class SegmentIconRowPage {
  readonly page: Page;
  readonly nav: Locator;

  constructor(page: Page) {
    this.page = page;
    this.nav = page.locator('nav[aria-label="Gym types"]');
  }

  /** All 9 segment buttons. */
  allButtons(): Locator {
    return this.nav.getByRole("button");
  }

  /** A single button by its title attribute (exact segment label). */
  buttonByTitle(title: string): Locator {
    return this.nav.locator(`button[title="${title}"]`);
  }

  /** Click a segment button (by title). */
  async click(title: string): Promise<void> {
    await this.buttonByTitle(title).click();
  }

  /** Returns true if the button is hard-pressed (aria-pressed="true"). */
  async isPressed(title: string): Promise<boolean> {
    const pressed = await this.buttonByTitle(title).getAttribute("aria-pressed");
    return pressed === "true";
  }

  /**
   * Returns true if the button has dashed border (soft/AI-suggested state).
   * The source applies `border-dashed` class when the segment is in preferredSegments.
   */
  async isSoft(title: string): Promise<boolean> {
    const classes = await this.buttonByTitle(title).getAttribute("class");
    return classes?.includes("border-dashed") ?? false;
  }

  /**
   * Returns the label text of a button (the visible span inside it).
   * Soft segments have " ~" appended to the first word of the label.
   */
  async labelText(title: string): Promise<string> {
    const span = this.buttonByTitle(title).locator("span");
    return (await span.textContent()) ?? "";
  }
}
