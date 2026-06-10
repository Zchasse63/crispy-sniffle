import type { Locator, Page } from "@playwright/test";

/**
 * Page Object Model for the /trips page and AddTripModal.
 *
 * Selectors verified against live DOM: specs/features/journeys-chrome-analysis.md
 *
 * TRAP: The footer's NewsletterForm also has a button[type="submit"] ("Alerts").
 * All modal form selectors are scoped to [role="dialog"][aria-label="Add trip"].
 *
 * TRAP: Do NOT assert geocode network results from the lodging input — the
 * test stops after asserting the input is present and editable.
 *
 * TRAP: TripCard has two p.readout elements:
 *   1. Date paragraph: class "readout mt-1.5 flex items-center gap-1.5 text-ink/70"
 *   2. Destination label: class "readout mt-4 text-ink/70"
 * Use p.readout.mt-1\.5 (escaped dot) to target the date paragraph specifically.
 */
export class TripsPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(): Promise<void> {
    await this.page.goto("/trips");
    await this.page.locator("h1").waitFor({ state: "visible" });
  }

  // ── Page header ───────────────────────────────────────────────────────────

  h1(): Locator {
    return this.page.locator("h1");
  }

  /** "Add trip" button in page header (top-right). */
  addTripButton(): Locator {
    return this.page.getByRole("button", { name: "Add trip" });
  }

  // ── AddTripModal ──────────────────────────────────────────────────────────

  /** The add-trip modal dialog. */
  addTripModal(): Locator {
    return this.page.locator('[role="dialog"][aria-label="Add trip"]');
  }

  /** City destination select inside modal. Options load asynchronously. */
  citySelect(): Locator {
    return this.addTripModal().locator("select");
  }

  /** Start date input ("From") inside modal — index 0. */
  startDateInput(): Locator {
    return this.addTripModal().locator('input[type="date"]').nth(0);
  }

  /** End date input ("To") inside modal — index 1. */
  endDateInput(): Locator {
    return this.addTripModal().locator('input[type="date"]').nth(1);
  }

  /**
   * Modal submit button ("Add trip").
   * Scoped to modal to avoid clashing with NewsletterForm's button[type="submit"].
   */
  modalSubmitButton(): Locator {
    return this.addTripModal().locator('button[type="submit"]');
  }

  /** Open the add-trip modal. */
  async openAddTripModal(): Promise<void> {
    await this.addTripButton().click();
    await this.addTripModal().waitFor({ state: "visible" });
  }

  /**
   * Select a city (by option index), fill dates, and submit.
   * Waits for city options to load before selecting.
   * @param cityIndex 1-based index of the city option (0 is blank placeholder)
   * @param startDate ISO date string e.g. "2026-09-01"
   * @param endDate   ISO date string e.g. "2026-09-07"
   * @returns the city name as displayed in the option label
   */
  async addTrip(
    cityIndex: number,
    startDate: string,
    endDate: string,
  ): Promise<string> {
    await this.openAddTripModal();
    // Wait for city options to populate (async fetchCities)
    await this.page.waitForFunction(
      ([sel, min]) => {
        const el = document.querySelector(sel as string);
        return el instanceof HTMLSelectElement && el.options.length > (min as number);
      },
      ['[role="dialog"] select', 1],
      { timeout: 10_000 },
    );
    // Get city name from option text before selecting
    const option = this.addTripModal().locator("select option").nth(cityIndex);
    const rawText = await option.textContent();
    // Option text: "Miami, FL · full Scout data" → extract city name
    const cityName = rawText?.split(",")[0]?.trim() ?? "";
    await this.citySelect().selectOption({ index: cityIndex });
    await this.startDateInput().fill(startDate);
    await this.endDateInput().fill(endDate);
    await this.modalSubmitButton().click();
    return cityName;
  }

  // ── Trip cards ────────────────────────────────────────────────────────────

  /** All trip card articles. */
  tripCards(): Locator {
    return this.page.locator("article.rounded-xl.border");
  }

  /** Trip card at index n. */
  tripCardAt(n: number): Locator {
    return this.tripCards().nth(n);
  }

  /** City name h2 in a trip card. */
  tripCityHeading(cardIndex: number): Locator {
    return this.tripCardAt(cardIndex).locator("h2");
  }

  /**
   * Date paragraph in a trip card.
   * Two p.readout elements exist in TripCard:
   *   1. Date line: class contains "mt-1.5 flex items-center gap-1.5 text-ink/70"
   *   2. Destination label: class contains "mt-4 text-ink/70"
   * Use the CalendarRange icon's sibling text to reliably target the date line.
   */
  tripDateParagraph(cardIndex: number): Locator {
    // The date paragraph contains a CalendarRange SVG icon followed by date text.
    // Filter by the presence of the SVG (lucide-calendar-range class on the icon).
    return this.tripCardAt(cardIndex)
      .locator("p.readout")
      .filter({ has: this.page.locator("svg") })
      .first();
  }

  /**
   * Lodging input inside a trip card.
   * aria-label: "Lodging for your {cityName} trip"
   */
  lodgingInput(cardIndex: number): Locator {
    return this.tripCardAt(cardIndex).locator('input[aria-label*="Lodging"]');
  }

  /**
   * Remove trip button.
   * aria-label: "Remove trip to {cityName}"
   */
  removeTripButton(cardIndex: number): Locator {
    return this.tripCardAt(cardIndex).locator('button[aria-label*="Remove trip"]');
  }
}
