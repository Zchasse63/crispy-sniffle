import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/types/database";

/**
 * Server-side Supabase client (anon role; beta has no auth).
 * Used by Server Components for initial data fetch / SEO.
 */
export async function getServerClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        // Beta: no auth, nothing to set; no-op keeps Next happy in RSC context.
        setAll: () => {},
      },
    },
  );
}
