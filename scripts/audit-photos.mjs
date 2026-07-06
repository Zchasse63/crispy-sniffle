// Audit every gym photo URL server-side to decide whether dead/ORB-blocked
// scraped images are RECOVERABLE (a server fetch that gets real image bytes can be
// rehosted into our own Storage; a 403/404 cannot). Read-only: no DB writes.
//
//   node scripts/audit-photos.mjs
//
// Reads Supabase via the publishable (anon) key from .env.local — photos are
// public-read, so no service-role key needed.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const env = {};
  try {
    for (const line of readFileSync(join(root, ".env.local"), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* fall back to process.env */
  }
  return { ...env, ...process.env };
}

const env = loadEnv();
const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL_BASE || !KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / PUBLISHABLE_KEY in .env.local");
  process.exit(1);
}

async function rest(path) {
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    headers: { apikey: KEY, authorization: `Bearer ${KEY}` },
  });
  if (!res.ok) throw new Error(`REST ${path}: ${res.status}`);
  return res.json();
}

// magic-byte image sniff — the definitive test (ORB blocks on content-type, not bytes)
function isImageBytes(buf) {
  const b = new Uint8Array(buf);
  if (b.length < 12) return false;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "gif";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[8] === 0x57 && b[9] === 0x45) return "webp";
  return false;
}

async function probe(url) {
  let origin = "";
  try {
    origin = new URL(url).origin + "/";
  } catch {
    return { url, verdict: "bad-url" };
  }
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        // browser-like UA + a same-site referer to defeat referer-based hotlinking
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        referer: origin,
        accept: "image/avif,image/webp,image/png,image/*,*/*;q=0.8",
      },
    });
    clearTimeout(t);
    if (!res.ok) return { url, verdict: "dead", status: res.status };
    const buf = await res.arrayBuffer();
    const kind = isImageBytes(buf);
    if (!kind) {
      const ct = res.headers.get("content-type") || "?";
      return { url, verdict: "not-image", status: res.status, contentType: ct, bytes: buf.byteLength };
    }
    return { url, verdict: "recoverable", status: res.status, kind, bytes: buf.byteLength };
  } catch (e) {
    return { url, verdict: "error", error: String(e.message || e).slice(0, 60) };
  }
}

async function pool(items, n, fn) {
  const out = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx], idx);
      }
    }),
  );
  return out;
}

const gyms = await rest("gyms?select=id,slug,photo_url&status=eq.active");
const photos = await rest("gym_photos?select=gym_id,url");
const slugById = new Map(gyms.map((g) => [g.id, g.slug]));

const targets = [];
for (const g of gyms) if (g.photo_url) targets.push({ slug: g.slug, kind: "hero", url: g.photo_url });
for (const p of photos) targets.push({ slug: slugById.get(p.gym_id) || p.gym_id, kind: "gallery", url: p.url });

console.log(`Probing ${targets.length} photo URLs (${gyms.length} gyms)...\n`);
const results = await pool(targets, 12, (t) => probe(t.url).then((r) => ({ ...t, ...r })));

const by = (v) => results.filter((r) => r.verdict === v);
const recoverable = by("recoverable");
const dead = by("dead");
const notImage = by("not-image");
const errored = by("error");

console.log("=== VERDICT TOTALS ===");
console.log(`  recoverable (real image bytes): ${recoverable.length}`);
console.log(`  dead (4xx/5xx):                 ${dead.length}`);
console.log(`  not-image (html/block page):    ${notImage.length}`);
console.log(`  error/timeout:                  ${errored.length}`);
console.log(`  TOTAL:                          ${results.length}\n`);

const broken = results.filter((r) => r.verdict !== "recoverable");
if (broken.length) {
  console.log("=== BROKEN, by gym ===");
  const byGym = {};
  for (const r of broken) (byGym[r.slug] ||= []).push(r);
  for (const [slug, rs] of Object.entries(byGym).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${slug}: ${rs.length} broken`);
    for (const r of rs) console.log(`      [${r.verdict}${r.status ? " " + r.status : ""}] ${r.url.slice(0, 90)}`);
  }
}
