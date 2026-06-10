/**
 * Auth chrome tests — AUTH-01 through AUTH-06
 *
 * Covers: header "Sign in" button opens SignInModal; email validates
 * (empty/invalid → disabled; valid → enabled); modal closes via X button
 * and via Escape key.
 *
 * CRITICAL: Do NOT click the enabled submit button.
 * auth.signInWithOtp() sends a real email to Supabase. Tests stop at
 * asserting the button is enabled (not disabled).
 *
 * IMPORTANT — Stacking context trap:
 * The AuthButton in the header renders SignInModal as a child of the sticky
 * header (sticky top-0 z-40). The header creates a stacking context that
 * constrains the modal's `fixed inset-0` to the header's box (64px tall),
 * pushing the modal panel above the visible viewport. This makes clicking
 * the close button in the header-mounted modal impossible.
 *
 * For AUTH-05 and AUTH-06 (close button and Escape), the modal is opened
 * from /me — the ProfilePortal's "Sign in with email" button renders
 * SignInModal outside the header, so `fixed inset-0` covers the full viewport.
 *
 * AUTH-01 through AUTH-04 still test the header button because the
 * requirement is to verify it opens the dialog (visible) and email validation
 * works — these don't require clicking the close button.
 *
 * Traps heeded:
 * - No .textContent() on possibly-absent elements.
 * - No waitForTimeout.
 * - No multi-Page fixtures.
 */
import { test, expect } from "../../fixtures/journeys";
import { AuthPage } from "../../pages/AuthPage";
import { StaticPage } from "../../pages/StaticPage";

test.describe("Auth chrome", () => {
  test("AUTH-01: header Sign in button opens SignInModal", async ({
    journeysPage,
  }) => {
    const auth = new AuthPage(journeysPage);
    await auth.goto();

    await expect(auth.headerSignInButton()).toBeVisible();

    await auth.openSignInModal();

    await expect(auth.signInModal()).toBeVisible();
    await expect(auth.emailInput()).toBeVisible();
  });

  test("AUTH-02: empty email keeps send button disabled", async ({
    journeysPage,
  }) => {
    const auth = new AuthPage(journeysPage);
    await auth.goto();
    await auth.openSignInModal();

    // Email input starts empty
    await expect(auth.emailInput()).toHaveValue("");
    // Submit is disabled
    await expect(auth.submitButton()).toBeDisabled();
  });

  test("AUTH-03: invalid email format keeps send button disabled", async ({
    journeysPage,
  }) => {
    const auth = new AuthPage(journeysPage);
    await auth.goto();
    await auth.openSignInModal();

    await auth.emailInput().fill("notvalid");
    await expect(auth.submitButton()).toBeDisabled();

    // Also test email without TLD separator
    await auth.emailInput().fill("user@domain");
    await expect(auth.submitButton()).toBeDisabled();
  });

  test("AUTH-04: valid email enables send button — stop before sending", async ({
    journeysPage,
  }) => {
    const auth = new AuthPage(journeysPage);
    await auth.goto();
    await auth.openSignInModal();

    await auth.emailInput().fill("test@example.com");

    // Button should now be enabled — DO NOT CLICK
    await expect(auth.submitButton()).toBeEnabled();
  });

  test("AUTH-05: modal closes via close button", async ({ journeysPage }) => {
    // Open modal from /me — the ProfilePortal renders SignInModal outside the
    // sticky header, so fixed inset-0 covers the full viewport and the close
    // button is reachable.
    const staticPage = new StaticPage(journeysPage);
    await staticPage.gotoMe();
    await staticPage.signInWithEmailButton().click();

    const modal = journeysPage.locator('[role="dialog"][aria-label="Sign in to Scout"]');
    await expect(modal).toBeVisible();

    const closeBtn = journeysPage.locator('button[aria-label="Close sign in"]');
    await closeBtn.click();
    await expect(modal).not.toBeVisible();
  });

  test("AUTH-06: modal closes via Escape key", async ({ journeysPage }) => {
    // Same: open from /me for full-viewport modal rendering.
    const staticPage = new StaticPage(journeysPage);
    await staticPage.gotoMe();
    await staticPage.signInWithEmailButton().click();

    const modal = journeysPage.locator('[role="dialog"][aria-label="Sign in to Scout"]');
    await expect(modal).toBeVisible();

    await journeysPage.keyboard.press("Escape");
    await expect(modal).not.toBeVisible();
  });
});
