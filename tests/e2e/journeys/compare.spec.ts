/**
 * /compare page tests — CMP-01 through CMP-06
 *
 * Covers: empty state when nothing saved, table renders with 2 gyms,
 *         presence of key row headers (Monthly from, Drop-in, Parking, Day pass).
 *
 * Strategy: save gyms via UI on the home page (same page context) then
 * navigate to /compare. This avoids needing hardcoded gym UUIDs and tests
 * the real save→compare flow.
 *
 * Traps heeded:
 * - Row label is "Monthly from" not "Monthly".
 * - No .textContent() on possibly-absent elements.
 * - No waitForTimeout — retry-based assertions with extended timeout for
 *   Supabase data fetch on /compare.
 * - The outer <table> element renders before Supabase data arrives. Wait for
 *   gymColumnLinks (thead a[href^="/gym/"]) to be visible, not just the table.
 */
import { test, expect } from "../../fixtures/journeys";
import { ComparePage } from "../../pages/ComparePage";
import { ShortlistPage } from "../../pages/ShortlistPage";

/** Save 2 gyms via UI and navigate to /compare, then wait for the table to
 *  fully populate (gym name links in thead visible). */
async function setupCompareTwoGyms(
  journeysPage: import("@playwright/test").Page,
): Promise<ComparePage> {
  const sl = new ShortlistPage(journeysPage);
  await sl.goto();
  await sl.saveButtonAt(0).click();
  await sl.saveButtonAt(0).click(); // nth(0) advances to next unsaved gym

  const compare = new ComparePage(journeysPage);
  await compare.goto();

  // Wait for Supabase data fetch to complete: gym name links appear in thead.
  // The outer <table> renders before data arrives — gymColumnLinks is the
  // reliable readiness signal.
  await expect(compare.gymColumnLinks().first()).toBeVisible({ timeout: 20_000 });

  return compare;
}

test.describe("Compare page", () => {
  test("CMP-01: empty state when nothing saved", async ({ journeysPage }) => {
    const compare = new ComparePage(journeysPage);
    await compare.goto();

    await expect(compare.h1()).toContainText("Compare");
    await expect(compare.emptyStateTitle()).toBeVisible();
    await expect(compare.findGymsButton()).toBeVisible();
  });

  test("CMP-02: table renders with 2 saved gyms — at least 2 gym columns", async ({
    journeysPage,
  }) => {
    const compare = await setupCompareTwoGyms(journeysPage);

    // At least 2 gym name links in thead
    const count = await compare.gymColumnLinks().count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test("CMP-03: 'Monthly from' row present in comparison table", async ({
    journeysPage,
  }) => {
    const compare = await setupCompareTwoGyms(journeysPage);

    await expect(compare.monthlyFromRow()).toBeVisible();
  });

  test("CMP-04: 'Drop-in' row present in comparison table", async ({
    journeysPage,
  }) => {
    const compare = await setupCompareTwoGyms(journeysPage);

    await expect(compare.dropInRow()).toBeVisible();
  });

  test("CMP-05: 'Parking' row present in comparison table", async ({
    journeysPage,
  }) => {
    const compare = await setupCompareTwoGyms(journeysPage);

    await expect(compare.parkingRow()).toBeVisible();
  });

  test("CMP-06: 'Day pass' row present in comparison table", async ({
    journeysPage,
  }) => {
    const compare = await setupCompareTwoGyms(journeysPage);

    await expect(compare.dayPassRow()).toBeVisible();
  });
});
