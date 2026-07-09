// Quality audit of pipeline-landed gyms. Reads the flagged/sample/dupPairs set
// (from audit-prep.mjs) and, per gym, reads its cached source page + asks Haiku to
// adjudicate: keep / reject (non-gym) / fix (segment or name). EVERY reject gets a
// second adversarial "refute" pass — only a confirmed reject is enacted, so a real
// gym is never wrongly cut. Also verifies a precision sample (no fabricated facts)
// and judges proximity dup pairs.
//   node scripts/audit-gyms.mjs <args.json>           # dry: adjudicate + write report
//   node scripts/audit-gyms.mjs <args.json> --apply   # enact reject/resegment/rename/dup-merge
import { readFileSync, writeFileSync } from "node:fs";
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

const ARGS_PATH = process.argv[2];
const APPLY = process.argv.includes("--apply");
const CACHE = "facility-cache";
const REPORT = join(dirname(ARGS_PATH), "audit-report.json");
const VALID_SEGMENTS = new Set(["strength","crossfit","big_box","boutique","climbing","yoga_pilates","mma","recovery","luxury","cycling","barre"]);
const { flagged, sample, dupPairs } = JSON.parse(readFileSync(ARGS_PATH, "utf8"));

const anthropicKey = (await db.rpc("get_secret", { secret_name: "ANTHROPIC_API_KEY" })).data;
if (!anthropicKey) { console.error("No Anthropic key from Vault"); process.exit(1); }

async function haiku(system, user, maxTokens = 500) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": anthropicKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: "claude-haiku-4-5", temperature: 0, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
        signal: AbortSignal.timeout(60000),
      });
      if (res.status === 429 || res.status >= 500) { await new Promise((r) => setTimeout(r, 1500 * (attempt + 1))); continue; }
      if (!res.ok) return null;
      const j = await res.json();
      const t = j.content?.[0]?.text ?? "";
      const m = t.match(/\{[\s\S]*\}/);
      return m ? JSON.parse(m[0]) : null;
    } catch { await new Promise((r) => setTimeout(r, 1500 * (attempt + 1))); }
  }
  return null;
}

async function cachedText(oid) {
  if (!oid) return "";
  try {
    const { data: files } = await db.storage.from(CACHE).list(oid, { limit: 8 });
    let out = "";
    for (const f of files ?? []) {
      const { data: blob } = await db.storage.from(CACHE).download(`${oid}/${f.name}`);
      if (blob) out += (await blob.text()).slice(0, 4000) + "\n";
      if (out.length > 9000) break;
    }
    return out;
  } catch { return ""; }
}

async function pool(items, n, fn) {
  let i = 0; const out = [];
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx], idx); }
  }));
  return out;
}

// ── Phase 1: adjudicate flagged (+ adversarial refute on rejects) ──
const ADJ_SYS =
  `You audit a gym-directory listing. Decide from the website text. Output ONLY JSON: ` +
  `{"is_real_gym":bool,"verdict":"keep"|"reject"|"fix","reject_reason":str,"suggested_segment":str,"clean_name":str,"notes":str}. ` +
  `is_real_gym: a real physical place a person can train at — martial-arts dojos, yoga/pilates/barre studios, climbing, recovery/stretch studios ALL count. ` +
  `Reject ONLY genuine non-gyms: retail/nutrition stores, chiropractors, med-spas, tanning, salons, pure online/mobile PT with no facility, gaming lounges, ` +
  `corporate-wellness vendors, permanently-closed. When unsure, KEEP. ` +
  `suggested_segment: if current segment is wrong or missing, the best fit from [strength,crossfit,big_box,boutique,climbing,yoga_pilates,mma,recovery,luxury,cycling,barre]; else "". ` +
  `clean_name: if the name is a domain/slug/run-together (e.g. "sudafitlargo"), a proper Title Case name; else "". notes: one sentence.`;
const REFUTE_SYS =
  `A reviewer wants to DELETE this gym listing as "not a real gym". Refute it: is it actually a legitimate physical training facility? ` +
  `Output ONLY JSON: {"still_reject":bool,"notes":str}. Any real gym/studio/dojo/box/climbing/recovery = still_reject false. ` +
  `Only still_reject true if clearly not a gym (retail, closed, no facility). Default false when unsure.`;

let done = 0;
const adj = await pool(flagged, 6, async (g) => {
  const text = (await cachedText(g.oid)).slice(0, 9000);
  const ctx = `Name: ${g.name}\nWebsite: ${g.website || "(none)"}\nCurrent segment: ${g.segment || "(none)"}\nFlagged: ${g.reason}\n\nSITE TEXT:\n${text || "(no cached content)"}`;
  const v = await haiku(ADJ_SYS, ctx);
  let confirmedReject = false, refuteNotes = "";
  if (v && v.verdict === "reject") {
    const r = await haiku(REFUTE_SYS, `${g.name} | ${g.website || "(no site)"}\nReviewer reason: ${v.reject_reason || v.notes}\n\nSITE TEXT:\n${text}`);
    confirmedReject = r ? !!r.still_reject : true;
    refuteNotes = r?.notes || "";
  }
  if (++done % 25 === 0) console.log(`  adjudicated ${done}/${flagged.length}`);
  return v ? { ...g, ...v, confirmedReject, refuteNotes } : { ...g, verdict: "keep", is_real_gym: true, notes: "adjudication failed — kept", confirmedReject: false };
});

// ── Phase 2: precision / fabrication spot-check ──
const PREC_SYS =
  `Verify a gym listing does not fabricate facts. Given the site text and the claimed amenity/equipment keys, decide which claims the site actually supports. ` +
  `Output ONLY JSON: {"checked":int,"verified":int,"fabricated":[keys unsupported by the site],"notes":str}.`;
const prec = await pool(sample, 6, async (g) => {
  const text = (await cachedText(g.oid)).slice(0, 9000);
  if (!text) return { ...g, checked: 0, verified: 0, fabricated: [], notes: "no cache" };
  const v = await haiku(PREC_SYS, `Name: ${g.name}\nClaimed amenities: ${(g.amenities||[]).join(", ")}\nClaimed equipment: ${(g.equipment||[]).join(", ")}\n\nSITE TEXT:\n${text}`);
  return v ? { id: g.id, name: g.name, ...v } : { id: g.id, name: g.name, checked: 0, verified: 0, fabricated: [], notes: "check failed" };
});

// ── Phase 3: duplicate adjudication on proximity pairs ──
const DUP_SYS =
  `Two gym listings sit close together. Decide if they are the SAME physical business (duplicate) or two distinct gyms. ` +
  `Output ONLY JSON: {"same_place":bool,"keep":"a"|"b"|"neither","notes":str}. Same brand+address=duplicate; different businesses in one plaza=distinct.`;
const dups = await pool(dupPairs, 6, async (p) => {
  const v = await haiku(DUP_SYS, `${p.dist}m apart.\nA: ${p.a.name} | ${p.a.website || "(no site)"}\nB: ${p.b.name} | ${p.b.website || "(no site)"}`);
  return v ? { ...p, ...v } : { ...p, same_place: false, keep: "neither", notes: "check failed" };
});

// ── Synthesize ──
const toReject = adj.filter((v) => v.verdict === "reject" && v.confirmedReject).map((v) => ({ id: v.id, name: v.name, reason: v.reject_reason || v.notes }));
const savedFromReject = adj.filter((v) => v.verdict === "reject" && !v.confirmedReject).map((v) => ({ id: v.id, name: v.name, notes: v.refuteNotes }));
const toResegment = adj.filter((v) => (v.verdict === "fix" || !v.segment) && v.suggested_segment && VALID_SEGMENTS.has(v.suggested_segment) && v.suggested_segment !== v.segment).map((v) => ({ id: v.id, name: v.name, from: v.segment, to: v.suggested_segment }));
const toRename = adj.filter((v) => v.clean_name && v.clean_name.trim().length > 1 && v.clean_name.trim() !== v.name).map((v) => ({ id: v.id, from: v.name, to: v.clean_name.trim() }));
const fabrications = prec.filter((r) => Array.isArray(r.fabricated) && r.fabricated.length).map((r) => ({ id: r.id, name: r.name, fabricated: r.fabricated, notes: r.notes }));
const dupMerge = dups.filter((d) => d.same_place && d.keep !== "neither").map((d) => ({ keep: d.keep === "a" ? d.a.id : d.b.id, drop: d.keep === "a" ? d.b.id : d.a.id, keep_name: d.keep === "a" ? d.a.name : d.b.name, drop_name: d.keep === "a" ? d.b.name : d.a.name, dist: d.dist, notes: d.notes }));

const report = {
  counts: { flagged: flagged.length, reject_confirmed: toReject.length, reject_saved: savedFromReject.length, resegment: toResegment.length, rename: toRename.length, precision_checked: prec.length, fabrications: fabrications.length, dup_pairs: dupPairs.length, dup_merge: dupMerge.length },
  toReject, savedFromReject, toResegment, toRename, fabrications, dupMerge,
};
writeFileSync(REPORT, JSON.stringify(report, null, 2));
console.log("\n=== AUDIT REPORT ===");
console.log(JSON.stringify(report.counts, null, 2));
console.log(`Full report -> ${REPORT}`);

// ── Apply ──
if (APPLY) {
  console.log("\nApplying fixes...");
  // gym_status enum: active|suspect|closed|moved|duplicate|unverified_new. Public
  // discovery hides (closed,moved,duplicate) — so 'closed' hides a non-gym and
  // 'duplicate' hides a merged dup. Both reversible (flip back to 'active').
  for (const r of toReject) {
    await db.from("gyms").update({ status: "closed" }).eq("id", r.id);
    await db.from("facility_candidates").update({ status: "rejected", reject_reason: "not-a-gym" }).eq("gym_id", r.id);
  }
  for (const r of dupMerge) {
    await db.from("gyms").update({ status: "duplicate" }).eq("id", r.drop);
    await db.from("facility_candidates").update({ status: "rejected", reject_reason: "dup-merged" }).eq("gym_id", r.drop);
  }
  for (const r of toResegment) await db.from("gyms").update({ segment: r.to }).eq("id", r.id);
  for (const r of toRename) await db.from("gyms").update({ name: r.to }).eq("id", r.id);
  console.log(`Applied: ${toReject.length} closed(non-gym), ${dupMerge.length} dup-merged, ${toResegment.length} resegmented, ${toRename.length} renamed.`);
} else {
  console.log("\n[DRY] re-run with --apply to enact.");
}
