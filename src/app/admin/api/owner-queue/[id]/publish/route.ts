import { NextResponse, type NextRequest } from "next/server";
import { requireStaffApi, isError, logAudit, logGymEdits, type GymEditEntry } from "@/lib/admin/api";
import type { ParsedFact } from "@/lib/owner/parse";
import type { PlanDraft } from "@/lib/owner/answerTypes";
import { AMENITY_LABELS, EQUIPMENT_LABELS } from "@/lib/types/scout";
import type { Database } from "@/lib/types/database";

const OWNER_CONF = 0.95;
const VALID_AMENITIES = new Set(Object.keys(AMENITY_LABELS));
const VALID_EQUIPMENT = new Set(Object.keys(EQUIPMENT_LABELS));

function planDraftsToPlans(drafts: PlanDraft[]) {
  return drafts
    .filter((p) => p.name.trim())
    .map((p) => ({
      name: p.name.trim(),
      usage: p.usageType ? { type: p.usageType, count: p.usageCount ?? null } : null,
      prices: p.prices
        .filter((pr) => pr.monthly !== null)
        .map((pr) => ({ term: pr.term, monthly: pr.monthly })),
    }));
}

function commitmentToColumns(terms: string[]): { min_commitment_months: number | null; no_contract_option: boolean } {
  const months = terms.includes("12_month") ? 12 : terms.includes("6_month") ? 6 : terms.includes("3_month") ? 3 : null;
  return { min_commitment_months: months, no_contract_option: terms.includes("month_to_month") };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireStaffApi("reviewer");
  if (isError(ctx)) return ctx.response;
  const { staff, service } = ctx;
  const { id } = await params;

  let body: { decisions?: Record<string, "publish" | "reject">; reviewNote?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const decisions = body.decisions ?? {};

  const { data: sub, error: subErr } = await service
    .from("owner_submissions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 });
  if (!sub) return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  if (sub.status !== "pending" && sub.status !== "needs_info") {
    return NextResponse.json({ error: `Already ${sub.status}` }, { status: 409 });
  }

  const facts = (sub.parsed_facts as unknown as ParsedFact[]) ?? [];
  const gymId = sub.gym_id;

  const gymPatch: Record<string, unknown> = {};
  const amenityUpserts: { gym_id: string; amenity_key: string; present: boolean; source: string; confidence: number }[] = [];
  // equipment ops keyed by equipment_key: ensure present (from an accepted
  // equipmentSet) and/or set attrs. attr-only keys never CREATE a new row.
  const equipOps = new Map<string, { quantity?: number; max_weight_lbs?: number; ensurePresent?: boolean }>();
  const factLog: Database["public"]["Tables"]["owner_fact_log"]["Insert"][] = [];
  const gymEdits: GymEditEntry[] = [];

  let publishedCount = 0;
  let rejectedCount = 0;

  for (const fact of facts) {
    const decision = decisions[fact.key] ?? "publish"; // default: accept
    if (decision === "reject") {
      rejectedCount++;
      factLog.push({
        submission_id: id,
        gym_id: gymId,
        field: fact.key,
        old_value: fact.oldValue as never,
        new_value: fact.newValue as never,
        decision: "rejected",
        actor: staff.userId,
      });
      continue;
    }

    const t = fact.target;
    switch (t.type) {
      case "scalar":
      case "bool":
        gymPatch[t.column] = fact.newValue;
        break;
      case "discounts": {
        const sel = new Set(fact.newValue as string[]);
        gymPatch.student_discount = sel.has("student");
        gymPatch.military_discount = sel.has("military");
        gymPatch.senior_discount = sel.has("senior");
        gymPatch.corporate_discount = sel.has("corporate");
        gymPatch.family_plans = sel.has("family");
        break;
      }
      case "commitment": {
        const cols = commitmentToColumns(fact.newValue as string[]);
        gymPatch.min_commitment_months = cols.min_commitment_months;
        gymPatch.no_contract_option = cols.no_contract_option;
        break;
      }
      case "amenitySet":
        for (const k of fact.newValue as string[]) {
          if (VALID_AMENITIES.has(k)) {
            amenityUpserts.push({ gym_id: gymId, amenity_key: k, present: true, source: "owner", confidence: OWNER_CONF });
          }
        }
        break;
      case "equipmentSet":
        for (const k of fact.newValue as string[]) {
          if (VALID_EQUIPMENT.has(k)) equipOps.set(k, { ...(equipOps.get(k) ?? {}), ensurePresent: true });
        }
        break;
      case "equipmentAttr": {
        if (VALID_EQUIPMENT.has(t.equipmentKey)) {
          const cur = equipOps.get(t.equipmentKey) ?? {};
          cur[t.attr] = fact.newValue as number;
          equipOps.set(t.equipmentKey, cur);
        }
        break;
      }
      case "hours":
        // open_24h is preserved from the existing gym row after this loop.
        gymPatch.hours = { ...(fact.newValue as Record<string, unknown>) };
        break;
      case "plans":
        gymPatch.membership_plans = planDraftsToPlans(fact.newValue as PlanDraft[]);
        break;
      case "vibes":
        gymPatch.vibe_tags = fact.newValue;
        gymPatch.vibe_source = "owner";
        break;
    }

    publishedCount++;
    factLog.push({
      submission_id: id,
      gym_id: gymId,
      field: fact.key,
      old_value: fact.oldValue as never,
      new_value: fact.newValue as never,
      decision: "published",
      actor: staff.userId,
    });
    gymEdits.push({
      gym_id: gymId,
      actor: staff.userId,
      action: "owner_publish",
      field: fact.key,
      old_value: fact.oldValue,
      new_value: fact.newValue,
      source: "owner",
      confidence: OWNER_CONF,
    });
  }

  // Preserve an existing open_24h flag when overwriting hours.
  if ("hours" in gymPatch) {
    const { data: g, error: hErr } = await service.from("gyms").select("hours").eq("id", gymId).maybeSingle();
    if (hErr) return NextResponse.json({ error: `hours read: ${hErr.message}` }, { status: 500 });
    const prev = g?.hours as Record<string, unknown> | null;
    if (prev && "open_24h" in prev) (gymPatch.hours as Record<string, unknown>).open_24h = prev.open_24h;
  }

  // Apply the gym patch only when something was actually published — a publish
  // that rejected every fact must NOT grant the Owner-Listed badge.
  if (publishedCount > 0) {
    gymPatch.owner_listed = true;
    gymPatch.updated_at = new Date().toISOString();
    const { error: gymErr } = await service
      .from("gyms")
      .update(gymPatch as Database["public"]["Tables"]["gyms"]["Update"])
      .eq("id", gymId);
    if (gymErr) return NextResponse.json({ error: `gym update: ${gymErr.message}` }, { status: 500 });
  }

  // Amenities (PK gym_id,amenity_key → upsert).
  if (amenityUpserts.length > 0) {
    const { error } = await service
      .from("gym_amenities")
      .upsert(amenityUpserts as never, { onConflict: "gym_id,amenity_key" });
    if (error) return NextResponse.json({ error: `amenities: ${error.message}` }, { status: 500 });
  }

  // Equipment (no natural unique key → find-or-insert per key).
  if (equipOps.size > 0) {
    const keys = [...equipOps.keys()];
    const { data: existing } = await service
      .from("gym_equipment")
      .select("id, equipment_key, quantity, max_weight_lbs")
      .eq("gym_id", gymId)
      .in("equipment_key", keys as never);
    const byKey = new Map((existing ?? []).map((r) => [r.equipment_key, r]));
    for (const [key, attrs] of equipOps) {
      const row = byKey.get(key as never);
      if (row) {
        const patch: Record<string, unknown> = { source: "owner", confidence: OWNER_CONF };
        if (attrs.quantity !== undefined) patch.quantity = attrs.quantity;
        if (attrs.max_weight_lbs !== undefined) patch.max_weight_lbs = attrs.max_weight_lbs;
        await service.from("gym_equipment").update(patch as never).eq("id", row.id);
      } else if (attrs.ensurePresent) {
        // Only create a new equipment row when an equipmentSet fact added the key.
        // An attr-only fact (e.g. squat count) without an accepted set never
        // fabricates a presence row.
        await service.from("gym_equipment").insert({
          gym_id: gymId,
          equipment_key: key as never,
          source: "owner",
          confidence: OWNER_CONF,
          quantity: attrs.quantity ?? null,
          max_weight_lbs: attrs.max_weight_lbs ?? null,
        } as never);
      }
    }
  }

  // Mark submission published + write the logs.
  await service
    .from("owner_submissions")
    .update({
      status: "published",
      reviewed_by: staff.userId,
      reviewed_at: new Date().toISOString(),
      review_note: body.reviewNote?.trim() || null,
    })
    .eq("id", id);

  if (factLog.length > 0) {
    const { error } = await service.from("owner_fact_log").insert(factLog);
    if (error) console.error("[owner_fact_log] insert failed:", error.message);
  }
  await logGymEdits(service, gymEdits);
  await logAudit(service, staff.userId, "owner_submission.publish", "owner_submissions", id, {
    gym_id: gymId,
    published: publishedCount,
    rejected: rejectedCount,
  });

  return NextResponse.json({ ok: true, published: publishedCount, rejected: rejectedCount });
}
