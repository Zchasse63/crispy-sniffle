/**
 * Owner self-serve submission — the partner-onboarding write path. OPT-IN: skips
 * unless SUPABASE_SERVICE_ROLE_KEY is set (it seeds + tears down a single-use
 * invite via the service role), so CI without creds never writes to prod.
 *
 * Seeds an active invite, drives the prefilled form to a submission, asserts it
 * lands as 'pending' with the invite consumed (single-use), then SELF-CLEANS in
 * afterAll regardless of pass/fail. The automated form of the manual owner-loop
 * verified repeatedly against the live DB.
 */
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GYM_SLUG = process.env.SCOUT_E2E_OWNER_GYM_SLUG ?? "813-barbell";

// Unique per run so a prior run's localStorage/server draft never interferes.
const RAW_TOKEN = `e2e-owner-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const TOKEN_HASH = createHash("sha256").update(RAW_TOKEN).digest("hex");

const admin = () => createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { persistSession: false } });

let inviteId: string | null = null;
let gymId: string | null = null;

test.describe("owner submission (opt-in)", () => {
  test.skip(!SUPABASE_URL || !SERVICE_KEY, "set SUPABASE_SERVICE_ROLE_KEY to run");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    const db = admin();
    const { data: gym } = await db.from("gyms").select("id").eq("slug", GYM_SLUG).maybeSingle();
    gymId = gym?.id ?? null;
    if (!gymId) return;
    const { data: invite } = await db
      .from("owner_invites")
      .insert({
        gym_id: gymId,
        token_hash: TOKEN_HASH,
        status: "active",
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      })
      .select("id")
      .single();
    inviteId = invite?.id ?? null;
  });

  test.afterAll(async () => {
    if (!SUPABASE_URL || !SERVICE_KEY || !inviteId) return;
    const db = admin();
    const { data: subs } = await db.from("owner_submissions").select("id").eq("invite_id", inviteId);
    for (const s of subs ?? []) {
      await db.from("owner_fact_log").delete().eq("submission_id", s.id);
      await db.from("owner_submissions").delete().eq("id", s.id);
    }
    await db.from("owner_drafts").delete().eq("invite_id", inviteId);
    await db.from("owner_invites").delete().eq("id", inviteId);
  });

  test("owner opens prefilled form → submits → lands pending, invite consumed", async ({ page }) => {
    test.skip(!gymId || !inviteId, "seed failed (gym or invite missing)");

    await page.goto(`/own/${RAW_TOKEN}`);
    // The form prefills from the gym — its name renders as the h1 once mounted.
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 15_000 });

    // Advance through the prefilled form, dismissing the milestone overlay, until
    // a submit happens (either the milestone's "I'm done" / "Finish", or the
    // review screen's Submit). Resilient to the short- vs full-path branch.
    // Arm a listener for the real submit POST before driving — the FinishCard
    // renders even if the POST errors, so the network result is the true signal.
    const submitResponse = page
      .waitForResponse(
        (r) => r.url().includes("/api/owner/submit") && r.request().method() === "POST",
        { timeout: 25_000 },
      )
      .catch(() => null);

    let submitted = false;
    for (let i = 0; i < 30 && !submitted; i++) {
      const dialog = page.getByRole("dialog");
      if (await dialog.isVisible().catch(() => false)) {
        const done = dialog.getByRole("button", { name: /i'm done for now|^finish$/i });
        if (await done.isVisible().catch(() => false)) {
          await done.click();
          submitted = true;
          break;
        }
        const cont = dialog.getByRole("button", { name: /continue to gym verified/i });
        if (await cont.isVisible().catch(() => false)) {
          await cont.click();
          continue;
        }
      }
      const reviewSubmit = page.getByRole("button", { name: /submit listing|submit — gym verified/i });
      if (await reviewSubmit.isVisible().catch(() => false)) {
        await reviewSubmit.click();
        submitted = true;
        break;
      }
      const advance = page.getByRole("button", { name: /^(continue|finish)$/i }).first();
      if (await advance.isVisible().catch(() => false)) {
        await advance.click();
      } else {
        break;
      }
    }
    expect(submitted, "reached a submit action").toBe(true);

    const resp = await submitResponse;
    expect(resp?.status(), "submit POST returned 200").toBe(200);

    // The submission persisted as 'pending' and the single-use invite is consumed.
    const db = admin();
    const { data: subs } = await db
      .from("owner_submissions")
      .select("id, status")
      .eq("invite_id", inviteId!);
    expect(subs && subs.length, "a submission row was created").toBeGreaterThan(0);
    expect(subs![0].status).toBe("pending");

    const { data: inv } = await db.from("owner_invites").select("status").eq("id", inviteId!).maybeSingle();
    expect(inv?.status).toBe("used");
  });
});
