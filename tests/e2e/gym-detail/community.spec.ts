/**
 * Community section tests — COM-01 through COM-06
 * COM-01: CommunitySection is inside the left grid column, not the aside.
 * COM-02: "Sign in to review" button visible signed-out; no review textarea.
 * COM-03: Outbound reddit links have target=_blank and rel containing "noopener".
 * COM-04: Powerhouse has at least one outbound reddit discussion link.
 * COM-05: "Verify your info" mailto link present on all gyms.
 * COM-06: Amped has no reddit links but community section still renders.
 *
 * Multi-gym tests navigate within the test body using a single fixture page
 * to avoid the shared-page fixture trap.
 */
import { test, expect } from "../../fixtures/gymDetail";
import { GymDetailPage } from "../../pages/GymDetailPage";

const ALL_SLUGS = [
  "powerhouse-gym-athletic-club",
  "kodawari-studios",
  "amped-fitness-carrollwood",
] as const;

test.describe("Community Section", () => {
  test("COM-01: CommunitySection is inside the left column, not the aside", async ({
    powerhousePage,
  }) => {
    for (const slug of ALL_SLUGS) {
      const gymPage = new GymDetailPage(powerhousePage.page, slug);
      await gymPage.goto();

      // The left column is the first direct child of the content grid
      const leftColumn = gymPage.leftColumn();
      // CommunitySection should be inside the left column
      const communityInLeft = leftColumn.locator("section").filter({
        has: gymPage.page.locator("h2").filter({ hasText: "From the community" }),
      });
      await expect(communityInLeft).toBeVisible();
    }
  });

  test("COM-02: 'Sign in to review' button visible signed-out; no review textarea", async ({
    powerhousePage,
  }) => {
    for (const slug of ALL_SLUGS) {
      const gymPage = new GymDetailPage(powerhousePage.page, slug);
      await gymPage.goto();
      await expect(gymPage.reviewSignInButton()).toBeVisible();

      // Review form textarea must NOT be present when signed out
      const textareas = await gymPage
        .communitySection()
        .locator("textarea")
        .count();
      expect(textareas).toBe(0);
    }
  });

  test("COM-03: powerhouse outbound links have target=_blank and rel containing noopener", async ({
    powerhousePage,
  }) => {
    const links = powerhousePage.discussionLinks();
    const linkCount = await links.count();
    expect(linkCount).toBeGreaterThan(0);

    for (let i = 0; i < linkCount; i++) {
      const link = links.nth(i);
      const target = await link.getAttribute("target");
      const rel = await link.getAttribute("rel");
      expect(target).toBe("_blank");
      expect(rel).toContain("noopener");
    }
  });

  test("COM-04: powerhouse has at least one outbound discussion link", async ({
    powerhousePage,
  }) => {
    const count = await powerhousePage.discussionLinks().count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("COM-05: 'Verify your info' mailto CTA present on all gyms", async ({
    powerhousePage,
  }) => {
    for (const slug of ALL_SLUGS) {
      const gymPage = new GymDetailPage(powerhousePage.page, slug);
      await gymPage.goto();
      const link = gymPage.verifyOwnLink();
      await expect(link).toBeVisible();
      const href = await link.getAttribute("href");
      expect(href).toMatch(/^mailto:/);
      expect(href).toMatch(/Verify/);
    }
  });

  test("COM-06: amped has no discussion links but community section still renders", async ({
    ampedPage,
  }) => {
    // No reddit community links for Amped
    const linkCount = await ampedPage.discussionLinks().count();
    expect(linkCount).toBe(0);

    // Section still renders with sign-in button
    await expect(ampedPage.communitySection()).toBeVisible();
    await expect(ampedPage.reviewSignInButton()).toBeVisible();
  });
});
