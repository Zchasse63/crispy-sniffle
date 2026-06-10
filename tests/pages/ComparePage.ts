import type { Locator, Page } from "@playwright/test";

/**
 * Page Object Model for the /compare page.
 *
 * Selectors verified against live DOM: specs/features/journeys-chrome-analysis.md
 *
 * IMPORTANT: The compare table only renders when ≥ 2 gyms are saved in
 * scout-shortlist-v1 localStorage. The preferred test approach is to save
 * gyms via UI on the home page in the same page context, then navigate here.
 *
 * Row label in table is "Monthly from" (not "Monthly").
 *
 * TRAP: "Day pass" (hasText) also matches "Day Passes" (amenity row).
 * Use getByRole('rowheader', { name: 'Day pass', exact: true }) or filter
 * with a regex anchor to match exactly. Use exact regex: /^Day pass$/.
 */
export class ComparePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(): Promise<void> {
    await this.page.goto("/compare");
    await this.page.locator("h1").waitFor({ state: "visible" });
  }

  // ── Page header ───────────────────────────────────────────────────────────

  h1(): Locator {
    return this.page.locator("h1");
  }

  // ── Empty state ───────────────────────────────────────────────────────────

  /** "Not enough to compare" title in EmptyState component. */
  emptyStateTitle(): Locator {
    return this.page.locator("text=Not enough to compare");
  }

  /** "Find gyms" CTA button in empty state. */
  findGymsButton(): Locator {
    return this.page.getByRole("button", { name: "Find gyms" });
  }

  // ── Compare table ─────────────────────────────────────────────────────────

  /** The comparison table — only visible when ≥ 2 gyms saved. */
  table(): Locator {
    return this.page.locator("table");
  }

  /** Gym name links in the thead (one per column). */
  gymColumnLinks(): Locator {
    return this.page.locator("thead a[href^='/gym/']");
  }

  /** Loading skeleton — brief flash before table renders. */
  loadingSkeleton(): Locator {
    return this.page.locator(".skeleton.h-96");
  }

  // ── Table rows (tbody th elements) ───────────────────────────────────────

  /**
   * "Day pass" row header — exact match.
   * TRAP: hasText('Day pass') also matches "Day Passes" (amenity).
   * Use a regex anchor /^Day pass$/ to match exactly.
   */
  dayPassRow(): Locator {
    return this.page.locator("tbody th").filter({ hasText: /^Day pass$/ });
  }

  /**
   * "Monthly from" row header.
   * IMPORTANT: The label is "Monthly from", not "Monthly".
   */
  monthlyFromRow(): Locator {
    return this.page.locator("tbody th").filter({ hasText: /^Monthly from$/ });
  }

  /** "Drop-in" row header — exact match. */
  dropInRow(): Locator {
    return this.page.locator("tbody th").filter({ hasText: /^Drop-in$/ });
  }

  /**
   * "Parking" row header — in the basic rows section (before Amenities header).
   * Note: "Parking" also appears as an amenity row. Use .first() to get the
   * basic-section row reliably.
   */
  parkingRow(): Locator {
    return this.page.locator("tbody th").filter({ hasText: /^Parking$/ }).first();
  }

  /** Remove button for a gym column (inside thead). */
  gymRemoveButton(n: number): Locator {
    return this.page.locator("thead button").filter({ hasText: "Remove" }).nth(n);
  }
}
