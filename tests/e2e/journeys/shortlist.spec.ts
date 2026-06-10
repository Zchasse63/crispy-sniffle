/**
 * Shortlist journey tests — SL-01 through SL-05
 *
 * Covers: GymCard save toggle, header count badge, drawer open/contents,
 *         remove from drawer, localStorage persistence across reload.
 *
 * Traps heeded:
 * - ShortlistButton is inside a Link: click handler uses e.preventDefault() +
 *   e.stopPropagation() — safe to click directly, no navigation occurs.
 * - No .textContent() on possibly-absent elements — use .count() / .isVisible().
 * - No waitForTimeout — Playwright retry-based assertions only.
 * - No multi-Page fixtures — all navigation happens within each test body.
 */
import { test, expect } from "../../fixtures/journeys";
import { ShortlistPage } from "../../pages/ShortlistPage";

test.describe("Shortlist", () => {
  test("SL-01: save button on GymCard toggles aria-label and aria-pressed", async ({
    journeysPage,
  }) => {
    const sl = new ShortlistPage(journeysPage);
    await sl.goto();

    const saveBtn = sl.saveButtonAt(0);

    // Initial state: unsaved
    await expect(saveBtn).toHaveAttribute("aria-label", "Save to shortlist");
    await expect(saveBtn).toHaveAttribute("aria-pressed", "false");

    // Save
    await saveBtn.click();

    // After save: button aria-label changes to "Remove from shortlist"
    const removeBtn = sl.removeFromCardButtons().first();
    await expect(removeBtn).toBeVisible();
    await expect(removeBtn).toHaveAttribute("aria-label", "Remove from shortlist");
    await expect(removeBtn).toHaveAttribute("aria-pressed", "true");

    // Unsave: click the remove button
    await removeBtn.click();

    // Back to save state
    await expect(sl.saveButtonAt(0)).toHaveAttribute("aria-label", "Save to shortlist");
    await expect(sl.saveButtonAt(0)).toHaveAttribute("aria-pressed", "false");
  });

  test("SL-02: header shortlist button count updates when gyms are saved", async ({
    journeysPage,
  }) => {
    const sl = new ShortlistPage(journeysPage);
    await sl.goto();

    // Initial count: 0
    await expect(sl.headerShortlistButton()).toHaveAttribute(
      "aria-label",
      "Open shortlist (0 saved)",
    );

    // Save first gym
    await sl.saveButtonAt(0).click();
    await expect(sl.headerShortlistButton()).toHaveAttribute(
      "aria-label",
      "Open shortlist (1 saved)",
    );

    // Save second gym
    await sl.saveButtonAt(0).click(); // nth(0) is now the next unsaved gym
    await expect(sl.headerShortlistButton()).toHaveAttribute(
      "aria-label",
      "Open shortlist (2 saved)",
    );
  });

  test("SL-03: drawer opens and lists the saved gym", async ({
    journeysPage,
  }) => {
    const sl = new ShortlistPage(journeysPage);
    await sl.goto();

    // Save the first gym
    await sl.saveButtonAt(0).click();
    // Confirm 1 saved
    await expect(sl.headerShortlistButton()).toHaveAttribute(
      "aria-label",
      "Open shortlist (1 saved)",
    );

    // Open drawer
    await sl.openDrawer();
    await expect(sl.drawer()).toBeVisible();

    // Wait for GymRow to load (async Supabase fetch for gym data)
    await expect(sl.drawerGymLinks().first()).toBeVisible({ timeout: 10_000 });
  });

  test("SL-04: remove from drawer — count resets to 0", async ({
    journeysPage,
  }) => {
    const sl = new ShortlistPage(journeysPage);
    await sl.goto();

    // Save one gym
    await sl.saveButtonAt(0).click();

    // Open drawer
    await sl.openDrawer();

    // Wait for GymRow remove button (async data fetch)
    await expect(sl.drawerRemoveButtons().first()).toBeVisible({ timeout: 10_000 });

    // Remove the gym
    await sl.drawerRemoveButtons().first().click();

    // Drawer should show empty state
    await expect(sl.drawerEmptyMessage()).toBeVisible();

    // Header should revert to 0
    await expect(sl.headerShortlistButton()).toHaveAttribute(
      "aria-label",
      "Open shortlist (0 saved)",
    );
  });

  test("SL-05: saved gyms persist across page reload (localStorage)", async ({
    journeysPage,
  }) => {
    const sl = new ShortlistPage(journeysPage);
    await sl.goto();

    // Save one gym
    await sl.saveButtonAt(0).click();
    await expect(sl.headerShortlistButton()).toHaveAttribute(
      "aria-label",
      "Open shortlist (1 saved)",
    );

    // Reload the page
    await journeysPage.reload();

    // Wait for hydration to complete — the header button label should show (1 saved)
    await expect(sl.headerShortlistButton()).toHaveAttribute(
      "aria-label",
      "Open shortlist (1 saved)",
      { timeout: 10_000 },
    );
  });
});
