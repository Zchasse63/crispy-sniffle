import type { Locator, Page } from "@playwright/test";

/**
 * Page Object Model for static / content pages.
 * Covers: /blog, /blog/[slug], /about, /privacy, /terms,
 *         /robots.txt, /llms.txt, /sitemap.xml
 *
 * Selectors verified against live DOM: specs/features/journeys-chrome-analysis.md
 */
export class StaticPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  async gotoBlog(): Promise<void> {
    await this.page.goto("/blog");
    await this.page.locator("h1").waitFor({ state: "visible" });
  }

  async gotoBlogSlug(slug: string): Promise<void> {
    await this.page.goto(`/blog/${slug}`);
    await this.page.locator("h1").waitFor({ state: "visible" });
  }

  async gotoAbout(): Promise<void> {
    await this.page.goto("/about");
    await this.page.locator("h1").waitFor({ state: "visible" });
  }

  async gotoPrivacy(): Promise<void> {
    await this.page.goto("/privacy");
    await this.page.locator("h1").waitFor({ state: "visible" });
  }

  async gotoTerms(): Promise<void> {
    await this.page.goto("/terms");
    await this.page.locator("h1").waitFor({ state: "visible" });
  }

  // ── Common elements ───────────────────────────────────────────────────────

  h1(): Locator {
    return this.page.locator("h1").first();
  }

  // ── Blog list ─────────────────────────────────────────────────────────────

  /**
   * Blog post card links.
   * DOM: ul > li > a
   * Confirmed count: 10 (POSTS array in src/lib/blog.ts).
   */
  blogPostCards(): Locator {
    return this.page.locator("ul li a");
  }

  // ── /me signed-out ────────────────────────────────────────────────────────

  async gotoMe(): Promise<void> {
    await this.page.goto("/me");
    await this.page.locator("h1").waitFor({ state: "visible", timeout: 15_000 });
  }

  /** "Sign in" button on the /me signed-out pitch (multi-auth modal trigger).
   *  Scoped to the ProfilePortal's unique centered container — the header's
   *  own Sign in button and nested flex-1 layout wrappers stay out of scope. */
  signInWithEmailButton(): Locator {
    return this.page
      .locator("div.text-center")
      .getByRole("button", { name: "Sign in", exact: true });
  }

  /** Skeleton elements — should not persist after hydration. */
  skeletonElements(): Locator {
    return this.page.locator(".skeleton");
  }
}
