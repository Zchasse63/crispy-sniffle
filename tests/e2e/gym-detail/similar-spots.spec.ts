/**
 * Similar spots tests — SIM-01
 * Grid at page bottom links to other /gym/ pages.
 */
import { test, expect } from "../../fixtures/gymDetail";

test.describe("Similar Spots", () => {
  test("SIM-01: similar spots grid links to other /gym/ pages on all three gyms", async ({
    powerhousePage,
    kodawariPage,
    ampedPage,
  }) => {
    for (const gymPage of [powerhousePage, kodawariPage, ampedPage]) {
      // Similar section heading present
      await expect(gymPage.similarSection()).toBeVisible();
      const headingText = await gymPage
        .similarSection()
        .locator("h2")
        .first()
        .textContent();
      expect(headingText).toMatch(/Similar.*spots/i);

      // At least one /gym/ link present (the similar spots cards)
      const gymLinksCount = await gymPage.similarGymLinks().count();
      expect(gymLinksCount).toBeGreaterThanOrEqual(1);

      // All /gym/ links should point to valid slugged paths
      const hrefs = await gymPage.similarGymLinks().evaluateAll((links) =>
        (links as HTMLAnchorElement[]).map((a) => a.getAttribute("href") ?? ""),
      );
      for (const href of hrefs) {
        expect(href).toMatch(/^\/gym\/.+/);
      }
    }
  });
});
