import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Refresh the Supabase session cookie on every request (required for
 *  magic-link auth to persist). No route guards in beta — /me handles its
 *  own signed-out state. (This Next.js: middleware→proxy rename AND root-level placement required — src/proxy.ts never registers in the production manifest; verified by build.) */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value }) => request.cookies.set(name, value));
          // re-create the response AFTER mutating request cookies — omitting
          // this drops the Set-Cookie headers (supabase/ssr contract)
          response = NextResponse.next({ request });
          cookies.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

// registered via default export — the named-`proxy` form left the
// build's middleware manifest empty (verified); default works for both.
export default proxy;
