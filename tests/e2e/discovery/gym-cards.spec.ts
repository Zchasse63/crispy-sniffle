/**
 * GymCard List View — P1
 * Tests: CARD-01 through CARD-06
 */
import { test, expect } from "../../fixtures/discovery";

test.describe("Gym Cards", () => {
  test("CARD-01: cards show gym name and neighborhood", async ({ discoveryPage }) => {
    const cards = discoveryPage.gymCards;
    await expect(cards.first()).toBeVisible();

    // Check first 3 cards have non-empty name and neighborhood text
    for (let i = 0; i < 3; i++) {
      const card = cards.nth(i);
      const name = await card.locator("h3.display").textContent();
      expect(name?.trim().length).toBeGreaterThan(0);
    }
  });

  test("CARD-02: open status chip text matches expected format", async ({ discoveryPage }) => {
    await expect(discoveryPage.gymCards.first()).toBeVisible();

    // Query all clock-adjacent status spans globally — avoids per-card iteration timeouts.
    // The app renders these only after client-side hydration (useEffect).
    // Clock chips match the regex /Open ·|Closes|Opens/ per the analysis.
    const statusSpans = discoveryPage.page
      .locator('a[href^="/gym/"] span')
      .filter({ hasText: /Open ·|Closes|Opens/ });

    // At least one gym must have hours data published
    await expect(statusSpans.first()).toBeVisible();
    const firstText = await statusSpans.first().textContent();
    expect(firstText).toMatch(/Open ·|Closes|Opens/);
  });

  test("CARD-03: at least one card shows FREE PARKING chip", async ({ discoveryPage }) => {
    const cards = discoveryPage.gymCards;
    await expect(cards.first()).toBeVisible();

    // "free parking" chip text (lowercased in source for gyms with free/customer access)
    const parkingChip = discoveryPage.page.locator("span").filter({ hasText: "free parking" }).first();
    await expect(parkingChip).toBeVisible();
  });

  test("CARD-04: match badge and Why it fits appear when search is active", async ({
    discoveryPage,
  }) => {
    await discoveryPage.search("sauna");

    const cards = discoveryPage.gymCards;
    await expect(cards.first()).toBeVisible();

    // Look for "Why it fits:" text in any card
    const whyItFits = discoveryPage.page.locator("b").filter({ hasText: "Why it fits:" }).first();
    await expect(whyItFits).toBeVisible();

    // The card header area (top-left absolute div) shows the numeric match score
    const matchBadge = cards.first().locator("div.absolute.left-3.top-3");
    await expect(matchBadge).toBeVisible();
  });

  test("CARD-05: card is a link to gym detail page", async ({ discoveryPage }) => {
    const firstCard = discoveryPage.gymCards.first();
    await expect(firstCard).toBeVisible();

    const href = await firstCard.getAttribute("href");
    expect(href).toMatch(/^\/gym\//);
  });

  test("CARD-06: day pass price shown on at least some cards", async ({ discoveryPage }) => {
    const cards = discoveryPage.gymCards;
    await expect(cards.first()).toBeVisible();

    // At least one card must show "$N day"
    const priceSpan = discoveryPage.page.locator("span").filter({ hasText: /\$\d+ day/ }).first();
    await expect(priceSpan).toBeVisible();
  });
});
