/**
 * Acceptance Searches — P0
 * Tests: ACC-01 through ACC-03
 *
 * CI assertions are INVARIANTS over live parse + score output (price caps,
 * MatchBadge presence, result-count consistency, curated-set membership).
 * Exact gym-name / rank-order checks belong to a manually-run smoke against
 * a known rich-tier seed — not CI — because catalog growth and AI parse
 * variance make pinned names flaky (audit E-section / Kimi).
 *
 * Mode: serial — the AI edge function (Supabase) has limited concurrency.
 * Running these tests simultaneously causes timeout under load from other
 * parallel workers. Serial mode ensures each AI call completes before the next.
 *
 * Timeout: 60s per test to accommodate edge function cold starts.
 */
import { test, expect } from "../../fixtures/discovery";

test.describe.configure({ mode: "serial" });

/** Curated Tampa rich-tier names from the original seed research set.
 *  Used only as a membership pool for a smoke-level "top result is one of…"
 *  check — never as a pinned rank-1 exact match. */
const CURATED_RICH_GYMS = [
  "Kodawari Studios",
  "Fox Fitness",
  "Peach Lab",
  "813 Barbell",
  "Powerhouse",
  "Cigar City CrossFit",
  "Bayshore Fit",
  "Central Rock Gym",
  "Crunch Fitness",
  "LA Fitness",
  "Camp Tampa",
  "Tampa Muay Thai",
  "Westshore CrossFit",
  "Dale Mabry CrossFit",
  "Amped Fitness",
];

function nameMatchesCurated(name: string): boolean {
  const n = name.toLowerCase();
  return CURATED_RICH_GYMS.some((g) => n.includes(g.toLowerCase()));
}

test.describe("Acceptance Searches", () => {
  test.setTimeout(60_000);

  test("ACC-01: yoga + cold plunge → scored results with MatchBadge, curated top hit", async ({
    discoveryPage,
  }) => {
    await discoveryPage.search("yoga studio with a cold plunge");

    const cards = discoveryPage.gymCards;
    await expect(cards.first()).toBeVisible();

    const resultCount = await discoveryPage.getGymCount();
    expect(resultCount).toBeGreaterThan(0);
    // Sticky-bar count must match at least the first page of rendered cards
    const rendered = await cards.count();
    expect(rendered).toBeGreaterThan(0);
    expect(rendered).toBeLessThanOrEqual(resultCount);

    // First card must carry a MatchBadge ("N match") after an NL search
    const firstCard = cards.first();
    const badge = firstCard.getByText(/\d+\s*match/i);
    await expect(badge).toBeVisible();

    // Smoke: a curated rich gym appears in the top few (membership, not rank-1 pin)
    const topN = Math.min(await cards.count(), 3);
    const topNames: string[] = [];
    for (let i = 0; i < topN; i++) {
      const n = (await cards.nth(i).locator("h3.display").textContent())?.trim() ?? "";
      topNames.push(n);
    }
    expect(topNames.some(nameMatchesCurated)).toBe(true);
  });

  test("ACC-02: women's only gym → MatchBadge + curated membership in top results", async ({
    discoveryPage,
  }) => {
    await discoveryPage.search("women's only gym");

    const cards = discoveryPage.gymCards;
    await expect(cards.first()).toBeVisible();

    const resultCount = await discoveryPage.getGymCount();
    expect(resultCount).toBeGreaterThan(0);

    const firstCard = cards.first();
    await expect(firstCard.getByText(/\d+\s*match/i)).toBeVisible();

    // At least one of the top visible cards is from the curated rich set
    const topN = Math.min(await cards.count(), 5);
    const names: string[] = [];
    for (let i = 0; i < topN; i++) {
      const n = (await cards.nth(i).locator("h3.display").textContent())?.trim() ?? "";
      names.push(n);
    }
    expect(names.some(nameMatchesCurated)).toBe(true);
  });

  test("ACC-03: lift heavy under $25 → price cap invariant + MatchBadge + curated smoke", async ({
    discoveryPage,
  }) => {
    await discoveryPage.search("lift heavy with a day pass under $25");

    const cards = discoveryPage.gymCards;
    await expect(cards.first()).toBeVisible();

    const resultCount = await discoveryPage.getGymCount();
    expect(resultCount).toBeGreaterThan(0);

    await expect(cards.first().getByText(/\d+\s*match/i)).toBeVisible();

    // Hard filter invariant: no visible card shows a day pass price > $25.
    // allTextContents() does NOT auto-wait — cards without a price span
    // contribute nothing instead of blocking 30s each (the cause of the
    // original ACC-03 timeout).
    const priceTexts = await cards
      .locator("span")
      .filter({ hasText: /\$\d+ day/ })
      .allTextContents();
    expect(priceTexts.length).toBeGreaterThan(0);
    for (const t of priceTexts) {
      const price = parseInt(t.replace(/[^0-9]/g, ""), 10);
      expect(price).toBeLessThanOrEqual(25);
    }

    // Smoke: a curated strength gym appears somewhere in the top results
    const topN = Math.min(await cards.count(), 5);
    const names: string[] = [];
    for (let i = 0; i < topN; i++) {
      const n = (await cards.nth(i).locator("h3.display").textContent())?.trim() ?? "";
      names.push(n);
    }
    expect(names.some(nameMatchesCurated)).toBe(true);
  });
});
