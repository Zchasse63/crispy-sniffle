/**
 * Getting In card tests — GI-01 through GI-03
 * GI-01: powerhouse shows "Walk in" policy chip.
 * GI-02: kodawari shows "Book first" policy chip.
 * GI-03: powerhouse shows break-even math line (has both monthly_from and day_pass_price).
 */
import { test, expect } from "../../fixtures/gymDetail";

test.describe("Getting In Card", () => {
  test("GI-01: powerhouse Getting In section shows 'Walk in' policy chip", async ({
    powerhousePage,
  }) => {
    await expect(powerhousePage.gettingInSection()).toBeVisible();
    await expect(powerhousePage.dropInPolicyChip("Walk in")).toBeVisible();
  });

  test("GI-02: kodawari Getting In section shows 'Book first' policy chip", async ({
    kodawariPage,
  }) => {
    await expect(kodawariPage.gettingInSection()).toBeVisible();
    await expect(kodawariPage.dropInPolicyChip("Book first")).toBeVisible();
  });

  test("GI-03: powerhouse shows break-even math line when both monthly and day-pass prices exist", async ({
    powerhousePage,
  }) => {
    // Powerhouse: monthly_from=$32.99, day_pass=$20 → 2 visits/month break-even
    // Rendered: "Day passes beat the membership until your 2nd visit each month…"
    await expect(powerhousePage.breakEvenLine()).toBeVisible();
    const text = await powerhousePage.breakEvenLine().textContent();
    expect(text).toMatch(/visit.*each month/i);
  });
});
