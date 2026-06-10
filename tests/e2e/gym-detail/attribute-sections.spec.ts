/**
 * Attribute section tests — ATTR-01 through ATTR-08
 * Covers: Equipment heading, Pro preview chip, machine key labels,
 *         provenance badges, confirm/correct buttons absent signed-out,
 *         confidence chips, women's area amenity, absent equipment on kodawari.
 *
 * Multi-gym tests navigate within the test body using a single fixture page
 * to avoid the shared-page fixture trap.
 */
import { test, expect } from "../../fixtures/gymDetail";
import { GymDetailPage } from "../../pages/GymDetailPage";

test.describe("Attribute Sections", () => {
  test("ATTR-01: powerhouse Equipment heading and Pro preview chip are visible", async ({
    powerhousePage,
  }) => {
    await expect(powerhousePage.equipmentHeading()).toBeVisible();
    await expect(powerhousePage.proPreviewChip()).toBeVisible();
  });

  test("ATTR-02: powerhouse equipment section contains machine key labels", async ({
    powerhousePage,
  }) => {
    const factRows = powerhousePage.factRows();
    const rowCount = await factRows.count();
    expect(rowCount).toBeGreaterThan(0);

    // Collect all text from fact rows
    const allText = await factRows.allTextContents();
    const combined = allText.join(" ");

    // Verified machine/equipment keys from DOM analysis
    expect(combined).toMatch(/Barbells|Squat Rack|Competition Bench|Dumbbells/);
  });

  test("ATTR-03: provenance badge 'Web Data' present in at least one fact row on all gyms", async ({
    powerhousePage,
  }) => {
    const SLUGS = [
      "powerhouse-gym-athletic-club",
      "kodawari-studios",
      "amped-fitness-carrollwood",
    ] as const;

    for (const slug of SLUGS) {
      const gymPage = new GymDetailPage(powerhousePage.page, slug);
      await gymPage.goto();
      const webDataCount = await gymPage.provenanceBadge("Web Data").count();
      expect(webDataCount).toBeGreaterThan(0);
    }
  });

  test("ATTR-04: powerhouse shows at least one Estimated provenance badge", async ({
    powerhousePage,
  }) => {
    const estimatedCount = await powerhousePage
      .provenanceBadge("Estimated")
      .count();
    expect(estimatedCount).toBeGreaterThan(0);
  });

  test("ATTR-05: no confirm/correct buttons visible inside fact rows when signed out", async ({
    powerhousePage,
  }) => {
    const SLUGS = [
      "powerhouse-gym-athletic-club",
      "kodawari-studios",
      "amped-fitness-carrollwood",
    ] as const;

    for (const slug of SLUGS) {
      const gymPage = new GymDetailPage(powerhousePage.page, slug);
      await gymPage.goto();
      // FactConfirm renders with auth gate — should produce 0 visible buttons
      // inside li.group/fact rows when not signed in
      const rowButtons = await gymPage.factRows().locator("button").count();
      expect(rowButtons).toBe(0);
    }
  });

  test("ATTR-06: powerhouse shows confidence percentage chips on estimated facts", async ({
    powerhousePage,
  }) => {
    // Confidence chips: <span class="opacity-60">55%</span> inside provenance badge
    const confidenceChips = powerhousePage.page
      .locator("span.opacity-60")
      .filter({ hasText: /^\d+%$/ });
    const count = await confidenceChips.count();
    expect(count).toBeGreaterThan(0);
  });

  test("ATTR-07: amped shows Women's-Only Area amenity label", async ({
    ampedPage,
  }) => {
    const allText = await ampedPage.factRows().allTextContents();
    const combined = allText.join(" ");
    expect(combined).toMatch(/Women.s.Only Area|Women's-Only/i);
  });

  test("ATTR-08: kodawari has no Equipment section heading", async ({
    kodawariPage,
  }) => {
    expect(await kodawariPage.equipmentHeading().count()).toBe(0);
  });
});
