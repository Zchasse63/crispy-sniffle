import "server-only";
import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";

/** Origins permitted to call the public owner-mutation endpoints. */
function allowedOrigins(): string[] {
  const out = new Set<string>();
  for (const v of [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.URL, // Netlify primary URL
    process.env.DEPLOY_PRIME_URL, // Netlify branch/deploy preview URL
  ]) {
    if (v) out.add(v.replace(/\/+$/, ""));
  }
  if (process.env.NODE_ENV !== "production") {
    out.add("http://localhost:3000");
    out.add("http://localhost:3100");
  }
  return [...out];
}

/**
 * True when the request's Origin (or Referer) is same-site, or when neither
 * header is present. A present Origin that doesn't match our site is rejected —
 * this blocks cross-site browser POSTs. It is NOT a hard boundary (a raw client
 * can spoof the header); the single-use invite token is the real gate. If the
 * allow-list is empty (env misconfigured) we fail open rather than lock owners
 * out of a legitimately-configured deploy.
 */
export function originAllowed(req: NextRequest): boolean {
  const allow = allowedOrigins();
  if (allow.length === 0) return true;
  const origin = req.headers.get("origin");
  if (origin) return allow.includes(origin.replace(/\/+$/, ""));
  const referer = req.headers.get("referer");
  if (referer) return allow.some((o) => referer.startsWith(o));
  return true;
}

/** Best-effort client IP. Netlify sets x-nf-client-connection-ip. */
export function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-nf-client-connection-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

/** sha256 of an IP — we store/compare hashes, never the raw address. */
export function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

// Best-effort in-memory burst limiter (per warm serverless instance). Durable
// per-IP caps live in the DB; this just blunts tight floods on a single instance.
const hits = new Map<string, { n: number; t: number }>();
export function burstLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || now - h.t > windowMs) {
    hits.set(key, { n: 1, t: now });
    return false;
  }
  h.n++;
  return h.n > limit;
}
