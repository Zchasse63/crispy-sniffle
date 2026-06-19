import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

/**
 * Service-role Supabase client — bypasses RLS. SERVER-ONLY: only import this
 * from Route Handlers / server actions that have already passed requireStaff().
 * Never import from a client component (the key would leak into the bundle).
 */
export function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service credentials are not configured");
  return createClient<Database>(url, key, { auth: { persistSession: false } });
}
