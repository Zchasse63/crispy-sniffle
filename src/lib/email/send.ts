import "server-only";
import { getServiceClient } from "@/lib/admin/service";

/**
 * Config-driven transactional email via Resend.
 *
 * The from-address and a test recipient live in app_config so the operator can
 * flip from test mode to a verified domain in /admin/flags with NO code change:
 *   - email.from           default "Scout <onboarding@resend.dev>"
 *   - email.test_recipient falls back to the EMAIL_TEST_RECIPIENT env var
 *
 * While `from` is the resend.dev test sender, Resend can only deliver to the
 * account owner — so we redirect every send to email.test_recipient and tag the
 * subject "[TEST → original@recipient]". Verify a domain + set email.from to
 * "Scout <invites@yourdomain>" and real sends start flowing. No PII recipient is
 * hardcoded: in test mode with no configured recipient, sends fail closed.
 */
const DEFAULT_FROM = "Scout <onboarding@resend.dev>";
const DEFAULT_TEST_RECIPIENT = process.env.EMAIL_TEST_RECIPIENT ?? "";

export interface SendResult {
  ok: boolean;
  id?: string;
  error?: string;
  /** true when the send was redirected to the test recipient (test mode) */
  redirected?: boolean;
  to?: string;
}

async function readEmailConfig(): Promise<{ from: string; testRecipient: string }> {
  let from = DEFAULT_FROM;
  let testRecipient = DEFAULT_TEST_RECIPIENT;
  try {
    const service = getServiceClient();
    const { data } = await service
      .from("app_config")
      .select("key, value")
      .in("key", ["email.from", "email.test_recipient"]);
    for (const row of data ?? []) {
      if (row.key === "email.from" && typeof row.value === "string" && row.value.trim()) from = row.value;
      if (row.key === "email.test_recipient" && typeof row.value === "string" && row.value.trim())
        testRecipient = row.value;
    }
  } catch {
    /* fall back to defaults */
  }
  return { from, testRecipient };
}

export async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY not configured" };

  const { from, testRecipient } = await readEmailConfig();
  const testMode = from.includes("resend.dev");
  if (testMode && !testRecipient) {
    return {
      ok: false,
      error: "Test mode but no test recipient configured (app_config email.test_recipient / EMAIL_TEST_RECIPIENT)",
    };
  }
  const to = testMode ? testRecipient : opts.to;
  const subject = testMode ? `[TEST → ${opts.to}] ${opts.subject}` : opts.subject;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html: opts.html }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: json?.message ?? `Resend ${res.status}`, redirected: testMode, to };
    }
    return { ok: true, id: json?.id, redirected: testMode, to };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/* ── Templates ──────────────────────────────────────────────────────── */

const SHELL = (body: string) => `
<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
  <div style="font-weight:800;font-size:20px;letter-spacing:.04em;padding:8px 0">SCOUT</div>
  ${body}
  <p style="color:#8a8a8a;font-size:12px;margin-top:28px">Scout — find your fit. If you didn't expect this, ignore it.</p>
</div>`;

export function inviteEmailHtml(gymName: string, link: string): string {
  const safeLink = escapeHtml(link);
  return SHELL(`
    <p style="font-size:15px">Hi — we built a Scout listing for <strong>${escapeHtml(gymName)}</strong> and pre-filled it from public info.</p>
    <p style="font-size:15px">Take two minutes to confirm or correct it (and add photos). Once you submit, we review and publish it at the owner-verified tier.</p>
    <p style="margin:24px 0">
      <a href="${safeLink}" style="background:#1a1a1a;color:#fff;padding:11px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">Confirm your gym</a>
    </p>
    <p style="color:#8a8a8a;font-size:12px">Or paste this link: ${safeLink}</p>`);
}

export function submissionConfirmHtml(gymName: string): string {
  return SHELL(`
    <p style="font-size:15px">Thanks — we received your confirmation for <strong>${escapeHtml(gymName)}</strong>.</p>
    <p style="font-size:15px">A quick human review comes next, then your details publish at the owner-verified tier.</p>`);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
