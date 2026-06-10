/**
 * /me signed-out tests — ME-01 through ME-03
 *
 * Covers: sign-in pitch renders (h1, "Sign in with email" button),
 *         no crash, no skeleton-forever, CircleUserRound icon present.
 *
 * The /me page is an async RSC (getServerClient auth check) + client
 * ProfilePortal component. The serverUser will be null when not authenticated.
 *
 * Traps heeded:
 * - No .textContent() on possibly-absent elements.
 * - No waitForTimeout — use explicit waits with toBeVisible/toBeHidden.
 * - No multi-Page fixtures.
 */
import { test, expect } from "../../fixtures/journeys";
import { StaticPage } from "../../pages/StaticPage";

test.describe("/me signed-out", () => {
  test("ME-01: renders sign-in pitch — h1 and Sign in with email button", async ({
    journeysPage,
  }) => {
    const staticPage = new StaticPage(journeysPage);
    await staticPage.gotoMe();

    await expect(staticPage.h1()).toContainText("Your Scout");
    await expect(staticPage.signInWithEmailButton()).toBeVisible();
  });

  test("ME-02: no crash and no skeleton-forever after full hydration", async ({
    journeysPage,
  }) => {
    const staticPage = new StaticPage(journeysPage);
    await journeysPage.goto("/me");

    // Wait for RSC + client hydration to finish (h1 visible means ProfilePortal rendered)
    await expect(staticPage.h1()).toBeVisible({ timeout: 15_000 });

    // No skeleton elements visible — they should have resolved
    await expect(staticPage.skeletonElements()).toHaveCount(0);

    // No error boundary content
    await expect(journeysPage.locator("text=Something went wrong")).not.toBeVisible();
  });

  test("ME-03: CircleUserRound icon area is rendered", async ({
    journeysPage,
  }) => {
    const staticPage = new StaticPage(journeysPage);
    await staticPage.gotoMe();

    // The CircleUserRound SVG is rendered with aria-hidden above the h1
    // ProfilePortal signed-out: <CircleUserRound className="mx-auto h-10 w-10 text-pool" aria-hidden />
    const icon = journeysPage.locator(
      ".mx-auto.h-10.w-10.text-pool[aria-hidden]",
    );
    await expect(icon).toBeVisible();
  });
});
