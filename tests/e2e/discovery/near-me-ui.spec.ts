/**
 * Near Me UI Structure — P2
 * Tests: NM-01 through NM-03
 * Scope: UI structure only — no geolocation activation (headless incompatible).
 */
import { test, expect } from "../../fixtures/discovery";

test.describe("Near Me UI", () => {
  test("NM-01: Drive and Walk buttons render in Near me section", async ({ filterRail }) => {
    await expect(filterRail.driveButton).toBeVisible();
    await expect(filterRail.walkButton).toBeVisible();

    // Drive is the default mode (aria-pressed="true")
    await expect(filterRail.driveButton).toHaveAttribute("aria-pressed", "true");
    await expect(filterRail.walkButton).toHaveAttribute("aria-pressed", "false");
  });

  test("NM-02: 10, 20, and 30 min chips render in Near me section", async ({
    filterRail,
  }) => {
    await expect(filterRail.minuteChip(10)).toBeVisible();
    await expect(filterRail.minuteChip(20)).toBeVisible();
    await expect(filterRail.minuteChip(30)).toBeVisible();
  });

  test("NM-03: switching to Walk updates aria-pressed state", async ({ filterRail }) => {
    // Drive should be selected by default
    await expect(filterRail.driveButton).toHaveAttribute("aria-pressed", "true");

    // Click Walk
    await filterRail.walkButton.click();

    await expect(filterRail.walkButton).toHaveAttribute("aria-pressed", "true");
    await expect(filterRail.driveButton).toHaveAttribute("aria-pressed", "false");
  });
});
