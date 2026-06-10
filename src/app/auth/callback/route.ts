import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";

/** Magic-link landing: exchange the one-time code for a session cookie. */
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
  return NextResponse.redirect(`${origin}/me`);
}
