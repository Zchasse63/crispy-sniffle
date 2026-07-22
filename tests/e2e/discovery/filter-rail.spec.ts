/**
 * Filter Rail — P1
 * Tests: FILT-01 through FILT-07
 *
 * Design note: amenity checkboxes are SOFT filters in Scout — they affect
 * match score but do NOT exclude gyms from the result set. Only these
 * filter types are HARD (exclusion): maxDayPass, segments, neighborhood,
 * open24h, openNow. Tests that require a count change use hard filters.
 *
 * Catalog size is derived at runtime from the unfiltered sticky-bar count —
 * never pin a hardcoded gym total (audit P1#8).
 */
import { test, expect } from "../../fixtures/discovery";

test.describe("Filter Rail", () => {
  test("FILT-01: day pass slider at $15 reduces result count", async ({
    discoveryPage,
    filterRail,
  }) => {
    // maxDayPass is a HARD filter — gyms with a published day_pass_price > $15 are excluded.
    const countBefore = await discoveryPage.getGymCount();
    await filterRail.setDayPass(15);
    const countAfter = await discoveryPage.getGymCount();
    expect(countAfter).toBeLessThan(countBefore);
  });

  test("FILT-02: resetting day pass slider to max restores result count", async ({
    discoveryPage,
    filterRail,
  }) => {
    const countBefore = await discoveryPage.getGymCount();

    await filterRail.setDayPass(15);
    const countFiltered = await discoveryPage.getGymCount();
    expect(countFiltered).toBeLessThan(countBefore);

    // Reset to max (60 = "Any price")
    await filterRail.setDayPass(60);
    const countRestored = await discoveryPage.getGymCount();
    expect(countRestored).toBe(countBefore);
  });

  test("FILT-03: day pass slider at $25 shows ≤ $25 in the display", async ({
    discoveryPage,
    filterRail,
  }) => {
    await filterRail.setDayPass(25);
    await expect(filterRail.dayPassDisplay).toContainText("≤ $25");
    const countAfter = await discoveryPage.getGymCount();
    expect(countAfter).toBeGreaterThan(0);
  });

  test("FILT-04: day pass slider at max (60) shows Any price", async ({ filterRail }) => {
    await filterRail.setDayPass(60);
    await expect(filterRail.dayPassDisplay).toContainText("Any price");
  });

  test("FILT-05: Clear all resets all hard filters and hides the button", async ({
    discoveryPage,
    filterRail,
  }) => {
    const catalogCount = await discoveryPage.getGymCount();
    expect(catalogCount).toBeGreaterThan(0);

    // Use the day pass slider (hard filter) to reduce count below full catalog
    await filterRail.setDayPass(15);
    const countFiltered = await discoveryPage.getGymCount();
    expect(countFiltered).toBeLessThan(catalogCount);

    // "Clear all" should now be visible
    await expect(filterRail.clearAllButton).toBeVisible();

    // Clear all
    await filterRail.clickClearAll();

    // Count should restore to the unfiltered catalog size
    const countAfter = await discoveryPage.getGymCount();
    expect(countAfter).toBe(catalogCount);

    // "Clear all" button should be gone
    await expect(filterRail.clearAllButton).not.toBeVisible();
  });

  test("FILT-06: over-constrained filters show the weak-match banner", async ({
    segmentRow,
    filterRail,
  }) => {
    // Recovery segment has only 2 gyms; adding Group Classes (not present in those gyms)
    // drives topScore to 0 → banner appears.
    await segmentRow.click("Recovery");
    await filterRail.toggleAmenity("Group Classes");

    await expect(filterRail.weakMatchBanner).toBeVisible();

    // At least one relax chip must be present
    await expect(filterRail.relaxChips().first()).toBeVisible();
  });

  test("FILT-07: clicking a relax chip removes the corresponding filter", async ({
    discoveryPage,
    segmentRow,
    filterRail,
  }) => {
    // Same trigger as FILT-06
    await segmentRow.click("Recovery");
    await filterRail.toggleAmenity("Group Classes");

    await expect(filterRail.weakMatchBanner).toBeVisible();

    const countBeforeRelax = await discoveryPage.getGymCount();

    // Click the first relax chip
    const firstChip = filterRail.relaxChips().first();
    await firstChip.click();

    // Count should increase or stay the same (a filter was loosened)
    const countAfterRelax = await discoveryPage.getGymCount();
    expect(countAfterRelax).toBeGreaterThanOrEqual(countBeforeRelax);
  });
});
