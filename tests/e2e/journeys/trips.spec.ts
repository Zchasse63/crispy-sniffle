/**
 * /trips page tests — TR-01 through TR-05
 *
 * Covers: add-trip form, trip card with city + dates, lodging input present,
 *         remove trip, localStorage persistence across reload.
 *
 * Traps heeded:
 * - Modal submit scoped to [role="dialog"] to avoid clashing with
 *   NewsletterForm's button[type="submit"] (Alerts button).
 * - Do NOT assert geocode network result from lodging input.
 * - No .textContent() on possibly-absent elements.
 * - No waitForTimeout.
 * - No multi-Page fixtures.
 */
import { test, expect } from "../../fixtures/journeys";
import { TripsPage } from "../../pages/TripsPage";

test.describe("Trips page", () => {
  test("TR-01: add-trip form opens with city select and date inputs", async ({
    journeysPage,
  }) => {
    const trips = new TripsPage(journeysPage);
    await trips.goto();

    await expect(trips.h1()).toContainText("Trips");

    // Open modal
    await trips.openAddTripModal();
    await expect(trips.addTripModal()).toBeVisible();

    // Modal has city select and 2 date inputs
    await expect(trips.citySelect()).toBeVisible();
    await expect(trips.startDateInput()).toBeVisible();
    await expect(trips.endDateInput()).toBeVisible();
  });

  test("TR-02: trip card appears with city name and dates after adding", async ({
    journeysPage,
  }) => {
    const trips = new TripsPage(journeysPage);
    await trips.goto();

    // Add a trip using the first available city
    const cityName = await trips.addTrip(1, "2026-09-01", "2026-09-07");

    // Modal should close
    await expect(trips.addTripModal()).not.toBeVisible();

    // Trip card should appear
    await expect(trips.tripCards()).toHaveCount(1, { timeout: 5_000 });

    // City name in h2
    await expect(trips.tripCityHeading(0)).toContainText(cityName);

    // Date paragraph should contain the formatted start date
    // fmtDate("2026-09-01") → "Sep 1" (no year = current year is 2026)
    const datePara = trips.tripDateParagraph(0);
    await expect(datePara).toContainText("Sep 1");
  });

  test("TR-03: lodging input present on trip card", async ({
    journeysPage,
  }) => {
    const trips = new TripsPage(journeysPage);
    await trips.goto();

    await trips.addTrip(1, "2026-09-01", "2026-09-07");
    await expect(trips.tripCards()).toHaveCount(1, { timeout: 5_000 });

    // Lodging input present and editable — do NOT submit or assert geocode result
    const lodging = trips.lodgingInput(0);
    await expect(lodging).toBeVisible();
    await expect(lodging).toBeEditable();
  });

  test("TR-04: remove trip — card disappears", async ({
    journeysPage,
  }) => {
    const trips = new TripsPage(journeysPage);
    await trips.goto();

    await trips.addTrip(1, "2026-09-01", "2026-09-07");
    await expect(trips.tripCards()).toHaveCount(1, { timeout: 5_000 });

    // Remove button visible
    await expect(trips.removeTripButton(0)).toBeVisible();

    // Click remove
    await trips.removeTripButton(0).click();

    // Trip card gone
    await expect(trips.tripCards()).toHaveCount(0, { timeout: 5_000 });
  });

  test("TR-05: trip persists across page reload (localStorage)", async ({
    journeysPage,
  }) => {
    const trips = new TripsPage(journeysPage);
    await trips.goto();

    const cityName = await trips.addTrip(1, "2026-09-01", "2026-09-07");
    await expect(trips.tripCards()).toHaveCount(1, { timeout: 5_000 });

    // Reload page
    await journeysPage.reload();
    await trips.h1().waitFor({ state: "visible" });

    // Trip card still present after reload (Zustand persist rehydrates)
    await expect(trips.tripCards()).toHaveCount(1, { timeout: 10_000 });
    await expect(trips.tripCityHeading(0)).toContainText(cityName);
  });
});
