import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";

/** Magic-link landing: exchange the one-time code for a session cookie. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  if (code) {
    const client = await getServerClient();
    await client.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(`${origin}/me`);
}
