/**
 * Acceptance Searches — P0
 * Tests: ACC-01 through ACC-03
 * These tests assert live data ordering from the Supabase database.
 * No mocking — run against http://localhost:3100 with real data.
 *
 * Mode: serial — the AI edge function (Supabase) has limited concurrency.
 * Running these tests simultaneously causes timeout under load from other
 * parallel workers. Serial mode ensures each AI call completes before the next.
 *
 * Timeout: 60s per test to accommodate edge function cold starts.
 */
import { test, expect } from "../../fixtures/discovery";

test.describe.configure({ mode: "serial" });

test.describe("Acceptance Searches", () => {
  test.setTimeout(60_000);

  test("ACC-01: yoga studio with cold plunge → Kodawari Studios first with score 100", async ({
    discoveryPage,
  }) => {
    await discoveryPage.search("yoga studio with a cold plunge");

    const cards = discoveryPage.gymCards;
    await expect(cards.first()).toBeVisible();

    // First result must be Kodawari Studios
    const firstName = await cards.first().locator("h3.display").textContent();
    expect(firstName?.trim()).toBe("Kodawari Studios");

    // Match badge on the first card must show 100 — the badge div is in the top-left absolute container
    const firstCard = cards.first();
    const cardText = await firstCard.locator("div.absolute.left-3.top-3").textContent();
    expect(cardText).toContain("100");
  });

  test("ACC-02: women's only gym → Fox Fitness and Peach Lab in top 2", async ({
    discoveryPage,
  }) => {
    await discoveryPage.search("women's only gym");

    const cards = discoveryPage.gymCards;
    await expect(cards.first()).toBeVisible();

    // Collect the names of the first two cards
    const name1 = (await cards.nth(0).locator("h3.display").textContent())?.trim() ?? "";
    const name2 = (await cards.nth(1).locator("h3.display").textContent())?.trim() ?? "";

    const topTwo = new Set([name1, name2]);
    expect(topTwo.has("Fox Fitness")).toBe(true);
    expect(topTwo.has("Peach Lab")).toBe(true);
  });

  test("ACC-03: lift heavy under $25 → 813 Barbell / Powerhouse in top 3, no gym over $25", async ({
    discoveryPage,
  }) => {
    await discoveryPage.search("lift heavy with a day pass under $25");

    const cards = discoveryPage.gymCards;
    await expect(cards.first()).toBeVisible();

    // 813 Barbell or Powerhouse must appear in the first 3 cards
    const names = await Promise.all([
      cards.nth(0).locator("h3.display").textContent(),
      cards.nth(1).locator("h3.display").textContent(),
      cards.nth(2).locator("h3.display").textContent(),
    ]);
    const topThree = names.map((n) => n?.trim() ?? "");
    const hasExpectedGym = topThree.some(
      (n) => n.includes("813 Barbell") || n.includes("Powerhouse"),
    );
    expect(hasExpectedGym).toBe(true);

    // No visible card should show a day pass price > $25.
    // allTextContents() does NOT auto-wait — cards without a price span
    // contribute nothing instead of blocking 30s each (the cause of the
    // original ACC-03 timeout).
    const priceTexts = await cards
      .locator("span")
      .filter({ hasText: /\$\d+ day/ })
      .allTextContents();
    for (const t of priceTexts) {
      const price = parseInt(t.replace(/[^0-9]/g, ""), 10);
      expect(price).toBeLessThanOrEqual(25);
    }
  });
});
