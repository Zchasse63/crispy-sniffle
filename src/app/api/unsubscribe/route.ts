import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/admin/service";

/**
 * PUBLIC, token-gated unsubscribe.
 *
 * GET renders a minimal confirmation page with a POST button (same token) —
 * never mutates. Email-client link prefetchers must not unsubscribe people.
 *
 * POST performs the unsubscribe. Like owner_invites' single-use token, the
 * 128-bit `unsubscribe_token` itself is the real gate — there's no separate
 * auth to check.
 *
 * This route must NEVER expose whether a given email is subscribed — every
 * outcome (missing token, unknown token, already-unsubscribed, freshly
 * unsubscribed) lands on the same confirmation page, varying only the
 * `ok` flag. No email address ever appears in the response or a redirect URL.
 */

function confirmHtml(origin: string, token: string): string {
  // Minimal plain HTML — no app chrome, no email leakage. Token is re-posted
  // (never reflected into JS beyond the form action) so prefetchers can't
  // trigger the side-effect.
  const action = `${origin}/api/unsubscribe`;
  const safeToken = token
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>Unsubscribe — Scout</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 28rem;
      margin: 4rem auto; padding: 0 1.25rem; color: #1a1a1a; line-height: 1.5; }
    h1 { font-size: 1.35rem; font-weight: 600; margin: 0 0 0.75rem; }
    p { margin: 0 0 1.25rem; color: #444; font-size: 0.95rem; }
    button { background: #1a1a1a; color: #fff; border: 0; border-radius: 0.4rem;
      padding: 0.65rem 1.1rem; font-size: 0.9rem; cursor: pointer; }
    button:hover { background: #333; }
    a { color: #0b6e6e; }
  </style>
</head>
<body>
  <h1>Unsubscribe from Scout emails?</h1>
  <p>Click the button below to stop gym alerts. This only runs when you confirm — opening this page does nothing.</p>
  <form method="POST" action="${action}">
    <input type="hidden" name="token" value="${safeToken}" />
    <button type="submit">Yes, unsubscribe me</button>
  </form>
  <p style="margin-top:1.5rem;font-size:0.85rem;color:#666;">
    Changed your mind? <a href="${origin}/">Back to Scout</a>
  </p>
</body>
</html>`;
}

export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url);
  const token = searchParams.get("token")?.trim();
  if (!token) {
    return NextResponse.redirect(`${origin}/unsubscribe?ok=0`);
  }

  // GET is confirmation-only — no DB write. Prefetchers land here safely.
  return new NextResponse(confirmHtml(origin, token), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: Request) {
  const { origin } = new URL(request.url);

  // Accept application/x-www-form-urlencoded (HTML form) or JSON.
  let token: string | null = null;
  const ctype = request.headers.get("content-type") ?? "";
  if (ctype.includes("application/json")) {
    try {
      const body = (await request.json()) as { token?: unknown };
      token = typeof body.token === "string" ? body.token.trim() : null;
    } catch {
      token = null;
    }
  } else {
    try {
      const form = await request.formData();
      const raw = form.get("token");
      token = typeof raw === "string" ? raw.trim() : null;
    } catch {
      token = null;
    }
  }

  if (!token) {
    return NextResponse.redirect(`${origin}/unsubscribe?ok=0`, 303);
  }

  const service = getServiceClient();
  const { data: subscriber } = await service
    .from("email_subscribers")
    .select("id, unsubscribed_at")
    .eq("unsubscribe_token", token)
    .maybeSingle();

  if (!subscriber) {
    return NextResponse.redirect(`${origin}/unsubscribe?ok=0`, 303);
  }

  // Idempotent — a second submit on the same token is a no-op, not an error.
  if (!subscriber.unsubscribed_at) {
    await service
      .from("email_subscribers")
      .update({ unsubscribed_at: new Date().toISOString() })
      .eq("id", subscriber.id);
  }

  return NextResponse.redirect(`${origin}/unsubscribe?ok=1`, 303);
}
