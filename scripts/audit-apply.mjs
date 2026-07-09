// Apply the reviewed Tampa audit fixes from audit-report.json:
//   - rejects      -> gyms.status='closed'    (+ candidate reject 'not-a-gym')
//   - dup merges   -> gyms.status='duplicate' (+ candidate reject 'dup-merged')
//   - resegments   -> gyms.segment  (soft labels, low risk)
//   - renames      -> gyms.name  BUT ONLY formatting cleanups (cleaned version of the
//                     SAME name); identity-changing renames (likely wrong-site) are skipped.
//   - fabrications -> IGNORED (the text-only precision check conflates vision-derived
//                     'estimated' facts with fabrication; not actionable).
//   node scripts/audit-apply.mjs <report.json> [--apply]
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

const REPORT = process.argv[2];
const APPLY = process.argv.includes("--apply");
const rep = JSON.parse(readFileSync(REPORT, "utf8"));

// A rename is a safe FORMATTING cleanup (not an identity change) when the two names,
// reduced to lowercase-alnum, share a >=5-char prefix or one contains the other.
const squash = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const safeRename = (from, to) => {
  const a = squash(from), b = squash(to);
  if (!a || !b) return false;
  if (a.includes(b) || b.includes(a)) return true;
  let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i >= 5;
};

const safeRenames = rep.toRename.filter((r) => safeRename(r.from, r.to));
const skippedRenames = rep.toRename.filter((r) => !safeRename(r.from, r.to));

console.log(`${APPLY ? "APPLYING" : "[DRY]"} audit fixes:`);
console.log(`  rejects=${rep.toReject.length}  dupMerges=${rep.dupMerge.length}  resegments=${rep.toResegment.length}`);
console.log(`  renames: ${safeRenames.length} safe (applying), ${skippedRenames.length} identity-change (SKIPPED):`);
for (const r of skippedRenames) console.log(`      skip "${r.from}" -> "${r.to}"`);
console.log(`  fabrications: ${rep.fabrications.length} IGNORED (vision-estimate artifact)\n`);

if (!APPLY) { console.log("re-run with --apply to enact."); process.exit(0); }

let n = 0;
for (const r of rep.toReject) {
  await db.from("gyms").update({ status: "closed" }).eq("id", r.id);
  await db.from("facility_candidates").update({ status: "rejected", reject_reason: "not-a-gym" }).eq("gym_id", r.id);
  n++;
}
for (const r of rep.dupMerge) {
  await db.from("gyms").update({ status: "duplicate" }).eq("id", r.drop);
  await db.from("facility_candidates").update({ status: "rejected", reject_reason: "dup-merged" }).eq("gym_id", r.drop);
}
for (const r of rep.toResegment) await db.from("gyms").update({ segment: r.to }).eq("id", r.id);
for (const r of safeRenames) await db.from("gyms").update({ name: r.to }).eq("id", r.id);

console.log(`Applied: ${rep.toReject.length} closed(non-gym), ${rep.dupMerge.length} dup-merged, ${rep.toResegment.length} resegmented, ${safeRenames.length} renamed.`);
