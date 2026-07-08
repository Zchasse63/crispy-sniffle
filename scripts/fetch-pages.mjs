// Metro-expansion Stage 2+3 — VALIDATE + FETCH. For each discovered candidate with
// a website, fetch the homepage + key sub-pages (tier A plain → tier B Jina), cache
// the markdown to the private facility-cache bucket (re-extraction never re-crawls),
// and collect facility photo URLs. Marks status 'fetched' or 'rejected'.
//
//   DUCKDB unused. node scripts/fetch-pages.mjs --metro=miami --limit=40
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

const metro = (process.argv.find((a) => a.startsWith("--metro=")) || "--metro=miami").split("=")[1];
const limit = Number((process.argv.find((a) => a.startsWith("--limit=")) || "--limit=40").split("=")[1]);
const CACHE = "facility-cache";
const SUBPATHS = ["", "/membership", "/memberships", "/pricing", "/amenities", "/about", "/classes", "/schedule"];

async function fetchMarkdown(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30000);
  try {
    const jina = await fetch(`https://r.jina.ai/${url}`, { signal: ctrl.signal, headers: { "x-return-format": "markdown" } });
    if (jina.ok) {
      const md = await jina.text();
      if (md && md.length > 250) return md;
    }
    const raw = await fetch(url, { signal: ctrl.signal, headers: { "user-agent": "Mozilla/5.0 ScoutBot (+https://scout-gym.netlify.app)" } });
    if (!raw.ok) return null;
    const html = await raw.text();
    const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i);
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return (og ? `![og](${og[1]})\n` : "") + text;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

const isPhoto = (u) =>
  /^https?:\/\//.test(u) && /\.(jpe?g|png|webp|avif)(\?|$)/i.test(u) && !/logo|icon|favicon|sprite|badge|avatar|placeholder/i.test(u);
function collectPhotos(markdown, base) {
  const urls = new Set();
  for (const m of markdown.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)) {
    let u = m[1];
    try { u = new URL(u, base).href; } catch { continue; }
    if (isPhoto(u)) urls.add(u);
  }
  return [...urls].slice(0, 8);
}

const slug = (p) => (p === "" ? "home" : p.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "home");

async function processOne(c) {
  const baseUrl = c.website.startsWith("http") ? c.website : `https://${c.website}`;
  const base = baseUrl.replace(/\/$/, "");
  const seen = new Set();
  const photos = new Set();
  let cachedPages = 0;
  for (const p of SUBPATHS) {
    if (cachedPages >= 5) break;
    const md = await fetchMarkdown(base + p);
    if (!md || md.length < 250) continue;
    const sig = md.slice(0, 150);
    if (seen.has(sig)) continue;
    seen.add(sig);
    const { error } = await db.storage.from(CACHE).upload(`${c.overture_id}/${slug(p)}.md`, md.slice(0, 40000), {
      contentType: "text/markdown", upsert: true,
    });
    if (!error) cachedPages++;
    for (const u of collectPhotos(md, base)) photos.add(u);
  }
  if (cachedPages === 0) {
    await db.from("facility_candidates").update({ status: "rejected", reject_reason: "no-live-content", website_live: false, updated_at: new Date().toISOString() }).eq("overture_id", c.overture_id);
    return { ok: false };
  }
  await db.from("facility_candidates").update({
    status: "fetched", website_live: true, photos: [...photos].slice(0, 8),
    fetched_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq("overture_id", c.overture_id);
  return { ok: true, pages: cachedPages, photos: photos.size };
}

async function pool(items, n, fn) {
  let i = 0;
  const out = [];
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]); }
  }));
  return out;
}

const { data: candidates } = await db
  .from("facility_candidates")
  .select("overture_id, name, website")
  .eq("metro", metro).eq("status", "candidate").not("website", "is", null)
  .order("confidence", { ascending: false })
  .limit(limit);

console.log(`FETCH — ${candidates.length} ${metro} candidates (top confidence, website present)\n`);
const res = await pool(candidates, 4, async (c) => {
  const r = await processOne(c);
  console.log(`  ${r.ok ? "OK  " : "SKIP"} ${c.name.slice(0, 40)} ${r.ok ? `(${r.pages} pages, ${r.photos} photos)` : "(no content)"}`);
  return r;
});
const ok = res.filter((r) => r.ok).length;
console.log(`\nDone. fetched=${ok}, rejected=${res.length - ok}, avg photos=${(res.filter((r) => r.ok).reduce((s, r) => s + r.photos, 0) / (ok || 1)).toFixed(1)}`);
