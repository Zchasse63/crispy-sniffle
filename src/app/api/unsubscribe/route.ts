import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/admin/service";

/**
 * PUBLIC, token-gated one-click unsubscribe. Like owner_invites' single-use
 * token, the 128-bit `unsubscribe_token` itself is the real gate — there's no
 * separate auth to check, so (unlike POST /api/owner/submit) no origin/burst
 * guards are layered on: this is a GET clicked from an email client (Origin
 * checks don't apply the same way there), and the operation is idempotent
 * and harmless even against a guessed token, which is computationally
 * infeasible anyway.
 *
 * This route must NEVER expose whether a given email is subscribed — every
 * outcome (missing token, unknown token, already-unsubscribed, freshly
 * unsubscribed) redirects to the same confirmation page, varying only the
 * `ok` flag. No email address ever appears in the response or a redirect URL.
 */
export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url);
  const token = searchParams.get("token")?.trim();
  if (!token) {
    return NextResponse.redirect(`${origin}/unsubscribe?ok=0`);
  }

  const service = getServiceClient();
  const { data: subscriber } = await service
    .from("email_subscribers")
    .select("id, unsubscribed_at")
    .eq("unsubscribe_token", token)
    .maybeSingle();

  if (!subscriber) {
    return NextResponse.redirect(`${origin}/unsubscribe?ok=0`);
  }

  // Idempotent — a second click (or an email client's link-prefetcher) on
  // the same link is a no-op, not an error.
  if (!subscriber.unsubscribed_at) {
    await service
      .from("email_subscribers")
      .update({ unsubscribed_at: new Date().toISOString() })
      .eq("id", subscriber.id);
  }

  return NextResponse.redirect(`${origin}/unsubscribe?ok=1`);
}
