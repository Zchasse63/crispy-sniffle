// Rehost external gym photos into our own Supabase Storage (`gym-photos` bucket)
// so they can't rot / hotlink-block like the source URLs do. Sets storage_path on
// each row (the app then serves the Storage copy via src/lib/gymPhotoUrl.ts).
//
//   node scripts/rehost-photos.mjs --dry     # preview, no writes
//   node scripts/rehost-photos.mjs           # download + upload + set storage_path
//
// Additive & idempotent: only sets storage_path (never overwrites url); skips rows
// already rehosted, already-ours (owner-photos) urls, and dead/non-image sources.
// Needs .env.local with SUPABASE_SERVICE_ROLE_KEY (storage write + row update).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const DRY = process.argv.includes("--dry");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const env = { ...process.env };
  try {
    for (const line of readFileSync(join(root, ".env.local"), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* rely on process.env */
  }
  return env;
}
const env = loadEnv();
const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPA_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const SUPA_HOST = new URL(SUPA_URL).host;
const BUCKET = "gym-photos";
const db = createClient(SUPA_URL, SERVICE_KEY, { auth: { persistSession: false } });

const SNIFF = [
  { ext: "jpg", ct: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: "png", ct: "image/png", test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { ext: "gif", ct: "image/gif", test: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 },
  { ext: "webp", ct: "image/webp", test: (b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[8] === 0x57 && b[9] === 0x45 },
];
function sniff(bytes) {
  const b = new Uint8Array(bytes.slice(0, 12));
  return b.length >= 12 ? SNIFF.find((s) => s.test(b)) : undefined;
}

// Rows already pointing at our storage (owner uploads) or already rehosted are ours.
const isOurs = (url) => {
  try {
    return new URL(url).host === SUPA_HOST;
  } catch {
    return false;
  }
};

async function download(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    // Inside the try: a malformed url must fail THIS job, not reject pool()'s
    // Promise.all and abort the whole run.
    const origin = new URL(url).origin + "/";
    const res = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        referer: origin,
        accept: "image/avif,image/webp,image/png,image/*,*/*;q=0.8",
      },
    });
    if (!res.ok) return { ok: false, reason: `http ${res.status}` };
    // Bound BEFORE buffering when the server declares a size.
    const declared = Number(res.headers.get("content-length") || 0);
    if (declared > 15_000_000) return { ok: false, reason: "too-large" };
    const buf = Buffer.from(await res.arrayBuffer());
    const kind = sniff(buf);
    if (!kind) return { ok: false, reason: "not-an-image" };
    if (buf.length > 15_000_000) return { ok: false, reason: "too-large" };
    return { ok: true, buf, kind };
  } catch (e) {
    return { ok: false, reason: String(e.message || e).slice(0, 40) };
  } finally {
    clearTimeout(t);
  }
}

async function pool(items, n, fn) {
  let i = 0;
  const out = [];
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}

// Build the work list: gym_photos rows + gyms hero photo, external + not-yet-rehosted.
const { data: photos, error: pErr } = await db
  .from("gym_photos")
  .select("id, gym_id, url, storage_path");
if (pErr) throw pErr;
const { data: gyms, error: gErr } = await db
  .from("gyms")
  .select("id, photo_url, photo_storage_path");
if (gErr) throw gErr;

const jobs = [];
for (const p of photos) {
  if (p.storage_path || !p.url || isOurs(p.url)) continue;
  jobs.push({ table: "gym_photos", id: p.id, gymId: p.gym_id, url: p.url });
}
for (const g of gyms) {
  if (g.photo_storage_path || !g.photo_url || isOurs(g.photo_url)) continue;
  jobs.push({ table: "gyms", id: g.id, gymId: g.id, url: g.photo_url, hero: true });
}

console.log(`${DRY ? "[DRY] " : ""}Rehosting ${jobs.length} external photos into ${BUCKET}...\n`);
let done = 0,
  failed = 0;

await pool(jobs, 6, async (job) => {
  const dl = await download(job.url);
  if (!dl.ok) {
    failed++;
    console.log(`  SKIP  [${dl.reason}] ${job.url.slice(0, 80)}`);
    return;
  }
  const hash = createHash("sha1").update(job.url).digest("hex").slice(0, 16);
  const path = `${job.gymId}/${hash}.${dl.kind.ext}`;
  if (DRY) {
    done++;
    console.log(`  OK    ${(dl.buf.length / 1024) | 0}KB ${dl.kind.ct} -> ${path}`);
    return;
  }
  const up = await db.storage.from(BUCKET).upload(path, dl.buf, {
    contentType: dl.kind.ct,
    upsert: true,
    cacheControl: "31536000", // 1y — immutable content-addressed path
  });
  if (up.error) {
    failed++;
    console.log(`  FAIL  upload ${path}: ${up.error.message}`);
    return;
  }
  const col = job.table === "gyms" ? "photo_storage_path" : "storage_path";
  const { error: updErr } = await db.from(job.table).update({ [col]: path }).eq("id", job.id);
  if (updErr) {
    failed++;
    console.log(`  FAIL  update ${job.table}.${job.id}: ${updErr.message}`);
    return;
  }
  done++;
  console.log(`  OK    ${(dl.buf.length / 1024) | 0}KB -> ${path}`);
});

console.log(`\n${DRY ? "[DRY] " : ""}Done. rehosted=${done} failed/dead=${failed}`);
