/**
 * Signed-in moat loop — the community/auth write path that ships the dataset's
 * self-improvement mechanic. OPT-IN: skips unless SCOUT_E2E_EMAIL / _PASSWORD
 * are set (a seeded confirmed account), so normal CI never writes to prod.
 *
 * It signs in for real (password path), logs a visit, and posts a review,
 * asserting each persists in the UI — then SELF-CLEANS via the service role in
 * afterAll so production data and the target gym's denormalized rating are
 * restored regardless of pass/fail. This is the automated form of the manual
 * loop verified in specs/reports/auth-write-loop-runbook.md.
 */
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const EMAIL = process.env.SCOUT_E2E_EMAIL;
const PASSWORD = process.env.SCOUT_E2E_PASSWORD;
const GYM_SLUG = process.env.SCOUT_E2E_GYM_SLUG ?? "813-barbell";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

test.describe("signed-in moat loop (opt-in)", () => {
  test.skip(!EMAIL || !PASSWORD, "set SCOUT_E2E_EMAIL/_PASSWORD to run");
  test.describe.configure({ mode: "serial" });

  test.afterAll(async () => {
    // Restore prod truth: remove this account's rows + reset the gym rating
    // the review denormalized. Requires the service role (loaders' key).
    if (!SUPABASE_URL || !SERVICE_KEY || !EMAIL) return;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const { data: list } = await admin.auth.admin.listUsers();
    const uid = list?.users.find((u) => u.email === EMAIL)?.id;
    if (uid) {
      await admin.from("gym_reviews").delete().eq("user_id", uid);
      await admin.from("gym_visits").delete().eq("user_id", uid);
      await admin.from("fact_confirmations").delete().eq("user_id", uid);
    }
    await admin
      .from("gyms")
      .update({ rating: null, rating_count: 0, rating_is_seed: true })
      .eq("slug", GYM_SLUG);
  });

  test("sign in → log visit → post review, each persists", async ({ page }) => {
    // sign in via the real modal (password tab)
    await page.goto("/me");
    await page.getByRole("button", { name: "Sign in", exact: true }).first().click();
    await page.getByRole("tab", { name: /password/i }).click();
    await page.locator('[role="dialog"] input[type="email"]').fill(EMAIL!);
    await page.locator('[role="dialog"] input[type="password"]').fill(PASSWORD!);
    await page.locator('[role="dialog"] button[type="submit"]').click();
    await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible({ timeout: 15_000 });

    // log a visit
    await page.goto(`/gym/${GYM_SLUG}`);
    await page.getByRole("button", { name: /trained here|i trained/i }).click();
    await expect(page.getByText(/visit logged/i)).toBeVisible({ timeout: 10_000 });

    // post a review
    await page.getByRole("button", { name: "5 stars" }).click();
    await page.locator("textarea").first().fill("Automated signed-in moat-loop check — self-cleans in teardown.");
    await page.getByRole("button", { name: /post review/i }).click();
    await expect(page.getByText("Automated signed-in moat-loop check", { exact: false })).toBeVisible({ timeout: 10_000 });

    // the visit shows in the profile
    await page.goto("/me");
    await expect(page.getByText(GYM_SLUG === "813-barbell" ? "813 Barbell" : GYM_SLUG, { exact: false }).first()).toBeVisible({ timeout: 10_000 });
  });
});
