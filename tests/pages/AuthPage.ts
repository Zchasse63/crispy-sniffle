import type { Locator, Page } from "@playwright/test";

/**
 * Page Object Model for Auth chrome (SiteHeader + SignInModal).
 *
 * Selectors verified against live DOM: specs/features/journeys-chrome-analysis.md
 *
 * CRITICAL: Do NOT click the enabled submit button in SignInModal.
 * Clicking it fires Supabase auth.signInWithOtp() which sends a real email.
 * Tests must stop at asserting the button is enabled (not disabled).
 */
export class AuthPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(): Promise<void> {
    await this.page.goto("/");
    // Wait for header to mount
    await this.page.locator("header").waitFor({ state: "visible" });
  }

  // ── SiteHeader auth button ────────────────────────────────────────────────

  /**
   * "Sign in" button in the header (signed-out state).
   * Rendered by AuthButton when user === null and isLoading === false.
   */
  headerSignInButton(): Locator {
    return this.page.locator("header button").filter({ hasText: "Sign in" });
  }

  /** Open SignInModal by clicking the header Sign in button. */
  async openSignInModal(): Promise<void> {
    await this.headerSignInButton().click();
    await this.signInModal().waitFor({ state: "visible" });
  }

  // ── SignInModal ───────────────────────────────────────────────────────────

  /** The SignInModal dialog. */
  signInModal(): Locator {
    return this.page.locator('[role="dialog"][aria-label="Sign in to Scout"]');
  }

  /**
   * Email input inside SignInModal.
   * aria-label="Email address"
   */
  emailInput(): Locator {
    return this.signInModal().locator('input[type="email"]');
  }

  /**
   * "Send sign-in link" submit button.
   * disabled when: busy OR email doesn't match /^\S+@\S+\.\S+$/
   */
  submitButton(): Locator {
    return this.signInModal().locator('button[type="submit"]');
  }

  /**
   * Close button (X icon) in modal header.
   * aria-label="Close sign in"
   */
  closeButton(): Locator {
    return this.page.locator('button[aria-label="Close sign in"]');
  }
}
