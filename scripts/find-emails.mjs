// Outreach email discovery for non-landed REAL-GYM prospects (metro expansion).
// For each 'no-live-content' or 'thin-extraction' reject, hunt a contact email:
//   1. already-cached pages (facility-cache)  2. fresh fetch of homepage + contact/
//   about/membership pages (Jina -> plain)  3. mailto: links.
// Email found  -> status='outreach', email set (queued for a "claim your listing" invite).
// None found   -> status='rejected', reject_reason='no-contact' (no way to reach them).
// Data is retained either way (reversible); nothing is hard-deleted.
//
//   node scripts/find-emails.mjs --metro=tampa --limit=800 --dry
//   node scripts/find-emails.mjs --metro=tampa --limit=800
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = { ...process.env };
try {
  for (const line of readFileSync(join(root, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch { /* env */ }
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const metro = (process.argv.find((a) => a.startsWith("--metro=")) || "--metro=tampa").split("=")[1];
const limit = Number((process.argv.find((a) => a.startsWith("--limit=")) || "--limit=800").split("=")[1]);
const DRY = process.argv.includes("--dry");
const CACHE = "facility-cache";
const SUBPATHS = ["", "/contact", "/contact-us", "/about", "/membership", "/memberships"];

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const BAD_DOMAIN = /\.(png|jpe?g|gif|webp|svg|css|js|woff2?|ttf)$/i;
const BAD_SUBSTR = /(sentry|wixpress|example\.|godaddy|cloudflare|schema\.org|w3\.org|@2x|@3x|\.wix\.|placeholder|yourdomain|domain\.com|email\.com|sentry\.io)/i;
// Vendor/CMS/analytics emails that are never the gym's own contact.
const VENDOR = /@(revize|nmt2|duda(mobile)?|squarespace|wix|weebly|godaddy|shopify|hubspot|mailchimp|constantcontact|sentry|wordpress|gravatar)\./i;
const NOREPLY = /^(no-?reply|do-?not-?reply|donotreply|postmaster|mailer-daemon|bounce|abuse|webmaster|hostmaster)/i;
const FREE = /@(gmail|yahoo|hotmail|outlook|icloud|aol|proton(mail)?|live|msn|comcast|att|verizon|bellsouth)\./i;
const looksReal = (e) => e && !BAD_DOMAIN.test(e) && !BAD_SUBSTR.test(e) && !VENDOR.test(e) && e.length < 60 && (e.match(/@/g) || []).length === 1;
const reg = (h) => (h || "").toLowerCase().replace(/^www\./, "").split(".").slice(-2).join("."); // registrable-ish domain

function pickEmail(cands, siteHost) {
  const host = reg(siteHost);
  const seen = new Set();
  const valid = [];
  for (const raw of cands) {
    const e = raw.toLowerCase().replace(/[.,;:)]+$/, "");
    if (!looksReal(e) || seen.has(e)) continue;
    seen.add(e);
    if (NOREPLY.test(e.split("@")[0])) continue;
    const dom = e.split("@")[1] || "";
    const domainMatch = host && reg(dom) === host;
    const free = FREE.test(e);
    if (!domainMatch && !free) continue; // vendor / unrelated third-party domain — not the gym's email
    valid.push({ e, domainMatch, free });
  }
  if (!valid.length) return null;
  // Prefer the gym's own domain, then a role inbox, then a free-provider address.
  return (
    valid.find((v) => v.domainMatch)?.e ||
    valid.find((v) => /^(info|contact|hello|hi|admin|frontdesk|membership|team|owner|manager|studio)@/.test(v.e))?.e ||
    valid[0].e
  );
}

async function fetchText(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  try {
    const jina = await fetch(`https://r.jina.ai/${url}`, { signal: ctrl.signal, headers: { "x-return-format": "markdown" } });
    if (jina.ok) { const md = await jina.text(); if (md && md.length > 120) return md; }
    const raw = await fetch(url, { signal: ctrl.signal, headers: { "user-agent": "Mozilla/5.0 ScoutBot (+https://scout-gym.netlify.app)" } });
    if (!raw.ok) return "";
    return await raw.text();
  } catch { return ""; } finally { clearTimeout(t); }
}

async function discover(c) {
  const emails = [];
  let source = null;
  // 1. cached pages (already fetched during the pipeline) — cheap, no network.
  try {
    const { data: files } = await db.storage.from(CACHE).list(c.overture_id, { limit: 8 });
    for (const f of files ?? []) {
      const { data: blob } = await db.storage.from(CACHE).download(`${c.overture_id}/${f.name}`);
      if (blob) { const txt = await blob.text(); for (const m of txt.matchAll(EMAIL_RE)) emails.push(m[0]); }
    }
    if (emails.length) source = "cached";
  } catch { /* no cache */ }
  // 2. fresh fetch of key pages if cache yielded nothing.
  if (!emails.length && c.website) {
    const base = (c.website.startsWith("http") ? c.website : `https://${c.website}`).replace(/\/$/, "");
    for (const p of SUBPATHS) {
      const txt = await fetchText(base + p);
      if (!txt) continue;
      for (const m of txt.matchAll(EMAIL_RE)) emails.push(m[0]);
      // mailto: links in raw HTML
      for (const m of txt.matchAll(/mailto:([^"'?>\s]+)/gi)) emails.push(m[1]);
      if (emails.length) { source = p === "" ? "homepage" : "contact-page"; break; }
    }
  }
  let siteHost = "";
  try { siteHost = c.website ? new URL(c.website.startsWith("http") ? c.website : `https://${c.website}`).host : ""; } catch { /* */ }
  const email = pickEmail(emails, siteHost);
  return { email, source: email ? source : null };
}

async function pool(items, n, fn) {
  let i = 0; const out = [];
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]); }
  }));
  return out;
}

// Clear non-fitness POIs that Overture mis-tagged — never email these.
const NON_GYM = /(alligator|attraction|ballroom|\bmuseum\b|\brestaurant\b|\bhotel\b|\bresort\b|brewery|\btheat(er|re)\b|nail salon|\bfuneral\b|\bchurch\b|car wash|\bdealership\b|\bwinery\b)/i;
const ELIGIBLE_REASONS = ["no-live-content", "thin-extraction", "no-contact"];

// Re-processable: include prior 'outreach'/'no-contact' rows so a re-run re-evaluates
// them with the current (stricter) email filter and self-heals a partial run.
const { data: raw } = await db
  .from("facility_candidates")
  .select("overture_id, name, website, phone, status, reject_reason")
  .eq("metro", metro).in("status", ["rejected", "outreach"])
  .order("confidence", { ascending: false }).limit(limit);
const touched = (raw || []).filter((c) => c.status === "outreach" || ELIGIBLE_REASONS.includes(c.reject_reason));
const nonGyms = touched.filter((c) => NON_GYM.test(c.name));
const prospects = touched.filter((c) => !NON_GYM.test(c.name));

if (!DRY && nonGyms.length) {
  for (const c of nonGyms) await db.from("facility_candidates").update({ status: "rejected", reject_reason: "not-a-gym", email: null, email_source: null }).eq("overture_id", c.overture_id);
}
console.log(`${DRY ? "[DRY] " : ""}Email discovery — ${prospects.length} ${metro} prospects (dead-site + thin); ${nonGyms.length} obvious non-gyms cut\n`);
let withEmail = 0, noContact = 0;

await pool(prospects, 5, async (c) => {
  const { email, source } = await discover(c);
  if (email) {
    withEmail++;
    console.log(`  MAIL ${email.padEnd(34)} [${source}] ${c.name.slice(0, 34)}`);
    if (!DRY) await db.from("facility_candidates").update({
      status: "outreach", reject_reason: null, email, email_source: source, updated_at: new Date().toISOString(),
    }).eq("overture_id", c.overture_id);
  } else {
    noContact++;
    if (!DRY) await db.from("facility_candidates").update({
      status: "rejected", reject_reason: "no-contact", email: null, email_source: null, updated_at: new Date().toISOString(),
    }).eq("overture_id", c.overture_id);
  }
});

console.log(`\n${DRY ? "[DRY] " : ""}Done. outreach(email found)=${withEmail}, no-contact=${noContact} of ${prospects.length}.`);
