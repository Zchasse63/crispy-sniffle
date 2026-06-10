/**
 * 404 / not-found tests — NF-01 through NF-03
 *
 * Covers: HTTP 404 status, not-found UI content, site chrome intact.
 *
 * /gym/nonexistent-slug-xyz triggers fetchGymBySlug → null → notFound()
 * which renders src/app/not-found.tsx.
 *
 * Traps heeded:
 * - No .textContent() on possibly-absent elements.
 * - No waitForTimeout.
 * - No multi-Page fixtures.
 */
import { test, expect } from "../../fixtures/journeys";

const NOT_FOUND_URL = "/gym/nonexistent-slug-xyz";

test.describe("404 not-found", () => {
  test("NF-01: returns 404 status and renders not-found UI", async ({
    journeysPage,
  }) => {
    const response = await journeysPage.goto(NOT_FOUND_URL);
    expect(response?.status()).toBe(404);

    // h1 from not-found.tsx
    await expect(journeysPage.locator("h1")).toContainText("No waypoint here.");
  });

  test("NF-02: site chrome (header) intact on 404 page", async ({
    journeysPage,
  }) => {
    await journeysPage.goto(NOT_FOUND_URL);

    // SiteHeader is in the root layout — always rendered
    await expect(journeysPage.locator("header")).toBeVisible();

    // Back to Explore link
    await expect(
      journeysPage.locator('a:has-text("Back to Explore")'),
    ).toBeVisible();

    const backHref = await journeysPage
      .locator('a:has-text("Back to Explore")')
      .getAttribute("href");
    expect(backHref).toBe("/");
  });

  test("NF-03: 404 blaze readout text present", async ({ journeysPage }) => {
    await journeysPage.goto(NOT_FOUND_URL);

    // p.readout.mt-6.text-blaze renders "404 · Off the map"
    const readout = journeysPage.locator("p.readout.mt-6.text-blaze");
    await expect(readout).toBeVisible();
    await expect(readout).toContainText("404");
  });
});
