/**
 * Hours section tests — HRS-01, HRS-02
 * HRS-01: powerhouse and kodawari show Hours section with open/closed status chip.
 * HRS-02: amped shows "Open 24 hours, every day" and Open now chip.
 *
 * HRS-01 navigates within the test body to avoid the shared-page fixture trap.
 */
import { test, expect } from "../../fixtures/gymDetail";
import { GymDetailPage } from "../../pages/GymDetailPage";

test.describe("Hours", () => {
  test("HRS-01: powerhouse and kodawari show Hours section with open/closed status", async ({
    powerhousePage,
  }) => {
    const slugs = [
      "powerhouse-gym-athletic-club",
      "kodawari-studios",
    ] as const;

    for (const slug of slugs) {
      const gymPage = new GymDetailPage(powerhousePage.page, slug);
      await gymPage.goto();

      await expect(gymPage.hoursSection()).toBeVisible();

      // Open/Closed now chip — text matches Open or Closed
      const chip = gymPage.openStatusChip();
      await expect(chip).toBeVisible();
      const chipText = await chip.textContent();
      expect(chipText).toMatch(/^(Open|Closed) now$/);
    }
  });

  test("HRS-02: amped shows '24 hours' text and an open status chip", async ({
    ampedPage,
  }) => {
    await expect(ampedPage.hoursSection()).toBeVisible();
    await expect(ampedPage.hours24hText()).toBeVisible();

    // Open now chip still present (open_24h → always open)
    const chip = ampedPage.openStatusChip();
    await expect(chip).toBeVisible();
    const chipText = await chip.textContent();
    expect(chipText).toMatch(/Open|24/i);
  });
});
