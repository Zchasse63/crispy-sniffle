/**
 * True only for OUR Supabase owner-photos public storage URLs.
 *
 * The owner answer map is client-controlled JSON, and a photo entry's `url`
 * eventually renders as a raw <img src> on the public gym page + in the staff
 * queue. Without this check, a valid-invite holder could publish an arbitrary
 * off-domain URL (tracker beacon, SSRF-ish fetch target, etc.). Pure/isomorphic
 * — safe to import in both client and server code (no server-only deps).
 */
const SUPA_HOST = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
      : "";
  } catch {
    return "";
  }
})();

export function isOwnerPhotoUrl(url: unknown): url is string {
  if (typeof url !== "string" || !url) return false;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  if (!SUPA_HOST || u.host !== SUPA_HOST) return false;
  return u.pathname.startsWith("/storage/v1/object/public/owner-photos/");
}
