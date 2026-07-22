/**
 * RLS smoke checks against a live Supabase project (publishable/anon key only).
 *
 * Usage:  node scripts/rls-smoke.mjs
 * Requires .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY  (or NEXT_PUBLIC_SUPABASE_ANON_KEY)
 *
 * Prints PASS/FAIL per check; exits 1 on any FAIL.
 * Not part of vitest — reviewer runs this with a real DB.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

try {
  for (const line of readFileSync(resolve(root, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  // .env.local optional if vars are already exported
}

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!URL_ || !KEY) {
  console.error(
    "FAIL  missing env: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or ANON_KEY)",
  );
  process.exit(1);
}

const db = createClient(URL_, KEY, { auth: { persistSession: false } });

let failed = 0;

function pass(name, detail = "") {
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail = "") {
  failed += 1;
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
}

/** SELECT allowed: expect data array (may be empty) and no error. */
async function expectSelectOk(table, { limit = 1 } = {}) {
  const { data, error } = await db.from(table).select("*").limit(limit);
  if (error) {
    fail(`SELECT ${table}`, error.message);
    return;
  }
  if (!Array.isArray(data)) {
    fail(`SELECT ${table}`, "response was not an array");
    return;
  }
  pass(`SELECT ${table}`, `${data.length} row(s) sample`);
}

/**
 * SELECT denied: RLS returns empty (PostgREST default) OR an explicit error.
 * Empty is the common "no policy for role" outcome for SELECT.
 * We assert the client never receives rows from staff/owner tables.
 */
async function expectSelectDenied(table) {
  const { data, error } = await db.from(table).select("*").limit(5);
  if (error) {
    // Permission / relation denied is fine
    pass(`DENY SELECT ${table}`, error.message);
    return;
  }
  if (Array.isArray(data) && data.length === 0) {
    pass(`DENY SELECT ${table}`, "0 rows (RLS filtered)");
    return;
  }
  fail(
    `DENY SELECT ${table}`,
    `got ${Array.isArray(data) ? data.length : "?"} row(s) — expected none`,
  );
}

/** INSERT denied: must error (no open insert policy). */
async function expectInsertDenied(table, row) {
  const { data, error } = await db.from(table).insert(row).select();
  if (error) {
    pass(`DENY INSERT ${table}`, error.message);
    return;
  }
  // If insert somehow succeeded, try to clean up is impossible with anon —
  // report FAIL loudly.
  fail(
    `DENY INSERT ${table}`,
    `insert succeeded unexpectedly (${JSON.stringify(data)?.slice(0, 80)})`,
  );
}

async function expectRpcOk(fn, args) {
  const { error } = await db.rpc(fn, args);
  if (error) {
    fail(`RPC ${fn}`, error.message);
    return;
  }
  pass(`RPC ${fn}`);
}

console.log("RLS smoke — publishable key against", URL_);
console.log("─".repeat(60));

// ── Allowed catalog reads ────────────────────────────────────────────
await expectSelectOk("gyms");
await expectSelectOk("amenities", { limit: 50 });

// ── Denied staff / owner tables ──────────────────────────────────────
await expectSelectDenied("owner_invites");
await expectSelectDenied("owner_submissions");
await expectSelectDenied("staff_members");
await expectSelectDenied("facility_candidates");

// ── Denied direct inserts (telemetry gated; gyms catalog is read-only) ─
await expectInsertDenied("gyms", {
  // Minimal shape — will fail RLS (or NOT NULL) before landing a real row.
  slug: `__rls_smoke_${Date.now()}`,
  name: "RLS Smoke Should Not Persist",
  city_id: "00000000-0000-0000-0000-000000000000",
});
await expectInsertDenied("search_logs", {
  query: "rls-smoke-should-fail",
  parsed_via: "fallback",
});
await expectInsertDenied("ask_logs", {
  gym_id: "00000000-0000-0000-0000-000000000000",
  question: "rls-smoke-should-fail",
});

// ── Allowed telemetry RPC ────────────────────────────────────────────
await expectRpcOk("log_search", {
  p_query: "rls-smoke",
  p_parsed_via: "fallback",
  p_result_count: 0,
  p_top_score: null,
  p_anon_id: "rls-smoke-script",
});

console.log("─".repeat(60));
if (failed > 0) {
  console.log(`RESULT: ${failed} FAIL`);
  process.exit(1);
}
console.log("RESULT: all PASS");
process.exit(0);
