/**
 * Footer NewsletterForm tests — NL-01 through NL-04
 *
 * Covers: checkboxes default-checked, unchecking both disables submit,
 *         valid email + one interest enables submit, empty email keeps disabled.
 *
 * CRITICAL: Do NOT click the enabled submit button.
 * Clicking fires a Supabase INSERT into email_subscribers (no test rows in prod).
 *
 * Traps heeded:
 * - Footer is below the fold — scroll to it before interacting.
 * - button[type="submit"] in the footer is the "Alerts" button (aria-label="Subscribe").
 *   Use that aria-label, not the generic submit selector.
 * - No waitForTimeout.
 * - No multi-Page fixtures.
 */
import { test, expect } from "../../fixtures/journeys";

test.describe("Footer NewsletterForm", () => {
  async function gotoAndScrollToFooter(
    page: import("@playwright/test").Page,
  ): Promise<void> {
    await page.goto("/");
    // Wait for page to load
    await page.locator("header").waitFor({ state: "visible" });
    // Scroll to footer
    await page.locator("footer").scrollIntoViewIfNeeded();
    // Confirm both checkboxes are mounted
    await page
      .locator('footer input[type="checkbox"]')
      .first()
      .waitFor({ state: "visible" });
  }

  test("NL-01: both checkboxes are checked by default", async ({
    journeysPage,
  }) => {
    await gotoAndScrollToFooter(journeysPage);

    const checkboxes = journeysPage.locator('footer input[type="checkbox"]');
    await expect(checkboxes.nth(0)).toBeChecked(); // "New gyms"
    await expect(checkboxes.nth(1)).toBeChecked(); // "Changes at gyms"
  });

  test("NL-02: unchecking both checkboxes disables the Alerts submit", async ({
    journeysPage,
  }) => {
    await gotoAndScrollToFooter(journeysPage);

    const checkboxes = journeysPage.locator('footer input[type="checkbox"]');
    const alertsBtn = journeysPage.locator('button[aria-label="Subscribe"]');

    // Uncheck both
    await checkboxes.nth(0).uncheck();
    await checkboxes.nth(1).uncheck();

    // Submit must be disabled even if email were valid
    await expect(alertsBtn).toBeDisabled();
  });

  test("NL-03: valid email + one interest enables the Alerts submit — stop before sending", async ({
    journeysPage,
  }) => {
    await gotoAndScrollToFooter(journeysPage);

    const emailInput = journeysPage.locator('input[aria-label="Email for gym alerts"]');
    const alertsBtn = journeysPage.locator('button[aria-label="Subscribe"]');

    // Checkboxes are default-checked — at least one interest is active
    // Fill valid email
    await emailInput.fill("test@example.com");

    // Button should now be enabled — DO NOT CLICK
    await expect(alertsBtn).toBeEnabled();
  });

  test("NL-04: empty email keeps submit disabled even with both checkboxes checked", async ({
    journeysPage,
  }) => {
    await gotoAndScrollToFooter(journeysPage);

    const emailInput = journeysPage.locator('input[aria-label="Email for gym alerts"]');
    const alertsBtn = journeysPage.locator('button[aria-label="Subscribe"]');

    // Both checkboxes are checked (default), email is empty
    await expect(emailInput).toHaveValue("");
    await expect(alertsBtn).toBeDisabled();
  });
});
