/**
 * Resolve a gym photo's served URL.
 *
 * If we've rehosted the image into our own Supabase Storage (`storagePath` set),
 * serve it from there — durable, our-origin/CDN, never hotlink-blocked or 404'd
 * by a gym reshuffling its site. Otherwise fall back to the original source URL.
 *
 * This is the SINGLE swap point for the storage backend and delivery strategy:
 * moving to Cloudflare R2 / Images (for egress savings at scale) or turning on
 * resized/WebP transforms is a change here only — callers just read `.url`.
 *
 * Pure/isomorphic (only NEXT_PUBLIC_ env) — safe in client and server code.
 */
const SUPA_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const BUCKET = "gym-photos";

export function gymPhotoUrl(
  storagePath: string | null | undefined,
  fallback: string | null,
): string | null {
  if (storagePath && SUPA_URL) {
    // encodeURI (not encodeURIComponent) — keep the `/` path separators.
    return `${SUPA_URL}/storage/v1/object/public/${BUCKET}/${encodeURI(storagePath)}`;
  }
  return fallback ?? null;
}
