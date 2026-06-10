import type { Locator, Page } from "@playwright/test";

/**
 * Page Object Model for the Shortlist feature.
 * Covers: GymCard save button, SiteHeader count badge, ShortlistDrawer, GymRow remove.
 *
 * Selectors verified against live DOM: specs/features/journeys-chrome-analysis.md
 *
 * TRAP: The ShortlistButton is rendered inside a <Link> (GymCard is an <a>).
 * The button's click handler calls e.preventDefault() + e.stopPropagation() —
 * safe to click directly; the page will NOT navigate.
 *
 * TRAP: Zustand store uses skipHydration:true — rehydrated by HydrationGate on mount.
 * To test persistence, call page.reload() then wait for header label to stabilise.
 */
export class ShortlistPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(): Promise<void> {
    await this.page.goto("/");
    // Wait for gym cards to render — confirms React has hydrated
    await this.page
      .locator('button[aria-label="Save to shortlist"]')
      .first()
      .waitFor({ state: "visible" });
  }

  // ── GymCard save buttons ──────────────────────────────────────────────────

  /** All "Save to shortlist" buttons — unsaved gyms only. */
  saveButtons(): Locator {
    return this.page.locator('button[aria-label="Save to shortlist"]');
  }

  /** Save button at index n (0-based) — unsaved state. */
  saveButtonAt(n: number): Locator {
    return this.saveButtons().nth(n);
  }

  /** All "Remove from shortlist" buttons — saved gyms. */
  removeFromCardButtons(): Locator {
    return this.page.locator('button[aria-label="Remove from shortlist"]');
  }

  /** The save/remove button for a specific gym card at index n.
   *  Uses the card-level save button regardless of saved state. */
  cardSaveToggleAt(n: number): Locator {
    // After toggling, aria-label changes. Use aria-pressed to find the button
    // at position n among ALL shortlist buttons on the page.
    return this.page
      .locator('button[aria-label="Save to shortlist"], button[aria-label="Remove from shortlist"]')
      .nth(n);
  }

  // ── Header shortlist button ───────────────────────────────────────────────

  /**
   * Header shortlist button.
   * aria-label pattern: "Open shortlist (N saved)"
   */
  headerShortlistButton(): Locator {
    return this.page.locator('button[aria-label*="Open shortlist"]');
  }

  /** Get the current saved count from the header button aria-label. */
  async getHeaderCount(): Promise<number> {
    const label = await this.headerShortlistButton().getAttribute("aria-label");
    const match = label?.match(/\((\d+) saved\)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  // ── ShortlistDrawer ───────────────────────────────────────────────────────

  /** The shortlist drawer dialog. */
  drawer(): Locator {
    return this.page.locator('[role="dialog"][aria-label="Shortlist"]');
  }

  /** Open the drawer by clicking the header button. */
  async openDrawer(): Promise<void> {
    await this.headerShortlistButton().click();
    await this.drawer().waitFor({ state: "visible" });
  }

  /** GymRow links inside the drawer. Appear after async Supabase fetch. */
  drawerGymLinks(): Locator {
    return this.drawer().locator('a[href^="/gym/"]');
  }

  /**
   * Remove buttons inside the drawer.
   * aria-label: "Remove {gymName}"
   */
  drawerRemoveButtons(): Locator {
    return this.drawer().locator('button[aria-label^="Remove "]');
  }

  /** "Nothing saved yet" message — shown when drawer is open but empty. */
  drawerEmptyMessage(): Locator {
    return this.drawer().locator("p").filter({ hasText: "Nothing saved yet" });
  }

  /** Drawer close button (X icon in header). */
  drawerCloseButton(): Locator {
    return this.drawer().locator('button[aria-label="Close"]');
  }
}
