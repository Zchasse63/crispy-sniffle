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
  // open-redirect guard: resolve against our origin and require it to stay
  // there — startsWith("/") checks miss browser normalization tricks like
  // "/\\evil.com" (backslash → "//evil.com")
  const next = searchParams.get("next");
  let dest = "/me";
  if (next) {
    try {
      const resolved = new URL(next, origin);
      if (resolved.origin === origin) dest = resolved.pathname + resolved.search;
    } catch {
      // malformed → default
    }
  }
  return NextResponse.redirect(`${origin}${dest}`);
}
