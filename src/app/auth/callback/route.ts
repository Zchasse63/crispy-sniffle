import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";

/** Auth landing (magic link, OAuth, password recovery): exchange the
 *  one-time code for a session cookie, then continue to `next`. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  if (code) {
    const client = await getServerClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (error) {
      // degrade-don't-break: /me shows signed-out state; keep a trace
      console.error("[auth/callback] code exchange failed:", error.message);
    }
  }
  // open-redirect guard: same-origin paths only
  const next = searchParams.get("next");
  const dest = next && next.startsWith("/") && !next.startsWith("//") ? next : "/me";
  return NextResponse.redirect(`${origin}${dest}`);
}
