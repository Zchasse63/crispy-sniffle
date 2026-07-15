/**
 * Scout policy/pricing backfill loader — merges scraped ENTRY-POLICY and
 * pricing facts into gyms columns with the same provenance discipline as
 * enrich.mjs (stated facts only; the scrape agents classify only explicitly
 * stated processes — a price alone never becomes walk_in).
 *
 * Input:  data/<city>-policy.json (array from the policy scrape workflow)
 * Writes: gyms.day_pass_price / week_pass_price / monthly_from /
 *         drop_in_policy / drop_in_note / guest_policy_model /
 *         members_guest_note — only fields the scrape produced, never
 *         overwriting an existing NON-NULL value with a different one
 *         unless --overwrite (existing curated facts win by default).
 *         Stamps day_pass_verified_at when writing day_pass_price
 *         (freshness convention, migration 20260714164012).
 *
 * Usage:  node scripts/policy-load.mjs --file data/tampa-policy.json [--dry-run] [--overwrite]
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DRY = process.argv.includes("--dry-run");
const OVERWRITE = process.argv.includes("--overwrite");
const fileIdx = process.argv.indexOf("--file");
const INPUT = fileIdx > -1 && process.argv[fileIdx + 1] ? process.argv[fileIdx + 1] : null;
if (!INPUT) {
  console.error("usage: node scripts/policy-load.mjs --file data/<city>-policy.json [--dry-run] [--overwrite]");
  process.exit(1);
}

for (const line of readFileSync(resolve(root, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const DROP_IN = new Set(["walk_in", "book_first", "restricted", "trial_route", "membership_only"]);
const GUEST = new Set(["public_day_pass", "member_invite_only", "members_only_waitlist", "hybrid"]);
const price = (v) => (typeof v === "number" && v >= 3 && v <= 300 ? v : null);
const note = (v) => (typeof v === "string" && v.trim().length > 0 && v.length <= 300 ? v.trim() : null);

const entries = JSON.parse(readFileSync(resolve(root, INPUT), "utf8"));
console.log(`${entries.length} policy entries · input: ${INPUT} · ${DRY ? "DRY RUN" : "writing"}${OVERWRITE ? " · OVERWRITE" : ""}\n`);

const stats = { gyms: 0, day_pass: 0, week_pass: 0, monthly: 0, policy: 0, guest: 0, skipped: [], kept_existing: 0 };

for (const e of entries) {
  if (!e?.slug || e.unreachable) continue;
  const { data: row, error } = await db
    .from("gyms")
    .select("id, day_pass_price, week_pass_price, monthly_from, drop_in_policy, guest_policy_model")
    .eq("slug", e.slug)
    .maybeSingle();
  if (error || !row) {
    stats.skipped.push(e.slug);
    continue;
  }

  const patch = {};
  const setIfSafe = (col, value, statKey) => {
    if (value === null) return;
    if (row[col] !== null && !OVERWRITE) {
      if (row[col] !== value) stats.kept_existing++;
      return; // existing curated fact wins
    }
    patch[col] = value;
    stats[statKey]++;
  };

  setIfSafe("day_pass_price", price(e.day_pass_price), "day_pass");
  setIfSafe("week_pass_price", price(e.week_pass_price), "week_pass");
  setIfSafe("monthly_from", price(e.monthly_from), "monthly");
  const policy = DROP_IN.has(e.drop_in_policy) ? e.drop_in_policy : null;
  // a policy classification without its backing note is not accepted —
  // the note is the verbatim-faithful evidence trail
  if (policy && note(e.drop_in_note)) {
    setIfSafe("drop_in_policy", policy, "policy");
    if (patch.drop_in_policy) patch.drop_in_note = note(e.drop_in_note);
  }
  const guest = GUEST.has(e.guest_policy_model) ? e.guest_policy_model : null;
  if (guest) {
    setIfSafe("guest_policy_model", guest, "guest");
    const gn = note(e.members_guest_note);
    if (patch.guest_policy_model && gn) patch.members_guest_note = gn;
  }
  // freshness stamp: writing a day-pass price counts as verifying it at
  // source now (scraped tier — the UI wording distinguishes tiers)
  if (patch.day_pass_price !== undefined) patch.day_pass_verified_at = new Date().toISOString();

  if (Object.keys(patch).length === 0) continue;
  stats.gyms++;
  const summary = Object.keys(patch).filter((k) => k !== "day_pass_verified_at").join(", ");
  console.log(`  ${DRY ? "→" : "✓"} ${e.slug} · ${summary}`);
  if (!DRY) {
    const { error: upErr } = await db.from("gyms").update(patch).eq("id", row.id);
    if (upErr) console.error(`  ✗ ${e.slug}: ${upErr.message}`);
  }
}

console.log("\nDone.", JSON.stringify(stats, null, 1));
