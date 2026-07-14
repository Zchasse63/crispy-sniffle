/**
 * Canonical contact channel for Scout. One source of truth — never hardcode
 * a mailto elsewhere; import CONTACT_EMAIL / mailtoHref instead.
 */
export const CONTACT_EMAIL = "zchasse89@gmail.com";

/** Builds a `mailto:` href for CONTACT_EMAIL, optionally pre-filling subject and body. */
export function mailtoHref(subject?: string, body?: string): string {
  const params = [
    subject ? `subject=${encodeURIComponent(subject)}` : null,
    body ? `body=${encodeURIComponent(body)}` : null,
  ].filter(Boolean);
  return params.length
    ? `mailto:${CONTACT_EMAIL}?${params.join("&")}`
    : `mailto:${CONTACT_EMAIL}`;
}
