/**
 * Static pages and content routes — STAT-01 through STAT-08
 *
 * Covers: /blog list (≥3 cards), /blog/[slug] h1, /about, /privacy, /terms,
 *         /robots.txt (200 + Sitemap:), /llms.txt (200), /sitemap.xml (200 + urlset).
 *
 * Traps heeded:
 * - No .textContent() on possibly-absent elements — use toContainText / toBeVisible.
 * - No waitForTimeout.
 * - No multi-Page fixtures.
 */
import { test, expect } from "../../fixtures/journeys";
import { StaticPage } from "../../pages/StaticPage";

test.describe("Static pages", () => {
  test("STAT-01: /blog lists at least 3 post cards", async ({
    journeysPage,
  }) => {
    const staticPage = new StaticPage(journeysPage);
    await staticPage.gotoBlog();

    await expect(staticPage.h1()).toBeVisible();
    // h1: "Guides from the gym map."
    await expect(staticPage.h1()).toContainText("Guides");

    // ≥ 3 post card links (actual count is 10 in production data)
    const count = await staticPage.blogPostCards().count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test("STAT-02: /blog/[slug] renders article h1", async ({
    journeysPage,
  }) => {
    const staticPage = new StaticPage(journeysPage);
    await staticPage.gotoBlogSlug("why-gym-fit-matters");

    const h1 = staticPage.h1();
    await expect(h1).toBeVisible();
    const text = await h1.textContent();
    expect(text?.trim().length).toBeGreaterThan(5);
  });

  test("STAT-03: /about renders h1", async ({ journeysPage }) => {
    const staticPage = new StaticPage(journeysPage);
    await staticPage.gotoAbout();

    await expect(staticPage.h1()).toContainText("Every fact");
  });

  test("STAT-04: /privacy renders h1", async ({ journeysPage }) => {
    const staticPage = new StaticPage(journeysPage);
    await staticPage.gotoPrivacy();

    const h1 = staticPage.h1();
    await expect(h1).toBeVisible();
    const text = await h1.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  });

  test("STAT-05: /terms renders h1", async ({ journeysPage }) => {
    const staticPage = new StaticPage(journeysPage);
    await staticPage.gotoTerms();

    const h1 = staticPage.h1();
    await expect(h1).toBeVisible();
    const text = await h1.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  });

  test("STAT-06: /robots.txt returns 200 and contains Sitemap:", async ({
    journeysPage,
  }) => {
    const response = await journeysPage.goto("/robots.txt");
    expect(response?.status()).toBe(200);

    const body = await journeysPage.content();
    expect(body).toContain("Sitemap:");
    expect(body).toContain("Allow:");
  });

  test("STAT-07: /llms.txt returns 200", async ({ journeysPage }) => {
    const response = await journeysPage.goto("/llms.txt");
    expect(response?.status()).toBe(200);

    // Body should be non-empty
    const body = await journeysPage.content();
    expect(body.length).toBeGreaterThan(10);
  });

  test("STAT-08: /sitemap.xml returns 200 with <urlset", async ({
    journeysPage,
  }) => {
    const response = await journeysPage.goto("/sitemap.xml");
    expect(response?.status()).toBe(200);

    const body = await journeysPage.content();
    expect(body).toContain("urlset");
  });
});
