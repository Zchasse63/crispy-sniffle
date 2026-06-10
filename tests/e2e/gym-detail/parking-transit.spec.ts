/**
 * Parking & transit card tests — PARK-01 through PARK-05
 * PARK-01: powerhouse parking section exists with primary recommendation.
 * PARK-02: powerhouse has alternatives list with >= 1 item.
 * PARK-03: powerhouse shows transit footer with bus stop text.
 * PARK-04: powerhouse shows OSM attribution.
 * PARK-05: amped has no parking section (ParkingCard returns null).
 */
import { test, expect } from "../../fixtures/gymDetail";

test.describe("Parking & Transit", () => {
  test("PARK-01: powerhouse parking section exists with primary recommendation text", async ({
    powerhousePage,
  }) => {
    await expect(powerhousePage.parkingSection()).toBeVisible();
    const primaryRec = powerhousePage.parkingPrimaryRec();
    await expect(primaryRec).toBeVisible();
    const text = await primaryRec.textContent();
    expect(text!.trim().length).toBeGreaterThan(0);
  });

  test("PARK-02: powerhouse has a parking alternatives list with at least one item", async ({
    powerhousePage,
  }) => {
    await expect(powerhousePage.parkingAlternativesList()).toBeVisible();
    const itemCount = await powerhousePage
      .parkingAlternativesList()
      .locator("li")
      .count();
    expect(itemCount).toBeGreaterThanOrEqual(1);
  });

  test("PARK-03: powerhouse shows transit footer with bus stop", async ({
    powerhousePage,
  }) => {
    // Transit footer is a <p> containing Bus stop text within the parking section
    const transitFooter = powerhousePage
      .parkingSection()
      .locator("p")
      .filter({ hasText: /Bus stop/i });
    await expect(transitFooter).toBeVisible();
    const text = await transitFooter.textContent();
    expect(text).toMatch(/Bus stop/i);
  });

  test("PARK-04: powerhouse shows OpenStreetMap attribution in parking card", async ({
    powerhousePage,
  }) => {
    await expect(powerhousePage.osmAttribution()).toBeVisible();
  });

  test("PARK-05: amped has no parking section (ParkingCard returns null)", async ({
    ampedPage,
  }) => {
    expect(await ampedPage.parkingSection().count()).toBe(0);
    // Page renders correctly
    await expect(ampedPage.h1()).toBeVisible();
  });
});
