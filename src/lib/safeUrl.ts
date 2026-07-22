/**
 * Safe http(s) URL gate for href / sameAs / loader writes.
 * Never returns javascript:, data:, protocol-relative, or bare junk.
 * Bare domains (no scheme) get an https:// prefix — same convention as
 * scripts/fetch-pages.mjs and scripts/land.mjs write path.
 */
export function safeHttpUrl(u: string | null | undefined): string | null {
  if (u == null) return null;
  const raw = String(u).trim();
  if (!raw) return null;

  // Protocol-relative URLs are ambiguous and easy to weaponize — reject.
  if (raw.startsWith("//")) return null;

  let candidate = raw;
  // Bare domain / path without scheme → assume https (write-path convention).
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  // Require a real host (blocks "https://" alone and some odd parses).
  if (!parsed.hostname) return null;
  return parsed.href;
}
