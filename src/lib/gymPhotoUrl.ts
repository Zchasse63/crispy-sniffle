/**
 * Resolve a gym photo's served URL.
 *
 * If we've rehosted the image into our own Supabase Storage (`storagePath` set),
 * serve it through the on-the-fly image-transform endpoint — resized + format-
 * negotiated (WebP/AVIF via Accept) + CDN-cached with a real max-age. That turns
 * multi-MB scraped originals into ~100-200KB deliveries and eliminates source rot
 * / hotlink blocks. Otherwise fall back to the original source URL.
 *
 * This is the SINGLE swap point for the storage backend AND delivery strategy:
 * moving to Cloudflare R2 / Images, or changing sizes/quality, is a change here
 * only — callers just read `.url` (optionally passing a per-surface `width`).
 *
 * Pure/isomorphic (only NEXT_PUBLIC_ env) — safe in client and server code.
 */
const SUPA_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const BUCKET = "gym-photos";
const DEFAULT_WIDTH = 1280; // good for hero/detail; cards/rail may pass smaller
const DEFAULT_QUALITY = 75;

export function gymPhotoUrl(
  storagePath: string | null | undefined,
  fallback: string | null,
  opts?: { width?: number; quality?: number },
): string | null {
  if (storagePath && SUPA_URL) {
    const width = opts?.width ?? DEFAULT_WIDTH;
    const quality = opts?.quality ?? DEFAULT_QUALITY;
    // encodeURI (not encodeURIComponent) — keep the `/` path separators.
    const path = encodeURI(storagePath);
    return `${SUPA_URL}/storage/v1/render/image/public/${BUCKET}/${path}?width=${width}&quality=${quality}`;
  }
  return fallback ?? null;
}
