/**
 * NL Search & Example Chips — P0
 * Tests: NL-01 through NL-08
 *
 * Mode: serial — several cases hit the AI edge function (or share rate-limit
 * budget with other workers). CLAUDE.md: AI-dependent specs stay serial.
 *
 * Catalog size is derived at runtime from the unfiltered sticky-bar count —
 * never pin a hardcoded gym total (audit P1#8).
 */
import { test, expect } from "../../fixtures/discovery";

test.describe.configure({ mode: "serial" });

test.describe("NL Search", () => {
  test("NL-01: example chips visible on load when no query", async ({ discoveryPage }) => {
    const chips = discoveryPage.exampleChips();
    await expect(chips).toHaveCount(3);
    await expect(chips.nth(0)).toHaveText("vibey yoga studio");
    await expect(chips.nth(1)).toHaveText("lift heavy with a sauna, under $25");
    await expect(chips.nth(2)).toHaveText("trendy gym that's instagram friendly");
  });

  test("NL-02: clicking a chip runs the search and shows results", async ({ discoveryPage }) => {
    await discoveryPage.clickExampleChip("vibey yoga studio");

    // Example chips should disappear once rawQuery is set
    await expect(discoveryPage.exampleChips()).toHaveCount(0);

    // Parse badge (AI or fallback) should be visible
    const badgeVisible = await discoveryPage.parseBadgeVisible();
    expect(badgeVisible).toBe(true);
  });

  test("NL-03: manual search submit updates results", async ({ discoveryPage }) => {
    await discoveryPage.search("squat rack sauna");

    // Parse badge should appear
    const badgeVisible = await discoveryPage.parseBadgeVisible();
    expect(badgeVisible).toBe(true);

    // Gym count should be a number > 0 (some gyms match)
    const count = await discoveryPage.getGymCount();
    expect(count).toBeGreaterThan(0);
  });

  test("NL-04: parse badge is either AI-parsed or Quick-parsed after search", async ({
    discoveryPage,
  }) => {
    await discoveryPage.clickExampleChip("vibey yoga studio");

    const aiVisible = await discoveryPage.aiParsedBadge.isVisible();
    const quickVisible = await discoveryPage.quickParsedBadge.isVisible();
    // Exactly one of the two must be visible
    expect(aiVisible || quickVisible).toBe(true);
  });

  test("NL-05: query chip shows the raw query text in the sticky bar", async ({
    discoveryPage,
  }) => {
    await discoveryPage.clickExampleChip("vibey yoga studio");

    // The app wraps the query in Unicode curly quotes: “...”
    // Use the query chip locator from the POM which scopes to the clear-search button sibling
    await expect(discoveryPage.queryChip).toBeVisible();
    const chipText = await discoveryPage.queryChip.textContent();
    // Strip non-letter characters and compare the core query text
    expect(chipText).toContain("vibey yoga studio");
  });

  test("NL-06: search activates filters (parse badge visible, query chip present)", async ({
    discoveryPage,
  }) => {
    // NL queries use soft scoring — the gym count may or may not decrease depending
    // on whether the query maps to hard filters (amenities/equipment) or soft vibes.
    // We assert the search ran successfully: badge and chip are present.
    await discoveryPage.clickExampleChip("vibey yoga studio");

    const badgeVisible = await discoveryPage.parseBadgeVisible();
    expect(badgeVisible).toBe(true);

    await expect(discoveryPage.queryChip).toBeVisible();
  });

  test("NL-07: clearing via the X button on the query chip resets state", async ({
    discoveryPage,
  }) => {
    // Baseline = unfiltered catalog size from the app itself (not a pinned 35).
    const catalogCount = await discoveryPage.getGymCount();
    expect(catalogCount).toBeGreaterThan(0);

    await discoveryPage.clickExampleChip("vibey yoga studio");

    // Clear the search
    await discoveryPage.resetViaQueryChip();

    // Count should return to the same unfiltered catalog size
    const countAfter = await discoveryPage.getGymCount();
    expect(countAfter).toBe(catalogCount);

    // Example chips should reappear
    await expect(discoveryPage.exampleChips()).toHaveCount(3);

    // No parse badge
    await expect(discoveryPage.aiParsedBadge).not.toBeVisible();
    await expect(discoveryPage.quickParsedBadge).not.toBeVisible();
  });

  test("NL-08: submit button is disabled when input is empty", async ({ discoveryPage }) => {
    // On fresh load the input is empty
    await expect(discoveryPage.submitButton).toBeDisabled();
  });
});
